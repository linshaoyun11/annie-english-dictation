/**
 * 音频获取与缓存（多教材 + 口音版）—— 完全离线版
 *
 * 口音：美式（us）默认 / 英式（uk）
 *  - 美式：本地预生成音频 manifest.json → {id}.mp3（随包分发）
 *  - 英式：本地英音 manifest-uk.json → {id}-uk.mp3（随包分发）
 *  - 本地未命中（理论上已全覆盖）→ 返回 null，由调用方退回浏览器
 *    speechSynthesis 朗读。App 不发起任何网络请求，无需网络权限。
 *
 * 缓存策略（方案 A：内存根治）：
 *  - 只缓存"文本 → 音频 URL"映射（key = "{accent}:{text}"），
 *    同一发音整场会话只解析一次，避免重复网络/清单查询。
 *  - 不缓存 HTMLAudioElement 本身：<audio> 元素改为运行时按需创建，
 *    播放完/切题/停止时 releaseElement() 立即释放原生解码缓冲，
 *    不长期驻留。彻底消除"重点记忆长列表连续学习时 48 份解码缓冲常驻、
 *    逼近 iOS 内存上限导致卡死崩溃"的问题。
 *  - MAX_CACHE_ENTRIES 仅约束 URL 映射数量（字符串极省内存），
 *    不再是内存压力来源；解码缓冲随元素用完即放。
 */

import type { Accent } from "./users";

export interface AudioResult {
  url: string;
  source: "local";
}

/** 元素级缓存：key="{accent}:{小写文本}"，value=音频结果（含已加载元素） */
const audioCache = new Map<string, AudioResult>();
// URL 映射上限（仅字符串，极省内存）。元素不再驻留缓存，此上限无内存压力。
const MAX_CACHE_ENTRIES = 48;

/**
 * 释放音频元素的原生资源。
 * iOS WebKit 里仅解除 JS 引用并不会回收底层解码器/缓冲，
 * 必须清空 src 并 load() 才能让系统回收。
 */
export function releaseElement(el: HTMLAudioElement | undefined | null) {
  if (!el) return;
  try {
    el.pause();
    el.onended = null;
    el.onerror = null;
    el.removeAttribute("src");
    el.load();
  } catch {
    /* ignore */
  }
}

function cachePut(key: string, val: AudioResult) {
  // FIFO 淘汰：URL 映射极小，仅约束数量；value 只含 url，无 <audio> 元素，无需释放
  if (audioCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = audioCache.entries().next().value;
    if (oldest) audioCache.delete(oldest[0]);
  }
  audioCache.set(key, val);
}

/* ── 本地预生成音频（随包分发，零 API 依赖） ── */

let manifestPromise: Promise<Map<string, string> | null> | null = null;
let ukManifestPromise: Promise<Map<string, string> | null> | null = null;

/**
 * 加载本地音频清单（归一化文本 → 词条 id）。
 * 失败返回 null（manifest 为随包静态文件，正常不会失败）。
 * variant: "us" 加载 manifest.json（美音），"uk" 加载 manifest-uk.json（英音）。
 */
function ensureLocalManifest(
  variant: "us" | "uk" = "us"
): Promise<Map<string, string> | null> {
  const file = variant === "uk" ? "manifest-uk.json" : "manifest.json";
  if (variant === "uk" ? ukManifestPromise : manifestPromise) {
    return variant === "uk" ? ukManifestPromise! : manifestPromise!;
  }
  const p = fetch(`${import.meta.env.BASE_URL}audio/${file}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((obj: unknown) => {
      if (!obj || typeof obj !== "object") return null;
      return new Map(Object.entries(obj as Record<string, string>));
    })
    .catch(() => null);
  if (variant === "uk") ukManifestPromise = p;
  else manifestPromise = p;
  return p;
}

/** 命中本地音频（美音 {id}.mp3 / 英音 {id}-uk.mp3）→ 返回结果；未命中返回 null */
async function resolveLocalAudio(
  text: string,
  variant: "us" | "uk" = "us"
): Promise<AudioResult | null> {
  const manifest = await ensureLocalManifest(variant);
  if (!manifest) return null;
  const id = manifest.get(text.trim().toLowerCase());
  if (!id) return null;
  return {
    url: `${import.meta.env.BASE_URL}audio/${id}${
      variant === "uk" ? "-uk" : ""
    }.mp3`,
    source: "local",
  };
}

/**
 * 解析音频：只查本地清单，未命中返回 null
 * （由调用方退回浏览器 speechSynthesis 朗读）。
 */
export async function resolveAudio(
  text: string,
  accent: Accent = "us"
): Promise<AudioResult | null> {
  const cacheKey = `${accent}:${text.trim().toLowerCase()}`;
  const cached = audioCache.get(cacheKey);
  if (cached) return cached;

  let result: AudioResult | null = null;

  if (accent === "uk") {
    // 英式优先本地英音（随包分发 {id}-uk.mp3，离线可用）
    result = await resolveLocalAudio(text, "uk");
    // 本地英音缺失 → 本地美音应急
    if (!result) result = await resolveLocalAudio(text, "us");
  } else {
    result = await resolveLocalAudio(text, "us");
  }

  if (result) cachePut(cacheKey, result);
  return result;
}

/** 同步查询音频缓存（已预取的条目切题时可零等待直放） */
export function getCachedAudio(text: string, accent: Accent = "us"): AudioResult | null {
  return audioCache.get(`${accent}:${text.trim().toLowerCase()}`) ?? null;
}

/**
 * 创建音频元素并开始加载（每次播放按需新建，用完由调用方 releaseElement 释放）。
 * 元素不再回写缓存：<audio> 不长期驻留，解码缓冲随播放结束即时回收（方案 A）。
 */
export function createAudioElement(url: string): HTMLAudioElement {
  const el = new Audio();
  el.preload = "auto";
  el.src = url;
  return el;
}

/**
 * 预加载音频：临时 <audio> 元素加载，解码完成后立即释放（不长期驻留），
 * 使切题时新建 <audio> 走媒体缓存零网络延迟，同时避免解码缓冲常驻内存（方案 A）。
 */
export function prefetchAudio(
  text: string,
  accent: Accent = "us"
): void {
  const cacheKey = `${accent}:${text.trim().toLowerCase()}`;
  if (audioCache.has(cacheKey)) return;
  resolveAudio(text, accent)
    .then((r) => {
      if (!r) return;
      const el = createAudioElement(r.url);
      const cleanup = () => releaseElement(el);
      el.addEventListener("canplaythrough", cleanup, { once: true });
      el.addEventListener("error", cleanup, { once: true });
      // 兜底：弱网下 canplaythrough 可能不触发，2s 后强制释放，防止元素泄漏
      window.setTimeout(cleanup, 2000);
    })
    .catch(() => {});
}

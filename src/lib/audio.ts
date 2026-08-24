/**
 * 音频获取与缓存（多教材 + 口音版）—— 完全离线版
 *
 * 口音：美式（us）默认 / 英式（uk）
 *  - 美式：本地预生成音频 manifest.json → {id}.mp3（随包分发）
 *  - 英式：本地英音 manifest-uk.json → {id}-uk.mp3（随包分发）
 *  - 本地未命中（理论上已全覆盖）→ 返回 null，由调用方退回浏览器
 *    speechSynthesis 朗读。App 不发起任何网络请求，无需网络权限。
 *
 * 缓存策略：
 *  - 元素级缓存：key = "{accent}:{text}"，同一发音整场会话只加载一次，
 *    循环重读/切题复用内存中的元素，零重复请求。
 *  - 上限 MAX_CACHE_ENTRIES：超过后淘汰最旧条目，并主动释放其
 *    HTMLAudioElement 的原生解码资源（pause + 清 src + load()）。
 *    iOS WKWebView 中被丢弃但未释放的 <audio> 会持续占用原生内存，
 *    是"学习单元多了 App 变卡"的主要来源之一。
 */

import type { Accent } from "./users";

export interface AudioResult {
  url: string;
  source: "local";
  /** 已加载的元素（缓存命中后直接复用，避免重复下载） */
  el?: HTMLAudioElement;
}

/** 元素级缓存：key="{accent}:{小写文本}"，value=音频结果（含已加载元素） */
const audioCache = new Map<string, AudioResult>();
// 预取深度只有 3 题 + 当前 1 题，48 个元素已绰绰有余；
// 过大的缓存只会在淘汰前累积原生音频内存，得不偿失。
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
  // FIFO 淘汰：最旧条目出队时同步释放其元素的原生资源
  if (audioCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = audioCache.entries().next().value;
    if (oldest) {
      audioCache.delete(oldest[0]);
      releaseElement(oldest[1].el);
    }
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
 * 确保音频元素存在并开始加载（预取/播放共用）。
 * 元素会被回写到缓存的 AudioResult.el，后续直接复用。
 */
export function ensureElement(result: AudioResult): HTMLAudioElement {
  if (result.el) return result.el;
  const el = new Audio();
  el.preload = "auto";
  el.src = result.url;
  result.el = el;
  return el;
}

/** 预加载音频到缓存并提前下载（不播放，仅预热） */
export function prefetchAudio(
  text: string,
  accent: Accent = "us"
): void {
  const cacheKey = `${accent}:${text.trim().toLowerCase()}`;
  const cached = audioCache.get(cacheKey);
  if (cached && cached.el) return;
  resolveAudio(text, accent)
    .then((r) => {
      if (r) ensureElement(r);
    })
    .catch(() => {});
}

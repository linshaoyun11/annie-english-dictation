/**
 * 音频获取与缓存（多教材 + 口音版）
 *
 * 口音：美式（us）默认 / 英式（uk）
 *  - 美式：本地预生成音频（随包分发，有道美音）→ 有道 type=2 → 百度 TTS → 浏览器语音(en-US)
 *  - 英式：本地英音（{id}-uk.mp3，随包分发）→ 有道 type=1（英音，补充清单缺失）
 *          → 本地美音（离线应急）→ 有道 type=2 → 百度 TTS → 浏览器语音(en-GB)
 *
 * 缓存策略：
 *  - 元素级缓存：key = "{accent}:{text}"，同一发音整场会话只下载一次，
 *    循环重读/切题复用内存中的元素，零网络请求。
 *
 * 三套教材（人教/外研社/沪教牛津）词条音频全部随包分发（public/audio）：
 *  - manifest.json      文本 → id（美音，{id}.mp3）
 *  - manifest-uk.json   文本 → id（英音，{id}-uk.mp3，有道英音生成，词条不全时缺失项回退本地美音）
 * 完全离线可用，无运行时 API 依赖。
 */

import type { Accent } from "./users";

export interface AudioResult {
  url: string;
  source: "local" | "youdao" | "baidu";
  /** 已加载的元素（缓存命中后直接复用，避免重复下载） */
  el?: HTMLAudioElement;
}

/** 元素级缓存：key="{accent}:{小写文本}"，value=音频结果（含已加载元素） */
const audioCache = new Map<string, AudioResult>();
const MAX_CACHE_ENTRIES = 400;

function cachePut(key: string, val: AudioResult) {
  // 简单的 FIFO 淘汰，防止元素无限累积占内存
  if (audioCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = audioCache.keys().next().value;
    if (oldest !== undefined) audioCache.delete(oldest);
  }
  audioCache.set(key, val);
}

/* ── 本地预生成音频（方案 C：随包分发，有道美音，零 API 依赖） ── */

let manifestPromise: Promise<Map<string, string> | null> | null = null;
let ukManifestPromise: Promise<Map<string, string> | null> | null = null;

/**
 * 加载本地音频清单（归一化文本 → 词条 id）。
 * 失败返回 null 并缓存结果，不影响网络兜底链路。
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
 * 有道词典真人发音 URL。
 * 只保留 a-z 与空格（don't → dont、good-bye → goodbye，发音一致；
 * 保留空格使短语 good morning 仍按词发音，不会拼成 goodmorning）。
 * type=2 美音 / type=1 英音。
 */
function youdaoUrl(text: string, type: 1 | 2): string | null {
  const clean = text.toLowerCase().replace(/[^a-z ]/g, "").trim();
  if (!clean) return null;
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
    clean
  )}&type=${type}`;
}

/** 百度翻译 TTS（en 美音，短语/句子兜底，国内直连） */
function baiduUrl(text: string): string {
  return `https://fanyi.baidu.com/gettts?lan=en&text=${encodeURIComponent(
    text
  )}&spd=3&source=web`;
}

/* ── 各口音的候选链（依次尝试，第一个非空即为首选） ── */

function buildChain(
  text: string,
  accent: Accent
): Array<AudioResult | null> {
  if (accent === "uk") {
    const uk = youdaoUrl(text, 1);
    const us = youdaoUrl(text, 2);
    return [
      uk ? { url: uk, source: "youdao" } : null,
      us ? { url: us, source: "youdao" } : null,
      { url: baiduUrl(text), source: "baidu" },
    ];
  }
  // 美式：本地预生成与有道美音已由 resolveAudio 处理，兜底只需百度
  return [{ url: baiduUrl(text), source: "baidu" }];
}

/**
 * 解析音频：返回当前口音下的首选候选（不保证可用，失败由调用方
 * 通过 fallbackAudio 沿链路继续尝试）。结果写入缓存。
 */
export async function resolveAudio(
  text: string,
  accent: Accent = "us"
): Promise<AudioResult | null> {
  const cacheKey = `${accent}:${text.trim().toLowerCase()}`;
  const cached = audioCache.get(cacheKey);
  if (cached) return cached;

  let result: AudioResult | null = null;

  if (accent === "us") {
    // 美式优先本地预生成音频（随包分发，有道口音，发布后无 API 依赖）
    const local = await resolveLocalAudio(text, "us");
    if (local) result = local;
  } else {
    // 英式优先本地英音（随包分发 {id}-uk.mp3，离线可用）
    const localUk = await resolveLocalAudio(text, "uk");
    if (localUk) result = localUk;
    // 本地英音缺失（有道英音词条不全）→ 联网补有道英音 type=1
    if (!result) {
      const uk = youdaoUrl(text, 1);
      if (uk) result = { url: uk, source: "youdao" };
    }
    // 英音不可得 → 本地美音应急（离线可用）
    if (!result) {
      const localUs = await resolveLocalAudio(text, "us");
      if (localUs) result = localUs;
    }
    // 本地也没有 → 有道美音 type=2
    if (!result) {
      const us = youdaoUrl(text, 2);
      if (us) result = { url: us, source: "youdao" };
    }
  }

  if (!result) {
    // 有道无词条/无英音 → 百度 TTS 兜底
    result = { url: baiduUrl(text), source: "baidu" };
  }

  if (result) cachePut(cacheKey, result);
  return result;
}

/** 当前候选失败后的下一候选（跳过所有失败同源，避免死循环） */
export async function fallbackAudio(
  text: string,
  accent: Accent,
  fromSource: AudioResult["source"]
): Promise<AudioResult | null> {
  for (const cand of buildChain(text, accent)) {
    if (!cand) continue;
    if (cand.source === fromSource) continue; // 跳过失败源及其同源候选
    const cacheKey = `${accent}:${text.trim().toLowerCase()}`;
    // 若候选已解析过且来源不同，直接复用
    const cached = audioCache.get(cacheKey);
    if (cached && cached.source === cand.source) return cached;
    cachePut(cacheKey, cand);
    return cand;
  }
  // 链路耗尽：英式最后可用本地美音应急（离线可用）
  if (accent === "uk") {
    const local = await resolveLocalAudio(text, "us");
    if (local) {
      cachePut(`${accent}:${text.trim().toLowerCase()}`, local);
      return local;
    }
  }
  return null;
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

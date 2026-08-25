/**
 * Web Audio 统一播放层
 *
 * 目的：所有词条音频走同一条 AudioContext → GainNode → destination 路径，
 * 根治 iOS WKWebView 上「第一遍播放音量偏小、第二遍以后变大」的问题
 * （该问题源于 <audio> 元素首播走低增益路径，与播放内容无关）。
 *
 * 设计原则：绝不比现状更差 ——
 *  - 浏览器不支持 AudioContext / fetch 失败 / 解码失败 / resume 失败
 *    → 返回 started:false，调用方回落到原 HTMLAudioElement 路径；
 *  - 模块级 playToken：任何新的播放请求或 stop 都会使在途的旧请求作废，
 *    杜绝快速切题/重读时旧音频"迟到抢播"的竞态；
 *  - 一次只播一条：新播放开始前显式停掉上一条（onended 置空再 stop）。
 */

import { safeTimeout } from "./timer";

/* ── 共享 AudioContext ── */

let ctx: AudioContext | null = null;

/**
 * App 切后台后 iOS 会中断音频输出管线（来电/挂起/其他 App 抢占）。
 * 中断后 ctx.state 可能仍是 "running"（僵尸态：resume() 是 no-op、
 * BufferSource.start() 正常返回，但实际完全无声 —— build 30 真机实测
 * "后台唤醒后显示 WEB 却没声音"的根因）。
 * 切后台时置 true；下次用户手势内的 primeWebAudio / ensureWebAudioActive
 * 消费它：close 旧 ctx 并重建（手势内 new AudioContext 合法且必然有声）。
 */
let needsRebuild = false;

/**
 * 标记 AudioContext 可能已被系统中断。App 切后台
 * （visibilitychange → hidden）时调用。
 */
export function markAudioPossiblyDead(): void {
  needsRebuild = true;
}

/** safeTimeout 的 Promise 包装（iOS 时钟冻结后可被交互心跳补发自愈） */
function sleepSafe(ms: number): Promise<void> {
  return new Promise((resolve) => {
    safeTimeout(resolve, ms);
  });
}

type AudioContextCtor = typeof AudioContext;

/**
 * 获取共享 AudioContext。
 *
 * ⚠️ iOS 手势陷阱（build 23 失败的根因）：
 * 在用户手势之外 `new AudioContext()` 得到的是 suspended 状态的 context，
 * 之后即使在手势里调用 resume() 也可能"假成功"（Promise 正常返回但
 * state 仍是 suspended），导致 Web Audio 永远播不出声、静默回落到有
 * Bug 的 <audio> 路径。
 *
 * 因此：只有 primeWebAudio()（在真实点击事件处理器内被调用）允许
 * 创建 context；播放/解码路径一律只复用已存在的（create=false），
 * 不存在就返回 null 走 <audio> 兜底。
 */
function getAudioContext(create: boolean): AudioContext | null {
  if (ctx) return ctx;
  if (!create) return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const AC = w.AudioContext ?? w.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * 关闭并重建 AudioContext（必须只从用户手势内的调用链同步执行）。
 * 解决 iOS 中断后的"僵尸 running"：state 报告 running、resume() no-op、
 * start() 正常返回但完全无声 —— 唯一可靠的恢复方式是整体重建管线。
 * 旧 ctx 的解码缓存一并作废（AudioBuffer 与旧 ctx 生命周期绑定），
 * 之后各词条重新 fetch + decode（本地 capacitor:// 文件，毫秒级）。
 */
function recreateContext(): AudioContext | null {
  const old = ctx;
  ctx = null;
  bufferCache.clear();
  playedUrls.clear();
  pendingDecodes.clear(); // 旧 ctx 上的在途解码作废（close 后行为未定义）
  if (old) {
    try {
      void old.close().catch(() => {});
    } catch {
      /* ignore */
    }
  }
  const c = getAudioContext(true);
  if (!c) return null;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  return c;
}

/**
 * 用户手势内调用（真实点击事件处理器中同步调用，切勿在 useEffect 里调）：
 * 创建/恢复共享 AudioContext 并播放一段静音，激活音频输出。
 * 必须在手势栈内创建 context，否则 iOS 上永久 suspended（见上方注释）。
 *
 * 静音缓冲 2 秒：primeWebAudio 在 HomePage 点击手势内调用，之后 React
 * 渲染 LearnPage、LearningCard useEffect 调 startAudio → speech.start →
 * resolveAudio → playCurrent → playWebAudio，整个链条约 100-300ms。
 * 2 秒静音缓冲覆盖此窗口，保持 context "running" 不被 iOS 自动挂起。
 *
 * needsRebuild（切后台标记）：close 旧 ctx 重建 —— 后台唤醒后旧 ctx 是
 * "僵尸 running"（无声），重建是唯一可靠恢复手段。
 */
export function primeWebAudio(): void {
  if (needsRebuild) {
    needsRebuild = false;
    const c = recreateContext();
    if (c) playSilence(c);
    return;
  }
  const c = getAudioContext(true);
  if (!c) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  playSilence(c);
}

/**
 * 手势内幂等激活：ctx 已存在且 running 时零开销直接返回；
 * 不存在 / suspended 时创建或恢复并播放静音热身。
 *
 * 用途：任何首次 keydown/touchstart 都可安全调用——解决冷启动
 * App 直接恢复到学习页时 ctx 不存在（no-ctx 回落 Element）的问题。
 * needsRebuild（切后台标记）时即使 running 也强制重建（僵尸态恢复）。
 */
export function ensureWebAudioActive(): boolean {
  if (needsRebuild) {
    needsRebuild = false;
    const c = recreateContext();
    if (!c) return false;
    playSilence(c);
    return true;
  }
  const existing = getAudioContext(false);
  if (existing && (existing.state as string) === "running") return true;
  const c = getAudioContext(true);
  if (!c) return false;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  playSilence(c);
  return true;
}

function playSilence(c: AudioContext): void {
  try {
    const len = Math.max(1, Math.floor(c.sampleRate * 2));
    const buf = c.createBuffer(1, len, c.sampleRate);
    // 非零低幅噪声（不可闻）：纯零样本可能被 WebKit 判定为 idle 而不
    // 打开输出通路（与 primeOutput 同理）；非零样本确保管线真正激活
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.0005;
    }
    const gain = c.createGain();
    gain.gain.value = 1;
    gain.connect(c.destination);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    src.onended = () => {
      try {
        src.disconnect();
        gain.disconnect();
      } catch {
        /* ignore */
      }
    };
    src.start();
  } catch {
    /* ignore */
  }
}

/* ── 已解码缓冲缓存（url → AudioBuffer） ── */

const bufferCache = new Map<string, AudioBuffer>();
// 与 audio.ts 的元素缓存（48）同一量级；词条音频约 0.5~1s，
// 解码后 PCM 每条约 100~200KB，64 条约 10MB，安全。
const MAX_BUFFERS = 64;

/**
 * 已真正出声播放过的 url（首播预热用）。
 * 真机实测（build 30，纯 WebAudio 路径）：每题切词后的第一遍播放
 * 音量偏小、3 秒后循环重播的第二遍正常 —— 怀疑 WebKit 对静音期后的
 * 首次出声有输出管线重启渐强（idle 省电机制）。每个 url 首次播放前
 * 先播一段非零低幅噪声（见 primeOutput）预热输出通路。
 */
const playedUrls = new Set<string>();

/**
 * 输出通路预热：播放约 300ms 极低幅度（振幅 0.0005，约 -66dB，不可闻）
 * 的非零白噪声。
 * 旧 playSilence 播的是数字全零样本，WebKit 可能将纯零输出判定为
 * idle 而不真正打开输出通路 —— 所以它从未治好"首遍小声"。
 * 非零样本强制 WebKit 打开完整输出管线，随后的正式播放满增益起播。
 */
async function primeOutput(c: AudioContext, ms = 300): Promise<void> {
  try {
    const len = Math.max(1, Math.floor((c.sampleRate * ms) / 1000));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.0005;
    }
    await new Promise<void>((resolve) => {
      const src = c.createBufferSource();
      src.buffer = buf;
      const gain = c.createGain();
      gain.gain.value = 1;
      src.connect(gain);
      gain.connect(c.destination);
      src.onended = () => {
        try {
          src.disconnect();
          gain.disconnect();
        } catch {
          /* ignore */
        }
        resolve();
      };
      src.start();
    });
  } catch {
    /* 预热失败不阻塞正式播放 */
  }
}

/** 在途解码请求（url → Promise），避免同一文件并发重复解码 */
const pendingDecodes = new Map<string, Promise<BufferResult>>();

/** decodeAudioData 兼容包装：Promise 版优先，失败/异常一律 resolve(null) */
function decodeAudioData(
  c: AudioContext,
  arr: ArrayBuffer
): Promise<AudioBuffer | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (b: AudioBuffer | null) => {
      if (!settled) {
        settled = true;
        resolve(b);
      }
    };
    try {
      const p = c.decodeAudioData(arr, done, () => done(null));
      if (p && typeof p.then === "function") {
        p.then(done, () => done(null));
      }
    } catch {
      done(null);
    }
  });
}

/**
 * 剥离 MP3 开头的 ID3v2 标签。
 *
 * ⚠️ WebKit 已知坑（ELEMENT:DECODE 的根因，build 28 诊断确认）：
 * Safari / WKWebView 的 decodeAudioData 对带 ID3v2.4 标签的 MP3 解码失败
 * （本项目全部美音 mp3 由 ffmpeg Lavf 写入统一 45 字节 ID3v2.4 头）。
 * Chrome 容忍 ID3，桌面测不出来；剥掉标签后 WebKit 即可正常解码。
 * 英音文件实为 WAV 数据（RIFF 头），不含 ID3，原样返回。
 */
function stripId3(arr: ArrayBuffer): ArrayBuffer {
  if (arr.byteLength < 10) return arr;
  const head = new Uint8Array(arr, 0, 10);
  // "ID3" = 0x49 0x44 0x33
  if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return arr;
  // 标签长度为 syncsafe integer（每字节仅低 7 位有效），正文从 10 + size 开始
  const size =
    ((head[6] & 0x7f) << 21) |
    ((head[7] & 0x7f) << 14) |
    ((head[8] & 0x7f) << 7) |
    (head[9] & 0x7f);
  const start = 10 + size;
  if (start <= 10 || start >= arr.byteLength) return arr;
  return arr.slice(start);
}

/** 已解码缓冲取回结果：buf 为空时 fail 说明失败发生在哪个阶段 */
export interface BufferResult {
  buf: AudioBuffer | null;
  /**
   * fetch-fail = 取字节失败（fetch 与 XHR 兜底均失败，WKWebView
   *              capacitor:// 自定义协议上 fetch 有已知兼容问题）；
   * decode-fail = decodeAudioData 解码失败。
   * 两者的修复方向完全不同，诊断标签必须区分。
   */
  fail?: "fetch-fail" | "decode-fail";
}

/** XHR 取 ArrayBuffer：WKWebView 自定义协议（capacitor://）上 fetch
 *  可能失败而 XHR 正常，作为取字节的兜底通道 */
function xhrArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url);
      xhr.responseType = "arraybuffer";
      xhr.onload = () => {
        const okStatus = xhr.status === 200 || xhr.status === 0;
        const b = xhr.response;
        resolve(okStatus && b instanceof ArrayBuffer ? b : null);
      };
      xhr.onerror = () => resolve(null);
      xhr.onabort = () => resolve(null);
      xhr.ontimeout = () => resolve(null);
      xhr.send();
    } catch {
      resolve(null);
    }
  });
}

/** 取字节：fetch 优先，失败（抛异常 / 非 2xx / 空响应）回落 XHR */
async function fetchArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (res.ok) {
      const arr = await res.arrayBuffer();
      if (arr.byteLength > 0) return arr;
    }
  } catch {
    /* 落入 XHR 兜底 */
  }
  return xhrArrayBuffer(url);
}

/**
 * 取（或解码并缓存）指定 url 的 AudioBuffer。
 * 返回 { buf, fail }；并发调用共享同一次解码。
 */
export async function ensureBuffer(url: string): Promise<BufferResult> {
  const cached = bufferCache.get(url);
  if (cached) return { buf: cached };
  const inflight = pendingDecodes.get(url);
  if (inflight) return inflight;
  const p = (async (): Promise<BufferResult> => {
    try {
      // 只复用手势内创建的 context；不存在则失败走 <audio> 兜底
      const c = getAudioContext(false);
      if (!c) return { buf: null, fail: "decode-fail" };
      const arr = await fetchArrayBuffer(url);
      if (!arr || arr.byteLength === 0) return { buf: null, fail: "fetch-fail" };
      const buf = await decodeAudioData(c, stripId3(arr));
      if (buf) {
        if (bufferCache.size >= MAX_BUFFERS) {
          const oldest = bufferCache.keys().next().value;
          if (oldest !== undefined) bufferCache.delete(oldest);
        }
        bufferCache.set(url, buf);
        return { buf };
      }
      return { buf: null, fail: "decode-fail" };
    } catch {
      return { buf: null, fail: "fetch-fail" };
    } finally {
      pendingDecodes.delete(url);
    }
  })();
  pendingDecodes.set(url, p);
  return p;
}

/* ── 单例播放 ── */

let activeSource: AudioBufferSourceNode | null = null;
/** 播放令牌：每次新播放/停止自增，在途旧请求据此作废 */
let playToken = 0;

function detachActiveSource() {
  if (!activeSource) return;
  const s = activeSource;
  activeSource = null;
  try {
    s.onended = null;
    s.stop();
  } catch {
    /* 已停止/未 start 过，忽略 */
  }
}

/** 停止当前 Web Audio 播放；同时使所有在途的 playWebAudio 作废 */
export function stopWebAudio() {
  playToken++;
  detachActiveSource();
}

export interface WebAudioPlayResult {
  started: boolean;
  /** 成功起播时为音频时长（秒，未变速），失败为 0 */
  duration: number;
  /** 失败原因（诊断用），成功时为 undefined */
  failReason?:
    | "no-ctx"
    | "fetch-fail"
    | "decode-fail"
    | "not-running"
    | "superseded";
}

/** 便捷常量 */
function notStarted(reason: WebAudioPlayResult["failReason"]): WebAudioPlayResult {
  return { started: false, duration: 0, failReason: reason };
}

/**
 * 用 Web Audio 播放一条音频。
 * - 返回 started:true 表示已成功起播（随后通过 onEnded 通知自然播完）；
 * - 返回 started:false 表示不可用（调用方应回落 <audio> 元素路径），
 *   或已被更新的播放请求取代（调用方应直接放弃，不要回落！）。
 *
 * 注意：调用方拿到 started:false 后，需结合自身的"是否仍是最新一次播放"
 * 判断要不要回落，避免已被取代的旧请求又经元素路径冒出来。
 */
export async function playWebAudio(
  url: string,
  opts: { rate?: number; onEnded?: () => void } = {}
): Promise<WebAudioPlayResult> {
  const token = ++playToken;
  // 只复用手势内 primeWebAudio() 创建的 context；
  // 未创建（无手势入口）→ 直接回落 <audio> 路径，不在此处 new
  const c = getAudioContext(false);
  if (!c) return notStarted("no-ctx");

  // 自动播放策略：suspended 时先尝试恢复（此前有用户手势即可成功）
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      /* ignore */
    }
  }
  const { buf, fail } = await ensureBuffer(url);
  // 在途期间被新的播放/停止请求取代 → 放弃（不回落，交由最新请求接管）
  if (token !== playToken) return notStarted("superseded");
  if (!buf) return notStarted(fail ?? "decode-fail");
  if (c.state !== "running") {
    try {
      await c.resume();
    } catch {
      /* ignore */
    }
    if (token !== playToken) return notStarted("superseded");
    // resume() 可能已把状态改为 running，但类型系统不感知，重新读取
    if ((c.state as string) !== "running") return notStarted("not-running");
  }

  // 取代上一条正在播放的音频（不递增 token，本次调用自身仍有效）
  detachActiveSource();

  // 首播预热：该 url 第一次真正出声前，先播 300ms 不可闻的非零噪声
  // 打开 WebKit 输出管线（见 primeOutput 注释），再等 120ms 让管线稳定。
  // 每个 url 只预热一次；循环重播（第二遍起）零延迟零开销。
  if (!playedUrls.has(url)) {
    await primeOutput(c, 300);
    if (token !== playToken) return notStarted("superseded");
    await sleepSafe(120);
    if (token !== playToken) return notStarted("superseded");
  }

  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = opts.rate ?? 1;
  const gain = c.createGain();
  gain.gain.value = 1; // 统一增益：所有播放同一条路径，音量必然一致
  src.connect(gain);
  gain.connect(c.destination);

  try {
    src.start();
  } catch {
    src.onended = null;
    try {
      src.disconnect();
      gain.disconnect();
    } catch {
      /* ignore */
    }
    return notStarted("not-running");
  }
  playedUrls.add(url);
  activeSource = src;
  src.onended = () => {
    if (activeSource === src) activeSource = null;
    try {
      src.disconnect();
      gain.disconnect();
    } catch {
      /* ignore */
    }
    opts.onEnded?.();
  };
  return { started: true, duration: buf.duration };
}

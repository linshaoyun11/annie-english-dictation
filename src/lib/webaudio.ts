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

/* ── 共享 AudioContext ── */

let ctx: AudioContext | null = null;

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
 * 用户手势内调用（真实点击事件处理器中同步调用，切勿在 useEffect 里调）：
 * 创建/恢复共享 AudioContext 并播放一段静音，激活音频输出。
 * 必须在手势栈内创建 context，否则 iOS 上永久 suspended（见上方注释）。
 *
 * 静音缓冲 2 秒：primeWebAudio 在 HomePage 点击手势内调用，之后 React
 * 渲染 LearnPage、LearningCard useEffect 调 startAudio → speech.start →
 * resolveAudio → playCurrent → playWebAudio，整个链条约 100-300ms。
 * 2 秒静音缓冲覆盖此窗口，保持 context "running" 不被 iOS 自动挂起。
 */
export function primeWebAudio(): void {
  const c = getAudioContext(true);
  if (!c) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  try {
    const buf = c.createBuffer(
      1,
      Math.max(1, Math.floor(c.sampleRate * 2)),
      c.sampleRate
    );
    // 静音（全 0），无需写入数据
    const gain = c.createGain();
    gain.gain.value = 0.001; // 几乎不可闻
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

/** 在途解码请求（url → Promise），避免同一文件并发重复解码 */
const pendingDecodes = new Map<string, Promise<AudioBuffer | null>>();

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
 * 取（或解码并缓存）指定 url 的 AudioBuffer。
 * 任何失败返回 null；并发调用共享同一次解码。
 */
export async function ensureBuffer(url: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(url);
  if (cached) return cached;
  const inflight = pendingDecodes.get(url);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      // 只复用手势内创建的 context；不存在则解码失败走 <audio> 兜底
      const c = getAudioContext(false);
      if (!c) return null;
      const res = await fetch(url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      const buf = await decodeAudioData(c, arr);
      if (buf) {
        if (bufferCache.size >= MAX_BUFFERS) {
          const oldest = bufferCache.keys().next().value;
          if (oldest !== undefined) bufferCache.delete(oldest);
        }
        bufferCache.set(url, buf);
      }
      return buf;
    } catch {
      return null;
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
  failReason?: "no-ctx" | "decode-fail" | "not-running" | "superseded";
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
  const buf = await ensureBuffer(url);
  // 在途期间被新的播放/停止请求取代 → 放弃（不回落，交由最新请求接管）
  if (token !== playToken) return notStarted("superseded");
  if (!buf) return notStarted("decode-fail");
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

/* ── MediaElementSource 路径 ── */

/**
 * 已包装的元素集合。createMediaElementSource 是不可逆操作，
 * 同一元素只能包装一次，用 WeakSet 避免重复调用。
 */
const wrappedElements = new WeakSet<HTMLAudioElement>();

/**
 * 尝试将 <audio> 元素通过 Web Audio 路由到输出。
 *
 * 解决 iOS WKWebView <audio> 元素「第一遍播放音量偏小」问题：
 * 不依赖 fetch + decodeAudioData（可能因 MP3 无 Xing 头等原因失败），
 * 而是用元素原生解码 + Web Audio 统一增益路径。
 *
 * ⚠️ 一旦包装，元素音频只能通过 AudioContext 输出（不可逆）。
 * AudioContext suspended 时包装后的元素无声——但后台唤醒时
 * visibilitychange handler 已丢弃僵尸元素（item.el = undefined），
 * 新元素不会被包装直到 context 恢复 running。
 *
 * 返回 true = 元素音频走 Web Audio 路径（音量一致）
 * 返回 false = 元素直接播放（原生路径，可能有首遍音量问题）
 */
export function tryWrapElement(el: HTMLAudioElement): boolean {
  if (wrappedElements.has(el)) return true; // 已包装
  const c = getAudioContext(false);
  if (!c || (c.state as string) !== "running") return false;
  try {
    const src = c.createMediaElementSource(el);
    const gain = c.createGain();
    gain.gain.value = 1;
    src.connect(gain);
    gain.connect(c.destination);
    wrappedElements.add(el);
    return true;
  } catch {
    return false;
  }
}

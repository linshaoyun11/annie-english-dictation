import { useEffect, useRef } from "react";
import {
  createAudioElement,
  releaseElement,
  resolveAudio,
  type AudioResult,
} from "../lib/audio";
import { safeClearTimeout, safeTimeout } from "../lib/timer";
import type { Accent } from "../lib/users";

/* ── Web Speech 兜底：仅当音频解析彻底失败时使用 ── */

function scoreVoice(v: SpeechSynthesisVoice, accent: Accent): number {
  const name = v.name.toLowerCase();
  const lang = v.lang.toLowerCase();
  let score = 0;
  if (accent === "uk") {
    if (lang === "en-gb") score += 5;
    else if (lang.startsWith("en")) score += 2;
  } else {
    if (lang === "en-us") score += 5;
    else if (lang.startsWith("en")) score += 2;
  }
  if (name.includes("online")) score += 1;
  if (name.includes("natural")) score += 1;
  if (name.includes("local")) score -= 3;
  return score;
}

function pickBestVoice(accent: Accent): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const scored = voices
    .map((v) => ({ v, s: scoreVoice(v, accent) }))
    .sort((a, b) => b.s - a.s);
  return scored[0]?.v ?? null;
}

function ensureVoiceListener() {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.onvoiceschanged = () => {
    /* 语音列表异步加载，无需额外处理 */
  };
}

/* ── 模块级 generation 计数器 ── */
/* 不随组件卸载重置，确保旧实例的异步回调一定被丢弃 */
let activeGen = 0;

/** 短语拆词后单词间的停顿 */
const WORD_GAP_MS = 260;

/* ── 主循环 Hook ── */

/**
 * 单词循环朗读（iOS 直出版）。
 *
 * 播放一律走 <audio> 元素原生路径：WKWebView 内最稳定的方案
 * （后台唤醒有声、无手势限制）。音频文件缺失/损坏时退回浏览器
 * speechSynthesis 朗读。
 *
 * ── 「首遍音量偏小」的根因与对策 ──
 * 现象：**每个词的第一遍都小，同一元素立刻重播就正常**（不是只有冷
 * 启动那一次）。这说明问题不在 AVAudioSession 类别（那只会影响会话
 * 首次激活），而在于**音频硬件通路的冷启动**：
 *   词 A 播完 → 间隔 gapMs（默认 3s）→ 通路空闲回落 → 词 B 的
 *   play() 要重新拉起硬件通路 → 开头一小段落在未就位窗口 → 偏小；
 *   同一元素立刻重播时通路尚热 → 音量正常。
 * 对策：见文件末尾的「通路保温」（startAudioWarm / stopAudioWarm）。
 * 在两次朗读的间隔里持续播放一段 -96 dB 的静音，让通路始终处于
 * 已激活状态；真词开播前再停掉，两者零重叠（不混音、不 ducking）。
 *
 * 注意：iOS 上 HTMLMediaElement.volume 只读且恒为 1，JS 层没有任何
 * 音量杠杆——所以只能从"让通路别冷下来"这个方向解决，不要再去写
 * el.volume = x（空操作）。
 */
export function useSpeechLoop(gapMs = 3000) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);
  /** 回前台延迟重播的定时器（等 iOS 完成恢复过渡） */
  const resumeTimerRef = useRef<number | null>(null);
  const loopRef = useRef(true);
  /** 当前播放模式："audio"=本地/网络音频序列，"speech"=浏览器语音，null=停止 */
  const modeRef = useRef<"audio" | "speech" | null>(null);
  /** 播放列表：单词为 1 项；短语拆词后为多个单词音频，顺序循环播放 */
  const playlistRef = useRef<AudioResult[]>([]);
  const seqIdxRef = useRef(0);
  /** 连续播放失败计数：全部条目都失败时切换到浏览器语音，避免死循环 */
  const failCountRef = useRef(0);
  const textRef = useRef("");
  const accentRef = useRef<Accent>("us");
  const rateRef = useRef(0.9);
  const myGen = useRef(0);

  function clearTimer() {
    safeClearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function clearWatchdog() {
    safeClearTimeout(watchdogRef.current);
    watchdogRef.current = null;
  }

  function clearResumeTimer() {
    safeClearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = null;
  }

  function stopAll() {
    if (audioRef.current) {
      releaseElement(audioRef.current);
      audioRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function valid(gen: number) {
    return loopRef.current && gen === activeGen && gen === myGen.current;
  }

  /** Web Speech 兜底朗读（按口音选择 en-US / en-GB 语音） */
  function speakWebSpeech() {
    if (!("speechSynthesis" in window)) return;
    if (!loopRef.current || !textRef.current) return;
    if (myGen.current !== activeGen) return;
    // TTS 与 <audio> 走不同音量通道且会互相 duck，切语音前先停保温
    stopAudioWarm();
    modeRef.current = "speech";
    // 切到语音管线前释放遗留的音频元素（原生解码器实例一并回收）
    if (audioRef.current) {
      releaseElement(audioRef.current);
      audioRef.current = null;
    }
    clearTimer();
    ensureVoiceListener();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(textRef.current);
    u.lang = accentRef.current === "uk" ? "en-GB" : "en-US";
    u.rate = rateRef.current;
    const voice = pickBestVoice(accentRef.current);
    if (voice) u.voice = voice;
    u.onend = () => {
      if (valid(myGen.current)) {
        clearTimer();
        timerRef.current = safeTimeout(speakWebSpeech, gapMs);
      }
    };
    u.onerror = () => {
      if (valid(myGen.current)) {
        clearTimer();
        timerRef.current = safeTimeout(speakWebSpeech, gapMs);
      }
    };
    window.speechSynthesis.speak(u);
  }

  /**
   * 看门狗：iOS 上 <audio> 偶发 ended 事件不触发/播放静默卡死
   * （表现为"只播一次不循环"或"回前台后无声"）。
   * 播完后超时仍未进入下一轮则强制重播。
   */
  function startWatchdog(el: HTMLAudioElement, gen: number) {
    clearWatchdog();
    const dur =
      Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 3;
    const expected = (dur / Math.max(rateRef.current, 0.1)) * 1000 + 2500;
    watchdogRef.current = safeTimeout(() => {
      if (!valid(gen) || modeRef.current !== "audio") return;
      if (el.ended) return;
      // 两种卡死：paused（假播放）或进度停滞（state=playing 但
      // currentTime 没走到接近结尾——回前台后偶发的静默僵尸态）。
      // 到达预期结束时刻仍未 ended 且进度落后 → 从头重播。
      if (el.paused || el.currentTime < dur - 0.3) {
        // 卡死：强制换新元素从头重播（forceFresh——僵尸元素 play() 不报错
        // 但无声，复用它只会无限循环卡死）
        playCurrent(gen, true);
      }
    }, expected);
  }

  /** 当前条目播放完成 → 安排下一个（最后一个条目后等 gapMs 再整组重播）
   *  等待期间启动通路保温，避免下一个词的第一遍音量偏小。 */
  function scheduleNext(gen: number) {
    if (!valid(gen)) return;
    clearWatchdog();
    startAudioWarm();
    const isLast = seqIdxRef.current >= playlistRef.current.length - 1;
    if (isLast) {
      timerRef.current = safeTimeout(() => {
        seqIdxRef.current = 0;
        playCurrent(gen);
      }, gapMs);
    } else {
      timerRef.current = safeTimeout(() => {
        seqIdxRef.current += 1;
        playCurrent(gen);
      }, WORD_GAP_MS);
    }
  }

  /** 跳到下一个条目（错误路径：不等间隔，直接推进） */
  function advance(gen: number) {
    if (!valid(gen)) return;
    startAudioWarm();
    const isLast = seqIdxRef.current >= playlistRef.current.length - 1;
    seqIdxRef.current = isLast ? 0 : seqIdxRef.current + 1;
    clearTimer(); // 纳入 timerRef 管理，stop() 时可一并取消，防幽灵回调
    timerRef.current = safeTimeout(() => playCurrent(gen), WORD_GAP_MS);
  }

  /**
   * <audio> 元素直出播放（唯一音频路径）。
   *
   * 首遍音量偏小由外层 scheduleNext() 的通路保温解决（见文件末尾注释），
   * 这里不再做任何音量处理——iOS 上 volume 只读且恒为 1。
   *
   * 元素复用策略（方案 A'）：
   * - 同一词条循环重播时**复用当前元素**（currentTime 归零重播、不清缓冲）；
   * - 仅在换词条 / 后台恢复 / 看门狗解卡（forceFresh）/ 播放失败重试时新建。
   * 之前每轮重播都新建元素：iOS WKWebView 为每个 media 元素分配原生
   * 解码器/播放器实例且回收滞后，长会话累积数百个实例 → 内存压力持续
   * 增大 → "学习久了打字/跳题整体越来越卡"。复用后常驻解码缓冲恒为 1 份。
   */
  function playViaElement(gen: number, item: AudioResult, forceFresh = false) {
    const prev = audioRef.current;
    const reusable =
      !forceFresh &&
      !!prev &&
      prev.error === null &&
      (prev.ended || prev.paused) &&
      prev.getAttribute("src") === item.url;
    if (!reusable) {
      // 方案 A：换词条时新建 <audio> 元素，先释放上一题遗留元素，
      // 杜绝解码缓冲在长列表连续学习中累积（卡死崩溃根因）。
      if (prev) releaseElement(prev);
      audioRef.current = createAudioElement(item.url);
    }
    const el = audioRef.current!;
    // attemptNo：0=首播，1=80ms 快重试，2=600ms 慢重试。
    // 回前台瞬间 play() 可能落在音频会话未就绪窗口而 reject，
    // 递增延迟重试可躲开该窗口；两轮都失败才算条目失败。
    const attempt = (el: HTMLAudioElement, attemptNo: number) => {
      if (!valid(gen)) return;
      audioRef.current = el;
      el.onended = () => {
        if (valid(gen)) scheduleNext(gen);
      };
      el.onerror = () => {
        if (!valid(gen)) return;
        // 本地音频加载失败（文件损坏等）→ 跳到下一个条目；
        // 全部条目都失败 → 浏览器语音兜底
        failCountRef.current += 1;
        if (failCountRef.current > playlistRef.current.length + 1) {
          speakWebSpeech();
        } else {
          advance(gen);
        }
      };
      el.playbackRate = rateRef.current;
      // ⚠️ 不要写 el.volume：iOS 上 HTMLMediaElement.volume 只读、恒为 1。
      el.muted = false;
      // 复用元素重播：归零但不清缓冲（load() 会丢弃已解码数据，
      // 导致重播退回"首遍音量偏小"且多一次解码）。
      // 新元素 currentTime 本来就是 0，不触碰。
      if (el.ended || el.currentTime > 0) {
        el.currentTime = 0;
      }
      el.play()
        .then(() => {
          failCountRef.current = 0;
          startWatchdog(el, gen);
        })
        .catch(() => {
          if (!valid(gen)) return;
          if (attemptNo < 2) {
            // iOS 上元素可能进入死态/恢复初期会话未就绪 →
            // 换新元素递增延迟重试（80ms → 600ms）
            releaseElement(audioRef.current); // 旧元素原生资源必须显式释放
            const fresh = createAudioElement(item.url);
            audioRef.current = fresh;
            safeTimeout(
              () => attempt(fresh, attemptNo + 1),
              attemptNo === 0 ? 80 : 600
            );
          } else {
            failCountRef.current += 1;
            if (failCountRef.current > playlistRef.current.length + 1) {
              // 全部条目都播不出来 → 浏览器语音兜底
              speakWebSpeech();
            } else {
              advance(gen);
            }
          }
        });
    };

    attempt(el, 0);
  }

  /** 播放列表中的当前条目（<audio> 元素直出）。forceFresh=true 时强制换新元素（看门狗解卡）。 */
  function playCurrent(gen: number, forceFresh = false) {
    if (!valid(gen)) return;
    clearTimer();
    clearWatchdog();
    const item = playlistRef.current[seqIdxRef.current];
    if (!item) {
      speakWebSpeech();
      return;
    }
    modeRef.current = "audio";
    // 真词开播前停掉保温，保证全程只有一路媒体（不混音、不 ducking）
    stopAudioWarm();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    playViaElement(gen, item, forceFresh);
  }

  /** 开始循环朗读（本地/网络音频优先，失败退回浏览器语音） */
  function start(text: string, rate = 0.9, accent: Accent = "uk") {
    const gen = ++activeGen;
    myGen.current = gen;
    textRef.current = text;
    rateRef.current = rate;
    accentRef.current = accent;
    loopRef.current = true;
    failCountRef.current = 0;
    seqIdxRef.current = 0;
    modeRef.current = null;

    stopAll();
    clearTimer();
    clearWatchdog();
    // 解析音频期间先保温：给冷启动的第一遍留出通路拉起时间
    startAudioWarm();

    // 待播放文本列表：整条播放（短语/句子用整句音频，不拆词）
    const words = [text];

    let started = false;
    // 解析太慢（弱网网页版）→ 4s 后退回浏览器语音，避免长时间无声。
    // 不用更短的过渡语音：iOS 上 speechSynthesis 与 <audio> 音量通道不同，
    // 来回切换听感上就是"忽大忽小"。
    const fallbackTimer = safeTimeout(() => {
      if (!started && valid(gen)) speakWebSpeech();
    }, 4000);

    Promise.all(words.map((w) => resolveAudio(w, accent))).then((results) => {
      if (gen !== activeGen) return;
      started = true;
      safeClearTimeout(fallbackTimer);
      if (!valid(gen)) return;
      const list = results.filter((r): r is AudioResult => !!r);
      if (list.length > 0) {
        playlistRef.current = list;
        playCurrent(gen);
      } else {
        speakWebSpeech();
      }
    });
  }

  /** 立即重读一次（点击波浪图标）：整组从头播放 */
  function replayNow() {
    clearTimer();
    clearWatchdog();
    if (modeRef.current === "audio" && loopRef.current) {
      seqIdxRef.current = 0;
      playCurrent(myGen.current);
    } else if (textRef.current && loopRef.current) {
      start(textRef.current, rateRef.current, accentRef.current);
    }
  }

  function stop() {
    loopRef.current = false;
    modeRef.current = null;
    stopAudioWarm();
    clearResumeTimer();
    clearTimer();
    clearWatchdog();
    stopAll();
  }

  // 最新函数引用：给常驻 effect（visibilitychange / 看门狗）用，
  // 避免每次渲染重绑监听器，也避免闭包过期
  const fnsRef = useRef({ playCurrent, speakWebSpeech });
  fnsRef.current = { playCurrent, speakWebSpeech };

  /**
   * 前后台切换处理（iOS 直出版）：
   * - 切后台（hidden）：立即停止音频循环（AVAudioSession 为 playback 类别时
   *   iOS 不会自动暂停，必须显式停），并取消朗读与全部定时器。
   *   保留 loopRef=true，回前台后由 visible 分支恢复。
   * - 回前台（visible）：后台挂起后旧元素可能进入"僵尸"状态（play() 正常
   *   返回但完全无声，或 ended 永不触发）。回前台一律丢弃旧元素、
   *   新建元素从头重播，最可靠（元素播放无手势限制，可直接恢复）。
   *   ⚠️ 重播延迟 350ms：visibilitychange 触发时 iOS 尚在恢复过渡期，
   *   立即 play() 偶发落在音频会话未就绪窗口 → 播放失败/静默，
   *   等 webview 与 AVAudioSession 就绪后再重播可避开该窗口。
   */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        // 停止一切播放（不置 loopRef=false，回前台仍可恢复）
        clearResumeTimer();
        stopAll();
        stopAudioWarm();
        clearTimer();
        clearWatchdog();
        return;
      }
      if (!loopRef.current || myGen.current !== activeGen) return;
      if (modeRef.current === "audio") {
        // 回前台后强制重建元素（stopAll 已释放旧元素）
        clearResumeTimer();
        stopAll();
        clearTimer();
        clearWatchdog();
        // 350ms 恢复等待期保温，避免回前台后第一遍偏小
        startAudioWarm();
        if (playlistRef.current.length) {
          resumeTimerRef.current = safeTimeout(() => {
            // 恢复延迟期间可能又切后台/换题/停止 → 重新校验
            if (!loopRef.current || myGen.current !== activeGen) return;
            if (modeRef.current !== "audio") return;
            fnsRef.current.playCurrent(myGen.current);
          }, 350);
        }
      } else if (modeRef.current === "speech") {
        if ("speechSynthesis" in window) {
          // iOS 经典 BUG：后台恢复后 speechSynthesis 状态卡在
          // speaking=true 但实际无声。pause()+resume() 强制解卡。
          try {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } catch {
            /* ignore */
          }
          if (
            !window.speechSynthesis.speaking &&
            !window.speechSynthesis.pending
          ) {
            fnsRef.current.speakWebSpeech();
          }
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /**
   * 语音兜底看门狗：iOS speechSynthesis 短句 onend 偶发不触发导致卡死。
   * 每 3s 检查一次：处于语音模式且既不在朗读也无排队 → 重新启动朗读。
   * 用递归 safeTimeout 而非 setInterval：iOS 后台挂起会冻结 interval，
   * safeTimeout 的心跳补发机制可在唤醒后自愈。
   */
  useEffect(() => {
    let id: number | null = null;
    const tick = () => {
      id = safeTimeout(tick, 3000);
      if (!loopRef.current || myGen.current !== activeGen) return;
      if (modeRef.current !== "speech") return;
      if (!("speechSynthesis" in window)) return;
      if (
        !window.speechSynthesis.speaking &&
        !window.speechSynthesis.pending
      ) {
        fnsRef.current.speakWebSpeech();
      }
    };
    id = safeTimeout(tick, 3000);
    return () => safeClearTimeout(id);
  }, []);

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { start, stop, replayNow };
}

/* ═══ 音频通路保温（解决「每个词第一遍音量偏小」） ═══
 *
 * 原理：iOS 的音频硬件通路在最后一个媒体停止后会空闲回落，下一次
 * play() 需要重新拉起通路，开头那一段就落在"未就位窗口"里而偏小。
 * 本模块在两次朗读的间隔里循环播放一段 -96 dB 的静音（public/silence.wav，
 * 48 kHz / mono，与主流词条音频同规格），让通路始终保持已激活状态。
 *
 * 关键设计：
 * 1. 必须是**真实有音频帧、有 duration** 的片段。之前用的是 data 段
 *    长度为 0 的 WAV（0 个采样点、duration=0），WebKit 根本不会为它
 *    建立音频输出 → 完全没起到保温作用。
 * 2. 内容用 ±1 LSB（≈ -96 dBFS）而不是纯 0：纯静音帧有可能被当作
 *    "无音频输出"从而不激活会话；±1 LSB 是确定非零的信号，但任何
 *    设备都听不见。
 * 3. **不能用 muted = true**：muted 会让 WebKit 认为该元素无音频输出，
 *    同样不会激活通路。同理 iOS 上 volume 只读（恒为 1），设 volume=0
 *    是空操作。
 * 4. 真词开播前会 stopAudioWarm()，两者零重叠：既不混音，也不会出现
 *    两路媒体互相 ducking。
 */

/** 全局唯一保温元素（常驻复用，不产生实例累积） */
let warmEl: HTMLAudioElement | null = null;
/**
 * 空闲自动停止：每次 startAudioWarm() 都续期，超过该时长没有续期
 * 就自动停。这样首页等场景调 primeSpeech() 只是"解锁 + 短暂保温"，
 * 不会让静音无限期常驻占用音频通路（学习页里每轮间隔都会续期，
 * 所以整段学习期间是持续保温的）。
 */
const WARM_IDLE_MS = 8000;
let warmStopTimer: number | null = null;

function getWarmEl(): HTMLAudioElement | null {
  if (warmEl) return warmEl;
  try {
    const el = new Audio();
    el.preload = "auto";
    el.loop = true;
    el.src = `${import.meta.env.BASE_URL}silence.wav`;
    warmEl = el;
  } catch {
    return null;
  }
  return warmEl;
}

/**
 * 开始保温：在朗读间隔期间持续播放静音，保持硬件通路处于已激活状态。
 * 幂等，可重复调用（每次调用都会续期）。
 */
export function startAudioWarm() {
  const el = getWarmEl();
  if (!el) return;
  if (warmStopTimer !== null) clearTimeout(warmStopTimer);
  warmStopTimer = window.setTimeout(() => {
    warmStopTimer = null;
    stopAudioWarm();
  }, WARM_IDLE_MS);
  if (!el.paused) return;
  try {
    if (el.ended || el.currentTime > 0) el.currentTime = 0;
    el.play().catch(() => {
      /* 无手势 / 后台等场景会被拒绝，忽略即可，后续仍会自动重试 */
    });
  } catch {
    /* ignore */
  }
}

/** 停止保温：真词开播前调用，避免两路媒体重叠。 */
export function stopAudioWarm() {
  if (warmStopTimer !== null) {
    clearTimeout(warmStopTimer);
    warmStopTimer = null;
  }
  if (!warmEl) return;
  try {
    warmEl.pause();
  } catch {
    /* ignore */
  }
}

/**
 * 预热（用户手势触发，解锁音频播放权限并激活 iOS 音频会话）。
 *
 * 历史实现有两点问题，均已修正：
 * - 用的是 0 帧 WAV（duration=0），等于什么都没预热；
 * - 末尾调用 speechSynthesis.speak(" ")：iOS 的 TTS 跑在 App 进程，
 *   而 WKWebView 是独立进程、有自己的 AVAudioSession，App 侧 TTS
 *   激活时**被 duck 的正是 WebView 里的 <audio>**——它不但没用，
 *   还是首遍音量偏小的加害项之一。
 */
export function primeSpeech() {
  ensureVoiceListener();
  startAudioWarm();
}

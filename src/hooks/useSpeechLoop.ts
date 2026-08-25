import { useEffect, useRef } from "react";
import {
  ensureElement,
  releaseElement,
  resolveAudio,
  type AudioResult,
} from "../lib/audio";
import {
  ensureWebAudioActive,
  playWebAudio,
  stopWebAudio,
} from "../lib/webaudio";
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
 * 实际播放路径（诊断用）：
 * - "web" = Web Audio BufferSource（统一增益，音量必然一致）
 * - "element" / "element:no-ctx" / "element:fetch-fail" / "element:decode-fail"
 *   / "element:not-running"
 *   = <audio> 元素直出（带 Web Audio 失败原因；原生路径可能首遍音量偏小）
 *   FETCH-FAIL = 取字节失败（capacitor:// 上 fetch 兼容问题，XHR 兜底也失败）
 *   DECODE-FAIL = decodeAudioData 解码失败
 * - "speech" = 浏览器语音
 * - "waiting" = 后台唤醒后等待首次用户交互
 */
export type PlayPath =
  | "web"
  | "element"
  | "element:no-ctx"
  | "element:fetch-fail"
  | "element:decode-fail"
  | "element:decode"
  | "element:not-running"
  | "speech"
  | "waiting";

export function useSpeechLoop(
  gapMs = 3000,
  onPlayPath?: (path: PlayPath) => void
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const loopRef = useRef(true);
  /** 当前播放模式："audio"=本地/网络音频序列，"speech"=浏览器语音，null=停止 */
  const modeRef = useRef<"audio" | "speech" | null>(null);
  /** 播放路径回调（存 ref，避免调用方传新函数导致行为变化） */
  const onPlayPathRef = useRef(onPlayPath);
  onPlayPathRef.current = onPlayPath;
  /** 播放列表：单词为 1 项；短语拆词后为多个单词音频，顺序循环播放 */
  const playlistRef = useRef<AudioResult[]>([]);
  const seqIdxRef = useRef(0);
  /** 连续播放失败计数：全部条目都失败时切换到浏览器语音，避免死循环 */
  const failCountRef = useRef(0);
  const textRef = useRef("");
  const accentRef = useRef<Accent>("us");
  const rateRef = useRef(0.9);
  const myGen = useRef(0);
  /**
   * 播放序号：每次 playCurrent 自增。Web Audio 起播是异步的（fetch+解码），
   * 期间用户可能切题/点重读触发新的播放 —— 旧请求回来后据此判断自己
   * 是否仍是最新一次播放，是才继续（起播或回落），否则直接丢弃。
   */
  const playSeqRef = useRef(0);
  /**
   * 前台恢复后标记需要重启音频。
   * visibilitychange→visible 不是用户手势，iOS 不允许在此 resume AudioContext。
   * 设标记后等首次 keydown/touchstart（= 用户手势）时 primeWebAudio() + 重播。
   */
  const needsAudioRestoreRef = useRef(false);

  function clearTimer() {
    safeClearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function clearWatchdog() {
    safeClearTimeout(watchdogRef.current);
    watchdogRef.current = null;
  }

  function stopAll() {
    if (audioRef.current) {
      const el = audioRef.current;
      el.pause();
      el.onended = null;
      el.onerror = null;
      audioRef.current = null;
    }
    stopWebAudio();
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
    modeRef.current = "speech";
    onPlayPathRef.current?.("speech");
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
   * （表现为"只播一次不循环"）。播完后超时仍未进入下一轮则强制重播。
   */
  function startWatchdog(el: HTMLAudioElement, gen: number) {
    clearWatchdog();
    const dur =
      Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 3;
    const expected = (dur / Math.max(rateRef.current, 0.1)) * 1000 + 2500;
    watchdogRef.current = safeTimeout(() => {
      if (!valid(gen) || modeRef.current !== "audio") return;
      if (el.paused && !el.ended) {
        playCurrent(gen); // 卡死：从头重播当前条目
      }
    }, expected);
  }

  /**
   * 看门狗（Web Audio 路径）：BufferSource 的 onended 偶发不触发时兜底。
   * 播放时长（按变速折算）+ 2.5s 后仍未安排下一轮（timerRef 为空）
   * 则从头重播当前条目。onended 正常触发时 scheduleNext 会设置定时器
   * 并清除本看门狗，不会误伤。
   */
  function startWatchdogMs(ms: number, gen: number) {
    clearWatchdog();
    watchdogRef.current = safeTimeout(() => {
      if (!valid(gen) || modeRef.current !== "audio") return;
      if (timerRef.current === null) {
        playCurrent(gen); // 卡死：从头重播当前条目
      }
    }, ms);
  }

  /** 当前条目播放完成 → 安排下一个（最后一个条目后等 gapMs 再整组重播） */
  function scheduleNext(gen: number) {
    if (!valid(gen)) return;
    clearWatchdog();
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
    const isLast = seqIdxRef.current >= playlistRef.current.length - 1;
    seqIdxRef.current = isLast ? 0 : seqIdxRef.current + 1;
    safeTimeout(() => playCurrent(gen), WORD_GAP_MS);
  }

  /**
   * <audio> 元素播放路径（Web Audio 不可用时的兜底，逻辑与旧版完全一致）。
   * failReason：Web Audio 失败原因（诊断显示用，如 "no-ctx"）。
   *
   * ⚠️ 不做 createMediaElementSource 包装（build 27 教训）：包装不可逆，
   * AudioContext 之后 suspend 时（iOS 后台唤醒音频会话被中断很常见）
   * 元素完全无声——比首遍音量偏小严重得多。且包装只是路由，元素内部
   * 解码增益低（WebKit bug）依旧，音量问题实际也没修复。
   */
  function playViaElement(
    gen: number,
    item: AudioResult,
    failReason?: string
  ) {
    const attempt = (el: HTMLAudioElement, isRetry: boolean) => {
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
      el.volume = 1;
      el.muted = false;
      // 元素直出（原生路径）：有声，但首遍音量可能偏小（WebKit bug，无法在此修复）
      onPlayPathRef.current?.(
        (failReason ? ("element:" + failReason) as PlayPath : "element")
      );
      // 复用过的元素只在确实播放过（有进度/已结束）时才 load() 彻底重置：
      // 1) 不做 currentTime=0 的 seek——Edge TTS 生成的 mp3 无 Xing/Info 头，
      //    WebKit 里 duration=Infinity，seek(0) 会跳到接近结尾（"短促尾音"元凶）；
      // 2) 预取刚加载完（readyState>0 但未播过）的元素不 load()，
      //    保留已缓冲的数据——load() 会丢弃缓冲导致首遍播放音量偏小。
      if (el.currentTime > 0 || el.ended) {
        el.load();
      }
      el.play()
        .then(() => {
          failCountRef.current = 0;
          startWatchdog(el, gen);
        })
        .catch(() => {
          if (!valid(gen)) return;
          // iOS 上复用的旧元素 ended 后可能进入死态 → 换新元素重试一次
          if (!isRetry) {
            releaseElement(item.el); // 旧元素原生资源必须显式释放
            const fresh = new Audio();
            fresh.preload = "auto";
            fresh.src = item.url;
            item.el = fresh;
            safeTimeout(() => attempt(fresh, true), 80);
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

    attempt(ensureElement(item), false);
  }

  /**
   * 播放列表中的当前条目。
   * 首选 Web Audio：所有播放走同一条 AudioContext→GainNode 路径，
   * 根治 iOS「第一遍音量小、后续变大」。不可用时回落 <audio> 元素
   * 路径（与旧版行为一致）。
   */
  function playCurrent(gen: number) {
    if (!valid(gen)) return;
    clearTimer();
    clearWatchdog();
    const item = playlistRef.current[seqIdxRef.current];
    if (!item) {
      speakWebSpeech();
      return;
    }
    modeRef.current = "audio";
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    stopWebAudio(); // 停掉上一条（并使在途的旧播放请求作废）
    const seq = ++playSeqRef.current;

    playWebAudio(item.url, {
      rate: rateRef.current,
      onEnded: () => {
        if (valid(gen)) scheduleNext(gen);
      },
    }).then((r) => {
      // 起播是异步的：期间若已切题/重读（seq 变化）或已停止，直接丢弃
      if (!valid(gen) || seq !== playSeqRef.current) return;
      if (r.started) {
        failCountRef.current = 0;
        onPlayPathRef.current?.("web");
        startWatchdogMs(
          (r.duration / Math.max(rateRef.current, 0.1)) * 1000 + 2500,
          gen
        );
      } else {
        // 诊断：Web Audio 失败原因（no-ctx/decode-fail/not-running/superseded）
        if (r.failReason) {
          console.warn("[useSpeechLoop] Web Audio fallback:", r.failReason);
        }
        playViaElement(gen, item, r.failReason);
      }
    });
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
    clearTimer();
    clearWatchdog();
    stopAll();
  }

  // 最新函数引用：给常驻 effect（visibilitychange / 看门狗）用，
  // 避免每次渲染重绑监听器，也避免闭包过期
  const fnsRef = useRef({ playCurrent, speakWebSpeech });
  fnsRef.current = { playCurrent, speakWebSpeech };

  /**
   * 前后台切换处理：
   * - 切后台（hidden）：立即停止音频循环（AVAudioSession 为 playback 类别时
   *   iOS 不会自动暂停，必须显式停），并取消朗读与全部定时器。
   *   保留 loopRef=true，回前台后由 visible 分支恢复。
   * - 回前台（visible）：iOS 切后台会冻结 AudioContext（suspended），
   *   visibilitychange 不是用户手势事件，此时 resume() 会"假成功"（Promise
   *   正常返回但 state 仍 suspended）。旧方案用 safeTimeout(500ms) 延迟恢复，
   *   但 safeTimeout 本身也是 JS 定时器，后台冻结后需等用户交互才被心跳补发，
   *   且补发时 AudioContext.resume() 仍不在用户手势内 → 可能假成功。
   *
   *   新方案：回前台只设 needsAudioRestoreRef=true，不尝试恢复音频。
   *   等用户首次 keydown/touchstart（= iOS 要求的 user gesture）时，
   *   在手势内同步 primeWebAudio()（resume AudioContext + 播放静音激活输出）
   *   再重启播放循环。用户输入第一个字母时音频自动恢复，体验自然。
   */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        // 切后台：停止一切播放（不置 loopRef=false，回前台仍可恢复）
        needsAudioRestoreRef.current = false;
        stopAll();
        clearTimer();
        clearWatchdog();
        return;
      }
      if (!loopRef.current || myGen.current !== activeGen) return;
      if (modeRef.current === null) return;
      // 标记需要恢复：等首次用户交互（手势）时恢复音频 + 重启播放
      needsAudioRestoreRef.current = true;
      onPlayPathRef.current?.("waiting"); // 诊断：显示等待交互
      // 丢弃僵尸 <audio> 元素，回前台后强制重建
      const item = playlistRef.current[seqIdxRef.current];
      if (item && item.el) item.el = undefined;
      // 停掉旧播放（Web Audio / speech），清定时器
      // 不在此处调 playCurrent —— 非用户手势，AudioContext.resume 会假成功
      stopAll();
      clearTimer();
      clearWatchdog();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /**
   * 首次交互恢复音频：
   * 1. ensureWebAudioActive()：任何交互都幂等激活 Web Audio（ctx 不存在/
   *    suspended 时在手势内创建/resume + 静音热身，running 时零开销）
   * 2. 若 visibilitychange→visible 设了 needsAudioRestoreRef：重启播放循环
   *    （audio 模式 → playCurrent，speech 模式 → speakWebSpeech）
   *
   * 捕获阶段 + passive：不阻止其他 keydown 监听器（含 SpellingInput 等），
   * 且比 timer.ts 的心跳更早执行（同为 capture，按注册顺序）。
   */
  useEffect(() => {
    const onFirstInteract = () => {
      // 无条件幂等激活（手势内）：冷启动 App 直接恢复到学习页时没经过
      // HomePage 的点击手势，ctx 不存在 → 首播 no-ctx 回落 Element
      // （"先 Element 后 WebAudio"的根因）。此处已 running 时零开销。
      ensureWebAudioActive();
      if (!needsAudioRestoreRef.current) return;
      needsAudioRestoreRef.current = false;
      if (!loopRef.current || myGen.current !== activeGen) return;
      if (modeRef.current === "audio") {
        // ctx 已在上面的 ensureWebAudioActive() 里激活，直接重播
        if (playlistRef.current.length) {
          fnsRef.current.playCurrent(myGen.current);
        }
      } else if (modeRef.current === "speech") {
        if (
          "speechSynthesis" in window &&
          !window.speechSynthesis.speaking &&
          !window.speechSynthesis.pending
        ) {
          fnsRef.current.speakWebSpeech();
        }
      }
    };
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    document.addEventListener("keydown", onFirstInteract, opts);
    document.addEventListener("touchstart", onFirstInteract, opts);
    return () => {
      document.removeEventListener("keydown", onFirstInteract, opts);
      document.removeEventListener("touchstart", onFirstInteract, opts);
    };
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

/** 预热（用户手势触发，解锁音频播放权限并激活 iOS 音频会话） */
export function primeSpeech() {
  ensureVoiceListener();
  // 1) 播放一段静音 Audio 解锁自动播放策略
  try {
    const a = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
    );
    a.volume = 0;
    a.play().catch(() => {});
  } catch {
    /* ignore */
  }

  // 2) Web Audio 预热不在 primeSpeech 里做！
  //    primeSpeech 会在 App 启动的 useEffect（无用户手势）中被调用，
  //    此时 new AudioContext() 会得到永久 suspended 的 context（iOS
  //    手势陷阱，build 23 失败根因），之后手势里 resume() 也可能假成功。
  //    AudioContext 只能由手势事件处理器里调用的 primeWebAudio() 创建，
  //    见 src/lib/webaudio.ts。

  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    window.speechSynthesis.cancel();
  }
}

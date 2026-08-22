import { useEffect, useRef } from "react";
import {
  ensureElement,
  fallbackAudio,
  resolveAudio,
  type AudioResult,
} from "../lib/audio";
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

export function useSpeechLoop(gapMs = 3000) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);
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
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function clearWatchdog() {
    if (watchdogRef.current) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }

  function stopAll() {
    if (audioRef.current) {
      const el = audioRef.current;
      el.pause();
      el.onended = null;
      el.onerror = null;
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
    modeRef.current = "speech";
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
        timerRef.current = window.setTimeout(speakWebSpeech, gapMs);
      }
    };
    u.onerror = () => {
      if (valid(myGen.current)) {
        clearTimer();
        timerRef.current = window.setTimeout(speakWebSpeech, gapMs);
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
    watchdogRef.current = window.setTimeout(() => {
      if (!valid(gen) || modeRef.current !== "audio") return;
      if (el.paused && !el.ended) {
        playCurrent(gen); // 卡死：从头重播当前条目
      }
    }, expected);
  }

  /** 当前条目播放完成 → 安排下一个（最后一个条目后等 gapMs 再整组重播） */
  function scheduleNext(gen: number) {
    if (!valid(gen)) return;
    clearWatchdog();
    const isLast = seqIdxRef.current >= playlistRef.current.length - 1;
    if (isLast) {
      timerRef.current = window.setTimeout(() => {
        seqIdxRef.current = 0;
        playCurrent(gen);
      }, gapMs);
    } else {
      timerRef.current = window.setTimeout(() => {
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
    window.setTimeout(() => playCurrent(gen), WORD_GAP_MS);
  }

  /** 播放列表中的当前条目（带失败重试：换新元素再试一次） */
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

    const attempt = (el: HTMLAudioElement, isRetry: boolean) => {
      if (!valid(gen)) return;
      audioRef.current = el;
      el.onended = () => {
        if (valid(gen)) scheduleNext(gen);
      };
      el.onerror = () => {
        if (!valid(gen)) return;
        // 当前源加载失败 → 沿候选链换源；链路耗尽 → 跳到下一个单词
        fallbackAudio(textRef.current, accentRef.current, item.source).then(
          (r) => {
            if (!valid(gen)) return;
            if (r) {
              playlistRef.current[seqIdxRef.current] = r;
              playCurrent(gen);
            } else {
              advance(gen);
            }
          }
        );
      };
      el.playbackRate = rateRef.current;
      el.currentTime = 0;
      el.play()
        .then(() => {
          failCountRef.current = 0;
          startWatchdog(el, gen);
        })
        .catch(() => {
          if (!valid(gen)) return;
          // iOS 上复用的旧元素 ended 后可能进入死态 → 换新元素重试一次
          if (!isRetry) {
            const fresh = new Audio();
            fresh.preload = "auto";
            fresh.src = item.url;
            item.el = fresh;
            window.setTimeout(() => attempt(fresh, true), 80);
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

  /** 开始循环朗读（本地/网络音频优先，失败退回浏览器语音） */
  function start(text: string, rate = 0.9, accent: Accent = "us") {
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
    const fallbackTimer = window.setTimeout(() => {
      if (!started && valid(gen)) speakWebSpeech();
    }, 4000);

    Promise.all(words.map((w) => resolveAudio(w, accent))).then((results) => {
      if (gen !== activeGen) return;
      started = true;
      window.clearTimeout(fallbackTimer);
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
   * 回前台恢复：iOS 切后台会暂停音频并冻结定时器，
   * 回前台后没人重启循环（表现：放后台回来就不循环了），这里主动恢复。
   */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!loopRef.current || myGen.current !== activeGen) return;
      if (modeRef.current === "audio") {
        const el = audioRef.current;
        if (el && el.paused && !timerRef.current) {
          fnsRef.current.playCurrent(myGen.current);
        } else if (!el && !timerRef.current && playlistRef.current.length) {
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
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /**
   * 语音兜底看门狗：iOS speechSynthesis 短句 onend 偶发不触发导致卡死。
   * 每 3s 检查一次：处于语音模式且既不在朗读也无排队 → 重新启动朗读。
   */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!loopRef.current || myGen.current !== activeGen) return;
      if (modeRef.current !== "speech") return;
      if (!("speechSynthesis" in window)) return;
      if (
        !window.speechSynthesis.speaking &&
        !window.speechSynthesis.pending
      ) {
        fnsRef.current.speakWebSpeech();
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { start, stop, replayNow };
}

/** 预热（用户手势触发，解锁音频播放权限） */
export function primeSpeech() {
  ensureVoiceListener();
  // 播放一段静音 Audio 解锁自动播放策略
  try {
    const a = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
    );
    a.volume = 0;
    a.play().catch(() => {});
  } catch {
    /* ignore */
  }
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    window.speechSynthesis.cancel();
  }
}

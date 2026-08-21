import { useCallback, useEffect, useRef } from "react";
import {
  ensureElement,
  fallbackAudio,
  getCachedAudio,
  resolveAudio,
  type AudioResult,
} from "../lib/audio";
import type { Accent } from "../lib/users";

/* ── Web Speech 兜底：仅当音频代理不可用时使用 ── */

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

/* ── 主循环 Hook ── */

export function useSpeechLoop(gapMs = 3000) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const loopRef = useRef(true);
  const textRef = useRef("");
  const accentRef = useRef<Accent>("us");
  const rateRef = useRef(0.9);
  const myGen = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  /** Web Speech 兜底朗读（按口音选择 en-US / en-GB 语音） */
  const speakWebSpeech = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    if (!loopRef.current || !textRef.current) return;
    if (myGen.current !== activeGen) return;
    ensureVoiceListener();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(textRef.current);
    u.lang = accentRef.current === "uk" ? "en-GB" : "en-US";
    u.rate = rateRef.current;
    const voice = pickBestVoice(accentRef.current);
    if (voice) u.voice = voice;
    u.onend = () => {
      if (loopRef.current && myGen.current === activeGen) {
        clearTimer();
        timerRef.current = window.setTimeout(speakWebSpeech, gapMs);
      }
    };
    u.onerror = () => {
      if (loopRef.current && myGen.current === activeGen) {
        clearTimer();
        timerRef.current = window.setTimeout(speakWebSpeech, gapMs);
      }
    };
    window.speechSynthesis.speak(u);
  }, [gapMs, clearTimer]);

  /** 播放一次 Audio 元素 */
  const playOnce = useCallback(() => {
    if (!loopRef.current || !textRef.current) return;
    if (myGen.current !== activeGen) return;
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.playbackRate = rateRef.current;
      audio.play().catch(() => speakWebSpeech());
    } else {
      speakWebSpeech();
    }
  }, [speakWebSpeech]);

  /**
   * 挂载高质量音频并进入循环。
   * 关键点：复用缓存的 Audio 元素 —— 同一个单词只下载一次，
   * 之后循环重读/切回都从内存播放，不再产生网络请求。
   */
  const attachCached = useCallback(
    (result: AudioResult, gen: number) => {
      if (gen !== activeGen || !loopRef.current) return;

      // 停掉过渡用的浏览器语音
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      clearTimer();

      const el = ensureElement(result);
      el.playbackRate = rateRef.current;
      el.onended = () => {
        if (loopRef.current && gen === activeGen) {
          clearTimer();
          timerRef.current = window.setTimeout(playOnce, gapMs);
        }
      };

      const safePlay = () => {
        if (gen !== activeGen || !loopRef.current) return;
        audioRef.current = el;
        el.currentTime = 0;
        el.play().catch(() => {
          if (gen === activeGen && loopRef.current) speakWebSpeech();
        });
      };

      // 加载失败：沿候选链换下一源重试；链路耗尽 → 浏览器语音
      const onError = () => {
        if (gen !== activeGen || !loopRef.current) return;
        fallbackAudio(textRef.current, accentRef.current, result.source).then(
          (r) => {
            if (r && gen === activeGen && loopRef.current) attachCached(r, gen);
            else if (gen === activeGen && loopRef.current) speakWebSpeech();
          }
        );
      };

      const onCanPlay = () => {
        window.clearTimeout(failTimer);
        safePlay();
      };

      // 就绪后开始播放（复用元素时数据已在内存，秒播）
      el.addEventListener("canplay", onCanPlay, { once: true });
      el.addEventListener("error", onError, { once: true });

      // 加载超时兜底：4s 内没就绪就退回浏览器语音，避免卡死
      const failTimer = window.setTimeout(() => {
        el.removeEventListener("canplay", onCanPlay);
        el.removeEventListener("error", onError);
        if (gen === activeGen && loopRef.current) speakWebSpeech();
      }, 4000);

      if (el.readyState >= 2) {
        // 数据已就绪，直接播
        el.removeEventListener("canplay", onCanPlay);
        el.removeEventListener("error", onError);
        window.clearTimeout(failTimer);
        safePlay();
      } else {
        el.load();
      }
    },
    [gapMs, clearTimer, playOnce, speakWebSpeech]
  );

  /** 开始循环朗读 */
  const start = useCallback(
    (text: string, rate = 0.9, accent: Accent = "us") => {
      const gen = ++activeGen;
      myGen.current = gen;
      textRef.current = text;
      rateRef.current = rate;
      accentRef.current = accent;
      loopRef.current = true;

      stopAll();
      clearTimer();

      // 0. 已预取/缓存的高质量音频 → 直接复用元素播放（零网络、零等待）
      const cached = getCachedAudio(text, accent);
      if (cached) {
        attachCached(cached, gen);
        return;
      }

      // 1. 立刻用浏览器语音发声（零延迟，作为过渡）
      speakWebSpeech();

      // 2. 后台解析真人音频，拿到后无缝切换
      resolveAudio(text, accent).then((result) => {
        // gen !== activeGen → 期间有新的 start() 调用（可能来自不同组件实例），丢弃
        if (gen !== activeGen || !result || !loopRef.current) return;
        attachCached(result, gen);
      });
    },
    [attachCached, speakWebSpeech, stopAll, clearTimer]
  );

  /** 立即重读一次（点击波浪图标） */
  const replayNow = useCallback(() => {
    clearTimer();
    if (audioRef.current && loopRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => speakWebSpeech());
    } else if (textRef.current && loopRef.current) {
      start(textRef.current, rateRef.current, accentRef.current);
    }
  }, [clearTimer, speakWebSpeech, start]);

  const stop = useCallback(() => {
    loopRef.current = false;
    clearTimer();
    stopAll();
  }, [clearTimer, stopAll]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

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

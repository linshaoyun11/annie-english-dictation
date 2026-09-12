import { useEffect, useMemo, useState, useRef } from "react";
import {
  getCurriculum,
  gradeLabel,
  getAllEntries,
  type CurriculumVersion,
} from "../data/curriculum";
import type { Progress } from "../lib/progress";
import { releaseElement, resolveAudio } from "../lib/audio";
import type { Accent } from "../lib/users";

interface DifficultWordsPageProps {
  progress: Progress;
  version: CurriculumVersion;
  accent: Accent;
  onBack: () => void;
  onRemove: (entryId: string) => void;
  /** 开始学习：携带当前筛选（"all" 或年级号），只学筛选后的词条 */
  onStartLearning: (filterGrade: number | "all") => void;
}

/** 年级筛选短标签（chip 用，比 gradeLabel 更紧凑） */
function gradeShortLabel(grade: number): string {
  if (grade <= 6) return `${grade}年级`;
  return ["初一", "初二", "初三"][grade - 7] ?? `${grade}年级`;
}

/** 播放中的简单线条声波：3 根细线轻幅律动 */
function LineWave() {
  return (
    <span className="flex h-4 items-center gap-[3px]" aria-hidden>
      {[8, 13, 8].map((h, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full"
          style={{
            height: `${h}px`,
            backgroundColor: "#534AB7",
            transformOrigin: "center",
            animation: `waveBar 1s ease-in-out ${i * 0.18}s infinite alternate`,
          }}
        />
      ))}
    </span>
  );
}

export default function DifficultWordsPage({
  progress,
  version,
  accent,
  onBack,
  onRemove,
  onStartLearning,
}: DifficultWordsPageProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filterGrade, setFilterGrade] = useState<number | "all">("all");
  /** 已点"移除"等待二次确认的词条（再点"确定"才真正移除） */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** 持住 SpeechSynthesisUtterance 引用：Safari 里 utterance 被 GC 会吞掉 onend */
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  /** 播放结束看门狗的 rAF 句柄（卸载时取消） */
  const watchdogRafRef = useRef(0);

  const cur = getCurriculum(version);

  const difficultEntries = useMemo(() => {
    const allMap = new Map(getAllEntries(version).map((e) => [e.id, e]));
    // difficultEntryIds 按加入先后追加（新的在末尾），倒序展示 = 最近加入的排最前
    return progress.difficultEntryIds
      .slice()
      .reverse()
      .map((id) => allMap.get(id))
      .filter((e): e is NonNullable<typeof e> => !!e);
  }, [progress.difficultEntryIds, version]);

  /** 列表中出现过的年级（筛选 chip 依据） */
  const filterGrades = useMemo(
    () =>
      [...new Set(difficultEntries.map((e) => e.grade))].sort((a, b) => a - b),
    [difficultEntries]
  );

  const visibleEntries = useMemo(
    () =>
      filterGrade === "all"
        ? difficultEntries
        : difficultEntries.filter((e) => e.grade === filterGrade),
    [difficultEntries, filterGrade]
  );

  const resetPlaying = (entryId: string) => {
    setPlayingId((cur) => (cur === entryId ? null : cur));
  };

  /**
   * 播放结束看门狗（rAF 轮询元素状态，不依赖 ended 事件）。
   *
   * 背景（2026-09-12 用户真机）：喇叭按钮播完不变回，图标卡在声波。
   * 原因：复位只挂 in <audio> 的 ended 事件，而 iOS WKWebView 后台挂起后
   * 媒体事件与定时器一同冻结（与自动跳题「走完不跳」同族问题）⇒ ended
   * 永不派发。渲染管线活着 rAF 就活 ⇒ 直接轮询 el.ended / el.paused，
   * 播完立即复位并按项目铁律 releaseElement 释放解码器。
   */
  const startEndWatchdog = (el: HTMLAudioElement, entryId: string) => {
    const tick = () => {
      if (audioRef.current !== el) return; // 已切到别的音频，旧看门狗退出
      const finished = el.ended || (el.currentTime > 0.05 && el.paused && !el.error);
      if (finished) {
        releaseElement(el);
        audioRef.current = null;
        resetPlaying(entryId);
        return;
      }
      watchdogRafRef.current = requestAnimationFrame(tick);
    };
    watchdogRafRef.current = requestAnimationFrame(tick);
  };

  const playAudio = async (english: string, entryId: string) => {
    if (audioRef.current) {
      releaseElement(audioRef.current);
      audioRef.current = null;
    }
    setPlayingId(entryId);

    const result = await resolveAudio(english, accent);
    const fallbackSpeak = () => {
      audioRef.current = null; // 看门狗随之退出，改走语音合成路径
      const u = new SpeechSynthesisUtterance(english);
      u.lang = accent === "uk" ? "en-GB" : "en-US";
      u.rate = 0.9;
      u.onend = () => resetPlaying(entryId);
      utterRef.current = u; // 防 GC 吞掉 onend（Safari 已知问题）
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    };
    if (result) {
      // <audio> 元素直出；失败回落浏览器语音
      const audio = new Audio(result.url);
      audio.playbackRate = 0.9;
      audio.onended = () => {
        releaseElement(audio);
        if (audioRef.current === audio) audioRef.current = null;
        resetPlaying(entryId);
      };
      audio.onerror = fallbackSpeak;
      audioRef.current = audio;
      startEndWatchdog(audio, entryId);
      audio.play().catch(fallbackSpeak);
    } else {
      fallbackSpeak();
    }
  };

  // 离开页面：停掉在播的音频与语音合成
  useEffect(() => {
    return () => {
      cancelAnimationFrame(watchdogRafRef.current);
      if (audioRef.current) releaseElement(audioRef.current);
      audioRef.current = null; // 看门狗下一帧看到 null 即自行退出
      try {
        speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  /** 移除按钮：点"移除"→"确定"两步确认 */
  const renderRemoveButton = (entryId: string) => {
    const confirming = confirmingId === entryId;
    if (confirming) {
      return (
        <button
          type="button"
          onClick={() => {
            onRemove(entryId);
            setConfirmingId(null);
          }}
          className="flex h-8 w-14 items-center justify-center rounded-full bg-error text-xs font-bold text-white transition-transform active:scale-[0.96]"
        >
          确定
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setConfirmingId(entryId)}
        className="flex h-8 w-14 items-center justify-center rounded-full border border-error/20 bg-error-light text-xs font-semibold text-error transition-colors active:bg-error/10"
      >
        移除
      </button>
    );
  };

  return (
    <div className="h-full overflow-y-auto px-5 pb-10">
      <div className="flex items-center gap-3 pt-8">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text2 transition-colors active:bg-primary-lighter"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-semibold text-text">重点记忆</h1>
          <p className="text-[11px] text-text3">
            {filterGrade === "all"
              ? `${difficultEntries.length} 个待复习词条`
              : `${visibleEntries.length} / ${difficultEntries.length} 个待复习词条`}
          </p>
        </div>
      </div>

      {difficultEntries.length === 0 ? (
        <div className="mt-24 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-light">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="text-sm text-text2">
            还没有需要重点记忆的内容
            <br />
            学习时点击「我不会」即可添加
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {/* 年级筛选：全部 + 列表中出现过的各年级 */}
          {filterGrades.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(["all", ...filterGrades] as const).map((g) => {
                const active = filterGrade === g;
                return (
                  <button
                    key={String(g)}
                    type="button"
                    onClick={() => setFilterGrade(g)}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-text2 active:bg-primary-lighter"
                    }`}
                  >
                    {g === "all" ? "全部" : gradeShortLabel(g)}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            disabled={visibleEntries.length === 0}
            onClick={() => onStartLearning(filterGrade)}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-transform ${
              visibleEntries.length === 0
                ? "cursor-not-allowed bg-primary/40 shadow-none"
                : "bg-primary shadow-[0_6px_20px_rgba(83,74,183,0.35)] active:scale-[0.98]"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
            {filterGrade === "all" ? "开始学习重点记忆" : `学习${gradeShortLabel(filterGrade)}重点记忆`}
            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px]">
              {visibleEntries.length} 词
            </span>
          </button>

          {visibleEntries.length === 0 ? (
            <div className="mt-16 flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-lighter">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <p className="text-sm text-text2">
                {gradeShortLabel(filterGrade as number)}暂无待复习词条
              </p>
            </div>
          ) : (
            visibleEntries.map((entry) => {
              const unit = cur.find(
                (u) => u.grade === entry.grade && u.unit === entry.unit
              );
              return (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-base font-semibold text-text">
                          {entry.english}
                        </span>
                        {entry.phonetic && (
                          <span className="text-xs text-primary">{entry.phonetic}</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-text2">{entry.chinese}</p>
                      <p className="mt-1 text-[11px] text-text3">
                        {gradeLabel(entry.grade)}
                        {unit ? ` · ${unit.title}` : ""} ·{" "}
                        {entry.type === "word"
                          ? "单词"
                          : entry.type === "phrase"
                          ? "短语"
                          : "句子"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={() => playAudio(entry.english, entry.id)}
                        className="flex h-8 w-14 items-center justify-center rounded-full border border-border bg-white text-text2 transition-colors active:bg-primary-lighter"
                      >
                        {playingId === entry.id ? (
                          /* 播放中：简单线条声波 */
                          <LineWave />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 5L6 9H2v6h4l5 4V5z" />
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                        )}
                      </button>
                      {renderRemoveButton(entry.id)}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* 底部留白 */}
        </div>
      )}
    </div>
  );
}

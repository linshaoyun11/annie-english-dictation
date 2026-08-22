import { useEffect, useRef, useState } from "react";
import { type WordEntry, gradeLabel } from "../data/curriculum";
import { pointsForEntry } from "../lib/users";
import SoundWave from "./SoundWave";
import SpellingInput from "./SpellingInput";

interface LearningCardProps {
  entry: WordEntry;
  unitTitle: string;
  orderInUnit: number; // 从 1 开始
  unitSize: number;
  onComplete: (entryId: string) => void;
  onNext: () => void;
  onDontKnow: (entryId: string) => void;
  /** 退出学习页（关闭按钮与顶部信息同行） */
  onExit: () => void;
  /** 词条拼错过或点过"我不会"（用于年级完成统计，整题只触发一次） */
  onMistake?: (entryId: string) => void;
  /** 冻结模式：单元完成祝贺页弹出时置 true，阻止自动跳题与自动朗读 */
  frozen?: boolean;
  /** 答对后是否自动进入下一题（默认 false） */
  autoNext?: boolean;
  replay: () => void;
  stopAudio: () => void;
  startAudio: (text: string) => void;
}

export default function LearningCard({
  entry,
  unitTitle,
  orderInUnit,
  unitSize,
  onComplete,
  onNext,
  onDontKnow,
  onExit,
  onMistake,
  frozen = false,
  autoNext = false,
  replay,
  stopAudio,
  startAudio,
}: LearningCardProps) {
  const [showHint, setShowHint] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [revealReason, setRevealReason] = useState<"dontKnow" | "strike5" | null>(null);
  const [revealSignal, setRevealSignal] = useState(0);
  const autoNextTimer = useRef<number | null>(null);

  useEffect(() => {
    setShowHint(false);
    setCompleted(false);
    setRevealed(false);
    setRevealReason(null);
    if (!frozen) startAudio(entry.english);
    return () => {
      stopAudio();
      if (autoNextTimer.current) {
        window.clearTimeout(autoNextTimer.current);
        autoNextTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id, frozen]);

  useEffect(() => {
    if (frozen && autoNextTimer.current) {
      window.clearTimeout(autoNextTimer.current);
      autoNextTimer.current = null;
    }
  }, [frozen]);

  // 空格键：答题中切换查看提示；答对/揭示后进入下一题
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (frozen) return;
      if (e.isComposing || e.keyCode === 229) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        const isHiddenInput =
          tag === "INPUT" && getComputedStyle(t).opacity === "0";
        if (
          tag === "BUTTON" ||
          tag === "TEXTAREA" ||
          t.isContentEditable ||
          (tag === "INPUT" && !isHiddenInput)
        ) {
          return;
        }
      }
      // 答对或揭示答案后，空格 = 进入下一题
      if (completed || revealed) {
        e.preventDefault();
        if (autoNextTimer.current) {
          window.clearTimeout(autoNextTimer.current);
          autoNextTimer.current = null;
        }
        onNext();
        return;
      }
      e.preventDefault();
      setShowHint((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [completed, revealed, frozen, onNext]);

  const handleComplete = () => {
    setCompleted(true);
    stopAudio();
    onComplete(entry.id);
    if (frozen) return;
    if (!autoNext) return; // 关闭自动跳题：停在正确页，等空格 / 点按钮
    autoNextTimer.current = window.setTimeout(() => {
      autoNextTimer.current = null;
      onNext();
    }, 2000);
  };

  const revealAnswer = (reason: "dontKnow" | "strike5") => {
    if (completed || revealed) return;
    setRevealReason(reason);
    setRevealed(true);
    setRevealSignal((s) => s + 1);
    stopAudio();
    onDontKnow(entry.id);
    onMistake?.(entry.id);
  };

  const nextBtn = (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (autoNextTimer.current) {
          window.clearTimeout(autoNextTimer.current);
          autoNextTimer.current = null;
        }
        onNext();
      }}
      className="relative mt-5 w-full overflow-hidden rounded-2xl bg-primary py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_20px_rgba(83,74,183,0.35)] transition-transform active:scale-[0.98]"
    >
      {completed && autoNext && (
        <span className="absolute top-0 left-0 h-[3px] bg-white/40 animate-[autoNextBar_2s_linear_forwards]" />
      )}
      <span className="relative z-10">{completed ? "下一题" : "记住了，进入下一题"}</span>
    </button>
  );

  return (
    <div className="flex h-full flex-col px-5 pt-5 pb-[calc(var(--kb-h,0px)+theme(space.6))]">
      {/* 顶部信息 + 关闭按钮（同一行） */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-text3">
            {gradeLabel(entry.grade)} · {unitTitle}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">
              {orderInUnit} / {unitSize}
            </span>
            <div className="h-1.5 w-20 rounded-full bg-primary-lighter">
              <div
                className="h-1.5 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${(orderInUnit / unitSize) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ScorePill type={entry.type} />
          <button
            type="button"
            onClick={onExit}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text2 transition-colors active:bg-primary-lighter"
            aria-label="返回首页"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 主要内容区：键盘弹起时允许滚动，避免底部按钮被键盘盖住 */}
      <div className="mt-6 flex flex-1 flex-col items-center justify-center overflow-y-auto">
        {completed ? (
          <div className="w-full max-w-[320px] animate-[slideUp_.35s_ease]">
            <div className="rounded-3xl bg-success-light p-6 text-center shadow-card">
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                <span className="absolute h-20 w-20 rounded-full border-2 border-success/40 animate-[ringOut_.9s_ease-out_forwards]" />
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white animate-[badgePop_.45s_cubic-bezier(.34,1.56,.64,1)]">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-success"
                    style={{ strokeDasharray: 26, animation: "checkDraw .35s ease .15s both" }}
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold text-success">回答正确</p>
              <p className="mt-2 text-[26px] font-bold leading-tight text-text">
                {entry.english}
              </p>
              {entry.phonetic && (
                <p className="mt-1 text-sm text-primary">{entry.phonetic}</p>
              )}
              <p className="mt-2 text-sm leading-relaxed text-text2">
                {entry.chinese}
              </p>
              <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-success shadow-sm">
                <span>+{pointsForEntry(entry.type)} 积分</span>
              </div>
            </div>
            {nextBtn}
            <p className="mt-3 text-center text-xs text-text3">
              {autoNext
                ? "2 秒后自动进入下一题，点击按钮跳过"
                : "按空格键或点击按钮进入下一题"}
            </p>
          </div>
        ) : revealed ? (
          <div className="w-full max-w-[320px] animate-[slideUp_.35s_ease]">
            <div className="rounded-3xl border border-[#F5E3C3] bg-[#FFFCF5] p-6 text-center shadow-card">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FAEEDA]">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#854F0B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </div>
              <p className="mt-4 text-sm font-semibold text-[#854F0B]">
                {revealReason === "strike5" ? "拼错 5 次，已加入重点记忆" : "已加入重点记忆"}
              </p>
              <p className="mt-2 text-[26px] font-bold leading-tight text-text">
                {entry.english}
              </p>
              {entry.phonetic && (
                <p className="mt-1 text-sm text-primary">{entry.phonetic}</p>
              )}
              <p className="mt-2 text-sm leading-relaxed text-text2">
                {entry.chinese}
              </p>
            </div>
            {nextBtn}
          </div>
        ) : (
          <div className="flex w-full flex-col items-center">
            <div
              className="relative flex flex-col items-center"
              /* 阻止点击抢走拼写输入层焦点（键盘会收起） */
              onMouseDown={(e) => e.preventDefault()}
            >
              <SoundWave active={!completed && !revealed} onClick={replay} />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowHint((v) => !v)}
                className="mt-4 flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-1.5 text-xs font-medium text-text2 shadow-sm transition-colors active:bg-primary-lighter"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.663 17h4.673M12 3v1M6.343 4.343l-.707-.707M18.364 4.343l.707-.707M4 12H3M21 12h-1M12 21v-1" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
                {showHint ? "隐藏提示" : "查看提示"}
              </button>
            </div>

            {showHint && (
              <div className="mt-5 flex animate-[fadeIn_.25s_ease] flex-col items-center rounded-2xl border border-border bg-surface px-5 py-3 shadow-sm">
                {entry.phonetic && (
                  <span className="text-sm font-medium text-primary">{entry.phonetic}</span>
                )}
                <span className="text-sm text-text2">{entry.chinese}</span>
              </div>
            )}
          </div>
        )}

        {/*
          拼写输入层：常挂载（答对/揭示后也不卸载）。
          SpellingInput 内部在完成态只渲染一个隐形的固定层输入框并保持焦点，
          键盘全程不收起 —— 避免"输入正确页"界面上下跳动。
          完成态外层高度归零，不占用正确/揭示卡片的布局空间。
        */}
        <div className={completed || revealed ? "h-0 w-full" : "mt-7 w-full"}>
          <SpellingInput
            target={entry.english}
            resetKey={entry.id}
            onComplete={handleComplete}
            onFirstMistake={() => onMistake?.(entry.id)}
            revealSignal={revealSignal}
            onStrike5={() => revealAnswer("strike5")}
          />
        </div>

        {!completed && !revealed && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => revealAnswer("dontKnow")}
            className="mt-7 flex items-center gap-1.5 rounded-full border border-[#F0D9B0] bg-[#FFF8EC] px-4 py-2 text-xs font-medium text-[#A06A1F] shadow-sm transition-all hover:bg-[#FDF1DB] active:scale-[0.97] active:bg-[#FAEEDA]"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            我不会
          </button>
        )}
      </div>
    </div>
  );
}

function ScorePill({ type }: { type: "word" | "phrase" | "sentence" }) {
  const label = type === "sentence" ? "句子" : type === "phrase" ? "短语" : "单词";
  return (
    <span className="rounded-full bg-primary-lighter px-2.5 py-1 text-[11px] font-semibold text-primary">
      {label}
    </span>
  );
}

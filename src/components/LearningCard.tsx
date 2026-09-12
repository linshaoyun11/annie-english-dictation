import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type WordEntry, gradeLabel } from "../data/curriculum";
import { pointsForEntry } from "../lib/users";
import { safeClearTimeout, safeTimeout } from "../lib/timer";
import SoundWave from "./SoundWave";
import SpellingInput, { type CellTier } from "./SpellingInput";

/** 降档顺序：内容放不下时依次变小，xxs 为最后一档兜底 */
const TIER_CHAIN: CellTier[] = ["normal", "compact", "xs", "xxs"];

/** 各档位对应的上下间距（越小越紧凑） */
const TIER_GAP: Record<CellTier, string> = {
  normal: "mt-7",
  compact: "mt-4",
  xs: "mt-3",
  xxs: "mt-2",
};

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
  /** 加入重点记忆：把当前词条加入重点记忆列表（不影响进度、不计错、不计分） */
  onAddToDifficult?: (entryId: string) => void;
  /** 当前词条是否已在重点记忆列表（按钮显示"已加入"并禁用） */
  alreadyInDifficult?: boolean;
  /** 冻结模式：单元完成祝贺页弹出时置 true，阻止自动跳题与自动朗读 */
  frozen?: boolean;
  /** 隐藏积分徽章（重点记忆重复学习不再加分时不显示"+N 积分"） */
  hidePoints?: boolean;
  /** 答对后是否自动进入下一题（默认 false） */
  autoNext?: boolean;
  replay: () => void;
  stopAudio: () => void;
  startAudio: (text: string) => void;
}

/**
 * 实测刷新率缓存（模块级，跨题目、跨渲染复用）：
 * 时钟冻结的兜底期只能数帧，而「帧数 → 墙钟时间」的换算依赖屏幕 Hz
 * （60Hz 与 120Hz 差一倍）。写死帧数必然与进度条对不上：
 * 200 帧 @60Hz = 3.3s（晚跳 1.5s），@120Hz = 1.67s（早跳 0.13s）。
 * 因此在时钟正常时借兜底循环前几帧实测 Hz 缓存下来，冻结期按
 * 「目标毫秒 × Hz」换算帧数，保证与进度条 1.8s 对齐。
 * 实测只认 2~40ms 的帧间隔：冻结时 Date.now() 不走动、dt≈0，自动被过滤。
 */
let cachedHz = 0;

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
  onAddToDifficult,
  alreadyInDifficult = false,
  frozen = false,
  hidePoints = false,
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
  const skipBtnRef = useRef<HTMLButtonElement>(null);
  /**
   * 幽灵点击防护（答对页 / 揭示页按钮专用）。
   *
   * 起因：自绘键盘的字母键改为 pointerdown 出字后（build 52 提速改动），
   * 最后一个字母是在**手指刚按下时**就判定完成的，此时手指还压在屏幕上。
   * onComplete 走的是离散事件 → React 18 同步刷新渲染 → 键盘整块卸载、
   * 答对页立刻替代它出现在屏幕上。于是同一次触摸的后续事件（touchstart /
   * touchend / click）全部落到**手指下方的新元素**上，浏览器照常合成的那记
   * click 就可能直接砸在"下一题"按钮上 —— 表现就是「答对页闪一下就跳走」。
   *
   * 判定方式：只认**本按钮自己收到过 pointerdown** 的 click。
   * 幽灵点击的 pointerdown 落在当时还不存在的按钮上，按钮不可能收到，
   * 因此 ref 保持 false 被拦下；真实点击必然先有 pointerdown，一定放行。
   * 用布尔量而不是时间窗，避免时间阈值带来的误杀与漏网。
   */
  const nextPressRef = useRef(false);
  const difficultPressRef = useRef(false);
  /** 自动跳转「已触发」标志：safeTimeout / onAnimationEnd / rAF 三路兜底互斥 */
  const autoNextDoneRef = useRef(false);

  /** 自动跳转统一出口（重复调用被 doneRef 拦下，onNext 只会走一次） */
  const fireAutoNext = () => {
    if (autoNextDoneRef.current) return;
    autoNextDoneRef.current = true;
    if (autoNextTimer.current) {
      safeClearTimeout(autoNextTimer.current);
      autoNextTimer.current = null;
    }
    onNext();
  };

  useEffect(() => {
    setShowHint(false);
    setCompleted(false);
    setRevealed(false);
    setRevealReason(null);
    if (!frozen) startAudio(entry.english);
    return () => {
      stopAudio();
      if (autoNextTimer.current) {
        safeClearTimeout(autoNextTimer.current);
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

  // 展开提示后，若“我不会”按钮被键盘遮挡，则自动滚动使其可见
  useEffect(() => {
    if (!showHint) return;
    const id = safeTimeout(() => {
      skipBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
    return () => safeClearTimeout(id);
  }, [showHint]);

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
        autoNextDoneRef.current = true; // 手动跳过：拦下尚未触发的自动兜底
        if (autoNextTimer.current) {
          safeClearTimeout(autoNextTimer.current);
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
    autoNextDoneRef.current = false;
    autoNextTimer.current = safeTimeout(fireAutoNext, 1800);
  };

  /**
   * rAF 帧数兜底（第三条路）：
   *
   * 背景（2026-09-12 用户真机）：答对页进度条走完不自动跳题。桌面复现正常，
   * 定位为 iOS WKWebView 已知的「后台挂起后 JS 时钟冻结」——safeTimeout 的
   * 墙钟定时器不再触发，且自动跳转场景没有用户触摸，runKicks 心跳无从补发；
   * onAnimationEnd 兜底在冻结态下同样不可靠（animationend 派发依赖主线程任务队列）。
   * 但 CSS 进度条仍在走 ⇒ 合成器渲染管线活着 ⇒ rAF 回调仍会被调度。
   *
   * 双条件触发：墙钟差 ≥1780ms（时钟正常时精确对齐进度条 1.8s）或
   * 帧数 ≥ framesNeeded（时钟冻结时靠帧数兜底）。framesNeeded 用模块级
   * 实测刷新率 cachedHz 换算（1.8s × Hz + 8 帧余量），与进度条对齐；
   * 尚无实测值（首题即冻结的罕见情形）退回 200 帧，宁可慢不可不跳。
   * 统一走 fireAutoNext，与另两路互斥。
   */
  useEffect(() => {
    if (!completed || !autoNext || frozen) return;
    let raf = 0;
    let frames = 0;
    const BAR_MS = 1800;
    const start = Date.now();
    let framesNeeded = cachedHz > 20 ? Math.ceil(cachedHz * (BAR_MS / 1000)) + 8 : 200;
    let dtSum = 0;
    let dtCount = 0;
    let last = start;
    const tick = () => {
      frames += 1;
      const now = Date.now();
      if (dtCount < 20) {
        const dt = now - last;
        last = now;
        if (dt >= 2 && dt <= 40) {
          dtSum += dt;
          dtCount += 1;
          if (dtCount === 20) {
            const hz = 1000 / (dtSum / dtCount);
            if (hz > 30 && hz < 240) {
              cachedHz = hz;
              const need = Math.ceil(hz * (BAR_MS / 1000)) + 8;
              if (need > frames) framesNeeded = need;
            }
          }
        }
      }
      if (now - start >= BAR_MS - 20 || frames >= framesNeeded) {
        fireAutoNext();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, autoNext, frozen, entry.id]);

  const revealAnswer = (reason: "dontKnow" | "strike5") => {
    if (completed || revealed) return;
    setRevealReason(reason);
    setRevealed(true);
    setRevealSignal((s) => s + 1);
    stopAudio();
    onDontKnow(entry.id);
    onMistake?.(entry.id);
  };

  /**
   * 字母格尺寸档位 —— 实测驱动，不按字母数猜。
   *
   * 背景：句子/长短语的字母格会折成 3-4 行，内容区高度不足时「我不会」
   * 按钮被挤出视口（3 行露一半、4 行完全看不见）。
   *
   * 为什么不用字母数阈值：折几行不只取决于字母数，还取决于单词切分
   * 带来的折行浪费、视口宽度、自绘键盘实测高度，同一字母数在不同机型
   * 上差一行就够翻车（390×844 实测：40 字母在 compact 档仍溢出 12px）。
   *
   * 因此改为渲染后量：内容区一旦真的溢出（scrollHeight > clientHeight）
   * 就降一档，normal → compact → xs → xxs，最多降三档。
   *  - 单词/短句从不溢出 ⇒ 恒定停在 normal，布局与历史版本逐像素一致；
   *  - useLayoutEffect 中同步完成，浏览器绘制前已定型，无闪烁；
   *  - ResizeObserver 兜底：自绘键盘高度是异步回写的，容器高度变化后补测。
   *  - xxs 仍放不下时停止降档，交给滚动（m-auto 是安全居中，底部可滚到）。
   */
  const contentRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<CellTier>("normal");

  // 换词条：回到 normal，保证每条词都从最舒服的尺寸开始重新判定
  useLayoutEffect(() => {
    setTier("normal");
  }, [entry.id]);

  const shrinkIfOverflow = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 1) return;
    setTier((t) => {
      const next = TIER_CHAIN[TIER_CHAIN.indexOf(t) + 1];
      return next ?? t; // 已到 xxs（最后一档）：保持，收敛
    });
  }, []);

  // 降档后立即重测（deps 含 tier），直到不再溢出或已到 xxs（末档不再变化，收敛）
  useLayoutEffect(() => {
    if (completed || revealed) return;
    shrinkIfOverflow();
  }, [shrinkIfOverflow, tier, entry.id, completed, revealed]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => shrinkIfOverflow());
    ro.observe(el);
    return () => ro.disconnect();
  }, [shrinkIfOverflow]);

  const gapClass = TIER_GAP[tier];
  const contentMt = tier === "xxs" ? "mt-2" : tier === "xs" ? "mt-3" : "mt-6";

  const nextBtn = (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={() => {
        nextPressRef.current = true;
      }}
      onClick={() => {
        // 幽灵点击：没经过本按钮的 pointerdown，是上一次按键尾巴上的合成 click
        if (!nextPressRef.current) return;
        nextPressRef.current = false;
        autoNextDoneRef.current = true; // 手动跳过：拦下尚未触发的自动兜底
        onNext();
      }}
      className="relative mt-5 w-full overflow-hidden rounded-2xl bg-primary py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_20px_rgba(83,74,183,0.35)] transition-transform active:scale-[0.98]"
    >
      {completed && autoNext && (
        <span
          className="absolute top-0 left-0 h-[3px] bg-white/40"
          style={{ animation: "autoNextBar 1.8s linear forwards" }}
          onAnimationEnd={() => {
            // CSS 动画跑在合成器线程，不受 iOS 后台 JS 时钟冻结影响。
            // 后台唤醒后动画恢复并正常触发 animationend → 可靠跳题。
            // safeTimeout 与 rAF 帧数为另两路兜底，fireAutoNext 内部互斥防双调用。
            fireAutoNext();
          }}
        />
      )}
      <span className="relative z-10">{completed ? "下一题" : "记住了，进入下一题"}</span>
    </button>
  );

  // 加入重点记忆：仅正确页显示，点击把当前词条加入重点记忆列表（不影响进度/积分）；
  // 已在列表中时显示"已加入重点记忆"并禁用，给出明确反馈。
  const addToDifficultBtn = onAddToDifficult ? (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={() => {
        difficultPressRef.current = true;
      }}
      onClick={() => {
        // 同 nextBtn：拦下按键尾巴上的幽灵点击，避免静默加入重点记忆
        if (!difficultPressRef.current) return;
        difficultPressRef.current = false;
        if (alreadyInDifficult) return;
        onAddToDifficult(entry.id);
      }}
      disabled={alreadyInDifficult}
      className={
        alreadyInDifficult
          ? "mt-3 w-full rounded-2xl border border-border bg-surface py-3 text-[15px] font-semibold text-text3"
          : "mt-3 w-full rounded-2xl border border-border bg-white py-3 text-[15px] font-semibold text-text2 transition-colors active:bg-primary-lighter"
      }
    >
      {alreadyInDifficult ? "已加入重点记忆" : "加入重点记忆"}
    </button>
  ) : null;

  return (
    <div className="flex h-full flex-col px-5 pt-5 pb-[calc(var(--kb-h,0px)+var(--dkb-h,0px)+theme(space.6))]">
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

      {/* 主要内容区。
          安全居中：不用 justify-center —— flex 容器里 justify-center 配合
          overflow 时是不安全居中（unsafe centering），内容一旦高于容器，
          顶部会被裁掉且无法滚动到，底部按钮也只露一半。改为内层 m-auto：
          内容放得下时 auto margin 均分剩余空间，视觉效果与 justify-center
          完全一致；放不下时 margin 归零、从顶部起排并可滚动到底，
          「我不会」按钮始终可达。 */}
      <div
        ref={contentRef}
        className={`flex flex-1 flex-col overflow-y-auto ${contentMt}`}
      >
        <div className="m-auto flex w-full flex-col items-center">
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
              {hidePoints ? null : (
                <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-success shadow-sm">
                  <span>+{pointsForEntry(entry.type)} 积分</span>
                </div>
              )}
            </div>
            {addToDifficultBtn}
            {nextBtn}
            {autoNext && (
              <p className="mt-3 text-center text-xs text-text3">
                1.8 秒后自动进入下一题，点击按钮跳过
              </p>
            )}
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
                {revealReason === "strike5" ? "拼错 5 次，已加入重点记忆列表" : "已加入重点记忆列表"}
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
              /* 阻止点击时选中文字、触发 iOS 长按菜单 */
              onMouseDown={(e) => e.preventDefault()}
            >
              <SoundWave
                active={!completed && !revealed}
                onClick={replay}
                size={tier === "xxs" ? "xxs" : tier === "xs" ? "xs" : "normal"}
              />
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
                {showHint ? "隐藏提示" : "查看提示（空格）"}
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
          拼写输入层：字母格在这里，A–Z 键盘条由组件内部 portal 固定到屏幕
          最底部（不唤起系统键盘，详见 SpellingInput 头部注释），其高度通过
          --dkb-h 回写给本卡片做底部避让。
          答对/揭示后整块卸载，把空间完整让给正确页/揭示页卡片。
        */}
        {!completed && !revealed && (
          <div className={`w-full ${gapClass}`}>
            <SpellingInput
              target={entry.english}
              resetKey={entry.id}
              onComplete={handleComplete}
              onFirstMistake={() => onMistake?.(entry.id)}
              revealSignal={revealSignal}
              onStrike5={() => revealAnswer("strike5")}
              /* 屏幕空格键与物理空格键共用同一行为：切换提示 */
              onSpaceKey={() => setShowHint((v) => !v)}
              tier={tier}
            />
          </div>
        )}

        {!completed && !revealed && (
          <button
            ref={skipBtnRef}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => revealAnswer("dontKnow")}
            className={`flex items-center gap-1.5 rounded-full border border-[#F0D9B0] bg-[#FFF8EC] px-4 py-2 text-xs font-medium text-[#A06A1F] shadow-sm transition-all hover:bg-[#FDF1DB] active:scale-[0.97] active:bg-[#FAEEDA] ${gapClass}`}
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

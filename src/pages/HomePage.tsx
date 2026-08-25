import { useState } from "react";
import {
  getCurriculum,
  gradeLabel,
  type CurriculumVersion,
} from "../data/curriculum";
import { type Progress, gradeStats, processedOf } from "../lib/progress";
import { primeSpeech } from "../hooks/useSpeechLoop";
import { primeWebAudio } from "../lib/webaudio";
import { avatarById, type User } from "../lib/users";
import { AvatarImg } from "../components/AvatarImg";
import PasswordModal from "../components/PasswordModal";

interface HomePageProps {
  user: User;
  progress: Progress;
  version: CurriculumVersion;
  onStart: (grade?: number) => void;
  onReset: () => void;
  onLogout: () => void;
  onLeaderboard: () => void;
  onDifficultWords: () => void;
  onSettings: () => void;
}

export default function HomePage({
  user,
  progress,
  version,
  onStart,
  onReset,
  onLogout,
  onLeaderboard,
  onDifficultWords,
  onSettings,
}: HomePageProps) {
  // 各年级进度独立：当前进度卡与"继续学习"都基于最近学习的年级
  const stats = gradeStats(progress, progress.activeGrade);
  const cur = getCurriculum(version);
  const activeGs = progress.grades[String(progress.activeGrade)];
  const currentUnit = cur[activeGs?.unitIndex ?? 0];
  const avatar = avatarById(user.avatarId);
  const currentProcessed = currentUnit
    ? activeGs
      ? processedOf(activeGs)
      : new Set<string>()
    : new Set<string>();
  const doneInCurrent = currentUnit.entries.filter((e) =>
    currentProcessed.has(e.id)
  ).length;

  const grades = Array.from(new Set(cur.map((u) => u.grade)));
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // 清空进度的密码验证（确认清空后再输密码，密码正确才真正执行）
  const [resetAuth, setResetAuth] = useState(false);

  return (
    <div className="h-full overflow-y-auto px-5 pb-10">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between pt-8">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-xl shadow-sm ring-2 ring-white"
            style={{ backgroundColor: avatar.color }}
          >
            <AvatarImg id={avatar.id} alt={avatar.name} />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">{avatar.name}</p>
            <p className="text-xs text-text3">⭐ {user.points} 积分</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <IconButton
            label="重点记忆"
            onClick={onDifficultWords}
            badge={progress.difficultEntryIds.length || undefined}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </IconButton>
          <IconButton label="排行榜" onClick={onLeaderboard}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </IconButton>
          <IconButton label="切换用户" onClick={onLogout}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 17l5-5-5-5M19 12H9M4 12H2" />
            </svg>
          </IconButton>
        </div>
      </div>

      {/* 当前进度卡片 */}
      <div className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-text3">当前学习</p>
            <p className="mt-1 text-lg font-semibold text-text">
              {gradeLabel(currentUnit.grade)} · {currentUnit.title}
              {stats.rounds > 0 && <RoundsBadge rounds={stats.rounds} />}
            </p>
            <p className="mt-0.5 text-xs text-text2">
              本单元 {doneInCurrent}/{currentUnit.entries.length} · 本年级{" "}
              {stats.done}/{stats.total}
            </p>
          </div>
          <button
            type="button"
            onClick={onSettings}
            title="选择教材与发音"
            aria-label="设置"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary transition-transform active:scale-90"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
        <div className="mt-4 h-2 w-full rounded-full bg-primary-lighter">
          <div
            className="h-2 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.max(stats.percent, 2)}%` }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            primeSpeech();
            primeWebAudio(); // 手势栈内创建 AudioContext（iOS 手势陷阱，切勿移到手势外）
            onStart();
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_20px_rgba(83,74,183,0.35)] transition-transform active:scale-[0.98]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5z" />
            <path d="M12 11v4" />
            <path d="M9 14h6" />
          </svg>
          {stats.done > 0 ? "继续学习" : "开始学习"}
        </button>
      </div>

      {/* 年级选择（各年级进度独立，完成一轮清零、星章数字 +1） */}
      <h2 className="mt-7 mb-3 text-sm font-semibold text-text">按年级开始</h2>
      <div className="grid grid-cols-2 gap-3">
        {grades.map((g) => {
          const unitsOfGrade = cur.filter((u) => u.grade === g);
          const gStats = gradeStats(progress, g);
          const isCurrent = progress.activeGrade === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => {
                primeSpeech();
                primeWebAudio(); // 手势栈内创建 AudioContext（iOS 手势陷阱，切勿移到手势外）
                onStart(g);
              }}
              className={`group flex flex-col rounded-2xl border bg-surface p-4 text-left shadow-sm transition-all active:scale-[0.98] ${
                isCurrent
                  ? "border-primary/30 bg-primary-lighter ring-1 ring-primary/20"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
                {gradeLabel(g)}
                {gStats.rounds > 0 && <RoundsBadge rounds={gStats.rounds} />}
              </span>
              <span className="mt-0.5 text-[11px] text-text2">
                {unitsOfGrade.length} 个单元
              </span>
              <div className="mt-3 h-1.5 w-full rounded-full bg-primary-lighter">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.max(gStats.percent, 2)}%` }}
                />
              </div>
              <span className="mt-2 text-[11px] text-text3">
                {gStats.done}/{gStats.total} 已完成
              </span>
            </button>
          );
        })}
      </div>

      {/* 清空进度 */}
      <button
        type="button"
        onClick={() => setShowResetConfirm(true)}
        className="mt-8 w-full rounded-2xl border border-border bg-white py-3 text-sm font-medium text-text2 transition-colors active:bg-primary-lighter"
      >
        清空学习进度
      </button>

      {/* 清空进度确认弹窗 */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-8 animate-[fadeIn_.2s_ease]"
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="w-full max-w-xs animate-[slideUp_.25s_ease] rounded-3xl bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-error-light text-2xl">
              ⚠️
            </div>
            <h2 className="mt-3 text-center text-base font-semibold text-text">
              清空学习进度？
            </h2>
            <div className="mt-4 rounded-2xl bg-error-light px-4 py-3">
              <p className="text-sm font-semibold text-error">
                全部积分（⭐ {user.points} 分）将一并清零！
              </p>
              <p className="mt-1 text-xs leading-5 text-error/80">
                当前教材的进度、积分与已学数量都会被删除，不可恢复。
              </p>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-text2 transition-colors active:bg-primary-lighter"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetAuth(true); // 密码验证通过后才执行清空
                }}
                className="flex-1 rounded-xl bg-error py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.97]"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 清空进度二次验证：输入用户密码后才真正执行 */}
      {resetAuth && (
        <PasswordModal
          user={user}
          onSuccess={() => {
            setResetAuth(false);
            onReset();
          }}
          onClose={() => setResetAuth(false)}
        />
      )}
    </div>
  );
}

/** 年级完成轮次徽章：勋章设计图，圆盘中心显示紫色轮次数 */
function RoundsBadge({ rounds }: { rounds: number }) {
  const label = rounds > 99 ? "99+" : String(rounds);
  return (
    <span
      className="relative inline-flex h-7 w-auto items-start align-middle"
      title={`已完整学完 ${rounds} 轮`}
      aria-label={`已完整学完 ${rounds} 轮`}
    >
      <img
        src="/grade-badge.png"
        alt=""
        className="h-7 w-auto object-contain"
        aria-hidden
      />
      <span className="pointer-events-none absolute left-0 right-0 top-[36%] flex -translate-y-1/2 justify-center text-[11px] font-bold text-primary">
        {label}
      </span>
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
  badge,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text2 transition-all active:scale-90 active:bg-primary-lighter"
    >
      {children}
      {!!badge && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {badge}
        </span>
      )}
    </button>
  );
}

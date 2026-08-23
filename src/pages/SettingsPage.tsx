import { useMemo, useState } from "react";
import {
  CURRICULUM_LABELS,
  getAllEntries,
  getCurriculum,
  type CurriculumVersion,
} from "../data/curriculum";
import { avatarById, type Accent, type User, type UserConfig } from "../lib/users";
import { AvatarImg } from "../components/AvatarImg";
import ChangePasswordModal from "../components/ChangePasswordModal";

interface SettingsPageProps {
  user: User;
  onBack: () => void;
  onSave: (config: UserConfig) => void;
  /** 修改当前用户密码（旧密码已在弹窗内校验） */
  onChangePassword: (newPassword: string) => void;
}

/** 教材版本简介（年级结构说明） */
const CURRICULUM_DESC: Record<CurriculumVersion, string> = {
  renjiao: "人教版 · 一年级起点（1-9 年级，三年级起自动跳过已学词）",
  renjiao3: "人教版 · 三年级起点（3-9 年级，按教材原样）",
  waiyanshe: "外研社 · 一年级起点（1-9 年级，三年级起自动跳过已学词）",
  waiyanshe3: "外研社 · 三年级起点（3-9 年级，按教材原样）",
  oxford: "沪教牛津 · 1-6 年级起始 + 初中牛津上海版",
};

const VERSIONS: CurriculumVersion[] = [
  "renjiao",
  "renjiao3",
  "waiyanshe",
  "waiyanshe3",
  "oxford",
];

const ACCENTS: { id: Accent; label: string; desc: string }[] = [
  { id: "us", label: "美式发音", desc: "美音 (American English)" },
  { id: "uk", label: "英式发音", desc: "英音 (British English)" },
];

export default function SettingsPage({
  user,
  onBack,
  onSave,
  onChangePassword,
}: SettingsPageProps) {
  const avatar = avatarById(user.avatarId);
  const [curriculum, setCurriculum] = useState<CurriculumVersion>(
    user.config.curriculum
  );
  const [accent, setAccent] = useState<Accent>(user.config.accent);
  const [autoNext, setAutoNext] = useState<boolean>(
    user.config.autoNext ?? false
  );
  const [saved, setSaved] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [pwdChanged, setPwdChanged] = useState(false);

  // 各版本统计（单元数 / 条目数）
  const stats = useMemo(() => {
    return Object.fromEntries(
      VERSIONS.map((v) => [
        v,
        { units: getCurriculum(v).length, entries: getAllEntries(v).length },
      ])
    ) as Record<CurriculumVersion, { units: number; entries: number }>;
  }, []);

  const commit = (next: {
    curriculum?: CurriculumVersion;
    accent?: Accent;
    autoNext?: boolean;
  }) => {
    const config: UserConfig = {
      curriculum: next.curriculum ?? curriculum,
      accent: next.accent ?? accent,
      autoNext: next.autoNext ?? autoNext,
    };
    if (next.curriculum) setCurriculum(next.curriculum);
    if (next.accent) setAccent(next.accent);
    if (next.autoNext !== undefined) setAutoNext(next.autoNext);
    onSave(config);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="h-full overflow-y-auto px-5 pb-10">
      {/* 顶部导航 */}
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
        <h1 className="text-lg font-semibold text-text">设置</h1>
        <div className="ml-auto flex items-center gap-2">
          {saved && (
            <span className="animate-[fadeIn_.2s_ease] rounded-full bg-success-light px-3 py-1 text-xs font-semibold text-success">
              ✓ 已保存
            </span>
          )}
          {pwdChanged && (
            <span className="animate-[fadeIn_.2s_ease] rounded-full bg-success-light px-3 py-1 text-xs font-semibold text-success">
              ✓ 密码已修改
            </span>
          )}
          {/* 点击头像修改密码 */}
          <button
            type="button"
            onClick={() => setShowChangePwd(true)}
            title="修改密码"
            aria-label="修改密码"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-base transition-transform active:scale-90"
            style={{ backgroundColor: avatar.color }}
          >
            <AvatarImg id={avatar.id} alt={avatar.name} />
          </button>
        </div>
      </div>

      {/* 修改密码弹窗 */}
      {showChangePwd && (
        <ChangePasswordModal
          user={user}
          onChangePassword={(pwd) => {
            onChangePassword(pwd);
            setShowChangePwd(false);
            setPwdChanged(true);
            window.setTimeout(() => setPwdChanged(false), 1800);
          }}
          onClose={() => setShowChangePwd(false)}
        />
      )}

      {/* 教材版本 */}
      <h2 className="mt-7 mb-1 text-sm font-semibold text-text">教材版本</h2>
      <p className="text-xs text-text3">
        学习进度按教材分开保存，切换互不影响
      </p>
      <div className="mt-3 flex flex-col gap-2.5">
        {VERSIONS.map((v) => {
          const active = curriculum === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => commit({ curriculum: v })}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-[0.98] ${
                active
                  ? "border-primary/30 bg-primary-lighter shadow-sm"
                  : "border-border bg-surface"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text">
                    {CURRICULUM_LABELS[v]}
                  </span>
                  {active && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                      当前
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-4 text-text2">
                  {CURRICULUM_DESC[v]}
                </p>
                <p className="mt-0.5 text-[11px] text-text3">
                  {stats[v].units} 个单元 · {stats[v].entries} 个词条
                </p>
              </div>
              <span
                className={`ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  active
                    ? "border-primary bg-primary"
                    : "border-border bg-white"
                }`}
              >
                {active && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* 发音口音 */}
      <h2 className="mt-8 mb-1 text-sm font-semibold text-text">发音口音</h2>
      <p className="text-xs text-text3">影响单词与句子的朗读音色</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {ACCENTS.map((a) => {
          const active = accent === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => commit({ accent: a.id })}
              className={`rounded-2xl border px-4 py-4 text-center transition-all active:scale-[0.98] ${
                active
                  ? "border-primary/30 bg-primary-lighter shadow-sm"
                  : "border-border bg-surface"
              }`}
            >
              <span className="text-2xl">{a.id === "us" ? "🇺🇸" : "🇬🇧"}</span>
              <p className="mt-2 text-sm font-semibold text-text">{a.label}</p>
              <p className="mt-0.5 text-[11px] text-text2">{a.desc}</p>
            </button>
          );
        })}
      </div>

      {/* 答题行为 */}
      <h2 className="mt-8 mb-1 text-sm font-semibold text-text">答题行为</h2>
      <p className="text-xs text-text3">控制答对后的跳题方式</p>
      <button
        type="button"
        onClick={() => commit({ autoNext: !autoNext })}
        className={`mt-3 flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-[0.98] ${
          autoNext
            ? "border-primary/30 bg-primary-lighter shadow-sm"
            : "border-border bg-surface"
        }`}
      >
        <div className="flex-1 pr-3">
          <p className="text-sm font-semibold text-text">答对后自动进入下一题</p>
          <p className="mt-1 text-[11px] leading-4 text-text2">
            关闭时，答对后停在正确页面，按空格键或点「下一题」继续
          </p>
        </div>
        <span
          className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            autoNext ? "bg-primary" : "bg-border"
          }`}
        >
          <span
            className={`absolute h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
              autoNext ? "left-[22px]" : "left-0.5"
            }`}
          />
        </span>
      </button>

      {/* 说明 */}
      <div className="mt-8 rounded-2xl border border-border bg-surface p-4 text-xs leading-5 text-text2">
        <p>
          💡 切换教材后，该教材的学习进度会从第一单元开始，其他教材上的进度仍然保留。
        </p>
      </div>
    </div>
  );
}

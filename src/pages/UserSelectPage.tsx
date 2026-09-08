import { useState } from "react";
import { avatarById, type User } from "../lib/users";
import PasswordModal from "../components/PasswordModal";
import Logo from "../components/Logo";
import { AvatarImg } from "../components/AvatarImg";

interface UserSelectPageProps {
  users: User[];
  onLogin: (user: User) => void;
  onRegister: () => void;
  onLeaderboard: () => void;
}

export default function UserSelectPage({
  users,
  onLogin,
  onRegister,
  onLeaderboard,
}: UserSelectPageProps) {
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  const sorted = [...users].sort((a, b) => b.points - a.points);

  return (
    <div className="flex h-full flex-col px-6 pb-8">
      {/* 排行榜入口 */}
      <div className="flex items-center justify-end pt-6">
        <button
          type="button"
          onClick={onLeaderboard}
          className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text2 transition-transform active:scale-[0.97]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
          排行榜
        </button>
      </div>

      {/* LOGO + 应用名 */}
      <div className="mt-2 flex justify-center">
        <div className="rounded-[28px] bg-white p-4 shadow-card">
          <Logo size={72} withText={false} />
        </div>
      </div>
      <div className="mt-5 flex flex-col items-center">
        <h1 className="text-xl font-semibold text-text tracking-wide">安妮英语听写</h1>
        <p className="mt-1 text-xs text-text3">点击头像开始学习</p>
      </div>

      {/* 用户头像网格 */}
      <div className="flex-1 overflow-y-auto pt-4">
        {users.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex gap-2 text-4xl opacity-60">
              <AvatarImg id="dog" alt="小狗" />
              <AvatarImg id="cat" alt="猫咪" />
              <AvatarImg id="panda" alt="熊猫" />
            </div>
            <p className="mt-4 text-sm text-text2">
              还没有小伙伴
              <br />
              点击下方按钮创建第一个角色吧
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-x-3 gap-y-5">
            {sorted.map((u) => {
              const avatar = avatarById(u.avatarId);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setPendingUser(u)}
                  className="group flex flex-col items-center transition-transform active:scale-[0.94]"
                >
                  <div
                    className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-[38px] shadow-md ring-2 ring-white transition-transform group-active:scale-95"
                    style={{ backgroundColor: avatar.color }}
                  >
                    <AvatarImg id={avatar.id} alt={avatar.name} />
                  </div>
                  <span className="mt-2 text-sm font-semibold text-text">{avatar.name}</span>
                  <span className="mt-0.5 text-[11px] text-text3">
                    ⭐ {u.points} 分
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 注册按钮 */}
      <button
        type="button"
        onClick={onRegister}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_20px_rgba(83,74,183,0.35)] transition-transform active:scale-[0.98]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        创建新角色
      </button>

      {pendingUser && (
        <PasswordModal
          user={pendingUser}
          onSuccess={() => onLogin(pendingUser)}
          onClose={() => setPendingUser(null)}
        />
      )}
    </div>
  );
}

import { avatarById, type User } from "../lib/users";

interface LeaderboardPageProps {
  users: User[];
  currentUserId: string | null;
  onBack: () => void;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage({ users, currentUserId, onBack }: LeaderboardPageProps) {
  const sorted = [...users].sort(
    (a, b) => b.points - a.points || b.learnedCount - a.learnedCount
  );

  return (
    <div className="flex h-full flex-col px-6 pb-8 pt-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text2 active:bg-primary-lighter"
          aria-label="返回"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-semibold text-text">积分排行榜</h1>
          <p className="text-[11px] text-text3">单词 +5 · 短语 +8 · 句子 +10</p>
        </div>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="mt-16 text-center text-sm text-text2">
            还没有用户注册，快去注册吧
          </p>
        ) : (
          <div className="space-y-2.5">
            {sorted.map((u, i) => {
              const avatar = avatarById(u.avatarId);
              const isMe = u.id === currentUserId;
              return (
                <div
                  key={u.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 ${
                    isMe
                      ? "border-primary/30 bg-primary-lighter"
                      : "border-border bg-surface"
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bg text-sm font-bold text-text3">
                    {i < 3 ? MEDALS[i] : i + 1}
                  </span>
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full text-2xl ring-2 ring-white"
                    style={{ backgroundColor: avatar.color }}
                  >
                    {avatar.emoji}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-text">
                      {avatar.name}
                      {isMe && (
                        <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          我
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text2">
                      已学 {u.learnedCount} 个条目
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-text">{u.points}</p>
                    <p className="text-[10px] text-text3">分</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo, useRef, useState } from "react";
import { AVATARS, takenAvatarIds, type User } from "../lib/users";
import { AvatarImg } from "../components/AvatarImg";

interface RegisterPageProps {
  users: User[];
  onRegister: (avatarId: string, password: string) => { ok: boolean; error?: string };
  onBack: () => void;
}

export default function RegisterPage({ users, onRegister, onBack }: RegisterPageProps) {
  const taken = useMemo(() => takenAvatarIds(users), [users]);
  const available = AVATARS.filter((a) => !taken.has(a.id)).length;

  const [selected, setSelected] = useState<string | null>(null);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pwdClean = pwd.replace(/\D/g, "").slice(0, 4);
  const pwd2Clean = pwd2.replace(/\D/g, "").slice(0, 4);

  /**
   * 把焦点输入框滚到系统键盘上方。
   *
   * iOS WKWebView 的数字键盘（inputMode="numeric"）不会自动把 input 滚进可视区，
   * 必须手动补偿；键盘高度由 App.tsx 写入的 CSS 变量 --kb-h 提供。
   *
   * 滚两次的原因：
   *  1) 立刻滚一次——pwd -> pwd2 切换时键盘已经开着，--kb-h 已就位，马上就能算准；
   *  2) 350ms 后再校准一次——首次聚焦时键盘正从底部升起（动画约 300ms），
   *     此刻测量到的还是键盘弹出前的布局，等动画结束必须重算。
   * 第二次若已到位则 delta <= 1，不会再滚，无副作用。
   */
  const scrollRef = useRef<HTMLDivElement>(null);
  const revealInput = (el: HTMLInputElement) => {
    const scrollOnce = () => {
      const box = scrollRef.current;
      if (!box) return;
      const kbH =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--kb-h")
        ) || 0;
      const boxRect = box.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      // 容器底部被键盘盖住 kbH，再留 16px 呼吸位
      const visibleBottom = boxRect.bottom - kbH - 16;
      const delta = elRect.bottom - visibleBottom;
      if (delta > 1) box.scrollBy({ top: delta, behavior: "smooth" });
    };
    scrollOnce();
    window.setTimeout(scrollOnce, 350);
  };

  const canSubmit =
    !!selected && /^\d{4}$/.test(pwdClean) && pwdClean === pwd2Clean;

  const handleSubmit = () => {
    if (!selected) {
      setError("请先选一个喜欢的头像");
      return;
    }
    const result = onRegister(selected, pwdClean);
    if (!result.ok) {
      setError(result.error ?? "创建失败");
    }
  };

  return (
    /* 整页可滚 + 底部按键盘高度留内边距：
       - overflow-y-auto 让键盘弹出后焦点输入框有可滚动的空间；
       - padding-bottom 用 --kb-h（App.tsx 已全局写入：原生走
         Capacitor keyboardWillShow，Web 走 visualViewport），
         与 ProfilePage / PasswordModal 的避让方式保持一致；
       - 头像区不再自己滚动，否则嵌套滚动容器会让 scrollBy 失效。 */
    <div
      ref={scrollRef}
      className="flex h-full flex-col overflow-y-auto px-6 pt-8"
      style={{ paddingBottom: "calc(var(--kb-h, 0px) + 2rem)" }}
    >
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
        <h1 className="text-lg font-semibold text-text">创建新角色</h1>
      </div>
      <p className="mt-1 ml-12 text-xs text-text3">
        选一个头像，再设置 4 位数字密码
        {available < AVATARS.length && `（还剩 ${available} 个可选）`}
      </p>

      {/* 头像选择（高度随内容自然展开，滚动交给外层容器） */}
      <div className="mt-5">
        <div className="grid grid-cols-4 gap-x-1.5 gap-y-3 px-1 py-1">
          {AVATARS.map((a) => {
            const isTaken = taken.has(a.id);
            const isSelected = selected === a.id;
            return (
              <button
                key={a.id}
                type="button"
                disabled={isTaken}
                onClick={() => {
                  setSelected(a.id);
                  setError(null);
                }}
                className={`relative flex flex-col items-center rounded-2xl p-1.5 transition-all ${
                  isTaken
                    ? "cursor-not-allowed opacity-35 grayscale"
                    : "active:scale-[0.93]"
                } ${
                  isSelected
                    ? "bg-primary-light ring-2 ring-primary"
                    : "bg-transparent"
                }`}
              >
                <div
                  className="flex h-[50px] w-[50px] items-center justify-center rounded-full text-2xl shadow-sm border border-black/5"
                  style={{ backgroundColor: a.color }}
                >
                  <AvatarImg id={a.id} alt={a.name} />
                </div>
                <span className="mt-1 text-[11px] font-medium text-text2">{a.name}</span>
                {isTaken && (
                  <span className="absolute right-1 top-1 text-xs">🔒</span>
                )}
                {isSelected && !isTaken && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-white shadow-sm">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 密码设置 */}
      <div className="mt-5 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-text3">密码（4 位数字）</label>
          <input
            value={pwdClean}
            onChange={(e) => {
              setPwd(e.target.value);
              setError(null);
            }}
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            onFocus={(e) => revealInput(e.currentTarget)}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-center text-lg tracking-[0.8em] text-text placeholder:text-text3 focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text3">再输入一次</label>
          <input
            value={pwd2Clean}
            onChange={(e) => {
              setPwd2(e.target.value);
              setError(null);
            }}
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            onFocus={(e) => revealInput(e.currentTarget)}
            className={`w-full rounded-2xl border bg-surface px-4 py-3 text-center text-lg tracking-[0.8em] text-text focus:ring-2 focus:ring-primary/10 ${
              pwd2Clean.length === 4 && pwd2Clean !== pwdClean
                ? "border-error"
                : "border-border focus:border-primary"
            }`}
          />
        </div>
        {pwd2Clean.length === 4 && pwd2Clean !== pwdClean && (
          <p className="text-xs text-error">两次输入的密码不一致</p>
        )}
        {error && <p className="text-xs text-error">{error}</p>}
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold transition-transform ${
          canSubmit
            ? "bg-primary text-white shadow-[0_6px_20px_rgba(83,74,183,0.35)] active:scale-[0.98]"
            : "bg-primary-lighter text-text3"
        }`}
      >
        创建并开始学习
      </button>
    </div>
  );
}

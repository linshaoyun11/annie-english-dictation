import { useEffect, useMemo, useRef, useState } from "react";
import { AVATARS, takenAvatarIds, type User } from "../lib/users";
import { AvatarImg } from "../components/AvatarImg";
import NumberPad from "../components/NumberPad";

interface RegisterPageProps {
  users: User[];
  onRegister: (avatarId: string, password: string) => { ok: boolean; error?: string };
  onBack: () => void;
}

/** 两个密码框的标识（自绘键盘要往哪一个里写字） */
type Field = "pwd" | "pwd2";

export default function RegisterPage({ users, onRegister, onBack }: RegisterPageProps) {
  const taken = useMemo(() => takenAvatarIds(users), [users]);
  const available = AVATARS.filter((a) => !taken.has(a.id)).length;

  const [selected, setSelected] = useState<string | null>(null);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [error, setError] = useState<string | null>(null);

  /**
   * 当前输入目标；null = 数字键盘收起。
   *
   * 键盘是**页内布局的一部分**（flex 的第二行），不是浮层，所以这个状态
   * 只决定键盘占不占位，不涉及任何「键盘高度避让」计算 —— 这正是它比
   * 系统键盘可靠的地方（详见 NumberPad.tsx 顶部注释）。
   */
  const [field, setField] = useState<Field | null>(null);

  const pwdClean = pwd.replace(/\D/g, "").slice(0, 4);
  const pwd2Clean = pwd2.replace(/\D/g, "").slice(0, 4);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pwdRef = useRef<HTMLInputElement>(null);
  const pwd2Ref = useRef<HTMLInputElement>(null);

  /**
   * 键盘展开后把内容区滚到底：密码框与「创建并开始学习」按钮都在键盘上方。
   *
   * 双 rAF 的理由：键盘挂载 → 内容区高度变化是**同一帧内**的布局变更，
   * 单次 rAF 时 scrollHeight 可能还是旧值（键盘还没占上位）。等两帧再量。
   * 键盘已经展开时（pwd → pwd2 切换）重跑一次无副作用。
   */
  useEffect(() => {
    if (!field) return;
    const box = scrollRef.current;
    if (!box) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [field]);

  /** 收起键盘：连焦点一起收，否则输入框的 :focus 高亮会一直亮着 */
  const dismiss = () => {
    setField(null);
    const el = document.activeElement;
    if (el instanceof HTMLInputElement) el.blur();
  };

  /**
   * 点内容区空白处收起键盘。输入框与按钮上的点击要放行 ——
   * 否则「点密码框切换」和「点创建按钮提交」都会顺带收起键盘。
   */
  const handlePaneClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest?.("input,button")) return;
    if (field) dismiss();
  };

  const handleDigit = (d: string) => {
    setError(null);
    if (field === "pwd") {
      const next = (pwdClean + d).slice(0, 4);
      setPwd(next);
      // 第一格填满 → 自动跳到第二格（系统密码框的常规体验）
      if (next.length === 4) {
        setField("pwd2");
        pwd2Ref.current?.focus();
      }
      return;
    }
    if (field === "pwd2") {
      const next = (pwd2Clean + d).slice(0, 4);
      setPwd2(next);
      // 两格都填满 → 收起键盘，把「创建并开始学习」让出来
      if (next.length === 4) dismiss();
    }
  };

  const handleBackspace = () => {
    setError(null);
    if (field === "pwd") {
      setPwd(pwdClean.slice(0, -1));
      return;
    }
    if (field === "pwd2") {
      const next = pwd2Clean.slice(0, -1);
      setPwd2(next);
      // 第二格删空 → 退回第一格继续编辑
      if (!next) {
        setField("pwd");
        pwdRef.current?.focus();
      }
    }
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
    /* 两段式布局：上半可滚动内容 + 下半数字键盘。
       键盘在文档流内（flex 的第二行）⇒ 内容区高度自动让位，
       **结构上不可能挡住输入框** —— 不再依赖 --kb-h 的时序与数值。 */
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        onClick={handlePaneClick}
        className="min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-6"
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
            {/* readOnly + inputMode=none：这两个属性一起挡住系统键盘。
                readOnly 单独用，iOS 仍可能弹键盘；inputMode="none" 是
                iOS 15+ 的明确「不弹键盘」指令。两者都留着最保险。
                输入完全由下方自绘键盘驱动，聚焦只用来标记「当前在写哪一格」。 */}
            <input
              ref={pwdRef}
              value={pwdClean}
              readOnly
              inputMode="none"
              maxLength={4}
              placeholder="••••"
              onFocus={() => setField("pwd")}
              className="w-full cursor-default select-none rounded-2xl border border-border bg-surface px-4 py-3 text-center text-lg tracking-[0.8em] text-text caret-transparent placeholder:text-text3 focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text3">再输入一次</label>
            <input
              ref={pwd2Ref}
              value={pwd2Clean}
              readOnly
              inputMode="none"
              maxLength={4}
              placeholder="••••"
              onFocus={() => setField("pwd2")}
              className={`w-full cursor-default select-none rounded-2xl border bg-surface px-4 py-3 text-center text-lg tracking-[0.8em] text-text caret-transparent focus:ring-2 focus:ring-primary/10 ${
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

      {field && (
        <NumberPad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          className="animate-[slideUp_.22s_cubic-bezier(.22,1,.36,1)]"
        />
      )}
    </div>
  );
}

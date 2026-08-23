import { useEffect, useRef, useState } from "react";
import { avatarById, type User } from "../lib/users";
import { AvatarImg } from "../components/AvatarImg";

interface ProfilePageProps {
  user: User;
  onBack: () => void;
  /** 修改当前用户密码（旧密码已在本页校验） */
  onChangePassword: (newPassword: string) => void;
}

type PwdStep = "old" | "new" | "confirm";

/**
 * 用户资料页：展示当前用户信息，后续可扩展修改头像/用户名。
 * 目前提供修改密码（页面内嵌三步流程，非弹窗）：
 * 1. 输入旧密码（4 位数字，自动提交校验）
 * 2. 输入新密码
 * 3. 再次输入新密码确认 → 提交
 */
export default function ProfilePage({
  user,
  onBack,
  onChangePassword,
}: ProfilePageProps) {
  const avatar = avatarById(user.avatarId);

  // 密码修改流程状态：null = 未开始（显示列表项）
  const [pwdStep, setPwdStep] = useState<PwdStep | null>(null);
  const [pwd, setPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [wrong, setWrong] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [changed, setChanged] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pwdStep) inputRef.current?.focus();
  }, [pwdStep]);

  // App 从后台回前台 → 主动恢复焦点（iOS 后台挂起后焦点可能失效）
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && pwdStep) {
        inputRef.current?.focus();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [pwdStep]);

  const shakeAndClear = () => {
    setWrong(true);
    navigator.vibrate?.(120);
    inputRef.current?.focus();
    window.setTimeout(() => {
      setPwd("");
      setWrong(false);
    }, 500);
  };

  const finishChanged = () => {
    setPwdStep(null);
    setPwd("");
    setNewPwd("");
    setChanged(true);
    window.setTimeout(() => setChanged(false), 2000);
  };

  const submit = (value: string) => {
    if (pwdStep === "old") {
      if (value === user.password) {
        setPwdStep("new");
        setPwd("");
      } else {
        shakeAndClear();
      }
    } else if (pwdStep === "new") {
      setNewPwd(value);
      setPwd("");
      setPwdStep("confirm");
    } else if (pwdStep === "confirm") {
      if (value === newPwd) {
        onChangePassword(newPwd);
        finishChanged();
      } else {
        setMismatch(true);
        navigator.vibrate?.(120);
        inputRef.current?.focus();
        window.setTimeout(() => {
          setPwd("");
          setMismatch(false);
          // 重新输入新密码
          setNewPwd("");
          setPwdStep("new");
        }, 700);
      }
    }
  };

  const handlePwdInput = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 4);
    setPwd(clean);
    if (clean.length === 4) {
      window.setTimeout(() => submit(clean), 150);
    }
  };

  const stepText =
    pwdStep === "old"
      ? "请输入旧密码"
      : pwdStep === "new"
        ? "请输入新的 4 位数字密码"
        : "请再次输入新密码";

  return (
    <div
      className="h-full overflow-y-auto px-5 pb-10"
      style={{ paddingBottom: pwdStep ? "calc(var(--kb-h, 0px) + 2.5rem)" : undefined }}
    >
      {/* 顶部导航 */}
      <div className="flex items-center gap-3 pt-8">
        <button
          type="button"
          onClick={() => {
            if (pwdStep) {
              // 正在改密码 → 取消流程回列表
              setPwdStep(null);
              setPwd("");
              setNewPwd("");
            } else {
              onBack();
            }
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text2 transition-colors active:bg-primary-lighter"
          aria-label="返回"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-text">用户资料</h1>
        {changed && (
          <span className="ml-auto animate-[fadeIn_.2s_ease] rounded-full bg-success-light px-3 py-1 text-xs font-semibold text-success">
            ✓ 密码已修改
          </span>
        )}
      </div>

      {/* 用户信息卡片 */}
      <div className="mt-6 flex items-center gap-4 rounded-3xl border border-border bg-surface p-5">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl ring-4 ring-white shadow-sm"
          style={{ backgroundColor: avatar.color }}
        >
          <AvatarImg id={avatar.id} alt={avatar.name} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-text">{avatar.name}</p>
          <p className="mt-1 text-xs text-text3">
            加入于 {new Date(user.createdAt).toLocaleDateString("zh-CN")}
          </p>
          <div className="mt-2 flex gap-4 text-xs text-text2">
            <span>⭐ {user.points} 积分</span>
            <span>📖 已学 {user.learnedCount} 词</span>
          </div>
        </div>
      </div>

      {/* 修改密码：列表项 / 内嵌流程 */}
      {pwdStep === null ? (
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setPwdStep("old")}
            className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-lighter text-base">
                🔑
              </span>
              <span className="text-sm font-semibold text-text">修改密码</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text3">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          {/* 后续扩展项（暂不可用） */}
          <div className="flex items-center justify-between rounded-2xl border border-border bg-surface/60 px-4 py-3.5 opacity-60">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg text-base">
                😀
              </span>
              <span className="text-sm font-semibold text-text">修改头像</span>
            </div>
            <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold text-text3">
              即将上线
            </span>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border bg-surface/60 px-4 py-3.5 opacity-60">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg text-base">
                ✏️
              </span>
              <span className="text-sm font-semibold text-text">修改用户名</span>
            </div>
            <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold text-text3">
              即将上线
            </span>
          </div>
        </div>
      ) : (
        <div
          className={`mt-6 rounded-3xl border border-border bg-surface p-6 text-center ${
            wrong || mismatch ? "animate-[shake_.45s_ease]" : ""
          }`}
        >
          <p className="text-base font-semibold text-text">
            修改 {avatar.name} 的密码
          </p>
          <p className="mt-1 text-xs text-text3">{stepText}</p>

          <div
            className="relative mt-5 cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 text-xl font-bold transition-colors ${
                    wrong || mismatch
                      ? "border-error bg-error-light text-error"
                      : pwd.length > i
                        ? "border-success bg-success-light text-success"
                        : "border-border bg-bg text-text3"
                  }`}
                >
                  {pwd.length > i ? "•" : ""}
                </div>
              ))}
            </div>
            <input
              ref={inputRef}
              value={pwd}
              onChange={(e) => handlePwdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pwd.length === 4) {
                  e.preventDefault();
                  submit(pwd);
                }
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-label="密码输入"
              className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
              style={{ fontSize: 16 }}
            />
          </div>

          {wrong && (
            <p className="mt-3 text-xs font-medium text-error animate-[fadeIn_.2s_ease]">
              旧密码不对，再试一次
            </p>
          )}
          {mismatch && (
            <p className="mt-3 text-xs font-medium text-error animate-[fadeIn_.2s_ease]">
              两次输入的新密码不一致，请重新输入
            </p>
          )}

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setPwdStep(null);
              setPwd("");
              setNewPwd("");
            }}
            className="mt-5 text-sm font-medium text-text3 transition-colors hover:text-text2"
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { avatarById, type User } from "../lib/users";
import { safeTimeout } from "../lib/timer";
import { AvatarImg } from "../components/AvatarImg";

interface ProfilePageProps {
  user: User;
  onBack: () => void;
  /** 修改当前用户密码（旧密码已在本页校验） */
  onChangePassword: (newPassword: string) => void;
}

type PwdStep = "old" | "new" | "confirm";

/**
 * 用户资料页：展示当前用户信息，提供修改密码（页面内嵌三步流程，非弹窗）：
 * 1. 输入旧密码（4 位数字，自动提交校验）
 * 2. 输入新密码
 * 3. 再次输入新密码确认 → 提交
 * 后续如需修改头像/用户名等，在设置列表中扩展。
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
  /**
   * 前台恢复时强制重建 input 元素（同 PasswordModal / SpellingInput 原理）。
   * iOS 后台挂起后 input 僵尸态：有焦点有键盘但 onChange 不触发。
   */
  const [inputKey, setInputKey] = useState(0);
  /** input onChange 是否正常工作（同 PasswordModal 的 inputAliveRef） */
  const inputAliveRef = useRef(false);

  useEffect(() => {
    if (pwdStep) inputRef.current?.focus();
  }, [pwdStep]);

  // App 从后台回前台 → 强制重建 input DOM 元素（同 PasswordModal 原理）。
  // 旧版只 focus()，对僵尸 input 无效；重建才能让 iOS 重新绑定键盘事件。
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && pwdStep) {
        inputAliveRef.current = false;
        flushSync(() => {
          setInputKey((k) => k + 1);
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [pwdStep]);

  // input 重建后聚焦
  useEffect(() => {
    if (pwdStep) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey]);

  const shakeAndClear = () => {
    setWrong(true);
    navigator.vibrate?.(120);
    inputRef.current?.focus();
    safeTimeout(() => {
      setPwd("");
      setWrong(false);
    }, 500);
  };

  const finishChanged = () => {
    setPwdStep(null);
    setPwd("");
    setNewPwd("");
    setChanged(true);
    safeTimeout(() => setChanged(false), 2000);
  };

  const submit = (value: string) => {
    if (pwdStep === "old") {
      if (value === user.password) {
        // flushSync 确保后台唤醒后 React 调度器异常时步骤切换仍立即生效
        flushSync(() => {
          setPwdStep("new");
          setPwd("");
        });
        inputAliveRef.current = false; // 新步骤，假定 input 可能僵尸
      } else {
        shakeAndClear();
      }
    } else if (pwdStep === "new") {
      flushSync(() => {
        setNewPwd(value);
        setPwd("");
        setPwdStep("confirm");
      });
      inputAliveRef.current = false;
    } else if (pwdStep === "confirm") {
      if (value === newPwd) {
        // flushSync 确保父组件 onChangePassword 触发的状态更新立即 flush
        flushSync(() => {
          onChangePassword(newPwd);
        });
        finishChanged();
      } else {
        setMismatch(true);
        navigator.vibrate?.(120);
        inputRef.current?.focus();
        safeTimeout(() => {
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
    inputAliveRef.current = true; // onChange 送达 → input 不是僵尸
    const clean = v.replace(/\D/g, "").slice(0, 4);
    setPwd(clean);
    if (clean.length === 4) {
      // 直接同步提交：后台唤醒后 WebKit 定时器冻结时，
      // safeTimeout 的心跳只在后续用户交互时才补发，
      // 但输完 4 位密码后没有更多交互，回调永不执行。
      submit(clean);
    }
  };

  // 全局按键兜底：input 僵尸时（有焦点但 onChange 不触发），
  // 数字键直接进入密码逻辑。与 PasswordModal 同理。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!pwdStep) return;
      if (wrong || mismatch) return;
      // input 有焦点 AND onChange 正常 → 让 onChange 处理
      if (document.activeElement === inputRef.current && inputAliveRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const next = (pwd + e.key).slice(0, 4);
        setPwd(next);
        if (next.length === 4) submit(next);
        inputRef.current?.focus();
      } else if (e.key === "Backspace" && pwd.length > 0) {
        e.preventDefault();
        setPwd(pwd.slice(0, -1));
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pwd, pwdStep, wrong, mismatch]);

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
              key={inputKey}
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

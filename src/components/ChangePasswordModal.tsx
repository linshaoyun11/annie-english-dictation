import { useEffect, useRef, useState } from "react";
import { avatarById, type User } from "../lib/users";
import { AvatarImg } from "./AvatarImg";

interface ChangePasswordModalProps {
  user: User;
  /** 新密码验证通过（旧密码已校验、两次新密码一致） */
  onChangePassword: (newPassword: string) => void;
  onClose: () => void;
}

/**
 * 修改密码弹窗：三步流程
 * 1. 输入旧密码（4 位数字，自动提交校验）
 * 2. 输入新密码
 * 3. 再次输入新密码确认 → 提交
 */
export default function ChangePasswordModal({
  user,
  onChangePassword,
  onClose,
}: ChangePasswordModalProps) {
  const [step, setStep] = useState<"old" | "new" | "confirm">("old");
  const [pwd, setPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [wrong, setWrong] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const avatar = avatarById(user.avatarId);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  // App 从后台回前台 → 主动恢复焦点（iOS 后台挂起后焦点可能失效）
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        inputRef.current?.focus();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const shakeAndClear = () => {
    setWrong(true);
    navigator.vibrate?.(120);
    inputRef.current?.focus();
    window.setTimeout(() => {
      setPwd("");
      setWrong(false);
    }, 500);
  };

  const submit = (value: string) => {
    if (step === "old") {
      if (value === user.password) {
        setStep("new");
        setPwd("");
      } else {
        shakeAndClear();
      }
    } else if (step === "new") {
      setNewPwd(value);
      setPwd("");
      setStep("confirm");
    } else {
      if (value === newPwd) {
        onChangePassword(newPwd);
      } else {
        setMismatch(true);
        navigator.vibrate?.(120);
        inputRef.current?.focus();
        window.setTimeout(() => {
          setPwd("");
          setMismatch(false);
          // 重新输入新密码
          setNewPwd("");
          setStep("new");
        }, 700);
      }
    }
  };

  const handleChange = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 4);
    setPwd(clean);
    if (clean.length === 4) {
      window.setTimeout(() => submit(clean), 150);
    }
  };

  const stepText =
    step === "old"
      ? "请输入旧密码"
      : step === "new"
        ? "请输入新的 4 位数字密码"
        : "请再次输入新密码";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 animate-[fadeIn_.2s_ease]"
      style={{ bottom: "var(--kb-h, 0px)" }}
      onClick={onClose}
    >
      <div
        className={`mx-6 w-full max-w-xs rounded-3xl bg-surface p-6 text-center shadow-2xl ${
          wrong || mismatch
            ? "animate-[shake_.45s_ease]"
            : "animate-[slideUp_.25s_ease]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ring-4 ring-white shadow-sm"
          style={{ backgroundColor: avatar.color }}
        >
          <AvatarImg id={avatar.id} alt={avatar.name} />
        </div>
        <p className="mt-3 text-base font-semibold text-text">
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
            onChange={(e) => handleChange(e.target.value)}
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
          onClick={onClose}
          className="mt-5 text-sm font-medium text-text3 transition-colors hover:text-text2"
        >
          取消
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { avatarById, type User } from "../lib/users";
import { AvatarImg } from "./AvatarImg";

interface PasswordModalProps {
  user: User;
  onSuccess: () => void;
  onClose: () => void;
}

export default function PasswordModal({ user, onSuccess, onClose }: PasswordModalProps) {
  const [pwd, setPwd] = useState("");
  const [wrong, setWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const avatar = avatarById(user.avatarId);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // App 从后台回前台 → 主动恢复焦点。
  // iOS 后台挂起后 input 焦点可能失效（按键事件不再送达），
  // 正是"输完密码没反应"且重启才好的根因。
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        inputRef.current?.focus();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const submit = (value: string) => {
    if (value === user.password) {
      onSuccess();
    } else {
      setWrong(true);
      navigator.vibrate?.(120);
      inputRef.current?.focus();
      window.setTimeout(() => {
        setPwd("");
        setWrong(false);
      }, 500);
    }
  };

  const handleChange = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 4);
    setPwd(clean);
    if (clean.length === 4) {
      window.setTimeout(() => submit(clean), 150);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 animate-[fadeIn_.2s_ease]"
      /* 底部让出键盘高度：弹窗始终完整可见于键盘上方 */
      style={{ bottom: "var(--kb-h, 0px)" }}
      onClick={onClose}
    >
      <div
        className={`mx-6 w-full max-w-xs rounded-3xl bg-surface p-6 text-center shadow-2xl ${
          wrong ? "animate-[shake_.45s_ease]" : "animate-[slideUp_.25s_ease]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ring-4 ring-white shadow-sm"
          style={{ backgroundColor: avatar.color }}
        >
          <AvatarImg id={avatar.id} alt={avatar.name} />
        </div>
        <p className="mt-3 text-base font-semibold text-text">{avatar.name}</p>
        <p className="mt-1 text-xs text-text3">请输入 4 位数字密码</p>

        <div
          className="relative mt-5 cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 text-xl font-bold transition-colors ${
                  wrong
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
          {/*
            真实透明输入层：覆盖整个密码圆点区域，尺寸足够大。
            旧版 0x0 隐藏 input 在 iOS 上会丢按键事件（输完没反应），
            改为全尺寸覆盖层后每次输入都稳定触发 onChange。
          */}
          <input
            ref={inputRef}
            value={pwd}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              // 回车兜底：自动提交的定时器万一丢失，按回车也能提交
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
            密码不对，再试一次
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

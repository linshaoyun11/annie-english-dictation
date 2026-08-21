import { useEffect, useRef, useState } from "react";
import { avatarById, type User } from "../lib/users";

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

  const submit = (value: string) => {
    if (value === user.password) {
      onSuccess();
    } else {
      setWrong(true);
      navigator.vibrate?.(120);
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
          {avatar.emoji}
        </div>
        <p className="mt-3 text-base font-semibold text-text">{avatar.name}</p>
        <p className="mt-1 text-xs text-text3">请输入 4 位数字密码</p>

        <div
          className="mt-5 cursor-text"
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
          <input
            ref={inputRef}
            value={pwd}
            onChange={(e) => handleChange(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="pointer-events-none absolute h-0 w-0 opacity-0"
            aria-label="密码输入"
          />
        </div>

        {wrong && (
          <p className="mt-3 text-xs font-medium text-error animate-[fadeIn_.2s_ease]">
            密码不对，再试一次
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 text-sm font-medium text-text3 transition-colors hover:text-text2"
        >
          取消
        </button>
      </div>
    </div>
  );
}

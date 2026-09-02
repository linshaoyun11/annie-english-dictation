import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { avatarById, type User } from "../lib/users";
import { safeTimeout } from "../lib/timer";
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
  /**
   * 前台恢复时强制重建 input 元素的 key（与 SpellingInput 同理）。
   * iOS 后台挂起后 input 僵尸态：有焦点有键盘但 onChange 不触发。
   */
  const [inputKey, setInputKey] = useState(0);
  /** input onChange 是否正常工作（同 SpellingInput 的 inputAliveRef） */
  const inputAliveRef = useRef(false);

  // 弹窗卸载时显式结束输入会话。
  // 登录成功会直接切走整个页面树，聚焦中的 input 是被"移除"而不是 blur 的，
  // iOS 上键盘会话不一定正常收起；残留的输入状态会让进入下一页后的第一次
  // 点按被系统吃掉（表现为要点两次才有反应）。这里补一次显式收尾。
  useEffect(
    () => () => {
      (document.activeElement as HTMLElement | null)?.blur();
      if (Capacitor.isNativePlatform()) Keyboard.hide().catch(() => {});
      document.documentElement.style.setProperty("--kb-h", "0px");
    },
    []
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // App 从后台回前台 → 强制重建 input DOM 元素（同 SpellingInput 原理）。
  // 旧版只 focus()，对僵尸 input 无效；重建才能让 iOS 重新绑定键盘事件。
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        inputAliveRef.current = false;
        flushSync(() => {
          setInputKey((k) => k + 1);
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // input 重建后聚焦
  useEffect(() => {
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey]);

  const submit = (value: string) => {
    if (value === user.password) {
      // flushSync 强制 React 同步处理 onSuccess 触发的父组件状态更新。
      // 后台唤醒后 React 调度器可能异常：onSuccess() 被调用了（手动
      // 关闭弹窗后能跳转 = 状态确实更新了），但 re-render 没执行 →
      // 弹窗不消失。flushSync 确保状态更新立即 flush，弹窗立即卸载。
      flushSync(() => {
        onSuccess();
      });
    } else {
      setWrong(true);
      navigator.vibrate?.(120);
      inputRef.current?.focus();
      safeTimeout(() => {
        setPwd("");
        setWrong(false);
      }, 500);
    }
  };

  const handleChange = (v: string) => {
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
  // 数字键直接进入密码逻辑。与 SpellingInput 同理。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (wrong) return;
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
  }, [pwd, wrong]);

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
            key={inputKey}
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

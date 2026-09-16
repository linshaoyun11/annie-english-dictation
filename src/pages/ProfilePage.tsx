import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { avatarById, type User } from "../lib/users";
import { safeTimeout } from "../lib/timer";
import { AvatarImg } from "../components/AvatarImg";
import { BookIcon, KeyIcon, TrashIcon } from "../components/Icons";
import { StarIcon } from "../components/RoundsStars";
import NumberPad from "../components/NumberPad";
import PageTopBar from "../components/PageTopBar";

interface ProfilePageProps {
  user: User;
  onBack: () => void;
  /** 修改当前用户密码（旧密码已在本页校验） */
  onChangePassword: (newPassword: string) => void;
  /** 删除当前用户（已在本页完成密码校验与二次确认） */
  onDeleteUser: () => void;
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
  onDeleteUser,
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

  /* ── 删除本用户：先验密码 → 再二次确认 → 回调父组件执行删除 ──────────
   *
   * 与「清空学习进度」（HomePage）的顺序**相反**：那边是先弹确认框、再验密码，
   * 这边按用户要求先验密码、密码正确才弹确认框。
   * 密码用自绘 NumberPad（build 119 约定：数字输入一律自绘，系统数字键盘在
   * WKWebView 里是浮层，会把输入控件盖住）。
   */

  /** "auth" = 正在输入密码；null = 不在删除流程里 */
  const [delStep, setDelStep] = useState<"auth" | null>(null);
  const [delPwd, setDelPwd] = useState("");
  const [delWrong, setDelWrong] = useState(false);
  /** 密码通过后的二次确认弹窗 */
  const [delConfirm, setDelConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const delCardRef = useRef<HTMLDivElement>(null);

  /**
   * 键盘占位后把密码卡片滚进可视区。
   * 双 rAF：键盘挂载引起的布局变更与 scrollHeight 更新不在同一帧，
   * 单次 rAF 时量到的还是旧位置（同 RegisterPage 的处理）。
   */
  useEffect(() => {
    if (delStep !== "auth") return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        delCardRef.current?.scrollIntoView({ block: "center" });
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [delStep]);

  const shakeDel = () => {
    setDelWrong(true);
    navigator.vibrate?.(120);
    safeTimeout(() => {
      setDelPwd("");
      setDelWrong(false);
    }, 500);
  };

  const submitDel = (value: string) => {
    if (value === user.password) {
      // flushSync：后台唤醒后 React 调度器可能异常，同步 flush 保证
      // 「收键盘 + 弹确认框」一起生效，不出现键盘还留着、弹窗不出的中间态
      flushSync(() => {
        setDelStep(null);
        setDelPwd("");
        setDelConfirm(true);
      });
    } else {
      shakeDel();
    }
  };

  const handleDelDigit = (d: string) => {
    if (delWrong) return;
    const next = (delPwd + d).slice(0, 4);
    setDelPwd(next);
    if (next.length === 4) submitDel(next);
  };

  const handleDelBackspace = () => {
    if (delWrong) return;
    setDelPwd(delPwd.slice(0, -1));
  };

  /** 物理键盘兜底（桌面预览 / iPad 外接键盘）：自绘键盘只在屏幕上点得动 */
  useEffect(() => {
    if (delStep !== "auth") return;
    const onKey = (e: KeyboardEvent) => {
      if (delWrong) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const next = (delPwd + e.key).slice(0, 4);
        setDelPwd(next);
        if (next.length === 4) submitDel(next);
      } else if (e.key === "Backspace" && delPwd.length > 0) {
        e.preventDefault();
        setDelPwd(delPwd.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delStep, delPwd, delWrong]);

  const stepText =
    pwdStep === "old"
      ? "请输入旧密码"
      : pwdStep === "new"
        ? "请输入新的 4 位数字密码"
        : "请再次输入新密码";

  return (
    /* 两段式布局：上半可滚动内容 + 下半自绘数字键盘。
       键盘在文档流内（flex 第二行）⇒ 结构上不可能遮住输入区。
       改密码流程仍用系统键盘（沿用旧实现），它靠 --kb-h 让位；
       两套并存：delStep 非空时才会渲染 NumberPad。 */
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-5 pb-10"
        style={{ paddingBottom: pwdStep ? "calc(var(--kb-h, 0px) + 2.5rem)" : undefined }}
      >
      {/* 顶部导航（吸顶：滚动时返回键 / 标题固定不动） */}
      <PageTopBar>
        <button
          type="button"
          onClick={() => {
            if (pwdStep) {
              // 正在改密码 → 取消流程回列表
              setPwdStep(null);
              setPwd("");
              setNewPwd("");
            } else if (delStep) {
              // 正在验密码 → 先退回列表，不要直接离开本页
              setDelStep(null);
              setDelPwd("");
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
      </PageTopBar>

      {/* 用户信息卡片：上半身份区、下半双列数据条，中间 1px 细分隔线 */}
      <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
        <div className="flex items-center gap-4 p-5">
          <div
            className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full text-3xl"
            style={{
              backgroundColor: avatar.color,
              // 浅紫描边环 + 轻投影：卡片本身是白的，用 ring-white 看不见
              boxShadow:
                "0 0 0 3px var(--color-primary-lighter), 0 2px 10px rgba(83,74,183,0.10)",
            }}
          >
            <AvatarImg id={avatar.id} alt={avatar.name} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[19px] font-semibold text-text">{avatar.name}</p>
            <p className="mt-1 text-xs text-text3">
              加入于 {new Date(user.createdAt).toLocaleDateString("zh-CN")}
            </p>
          </div>
        </div>

        <div className="mx-5 h-px bg-border-light" />

        {/* 积分 / 已学单词：图标 + 数字 + 标签，等宽两列 */}
        <div className="grid grid-cols-2 py-3.5">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 text-[17px] font-bold tabular-nums text-text">
              <StarIcon size={16} />
              <span>{user.points}</span>
            </div>
            <span className="text-[11px] text-text3">积分</span>
          </div>
          <div className="flex flex-col items-center gap-1 border-l border-border-light">
            <div className="flex items-center gap-1.5 text-[17px] font-bold tabular-nums text-text">
              <BookIcon size={17} className="text-primary" />
              <span>{user.learnedCount}</span>
            </div>
            <span className="text-[11px] text-text3">已学单词</span>
          </div>
        </div>
      </div>

      {/* 三个互斥状态：删除流程的密码卡片 / 分组列表 / 改密码卡片 */}
      {delStep === "auth" ? (
        <div
          ref={delCardRef}
          className={`mt-6 rounded-3xl border border-border bg-surface p-6 text-center shadow-card ${
            delWrong ? "animate-[shake_.45s_ease]" : ""
          }`}
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-error-light">
            <TrashIcon size={26} className="text-error" />
          </div>
          <p className="mt-3 text-base font-semibold text-text">
            删除 {avatar.name}？
          </p>
          <p className="mt-1 text-xs text-text3">
            这是危险操作，请先输入 4 位数字密码确认身份
          </p>

          <div
            className="mt-5 flex justify-center gap-3"
            role="status"
            aria-label={`已输入 ${delPwd.length} 位密码，共 4 位`}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 text-xl font-bold transition-colors ${
                  delWrong
                    ? "border-error bg-error-light text-error"
                    : delPwd.length > i
                      ? "border-success bg-success-light text-success"
                      : "border-border bg-bg text-text3"
                }`}
              >
                {delPwd.length > i ? "•" : ""}
              </div>
            ))}
          </div>

          {delWrong && (
            <p className="mt-3 text-xs font-medium text-error animate-[fadeIn_.2s_ease]">
              密码不对，再试一次
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setDelStep(null);
              setDelPwd("");
            }}
            className="mt-5 text-sm font-medium text-text3 transition-colors hover:text-text2"
          >
            取消
          </button>
        </div>
      ) : pwdStep === null ? (
        <>
          <h2 className="mb-2.5 mt-6 px-1 text-xs font-semibold tracking-[0.04em] text-text3">
            账号安全
          </h2>
          <div className="overflow-hidden rounded-[20px] border border-border bg-surface shadow-card">
            <button
              type="button"
              onClick={() => setPwdStep("old")}
              className="flex h-[60px] w-full items-center gap-3 px-4 text-left transition-colors active:bg-primary-lighter"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-primary-lighter">
                <KeyIcon size={20} className="text-primary" />
              </span>
              <span className="flex-1 text-[15px] font-semibold text-text">
                修改密码
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text3">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <h2 className="mb-2.5 mt-6 px-1 text-xs font-semibold tracking-[0.04em] text-text3">
            危险操作
          </h2>
          <div className="overflow-hidden rounded-[20px] border border-border bg-surface shadow-card">
            <button
              type="button"
              onClick={() => {
                setPwdStep(null); // 保险：两个内嵌流程互斥
                setDelStep("auth");
              }}
              className="flex h-[60px] w-full items-center gap-3 px-4 text-left transition-colors active:bg-error-light"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-error-light">
                <TrashIcon size={20} className="text-error" />
              </span>
              <span className="flex-1 text-[15px] font-semibold text-error">
                删除本用户
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text3">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </>
      ) : (
        <div
          className={`mt-6 rounded-3xl border border-border bg-surface p-6 text-center shadow-card ${
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

      {/* 二次确认：密码已经过了，这一步才是真正不可逆的 */}
      {delConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-8 animate-[fadeIn_.2s_ease]"
          onClick={() => setDelConfirm(false)}
        >
          <div
            className="w-full max-w-xs animate-[slideUp_.25s_ease] rounded-3xl bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-error-light text-2xl">
              ⚠️
            </div>
            <h2 className="mt-3 text-center text-base font-semibold text-text">
              删除「{avatar.name}」？
            </h2>
            <div className="mt-4 rounded-2xl bg-error-light px-4 py-3">
              <p className="text-sm font-semibold text-error">
                该用户的所有资料、积分与学习进度都会被删除！
              </p>
              <p className="mt-1 text-xs leading-5 text-error/80">
                ⭐ {user.points} 积分、{user.learnedCount} 个已学单词，以及<span className="whitespace-nowrap">全部学习进度</span>都会被清除，且无法恢复。
              </p>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setDelConfirm(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-text2 transition-colors active:bg-primary-lighter"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setDelConfirm(false);
                  onDeleteUser();
                }}
                className="flex-1 rounded-xl bg-error py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.97]"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {delStep === "auth" && (
        <NumberPad
          onDigit={handleDelDigit}
          onBackspace={handleDelBackspace}
          className="animate-[slideUp_.22s_cubic-bezier(.22,1,.36,1)]"
        />
      )}
    </div>
  );
}

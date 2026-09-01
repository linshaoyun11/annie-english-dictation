import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 自绘 A–Z 拼写键盘。
 *
 * 为什么不依赖系统键盘：iOS 的键盘语言是**系统级状态**，由「本 App 上次
 * 使用的键盘」记忆与「设置 → 通用 → 键盘」列表顺序共同决定，Web 层既
 * 读不到也写不了：
 *  - inputmode 规范只有 none / text / tel / url / email / numeric /
 *    decimal / search 八个值，此前使用的 "latin" 不属于规范，iOS 直接
 *    忽略（等于从来没生效过）；
 *  - 原生唯一的杠杆 UIResponder.textInputMode 对 WKWebView 无效，
 *    底层 WKContentView 无法被覆盖（method swizzling 亦失败）；
 *  - 连拥有原生键盘扩展权限的第三方键盘（SwiftKey）官方文档都写明
 *    「锁定设备后返回 App / 切换 App 时键盘会回落系统默认」，只能让用户
 *    手动点 globe 键。
 *
 * 因此这里**不再使用真实 <input>**（也就不会唤起系统键盘），改为页面内
 * 自绘字母键盘：永远英文小写，行为 100% 确定，彻底不受系统键盘语言
 * 记忆/回落影响。
 *
 * 物理键盘（妙控键盘 / 智能键盘 / 外接键盘）通过 window 级 keydown 兼容；
 * 一旦检测到物理按键输入即自动收起屏幕键盘，并提供手动唤回入口。
 *
 * 键盘条用 portal 挂到 document.body，固定贴在屏幕最底部（视觉与行为都
 * 对齐系统键盘），并把实测高度写入 CSS 变量 --dkb-h，页面内容区据此留出
 * 避让空间，底部按钮不会被盖住。
 */

const KB_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

/** 模块级：本次会话是否已检测到物理键盘（跨题目保持，重启 App 重置） */
let hardwareKeyboardSeen = false;

interface WordGroup {
  letters: string[]; // 需要输入的字母（保留原大小写）
  suffix: string; // 词尾标点（预填显示，不需输入）
}

interface SpellingInputProps {
  target: string;
  resetKey: string;
  onComplete: () => void;
  onFirstInput?: () => void;
  /** 本题第一次拼错字母时触发（用于统计"曾经拼错"的词条） */
  onFirstMistake?: () => void;
  /** 递增此值会触发自动揭示正确答案 */
  revealSignal?: number;
  /** 本题累计拼错字母达到 5 次时回调（整题只触发一次） */
  onStrike5?: () => void;
}

function parseTarget(target: string): WordGroup[] {
  return target
    .split(" ")
    .filter(Boolean)
    .flatMap((w) => {
      const groups: WordGroup[] = [];
      let letters: string[] = [];
      let suffix = "";
      for (let i = 0; i < w.length; i++) {
        const ch = w[i];
        if (/[a-zA-Z]/.test(ch)) {
          if (suffix) {
            // 保存前面的字母段及其后的标点/连接符（如 man-made 中的 man-）
            if (letters.length > 0) {
              groups.push({ letters, suffix });
            }
            letters = [ch];
            suffix = "";
          } else {
            letters.push(ch);
          }
        } else {
          suffix += ch;
        }
      }
      if (letters.length > 0) {
        groups.push({ letters, suffix });
      }
      return groups;
    })
    .filter((g) => g.letters.length > 0);
}

function isLetter(c: string) {
  return /^[a-zA-Z]$/.test(c);
}

export default function SpellingInput({
  target,
  resetKey,
  onComplete,
  onFirstInput,
  onFirstMistake,
  revealSignal = 0,
  onStrike5,
}: SpellingInputProps) {
  const groups = useMemo(() => parseTarget(target), [target]);
  const totalLetters = useMemo(
    () => groups.reduce((s, g) => s + g.letters.length, 0),
    [groups]
  );
  const allLetters = useMemo(
    () => groups.flatMap((g) => g.letters),
    [groups]
  );

  const [typed, setTyped] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [kbVisible, setKbVisible] = useState(() => !hardwareKeyboardSeen);

  const firstInputFired = useRef(false);
  const completedRef = useRef(false);
  const typedLenRef = useRef(0);
  const errorCountRef = useRef(0);
  const strike5FiredRef = useRef(false);
  /** typed 的同步镜像（用于在输入回调里同步判定完成，不依赖 useEffect） */
  const typedRef = useRef<string[]>([]);
  /** 最新处理函数引用（供 window 级按键与键盘按钮共用） */
  const handlersRef = useRef<{ push: (c: string) => void; pop: () => void }>({
    push: () => {},
    pop: () => {},
  });

  // 新题：清空全部状态
  useEffect(() => {
    setTyped([]);
    typedRef.current = [];
    setDone(false);
    setRevealed(false);
    firstInputFired.current = false;
    completedRef.current = false;
    typedLenRef.current = 0;
    errorCountRef.current = 0;
    strike5FiredRef.current = false;
    setKbVisible(!hardwareKeyboardSeen);
  }, [resetKey]);

  // 揭示答案（"我不会" / 拼错 5 次）：填满字母并进入揭示态
  useEffect(() => {
    if (revealSignal > 0) {
      completedRef.current = true;
      typedLenRef.current = totalLetters;
      typedRef.current = [...allLetters];
      setTyped([...allLetters]);
      setDone(true);
      setRevealed(true);
    }
  }, [revealSignal, allLetters, totalLetters]);

  const pushLetter = (c: string) => {
    if (done || completedRef.current) return;
    if (!isLetter(c)) return;
    const idx = typedLenRef.current;
    if (idx >= totalLetters) return;
    const targetChar = allLetters[idx];
    if (c.toLowerCase() !== targetChar.toLowerCase()) {
      if (errorCountRef.current === 0) onFirstMistake?.();
      errorCountRef.current += 1;
      if (errorCountRef.current >= 5 && !strike5FiredRef.current) {
        strike5FiredRef.current = true;
        onStrike5?.();
      }
    }
    typedLenRef.current = idx + 1;
    const next = [...typedRef.current, c];
    typedRef.current = next;
    setTyped(next);
    if (!firstInputFired.current) {
      firstInputFired.current = true;
      onFirstInput?.();
    }
    // 同步判定完成：不依赖 useEffect，避免后台唤醒后重渲染被冻结的情况
    if (next.length === totalLetters && !completedRef.current) {
      const allCorrect = next.every(
        (ch, i) => ch.toLowerCase() === allLetters[i].toLowerCase()
      );
      if (allCorrect) {
        completedRef.current = true;
        setDone(true);
        if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
        onComplete();
      }
    }
  };

  const popLetter = () => {
    if (done) return;
    if (typedLenRef.current > 0) typedLenRef.current -= 1;
    const next = typedRef.current.slice(0, -1);
    typedRef.current = next;
    setTyped(next);
  };

  handlersRef.current = { push: pushLetter, pop: popLetter };

  /** 收到物理键盘输入 → 收起屏幕键盘（跨题目保持） */
  const noteHardwareInput = useCallback(() => {
    if (hardwareKeyboardSeen) return;
    hardwareKeyboardSeen = true;
    setKbVisible(false);
  }, []);

  // 物理键盘兼容：window 级 keydown。
  // 由于不再有真实 input，按键不会唤起任何系统键盘；这里直接把字母/
  // 退格喂给拼写逻辑。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || revealed) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.isComposing || e.keyCode === 229) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return; // 焦点在别的真实输入框（如密码框）时不抢按键
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        noteHardwareInput();
        handlersRef.current.push(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        noteHardwareInput();
        handlersRef.current.pop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, revealed, noteHardwareInput]);

  // 退格长按连续删除（首次立即删 1 个，按住 400ms 后每 110ms 继续删）
  const bsDelay = useRef<number | null>(null);
  const bsRepeat = useRef<number | null>(null);
  const stopBackspace = useCallback(() => {
    if (bsDelay.current !== null) {
      window.clearTimeout(bsDelay.current);
      bsDelay.current = null;
    }
    if (bsRepeat.current !== null) {
      window.clearInterval(bsRepeat.current);
      bsRepeat.current = null;
    }
  }, []);
  const startBackspace = () => {
    handlersRef.current.pop();
    bsDelay.current = window.setTimeout(() => {
      bsDelay.current = null;
      bsRepeat.current = window.setInterval(() => handlersRef.current.pop(), 110);
    }, 400);
  };
  useEffect(() => stopBackspace, [stopBackspace]);

  /**
   * 底部键盘条高度回写：把实测高度写入 CSS 变量 --dkb-h，页面内容区据此
   * 加底部内边距，"我不会"等按钮不会被键盘条盖住（等价于系统键盘避让）。
   */
  const [barEl, setBarEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!barEl) return;
    const update = () => {
      const h = barEl.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--dkb-h",
        `${Math.round(h)}px`
      );
    };
    update();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(barEl);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
      document.documentElement.style.setProperty("--dkb-h", "0px");
    };
  }, [barEl]);

  const answering = !done && !revealed;
  const showKeyboard = kbVisible && answering;
  let letterIdx = -1;

  return (
    <div className="w-full select-none">
      {answering && (
        <div
          role="textbox"
          aria-label="拼写输入"
          className={`flex flex-wrap items-end justify-center gap-x-5 gap-y-4 ${
            totalLetters > 18 ? "px-2" : ""
          }`}
        >
          {groups.map((g, gi) => (
            <div key={gi} className="flex flex-wrap items-end justify-center" style={{ gap: 5 }}>
              {g.letters.map((ch, li) => {
                letterIdx += 1;
                const i = letterIdx;
                const isTyped = i < typed.length;
                const typedChar = typed[i];
                const correct =
                  isTyped &&
                  (typedChar?.toLowerCase() ?? "") === ch.toLowerCase();
                const isCurrent = i === typed.length && !done;

                const underlineColor = revealed
                  ? "#534AB7"
                  : isTyped
                  ? correct
                    ? "#1D9E75"
                    : "#E24B4A"
                  : "#D8D6E8";
                const charColor = revealed
                  ? "#534AB7"
                  : isTyped
                  ? correct
                    ? "#0F6E56"
                    : "#A32D2D"
                  : "#1F1D2E";
                const display = isTyped
                  ? revealed
                    ? ch
                    : correct
                    ? ch
                    : (typedChar ?? "").toLowerCase()
                  : "";

                return (
                  <div
                    key={li}
                    className="flex flex-col items-center justify-between"
                    style={{ width: 30, height: 58, gap: 10 }}
                  >
                    <div className="flex flex-1 items-center justify-center w-full">
                      {display ? (
                        <span
                          className="font-semibold leading-none"
                          style={{
                            color: charColor,
                            fontSize: revealed ? "30px" : "26px",
                            textShadow: revealed
                              ? "0 0 14px rgba(83,74,183,0.25)"
                              : "none",
                            animation: revealed
                              ? "revealPop .35s ease"
                              : undefined,
                          }}
                        >
                          {display}
                        </span>
                      ) : isCurrent ? (
                        <span
                          className="block w-[2px] h-6 rounded-sm"
                          style={{
                            backgroundColor: "#534AB7",
                            animation: "caretBlink 0.9s steps(1) infinite",
                          }}
                        />
                      ) : null}
                    </div>
                    <span
                      className="block rounded-full shrink-0"
                      style={{
                        width: isCurrent ? 30 : 28,
                        height: isCurrent ? 5 : 4,
                        backgroundColor: underlineColor,
                        transition: "background-color .15s, width .15s",
                      }}
                    />
                  </div>
                );
              })}
              {g.suffix && (
                <div
                  className="flex flex-col items-center justify-between"
                  style={{ width: 22, height: 58, gap: 10 }}
                >
                  <div className="flex flex-1 items-center justify-center w-full text-[22px] leading-none font-medium text-text3">
                    {g.suffix}
                  </div>
                  <span
                    className="block rounded-full shrink-0"
                    style={{ width: 18, height: 4, backgroundColor: "#E8E6F0" }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/*
        底部键盘条：portal 到 body，固定贴屏幕最底部（与系统键盘一致）。
        答题中常驻；检测到物理键盘后收起为一条唤回入口；答对/揭示后整块卸载。
      */}
      {answering &&
        createPortal(
          <div
            ref={setBarEl}
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-primary-lighter shadow-[0_-4px_18px_rgba(83,74,183,0.10)]"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {showKeyboard ? (
              <div className="mx-auto w-full max-w-[420px] p-2">
                {KB_ROWS.map((row, ri) => (
                  <div
                    key={ri}
                    className={`flex gap-[6px] ${ri === 0 ? "" : "mt-[6px]"}`}
                  >
                    {/*
                      两侧留白：第 2 行 0.5（凑满 10 格与第 1 行对齐）；
                      第 3 行 0.835 —— 删除键从 2 格收窄到 1.33 格后省下的
                      0.67 格平均分给两侧，保证三行字母键宽度完全一致。
                      （第 3 行 = 0.835 + 7 + 1.33 + 0.835 = 10）
                    */}
                    {(ri === 1 || ri === 2) && (
                      <span
                        className={`basis-0 ${ri === 2 ? "flex-[0.835]" : "flex-[0.5]"}`}
                      />
                    )}
                    {row.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        aria-label={ch}
                        onMouseDown={(e) => e.preventDefault()}
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={() => handlersRef.current.push(ch)}
                        className="flex h-[44px] flex-1 basis-0 touch-manipulation select-none items-center justify-center rounded-lg bg-white text-[19px] font-medium leading-none text-text shadow-[0_1px_0_rgba(83,74,183,0.10)] transition-[transform,background-color] duration-75 active:scale-[0.94] active:bg-primary-light"
                      >
                        {ch}
                      </button>
                    ))}
                    {ri === 2 && (
                      <button
                        type="button"
                        aria-label="删除"
                        onContextMenu={(e) => e.preventDefault()}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          startBackspace();
                        }}
                        onPointerUp={stopBackspace}
                        onPointerCancel={stopBackspace}
                        onPointerLeave={stopBackspace}
                        /* 删除键宽度 = 1.33 格（原 2 格，收窄约 1/3）；
                           内部 SVG 固定 22px，不随按键缩放 */
                        /* 与字母键同色（text-text），让图标颜色完全一致 */
                        className="flex h-[44px] flex-[1.33] basis-0 touch-manipulation select-none items-center justify-center rounded-lg bg-white text-text shadow-[0_1px_0_rgba(83,74,183,0.10)] transition-[transform,background-color] duration-75 active:scale-[0.94] active:bg-primary-light"
                      >
                        {/* iOS 删除键：上/下/右三边直线带圆角，左边 V 形尖 + 内部 X */}
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          {/* 键帽轮廓：从右上角 (20,5) 起 → 上边横线到 (9,5) → 左斜下到尖 (3,12) → 左斜上到 (9,19) → 下边横线到 (20,19) → 圆角上抬到 (22,17) → 右边竖线 (22,7) → 圆角收口回到 (20,5) */}
                          <path d="M20 5 H9 L3 12 L9 19 H20 A2 2 0 0 0 22 17 V7 A2 2 0 0 0 20 5 Z" />
                          {/* 键帽主体内的叉号 */}
                          <path d="M13 9 L19 15 M19 9 L13 15" />
                        </svg>
                      </button>
                    )}
                    {(ri === 1 || ri === 2) && (
                      <span
                        className={`basis-0 ${ri === 2 ? "flex-[0.835]" : "flex-[0.5]"}`}
                      />
                    )}
                  </div>
                ))}
                {hardwareKeyboardSeen && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setKbVisible(false)}
                    className="mt-1 w-full py-0.5 text-center text-[11px] text-text3"
                  >
                    隐藏屏幕键盘
                  </button>
                )}
              </div>
            ) : (
              /* 检测到物理键盘后，键盘条收起为一条唤回入口 */
              <div className="mx-auto flex w-full max-w-[420px] justify-center px-3 py-2">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setKbVisible(true)}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-1.5 text-xs font-medium text-text2 shadow-sm transition-colors active:bg-primary-lighter"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
                  </svg>
                  使用屏幕键盘
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

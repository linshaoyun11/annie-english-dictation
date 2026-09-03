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
  /**
   * 空格键回调：切换"查看提示"。
   * 屏幕键盘第四行的空格键与物理空格键共用此回调，两者行为完全一致
   * （物理空格键由 LearningCard 的 window keydown 处理）。
   */
  onSpaceKey?: () => void;
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
  onSpaceKey,
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
            /* 供上层手势识别排除：本键盘通过 createPortal 挂到 body，
               DOM 上不在 LearnPage 容器里，但 React 合成事件仍沿组件树
               冒泡到 LearnPage 根容器的 onTouchStart/onTouchEnd。
               若不排除，键盘上的抬手动作（尤其双指交替打字时）会被
               误判成「上滑切题」。上层用 closest() 检测该属性。 */
            data-dictation-keyboard=""
            /* iOS 深色键盘配色：面板 #1C1C1E（近黑），上两角 20px 大圆角。
               下方两角被屏幕底部与安全区遮住，故只做 rounded-t。 */
            className="fixed inset-x-0 bottom-0 z-30 rounded-t-[20px] bg-[#1C1C1E] shadow-[0_-4px_18px_rgba(0,0,0,0.35)]"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            /* 空的 touchstart 监听：iOS Safari 只在元素（或其祖先）注册了
               touch 类监听时，才会在手指按下的那一刻应用 :active 伪类。
               没有它，按键的 active 高亮/缩放要等到 touchend 才出现，
               观感上就是「按下去没反应」。这是启用即时视觉反馈的开关，
               回调本身无需做任何事。 */
            onTouchStart={() => {}}
          >
            {showKeyboard ? (
              /* iOS 深色键盘规格（按 2026-09-02 第二张截图，仅调键大小与间距，
                 布局与交互沿用既有实现）：
                 - 面板 #1C1C1E（近黑）、字母键 #3A3A3C、功能键 #2C2C2E
                 - 字母纯白 #FFFFFF，删除键图标 #E5E5EA（略暗于字母）
                 - 字母键高 46px（原 44px，+2px）/ 字号 21px（原 20px，+1 档）
                 - 第 4 行空格键高 50px（原 48px，+2px），键内小字 "space" #8E8E93
                 - 键圆角 7px（原 9px，收敛），键间距 6px（保持），行间距 12px（保持）
                 - 容器左右 padding 5px，上下 padding 28px（用户上一版明确要求）
                 - 实测高度 = 3×46 + 3×12 + 50 + 28×2 ≈ 280px + 底部安全区
                   （上一版 272px，+8px：三行字母/删除各 +2 = +6，空格键 +2）。 */
              <div className="mx-auto w-full max-w-[420px] px-[5px] py-[28px]">
                {KB_ROWS.map((row, ri) => (
                  <div
                    key={ri}
                    className={`flex gap-[6px] ${ri === 0 ? "" : "mt-[12px]"}`}
                    /* 第 2 行（a-l）改用 padding 而非 span 做左右缩进：
                       flex container 每多 1 个 span 就多 1 个 gap，
                       让每份从 (W-9g)/10 压缩到 (W-10g)/10，letter 宽损失 0.6px。
                       现改用 calc((100%+g)/20) 的行 padding，让 letter 占比严格相等。
                       三行项目数 = 10 = 9 gap，每份 (W-9g)/10，Q=A=Z 严格相等。 */
                    style={ri === 1 ? {
                      paddingLeft: 'calc((100% + 6px) / 20)',
                      paddingRight: 'calc((100% + 6px) / 20)',
                    } : undefined}
                  >
                    {/* 三行 flex 份总和 = 10，列宽一致：
                          第 1 行 = 10 letter（两端贴边、无缩进）
                          第 2 行 = 9 letter（行 padding 缩进，不增 gap）
                          第 3 行 = 1.0 缩进 + 7 letter + 1.5 删除 + 0.5 缩进
                        第 3 行左侧留空 1.0 而非 0.5：总和才能凑到 10，使三行
                        列宽严格相等；效果是 z 块比 a 块右移约 0.5 键宽，
                        与 iOS 原生阶梯式排列（Q → A → Z 逐行右移）方向一致。 */}
                    {ri === 2 && <span className="basis-0 flex-[1]" />}
                    {row.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        aria-label={ch}
                        /* 输入时机：用 pointerdown（手指按下即出字），不用 click。
                           click 要等 touchend 才触发，比系统键盘晚一个「手指接触
                           时长」——通常 80~150ms，正是自绘键盘「慢半拍」的主因。
                           iOS 系统键盘就是 touchdown 即插入字符，这里与之对齐。

                           preventDefault 会一并抑制 pointerdown 之后浏览器合成的
                           mousedown/mouseup/click，所以不会重复输入；同时让 button
                           永不获得焦点，避免之后按物理空格/回车被浏览器当成
                           「点了一次该字母键」而误输入。 */
                        onPointerDown={(e) => {
                          e.preventDefault();
                          handlersRef.current.push(ch);
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        className="flex h-[46px] flex-1 basis-0 touch-manipulation select-none items-center justify-center rounded-[7px] bg-[#3A3A3C] text-[21px] font-medium leading-none text-white shadow-[0_1px_0_rgba(0,0,0,0.30)] transition-[transform,background-color] duration-75 active:scale-[0.94] active:bg-[#5A5A5E]"
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
                        /* 退格键：宽度 = 1.5 letter（与 iOS 系统键盘退格一致）
                           SVG 固定 22px 不随键缩放（用户要求"标志大小不变"）。
                           键面用功能键色 #2C2C2E（比字母键 #3A3A3C 暗一档，
                           iOS 原生即如此），图标 #E5E5EA 略暗于字母纯白。 */
                        className="flex h-[46px] flex-[1.5] basis-0 touch-manipulation select-none items-center justify-center rounded-[7px] bg-[#2C2C2E] text-[#E5E5EA] shadow-[0_1px_0_rgba(0,0,0,0.30)] transition-[transform,background-color] duration-75 active:scale-[0.94] active:bg-[#5A5A5E]"
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
                          <path d="M20 5 H9 L3 12 L9 19 H20 A2 2 0 0 0 22 17 V7 A2 2 0 0 0 20 5 Z" />
                          <path d="M13 9 L19 15 M19 9 L13 15" />
                        </svg>
                      </button>
                    )}
                    {ri === 2 && (
                      <span className="basis-0 flex-[0.5]" />
                    )}
                  </div>
                ))}

                {/*
                  第四行：严格按 iOS 截图布局。原 4 个位置——
                    [123] [空格] [return] [hide_kb]
                  其中 123 / return / hide_kb 三个位置删除留空（不渲染按钮），
                  仅中间的「空格键」保留可点击域，按下 = 切换查看提示。

                  空格键左右居中：左侧留空 2.0 letter，右侧留空 2.0 letter
                  （= 原 return 1.4 + hide_kb 0.6，两段合并为一个占位 span，
                    避免中间 5px gap 破坏对称性），空格键 5.5 letter，合计 9.5。
                  左右 grow 相等 → 空格键几何中心与行中心重合。

                  键内文字 "space"：13px 小字 #8E8E93（比字母暗一档，
                  不抢视觉焦点），行为不变 —— 按下仍是切换查看提示。
                */}
                <div className="mt-[12px] flex gap-[6px]">
                  {/* 原「123」位置：留空 2.0，与右侧合计宽度相等 */}
                  <span className="basis-0 flex-[2]" aria-hidden="true" />
                  <button
                    type="button"
                    aria-label="空格：查看提示"
                    /* 与字母键一致：pointerdown 立即响应，且 preventDefault
                       抑制后续合成的 click，避免一次按下触发两次切换。 */
                    onPointerDown={(e) => {
                      e.preventDefault();
                      onSpaceKey?.();
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    className="flex h-[50px] flex-[5.5] basis-0 touch-manipulation select-none items-center justify-center rounded-[7px] bg-[#3A3A3C] text-[13px] font-medium leading-none tracking-wide text-[#8E8E93] shadow-[0_1px_0_rgba(0,0,0,0.30)] transition-[transform,background-color] duration-75 active:scale-[0.98] active:bg-[#5A5A5E]"
                  >
                    space
                  </button>
                  {/* 原「return」+「隐藏键盘」位置：合并留空 2.0，与左侧对称 */}
                  <span className="basis-0 flex-[2]" aria-hidden="true" />
                </div>

                {hardwareKeyboardSeen && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setKbVisible(false)}
                    className="mt-1 w-full py-0.5 text-center text-[11px] text-[#8E8E93]"
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
                  className="flex items-center gap-1.5 rounded-full border border-[#48484A] bg-[#3A3A3C] px-4 py-1.5 text-xs font-medium text-[#E5E5EA] transition-colors active:bg-[#5A5A5E]"
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

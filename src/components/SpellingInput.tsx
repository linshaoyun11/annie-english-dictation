import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const firstInputFired = useRef(false);
  const completedRef = useRef(false);
  const typedLenRef = useRef(0);
  const errorCountRef = useRef(0);
  const strike5FiredRef = useRef(false);
  /**
   * 同步镜像 typed 数组（ref），用于在 pushLetter 里同步检测完成。
   * 后台唤醒后 WebKit 定时器冻结时，React 的 useEffect 可能不触发
   * （状态更新后排队的重渲染被冻结的 event loop 卡住），
   * 因此完成检测必须在输入回调中同步完成，不依赖 useEffect。
   */
  const typedRef = useRef<string[]>([]);

  /**
   * 前台恢复时强制重建 input 元素的 key。
   * iOS 后台挂起后 input 进入"僵尸态"：document.activeElement 指向它、
   * 键盘可见，但 onChange 事件不送达。换 key 让 React 销毁旧 input、
   * 创建新 input，iOS 重新绑定键盘事件。flushSync 确保即使 React
   * 调度器异常也能立即重建。
   */
  const [inputKey, setInputKey] = useState(0);

  /**
   * input 是否"活着"（onChange 事件正常送达）。
   * 前台恢复后设为 false（假定僵尸，直到 onChange 证明活着）。
   * 全局 keydown 兜底据此判断是否需要接管按键：
   * - input 有焦点 && 活着 → 让 onChange 处理
   * - input 有焦点但僵尸 → 全局兜底接管（build 24 失败根因：
   *   旧代码只查 activeElement，僵尸 input 有焦点但 onChange 不触发）
   */
  const inputAliveRef = useRef(false);

  // 最新处理函数引用（全局按键兜底用，避免每帧重绑监听器）
  const handlersRef = useRef<{ push: (c: string) => void; pop: () => void }>({
    push: () => {},
    pop: () => {},
  });

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
    inputAliveRef.current = false; // 新题，假定 input 可能僵尸
    inputRef.current?.focus();
  }, [resetKey]);

  // 点击页面任意处 → 重新聚焦输入层（输入焦点丢失时快速恢复）
  useEffect(() => {
    const onDocClick = () => {
      if (done || revealed) return;
      inputRef.current?.focus();
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [done, revealed]);

  // App 从后台回前台 → 强制重建 input DOM 元素。
  // iOS 后台挂起后 input 进入"僵尸态"：document.activeElement 指向它、
  // 键盘可见，但 onChange 事件不送达 → 打字没反应（"最后字母没反应"根因）。
  // 用 flushSync 换 inputKey → React 同步销毁旧 input、创建新 input。
  // 新 input 不带焦点 → 全局 keydown 兜底处理第一个按键并 focus，
  // 之后新 input 的 onChange 正常工作。
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (done || revealed) {
        // 通关页/正确页/揭示页：回来时主动收起键盘，避免遮挡按钮。
        // inputRef.blur() 可能因僵尸态失效，用原生 Keyboard.hide() 兜底。
        inputRef.current?.blur();
        if (Capacitor.isNativePlatform()) Keyboard.hide();
        return;
      }
      inputAliveRef.current = false; // 假定僵尸，直到 onChange 证明活着
      flushSync(() => {
        setInputKey((k) => k + 1);
      });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [done, revealed]);

  // input 重建后聚焦新元素（visibilitychange 非用户手势，
  // focus 可能不弹键盘，但首次点击/打字时 onDocClick 会补上）
  useEffect(() => {
    if (!done && !revealed) {
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey]);

  // input 重建后重新设置 DOM 属性：iOS WKWebView 在 inputKey 换 key 销毁旧
  // input、创建新 input 时，React 设置的 autocapitalize/inputmode 等属性
  // 可能不被 iOS 立即应用（键盘仍显示默认大写/中文）。直接通过 DOM API
  // 重新设置，触发 iOS 重新评估键盘配置。
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.setAttribute("autocapitalize", "none");
    el.setAttribute("autocomplete", "off");
    el.setAttribute("autocorrect", "off");
    el.setAttribute("inputmode", "latin");
    el.setAttribute("lang", "en");
    el.setAttribute("pattern", "[a-zA-Z]*");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey]);

  useEffect(() => {
    if (revealSignal > 0) {
      completedRef.current = true;
      typedLenRef.current = totalLetters;
      typedRef.current = [...allLetters];
      setTyped([...allLetters]);
      setDone(true);
      setRevealed(true);
      // 揭示答案后收起键盘，避免"我不会"页/正确页还弹出键盘遮挡内容
      inputRef.current?.blur();
    }
  }, [revealSignal, allLetters, totalLetters]);

  useEffect(() => {
    if (done || completedRef.current) return;
    if (typed.length !== totalLetters) return;
    const allCorrect = typed.every(
      (ch, i) => ch.toLowerCase() === allLetters[i].toLowerCase()
    );
    if (!allCorrect) return;
    completedRef.current = true;
    setDone(true);
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    // 答对后收起键盘，避免正确页继续占用屏幕空间
    inputRef.current?.blur();
    onComplete();
  }, [typed, totalLetters, allLetters, done, onComplete]);

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
    // 同步检测完成：后台唤醒后 WebKit 定时器冻结可能导致
    // useEffect 不触发，因此在输入回调中直接检查并调用 onComplete
    if (next.length === totalLetters && !completedRef.current) {
      const allCorrect = next.every(
        (ch, i) => ch.toLowerCase() === allLetters[i].toLowerCase()
      );
      if (allCorrect) {
        completedRef.current = true;
        setDone(true);
        if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
        inputRef.current?.blur();
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

  // 全局按键兜底：焦点不在输入层或 input 僵尸时，字母/退格直接进入拼写逻辑。
  // 覆盖"焦点静默丢失但键盘仍在"和"僵尸 input（有焦点但 onChange 不触发）"两种场景。
  // 关键：不能只查 document.activeElement —— 僵尸 input 有焦点但 onChange 不触发，
  // 旧代码（build 24）因此跳过全局兜底，导致后台唤醒后打字完全无反应。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || revealed) return;
      // input 有焦点 AND onChange 正常工作 → 让 onChange 处理
      if (document.activeElement === inputRef.current && inputAliveRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.isComposing || e.keyCode === 229) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return; // 焦点在别的真实输入框（如密码框）时不抢按键
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handlersRef.current.push(e.key);
        inputRef.current?.focus();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handlersRef.current.pop();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, revealed]);

  // 受控 diff：对比新旧值推导新增/删除，iOS 联想或快速输入一次多个字符也能正确处理
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    inputAliveRef.current = true; // onChange 送达 → input 不是僵尸
    const val = e.target.value;
    const prev = typedRef.current.join("");
    if (val.length > prev.length) {
      for (const c of val.slice(prev.length)) pushLetter(c);
    } else if (val.length < prev.length) {
      for (let i = 0; i < prev.length - val.length; i++) popLetter();
    }
  };

  let letterIdx = -1;

  return (
    <div
      className="relative w-full select-none"
      onClick={() => !done && inputRef.current?.focus()}
    >
      {/*
        真实透明输入层（覆盖整个拼写区域）：
        - 答题中：absolute inset-0 覆盖字母区，尺寸足够大，iOS 稳定触发 onChange
          （旧版 1x1 隐藏 input 在 iOS 上会丢最后一位/丢事件）
        - 已完成/已揭示：固定在底部的隐形输入层（非 display:none，不丢焦点），
          保持键盘弹出，"正确页"不上下跳动；进入下一题时焦点原位复用
      */}
      <input
        key={inputKey}
        ref={inputRef}
        type="text"
        value={typed.join("")}
        onChange={handleChange}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="text"
        lang="en"
        pattern="[a-zA-Z]*"
        aria-label="拼写输入"
        className={
          done || revealed
            ? "pointer-events-none fixed bottom-0 left-0 h-11 w-full opacity-0"
            : "absolute inset-0 z-10 w-full cursor-text opacity-0"
        }
        style={{ fontSize: 16 }}
      />
      {!(done || revealed) && (
        <div
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
    </div>
  );
}

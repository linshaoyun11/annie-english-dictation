import { useEffect, useMemo, useRef, useState } from "react";

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

  // 最新处理函数引用（全局按键兜底用，避免每帧重绑监听器）
  const handlersRef = useRef<{ push: (c: string) => void; pop: () => void }>({
    push: () => {},
    pop: () => {},
  });

  useEffect(() => {
    setTyped([]);
    setDone(false);
    setRevealed(false);
    firstInputFired.current = false;
    completedRef.current = false;
    typedLenRef.current = 0;
    errorCountRef.current = 0;
    strike5FiredRef.current = false;
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

  // App 从后台回前台 → 主动恢复焦点。
  // iOS 后台挂起后 input 焦点可能失效（按键事件不再送达），
  // 这正是"输完没反应 / 输对不跳转"且重启才好的根因。
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (done || revealed) return;
      inputRef.current?.focus();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [done, revealed]);

  useEffect(() => {
    if (revealSignal > 0) {
      completedRef.current = true;
      typedLenRef.current = totalLetters;
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
    setTyped((prev) => {
      if (prev.length >= totalLetters) return prev;
      return [...prev, c];
    });
    if (!firstInputFired.current) {
      firstInputFired.current = true;
      onFirstInput?.();
    }
  };

  const popLetter = () => {
    if (done) return;
    if (typedLenRef.current > 0) typedLenRef.current -= 1;
    setTyped((prev) => prev.slice(0, -1));
  };

  handlersRef.current = { push: pushLetter, pop: popLetter };

  // 全局按键兜底：焦点不在输入层时，字母/退格直接进入拼写逻辑。
  // 覆盖"焦点静默丢失但键盘仍在"的边缘场景（iOS 后台恢复后偶发）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || revealed) return;
      if (document.activeElement === inputRef.current) return;
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
    const val = e.target.value;
    const prev = typed.join("");
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
            <div key={gi} className="flex items-end" style={{ gap: 5 }}>
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

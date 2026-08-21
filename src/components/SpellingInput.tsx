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

  useEffect(() => {
    const onDocClick = () => {
      if (done || revealed) return;
      inputRef.current?.focus();
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [done, revealed]);

  useEffect(() => {
    if (revealSignal > 0) {
      completedRef.current = true;
      typedLenRef.current = totalLetters;
      setTyped([...allLetters]);
      setDone(true);
      setRevealed(true);
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

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const val = el.value;
    el.value = "";
    for (const c of val) {
      if (isLetter(c)) pushLetter(c);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      popLetter();
    }
  };

  let letterIdx = -1;

  return (
    <div
      className="relative w-full select-none"
      onClick={() => !done && inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        className="absolute opacity-0 pointer-events-none"
        style={{ top: 0, left: 0, width: 1, height: 1 }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        value=""
        onChange={() => {}}
      />
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
                  : (typedChar ?? "").toUpperCase()
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
    </div>
  );
}

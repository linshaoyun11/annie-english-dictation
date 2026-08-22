import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAllEntries,
  getCurriculum,
  gradeLabel,
  type CurriculumVersion,
} from "../data/curriculum";
import {
  type Progress,
  freshProgress,
  makeUnitOrder,
  saveProgress,
} from "../lib/progress";
import { pointsForEntry, type User } from "../lib/users";
import { randomMovieQuote, type MovieQuote } from "../data/movieQuotes";
import { useSpeechLoop, primeSpeech } from "../hooks/useSpeechLoop";
import { prefetchAudio } from "../lib/audio";
import { playCelebrationJingle } from "../lib/celebration";
import LearningCard from "../components/LearningCard";

interface LearnPageProps {
  onExit: () => void;
  progress: Progress;
  setProgress: React.Dispatch<React.SetStateAction<Progress>>;
  user: User;
  version: CurriculumVersion;
  addPoints: (userId: string, points: number, learnedDelta: number) => void;
  onRestart: () => void;
  /** 重点记忆学习模式：difficultOrder 为打乱后的难词条目 id 列表 */
  difficultMode?: boolean;
  difficultOrder?: string[];
}

/** 普通模式下当前题的 entry id */
function entryIdOf(progress: Progress): string {
  return progress.unitOrder[progress.entryIndex] ?? "";
}

function formatDateTime(ts?: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const mins = Math.max(Math.round(ms / 60000), 1);
  if (mins < 60) return `${mins} 分钟`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时 ${mins % 60} 分钟`;
  const days = Math.floor(hours / 24);
  return `${days} 天 ${hours % 24} 小时`;
}

function StatCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-3 text-left shadow-card">
      <p className="text-[11px] text-text3">{label}</p>
      <p className={`mt-1 text-xs font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}

export default function LearnPage({
  onExit,
  progress,
  setProgress,
  user,
  version,
  addPoints,
  onRestart,
  difficultMode = false,
  difficultOrder = [],
}: LearnPageProps) {
  const speech = useSpeechLoop(3000);
  const touchStartY = useRef<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [finishedAll, setFinishedAll] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  // 重点记忆模式：独立的当前索引 + 全部学完提示
  const [difficultIndex, setDifficultIndex] = useState(0);
  const [difficultDone, setDifficultDone] = useState(false);
  // 双保险：记录本次会话已加分的题目，防止同一题 onComplete 被多次调用导致重复加分
  const awardedRef = useRef<Set<string>>(new Set());
  // 最近处理（答对 / 我不会）的词条所属单元（单元完成祝贺检测用，避免切题竞态）
  const lastProcessedUnitRef = useRef<string | null>(null);
  // 最新进度引用：goNext 会被 LearningCard 答对后的 2s 自动跳题定时器以旧闭包调用，
  // 该闭包里的 progress 不包含刚答对的最后一题（setProgress 尚未提交），
  // 单元完成判定会永远读到旧数据导致祝贺页不弹，故用 ref 读取最新值。
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);
  // 防止 goNext / 祝贺页继续 被快速重复触发导致进度回退或重复弹窗
  const busyRef = useRef(false);
  // 单元/年级完成祝贺弹窗（unitKey: `${grade}-${unit}`；level 区分只祝词还是带统计）
  const [celebration, setCelebration] = useState<{
    unitKey: string;
    level: "unit" | "grade";
    quote: MovieQuote;
  } | null>(null);

  const cur = getCurriculum(version);
  const accent = user.config.accent;

  const allEntriesMap = useMemo(
    () => new Map(getAllEntries(version).map((e) => [e.id, e])),
    [version]
  );

  const unit = cur[progress.unitIndex];
  // 重点记忆模式：从打乱的难词列表取当前条目，并解析其所在单元
  const difficultEntry = difficultMode
    ? allEntriesMap.get(difficultOrder[difficultIndex] ?? "")
    : undefined;
  const difficultUnit = difficultEntry
    ? cur.find(
        (u) => u.grade === difficultEntry.grade && u.unit === difficultEntry.unit
      )
    : undefined;

  const entry = difficultMode
    ? difficultEntry
    : (unit.entries.find((e) => e.id === entryIdOf(progress)) ?? unit.entries[0]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  };

  // 键盘避让已全局化（App.tsx 统一设置 --kb-h），此处不再重复处理。

  // 预加载后续几题的音频：切题时真人录音已在缓存，零等待直放。
  useEffect(() => {
    // 重点记忆模式：预取难词列表后续 3 题
    if (difficultMode) {
      const texts: string[] = [];
      for (let i = difficultIndex + 1; i <= difficultIndex + 3; i++) {
        const e = difficultOrder[i]
          ? allEntriesMap.get(difficultOrder[i])
          : undefined;
        if (e) texts.push(e.english);
      }
      texts.forEach((t) => prefetchAudio(t, accent));
      return;
    }
    const texts: string[] = [];
    const order = progress.unitOrder;
    // 当前单元后续 3 题
    for (let i = progress.entryIndex + 1; i <= progress.entryIndex + 3; i++) {
      const id = order[i];
      if (!id) break;
      const e = unit.entries.find((x) => x.id === id);
      if (e) texts.push(e.english);
    }
    // 当前单元最后一题时，预取下一单元第 1 题
    if (progress.entryIndex + 1 >= order.length) {
      const nextUnit = cur[progress.unitIndex + 1];
      if (nextUnit?.entries[0]) texts.push(nextUnit.entries[0].english);
    }
    texts.forEach((t) => prefetchAudio(t, accent));
  }, [
    difficultMode,
    difficultIndex,
    difficultOrder,
    allEntriesMap,
    accent,
    cur,
    progress.entryIndex,
    progress.unitIndex,
    progress.unitOrder,
    unit,
  ]);

  const markComplete = useCallback(
    (id: string) => {
      // 记录最近处理词条的单元，供"单元完成"祝贺检测使用
      const src = difficultMode
        ? allEntriesMap.get(id)
        : unit.entries.find((e) => e.id === id);
      if (src) lastProcessedUnitRef.current = `${src.grade}-${src.unit}`;
      // 双保险：同一题只加一次分（防止 onComplete 被多次调用）
      if (!awardedRef.current.has(id)) {
        awardedRef.current.add(id);
        const pts = src ? pointsForEntry(src.type) : 5;
        addPoints(user.id, pts, 1);
      }
      // 函数式更新：基于最新 state 合并，防止被旧闭包覆盖
      setProgress((prev) =>
        prev.completedEntryIds.includes(id)
          ? prev
          : { ...prev, completedEntryIds: [...prev.completedEntryIds, id] }
      );
    },
    [setProgress, unit, allEntriesMap, addPoints, user.id, difficultMode]
  );

  const goNext = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const release = () => {
      window.setTimeout(() => {
        busyRef.current = false;
      }, 50);
    };

    // 重点记忆模式：遍历难词列表，全部学完弹完成提示
    if (difficultMode) {
      const nextIndex = difficultIndex + 1;
      if (nextIndex < difficultOrder.length) {
        setDifficultIndex(nextIndex);
        setAnimKey((k) => k + 1);
      } else {
        setDifficultDone(true);
      }
      release();
      return;
    }

    // 单元完成检测：最近处理的词条所属单元，若全部词条都已处理过（答对 或 点过"我不会"）
    // 则弹出祝贺页并停在这里，等用户点"继续学习"再真正切题。
    // 放在 goNext 里触发，保证"我不会"揭示答案后用户先看完答案，离开时再弹。
    // 注意：必须读 progressRef（最新值），因为本函数可能被 1.8s 定时器以旧闭包调用。
    const p = progressRef.current;
    const lastKey = lastProcessedUnitRef.current;
    if (lastKey && !(p.celebratedUnits ?? []).includes(lastKey)) {
      const lastUnit = cur.find((u) => `${u.grade}-${u.unit}` === lastKey);
      if (lastUnit) {
        const isProcessed = (id: string) =>
          p.completedEntryIds.includes(id) || p.difficultEntryIds.includes(id);
        const allProcessed = lastUnit.entries.every((e) => isProcessed(e.id));
        if (allProcessed) {
          // 年级是否也全部学完（该年级所有单元的词条都处理过）→ 升级为年级祝贺（带统计）
          const gradeAllDone = cur
            .filter((u) => u.grade === lastUnit.grade)
            .every((uu) => uu.entries.every((e) => isProcessed(e.id)));
          // 持久化标记：该单元已庆祝，避免重复弹出
          setProgress((prev) =>
            prev.celebratedUnits?.includes(lastKey)
              ? prev
              : {
                  ...prev,
                  celebratedUnits: [...(prev.celebratedUnits ?? []), lastKey],
                }
          );
          speech.stop(); // 停掉后台朗读，避免祝贺页背后响着下一题的音频
          playCelebrationJingle(); // 播放简短庆祝音效
          setCelebration({
            unitKey: lastKey,
            level: gradeAllDone ? "grade" : "unit",
            quote: randomMovieQuote(),
          });
          release();
          return;
        }
      }
    }

    const nextIndex = p.entryIndex + 1;
    if (nextIndex < p.unitOrder.length) {
      setProgress((prev) => ({ ...prev, entryIndex: nextIndex }));
    } else {
      const nextUnitIndex = p.unitIndex + 1;
      if (nextUnitIndex < cur.length) {
        setProgress((prev) => ({
          ...prev,
          unitIndex: nextUnitIndex,
          entryIndex: 0,
          unitOrder: makeUnitOrder(nextUnitIndex, version),
        }));
      } else {
        setFinishedAll(true);
        release();
        return;
      }
    }
    setAnimKey((k) => k + 1);
    release();
  }, [
    difficultMode,
    difficultIndex,
    difficultOrder.length,
    setProgress,
    cur,
    version,
    setCelebration,
    speech,
  ]);

  /** 记录"曾经拼错或不会"的词条（去重），供年级完成页统计 */
  const addMistake = useCallback(
    (id: string) => {
      setProgress((prev) =>
        prev.mistakeEntryIds?.includes(id)
          ? prev
          : {
              ...prev,
              mistakeEntryIds: [...(prev.mistakeEntryIds ?? []), id],
            }
      );
    },
    [setProgress]
  );

  const markDontKnow = useCallback(
    (id: string) => {
      // 记录最近处理词条的单元，供"单元完成"祝贺检测使用（"我不会"也算处理过）
      const src = difficultMode
        ? allEntriesMap.get(id)
        : unit.entries.find((e) => e.id === id);
      if (src) lastProcessedUnitRef.current = `${src.grade}-${src.unit}`;
      setProgress((prev) =>
        prev.difficultEntryIds.includes(id)
          ? prev
          : {
              ...prev,
              difficultEntryIds: [...prev.difficultEntryIds, id],
            }
      );
      addMistake(id); // "我不会"也计入拼错/不会统计
      showToast("📝 已加入重点记忆");
    },
    [setProgress, addMistake, unit, allEntriesMap, difficultMode]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (dy < -60) {
      // 祝贺页打开时禁止上滑切题（祝贺页内容滚动也会冒泡到这里）
      if (celebration) return;
      if (finishedAll || difficultDone) return;
      if (!entry) return;
      if (
        !progress.completedEntryIds.includes(entry.id) &&
        !progress.difficultEntryIds.includes(entry.id)
      ) {
        showToast("请先完成当前拼写");
        return;
      }
      goNext();
    }
  };

  // 祝贺页"继续学习"：按钮点击与空格键共用。
  // 显式推进进度，不依赖 progressRef/lastProcessedUnitRef，避免竞态导致回到刚完成单元的最后一词。
  const continueFromCelebration = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setCelebration(null);
    setProgress((prev) => {
      const nextIndex = prev.entryIndex + 1;
      if (nextIndex < prev.unitOrder.length) {
        return { ...prev, entryIndex: nextIndex };
      }
      const nextUnitIndex = prev.unitIndex + 1;
      if (nextUnitIndex < cur.length) {
        return {
          ...prev,
          unitIndex: nextUnitIndex,
          entryIndex: 0,
          unitOrder: makeUnitOrder(nextUnitIndex, version),
        };
      }
      return prev;
    });
    lastProcessedUnitRef.current = null;
    setAnimKey((k) => k + 1);
    window.setTimeout(() => {
      busyRef.current = false;
    }, 80);
  }, [cur.length, version, setProgress]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 祝贺页打开时只屏蔽 Enter/Escape，避免误触切题或返回首页播放音频
      if (celebration) return;
      if (e.key === "Enter" && !difficultDone) goNext();
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, onExit, difficultDone, celebration]);

  // 同步当前学习位置到所属年级（gradeProgress），供首页年级卡片恢复进度。
  // 正常学习 / 祝贺页继续 / 上滑切题等所有推进路径最终都会改 unitIndex/entryIndex，
  // 在这里统一落盘，无需在每个推进点手动保存。
  useEffect(() => {
    if (difficultMode) return;
    const g = String(unit.grade);
    setProgress((prev) => {
      const gp = prev.gradeProgress ?? {};
      const saved = gp[g];
      if (
        saved &&
        saved.unitIndex === prev.unitIndex &&
        saved.entryIndex === prev.entryIndex &&
        saved.unitOrder === prev.unitOrder
      ) {
        return prev;
      }
      return {
        ...prev,
        gradeProgress: {
          ...gp,
          [g]: {
            unitIndex: prev.unitIndex,
            entryIndex: prev.entryIndex,
            unitOrder: prev.unitOrder,
          },
        },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.grade, progress.unitIndex, progress.entryIndex, difficultMode]);

  // 记录各单元首次开始学习的时间（用于完成页展示"开始学习时间 / 完成用时"）
  useEffect(() => {
    if (!entry) return;
    const k = `${entry.grade}-${entry.unit}`;
    setProgress((prev) =>
      prev.unitStartedAt?.[k]
        ? prev
        : {
            ...prev,
            unitStartedAt: { ...(prev.unitStartedAt ?? {}), [k]: Date.now() },
          }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.grade, entry?.unit]);

  // 单元完成检测已迁移到 goNext 内：答对/点"我不会"都会更新 lastProcessedUnitRef，
  // 离开当前词条（切题）时检查所属单元是否全部处理过，是则弹祝贺页。

  const restart = () => {
    const p = freshProgress(version);
    setProgress(p);
    saveProgress(user.id, p);
    setFinishedAll(false);
    setAnimKey((k) => k + 1);
  };

  // 祝贺页数据：单元级只提供标题信息；年级级提供完整学习统计
  const celebrationStats = useMemo(() => {
    if (!celebration) return null;
    const unitInfo = cur.find(
      (u) => `${u.grade}-${u.unit}` === celebration.unitKey
    );
    if (!unitInfo) return null;

    // 单元级：只展示祝贺信息 + 台词，不带统计
    if (celebration.level === "unit") {
      return {
        level: "unit" as const,
        grade: unitInfo.grade,
        unit: unitInfo.unit,
        title: unitInfo.title,
        quote: celebration.quote,
      };
    }

    // 年级级：整个年级的学习统计
    const gradeUnits = cur.filter((u) => u.grade === unitInfo.grade);
    const gradeEntries = gradeUnits.flatMap((u) => u.entries);
    const gradeIds = new Set(gradeEntries.map((e) => e.id));
    const doneCount = gradeEntries.length;
    const unitCount = gradeUnits.length;
    const mistakeCount = (progress.mistakeEntryIds ?? []).filter((id) =>
      gradeIds.has(id)
    ).length;
    const onceRight = Math.max(doneCount - mistakeCount, 0);
    const gradePoints = progress.completedEntryIds.reduce((s, id) => {
      if (!gradeIds.has(id)) return s;
      const e = allEntriesMap.get(id);
      return s + (e ? pointsForEntry(e.type) : 5);
    }, 0);
    // 年级开始时间 = 该年级各单元开始时间的最早值
    const starts = gradeUnits
      .map((u) => progress.unitStartedAt?.[`${u.grade}-${u.unit}`])
      .filter((t): t is number => typeof t === "number");
    const startAt = starts.length ? Math.min(...starts) : undefined;
    return {
      level: "grade" as const,
      grade: unitInfo.grade,
      unitCount,
      quote: celebration.quote,
      doneCount,
      mistakeCount,
      onceRight,
      gradePoints,
      startAt,
      durationMs: startAt ? Date.now() - startAt : 0,
    };
  }, [celebration, cur, progress, allEntriesMap]);

  if (!entry) return null;

  if (finishedAll) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success-light ring-4 ring-white shadow-card">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text">全部学完了！</h2>
          <p className="mt-2 text-sm text-text2">
            你已完成 1-9 年级全部内容，可以重新开始巩固复习。
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onRestart}
            className="rounded-full border border-border bg-surface px-6 py-2.5 text-sm font-medium text-text2 transition-colors active:bg-primary-lighter"
          >
            重置进度
          </button>
          <button
            type="button"
            onClick={restart}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(83,74,183,0.35)] transition-transform active:scale-[0.97]"
          >
            重新学习
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative h-full overflow-hidden bg-bg transition-[padding] duration-200 ease-out"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div key={animKey} className="h-full animate-[cardIn_.35s_ease]">
        <LearningCard
          entry={entry}
          onExit={onExit}
          unitTitle={
            difficultMode
              ? `重点记忆 · ${difficultUnit?.title ?? ""}`
              : `第 ${unit.unit} 单元 · ${unit.title}`
          }
          orderInUnit={
            difficultMode ? difficultIndex + 1 : progress.entryIndex + 1
          }
          unitSize={
            difficultMode
              ? difficultOrder.length
              : progress.unitOrder.length || unit.entries.length
          }
          onComplete={markComplete}
          onNext={goNext}
          onDontKnow={markDontKnow}
          onMistake={addMistake}
          frozen={celebration !== null}
          autoNext={user.config.autoNext ?? false}
          replay={speech.replayNow}
          stopAudio={speech.stop}
          startAudio={(t) => {
            primeSpeech();
            speech.start(t, 1.0, accent);
          }}
        />
      </div>

      {/* 单元/年级完成祝贺页 */}
      {celebrationStats && (
        <div className="absolute inset-0 z-40 overflow-y-auto bg-gradient-to-b from-primary-lighter via-bg to-[#FFF9EC] px-8 py-12">
          <div className="mx-auto flex max-w-sm flex-col items-center text-center">
            <div className="text-5xl animate-[badgePop_.5s_cubic-bezier(.34,1.56,.64,1)]">
              🎉
            </div>
            {celebrationStats.level === "unit" ? (
              <>
                <h2 className="mt-3 text-xl font-semibold text-text">
                  恭喜完成 {gradeLabel(celebrationStats.grade)}第{" "}
                  {celebrationStats.unit} 单元！
                </h2>
                <p className="mt-1.5 text-sm leading-5 text-text2">
                  <span className="font-semibold text-text">
                    {celebrationStats.title}
                  </span>
                  ——通过努力学习，你完成了本单元的听写练习，太棒了！
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-3 text-xl font-semibold text-text">
                  恭喜通关 {gradeLabel(celebrationStats.grade)}！
                </h2>
                <p className="mt-1.5 text-sm leading-5 text-text2">
                  {celebrationStats.unitCount} 个单元、{celebrationStats.doneCount}{" "}
                  个词条全部学完，你用坚持和努力完成了整个年级的听写练习，太了不起了！
                </p>
              </>
            )}

            {/* 学习信息统计（仅年级完成时展示） */}
            {celebrationStats.level === "grade" && (
              <div className="mt-6 grid w-full grid-cols-2 gap-2.5">
                <StatCard label="📅 开始学习" value={formatDateTime(celebrationStats.startAt)} valueColor="text-text" />
                <StatCard label="⏱️ 完成用时" value={formatDuration(celebrationStats.durationMs)} valueColor="text-text" />
                <StatCard label="💪 拼错或不会" value={`${celebrationStats.mistakeCount} 个词条`} valueColor="text-error" />
                <StatCard label="✅ 一次做对" value={`${celebrationStats.onceRight} 个词条`} valueColor="text-success" />
                <StatCard label="⭐ 本年级积分" value={`+${celebrationStats.gradePoints} 分`} valueColor="text-gold" />
                <StatCard label="📚 完成词条" value={`${celebrationStats.doneCount}/${celebrationStats.doneCount} 全部学完`} valueColor="text-text" />
              </div>
            )}

            {/* 随机电影台词 */}
            <div className={`w-full rounded-2xl bg-[#FAEEDA] px-5 py-4 animate-[slideUp_.4s_ease] ${celebrationStats.level === "unit" ? "mt-6" : "mt-4"}`}>
              {celebrationStats.quote.en && (
                <p className="text-sm italic leading-6 text-[#854F0B]">
                  “{celebrationStats.quote.en}”
                </p>
              )}
              <p className="mt-1.5 text-sm font-semibold leading-6 text-[#854F0B]">
                {celebrationStats.quote.cn}
              </p>
              <p className="mt-1.5 text-xs text-[#854F0B]/70">
                —— 电影《{celebrationStats.quote.movie}》
              </p>
            </div>

            <button
              type="button"
              onClick={continueFromCelebration}
              className="mt-6 w-full rounded-full bg-primary py-3 text-[15px] font-semibold text-white shadow-[0_6px_20px_rgba(83,74,183,0.35)] transition-transform active:scale-[0.98]"
            >
              继续学习
            </button>
            <button
              type="button"
              onClick={onExit}
              className="mt-3 w-full rounded-full border border-border bg-surface py-2.5 text-sm font-medium text-text2 transition-colors active:bg-primary-lighter"
            >
              返回首页
            </button>
          </div>
        </div>
      )}

      {/* 重点记忆全部学完提示 */}
      {difficultMode && difficultDone && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-8">
          <div className="w-full max-w-xs animate-[fadeIn_.2s_ease] rounded-3xl bg-surface p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-light">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 className="mt-3 text-base font-semibold text-text">重点记忆已全部学完！</h2>
            <p className="mt-1.5 text-sm text-text2">
              太棒了，所有重点词都复习了一遍。
            </p>
            <button
              type="button"
              onClick={onExit}
              className="mt-5 w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(83,74,183,0.35)] transition-transform active:scale-[0.98]"
            >
              确定
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 animate-[fadeIn_.2s_ease]">
          <span className="rounded-full bg-text/85 px-4 py-1.5 text-xs font-medium text-white shadow-lg">
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAllEntries,
  getCurriculum,
  gradeLabel,
  type CurriculumVersion,
} from "../data/curriculum";
import {
  type GradeState,
  type Progress,
  findResumePosition,
  freshGradeState,
  freshProgress,
  gradeStartIndex,
  makeUnitOrder,
  processedOf,
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

/** 年级完成（一轮通关）祝贺页的统计快照（在轮次清零前计算） */
interface GradeStatsSnapshot {
  grade: number;
  unitCount: number;
  doneCount: number;
  mistakeCount: number;
  onceRight: number;
  gradePoints: number;
  startAt?: number;
  durationMs: number;
  /** 完成本轮后的轮次数（原 rounds + 1） */
  rounds: number;
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
  // 最新进度引用：goNext 会被 LearningCard 答对后的自动跳题定时器以旧闭包调用，
  // 该闭包里的 progress 不包含刚答对的最后一题（setProgress 尚未提交），
  // 单元完成判定会永远读到旧数据导致祝贺页不弹，故用 ref 读取最新值。
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);
  // 防止 goNext / 祝贺页继续 被快速重复触发导致进度回退或重复弹窗
  const busyRef = useRef(false);
  // 单元/年级完成祝贺弹窗（unitKey: `${grade}-${unit}`；grade 快照在轮次清零前计算）
  const [celebration, setCelebration] = useState<{
    unitKey: string;
    level: "unit" | "grade";
    quote: MovieQuote;
    grade?: GradeStatsSnapshot;
  } | null>(null);

  const cur = getCurriculum(version);
  const accent = user.config.accent;

  const allEntriesMap = useMemo(
    () => new Map(getAllEntries(version).map((e) => [e.id, e])),
    [version]
  );

  // ── 年级独立进度：当前学习状态来自 activeGrade（重点记忆模式不使用） ──
  const gs: GradeState =
    progress.grades[String(progress.activeGrade)] ??
    freshGradeState(version, progress.activeGrade);
  const unit = cur[gs.unitIndex] ?? cur[0];
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
    : (unit.entries.find((e) => e.id === (gs.unitOrder[gs.entryIndex] ?? "")) ??
      unit.entries[0]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  };

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
    const order = gs.unitOrder;
    // 当前单元后续 3 题
    for (let i = gs.entryIndex + 1; i <= gs.entryIndex + 3; i++) {
      const id = order[i];
      if (!id) break;
      const e = unit.entries.find((x) => x.id === id);
      if (e) texts.push(e.english);
    }
    // 当前单元最后一题时，预取同年级下一单元第 1 题
    if (gs.entryIndex + 1 >= order.length) {
      const nextUnit = cur[gs.unitIndex + 1];
      if (nextUnit && nextUnit.grade === unit.grade && nextUnit.entries[0]) {
        texts.push(nextUnit.entries[0].english);
      }
    }
    texts.forEach((t) => prefetchAudio(t, accent));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    difficultMode,
    difficultIndex,
    difficultOrder,
    allEntriesMap,
    accent,
    gs.unitIndex,
    gs.entryIndex,
    gs.unitOrder,
    unit,
  ]);

  const markComplete = useCallback(
    (id: string) => {
      // 记录最近处理词条的单元，供"单元完成"祝贺检测使用
      const src = difficultMode
        ? allEntriesMap.get(id)
        : unit.entries.find((e) => e.id === id);
      if (src) lastProcessedUnitRef.current = `${src.grade}-${src.unit}`;

      if (difficultMode) {
        // 拼对一次即视为"学习过"，之后才允许从重点记忆列表移除
        setProgress((prev) =>
          prev.difficultStudiedIds?.includes(id)
            ? prev
            : {
                ...prev,
                difficultStudiedIds: [...(prev.difficultStudiedIds ?? []), id],
              }
        );
        // 重点记忆学习：积分只加一次（持久化 difficultAwardedIds 去重），
        // 重复学习不再加分；不写年级进度（重点记忆不参与进度推进）
        if (!awardedRef.current.has(id)) {
          awardedRef.current.add(id);
          const awarded = progressRef.current.difficultAwardedIds ?? [];
          if (!awarded.includes(id)) {
            const pts = src ? pointsForEntry(src.type) : 5;
            addPoints(user.id, pts, 1);
            setProgress((prev) => ({
              ...prev,
              difficultAwardedIds: [...(prev.difficultAwardedIds ?? []), id],
            }));
          }
        }
        return;
      }

      // 普通模式：积分规则不变 —— 每轮学习照常加分。
      // awardedRef 防同一题并发重复加分；轮次清零后重学（completed 已清空）可再次加分。
      const gsNow = progressRef.current.grades[
        String(progressRef.current.activeGrade)
      ];
      const alreadyCompleted = gsNow?.completedEntryIds.includes(id) ?? false;
      if (!alreadyCompleted || !awardedRef.current.has(id)) {
        awardedRef.current.add(id);
        const pts = src ? pointsForEntry(src.type) : 5;
        addPoints(user.id, pts, 1);
      }
      // 记入当前年级本轮完成集合
      setProgress((prev) => {
        const gk = String(prev.activeGrade);
        const g = prev.grades[gk];
        if (!g || g.completedEntryIds.includes(id)) return prev;
        return {
          ...prev,
          grades: {
            ...prev.grades,
            [gk]: { ...g, completedEntryIds: [...g.completedEntryIds, id] },
          },
        };
      });
    },
    [setProgress, unit, allEntriesMap, addPoints, user.id, difficultMode]
  );

  /**
   * 当前词条离开后的推进位置（普通模式，限制在当前年级内）：
   * - 单元内 → 下一个未处理词条（跳过本轮已处理词条）
   * - 单元结束 → 年级内向后找第一个含未处理词条的单元
   * - 年级内全部处理完 → "grade-complete"（一轮完成：清零 + 轮数 +1）
   */
  const nextPositionAfter = useCallback(
    (p: Progress):
      | "grade-complete"
      | { unitIndex: number; entryIndex: number; unitOrder: string[] } => {
      const g = p.grades[String(p.activeGrade)];
      if (!g) return "grade-complete";
      const grade = cur[g.unitIndex]?.grade ?? p.activeGrade;
      const processed = processedOf(g);

      // 当前单元内下一个未处理词条
      let ei = g.entryIndex + 1;
      while (ei < g.unitOrder.length && processed.has(g.unitOrder[ei])) ei += 1;
      if (ei < g.unitOrder.length) {
        return { unitIndex: g.unitIndex, entryIndex: ei, unitOrder: g.unitOrder };
      }

      // 年级内向后找
      for (
        let ui = g.unitIndex + 1;
        ui < cur.length && cur[ui].grade === grade;
        ui += 1
      ) {
        const order = makeUnitOrder(ui, version);
        let e = 0;
        while (e < order.length && processed.has(order[e])) e += 1;
        if (e < order.length) {
          return { unitIndex: ui, entryIndex: e, unitOrder: order };
        }
      }
      // 边角：保存位置之前还有未处理单元（中途跳学）→ 回到年级开头找
      const gradeStart = gradeStartIndex(version, grade);
      for (let ui = gradeStart; ui < g.unitIndex; ui += 1) {
        const order = makeUnitOrder(ui, version);
        let e = 0;
        while (e < order.length && processed.has(order[e])) e += 1;
        if (e < order.length) {
          return { unitIndex: ui, entryIndex: e, unitOrder: order };
        }
      }
      return "grade-complete";
    },
    [cur, version]
  );

  /** 年级完成统计快照（在轮次清零前基于当前数据计算） */
  const computeGradeSnapshot = useCallback(
    (p: Progress, grade: number): GradeStatsSnapshot => {
      const g = p.grades[String(grade)];
      const gradeUnits = cur.filter((u) => u.grade === grade);
      const gradeEntries = gradeUnits.flatMap((u) => u.entries);
      const gradeIds = new Set(gradeEntries.map((e) => e.id));
      const doneCount = gradeEntries.length;
      const unitCount = gradeUnits.length;
      const mistakeCount = (p.mistakeEntryIds ?? []).filter((id) =>
        gradeIds.has(id)
      ).length;
      const onceRight = Math.max(doneCount - mistakeCount, 0);
      const gradePoints = (g?.completedEntryIds ?? []).reduce((s, id) => {
        if (!gradeIds.has(id)) return s;
        const e = allEntriesMap.get(id);
        return s + (e ? pointsForEntry(e.type) : 5);
      }, 0);
      // 年级开始时间 = 该年级各单元开始时间的最早值
      const starts = gradeUnits
        .map((u) => p.unitStartedAt?.[`${u.grade}-${u.unit}`])
        .filter((t): t is number => typeof t === "number");
      const startAt = starts.length ? Math.min(...starts) : undefined;
      return {
        grade,
        unitCount,
        doneCount,
        mistakeCount,
        onceRight,
        gradePoints,
        startAt,
        durationMs: startAt ? Date.now() - startAt : 0,
        rounds: (g?.rounds ?? 0) + 1,
      };
    },
    [cur, allEntriesMap]
  );

  /**
   * 年级一轮完成：轮数 +1、本轮进度清零、位置回到年级第一单元第一词；
   * 同时清掉该年级的单元祝贺标记 / 开始时间 / 错词记录（新一轮重新统计）。
   * 返回清零后的新 Progress（不修改原对象）。
   */
  const completeGradeRound = useCallback(
    (p: Progress, grade: number): Progress => {
      const gradeStart = gradeStartIndex(version, grade);
      const g = p.grades[String(grade)];
      const newGs: GradeState = {
        unitIndex: gradeStart,
        entryIndex: 0,
        unitOrder: makeUnitOrder(gradeStart, version),
        completedEntryIds: [],
        skippedEntryIds: [],
        rounds: (g?.rounds ?? 0) + 1,
      };
      const gradeIds = new Set(
        cur
          .filter((u) => u.grade === grade)
          .flatMap((u) => u.entries.map((e) => e.id))
      );
      const prefix = `${grade}-`;
      const unitStartedAt = Object.fromEntries(
        Object.entries(p.unitStartedAt ?? {}).filter(
          ([k]) => !k.startsWith(prefix)
        )
      );
      return {
        ...p,
        grades: { ...p.grades, [String(grade)]: newGs },
        celebratedUnits: (p.celebratedUnits ?? []).filter(
          (k) => !k.startsWith(prefix)
        ),
        unitStartedAt,
        mistakeEntryIds: (p.mistakeEntryIds ?? []).filter(
          (id) => !gradeIds.has(id)
        ),
      };
    },
    [cur, version]
  );

  /** 触发年级（一轮通关）祝贺：先算统计快照，再清零轮次，最后弹祝贺页 */
  const triggerGradeCelebration = useCallback(
    (p: Progress, grade: number, unitKey: string) => {
      const snapshot = computeGradeSnapshot(p, grade);
      speech.stop();
      playCelebrationJingle();
      setCelebration({
        unitKey,
        level: "grade",
        quote: randomMovieQuote(),
        grade: snapshot,
      });
      setProgress((prev) => completeGradeRound(prev, grade));
    },
    [computeGradeSnapshot, completeGradeRound, setProgress, speech]
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
    // 每次学完该单元都弹（不限第一次）；lastProcessedUnitRef 在继续学习/重学时清空，防重复触发。
    // 注意：必须读 progressRef（最新值），因为本函数可能被 1.8s 定时器以旧闭包调用。
    const p = progressRef.current;
    const g = p.grades[String(p.activeGrade)];
    const processed = g ? processedOf(g) : new Set<string>();
    const lastKey = lastProcessedUnitRef.current;
    if (lastKey) {
      const lastUnit = cur.find((u) => `${u.grade}-${u.unit}` === lastKey);
      if (lastUnit) {
        const allProcessed = lastUnit.entries.every((e) => processed.has(e.id));
        if (allProcessed) {
          // 年级是否也全部处理完（该年级所有单元的词条都处理过）
          // → 一轮通关：轮数 +1、进度清零、年级祝贺（带统计）
          const gradeAllDone = cur
            .filter((u) => u.grade === lastUnit.grade)
            .every((uu) => uu.entries.every((e) => processed.has(e.id)));
          if (gradeAllDone) {
            triggerGradeCelebration(p, lastUnit.grade, lastKey);
          } else {
            speech.stop(); // 停掉后台朗读，避免祝贺页背后响着下一题的音频
            playCelebrationJingle(); // 播放简短庆祝音效
            setCelebration({
              unitKey: lastKey,
              level: "unit",
              quote: randomMovieQuote(),
            });
          }
          release();
          return;
        }
      }
    }

    const next = nextPositionAfter(p);
    if (next === "grade-complete") {
      // 年级刚学完（如重新学习本单元后再通关）→ 年级祝贺
      const grade = cur[g?.unitIndex ?? 0]?.grade ?? p.activeGrade;
      const unitKey =
        lastKey ?? `${grade}-${cur[g?.unitIndex ?? 0]?.unit ?? 1}`;
      triggerGradeCelebration(p, grade, unitKey);
      release();
      return;
    }
    setProgress((prev) => {
      const gk = String(prev.activeGrade);
      const gsNow = prev.grades[gk];
      if (!gsNow) return prev;
      return {
        ...prev,
        grades: { ...prev.grades, [gk]: { ...gsNow, ...next } },
      };
    });
    setAnimKey((k) => k + 1);
    release();
  }, [
    difficultMode,
    difficultIndex,
    difficultOrder.length,
    setProgress,
    cur,
    setCelebration,
    speech,
    nextPositionAfter,
    triggerGradeCelebration,
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

  /**
   * "我不会"：不影响学习进度（进度继续往后走），只把词条加入重点记忆列表；
   * 记入年级本轮 skipped 集合（推进进度但不计分）。
   */
  const markDontKnow = useCallback(
    (id: string) => {
      const src = difficultMode
        ? allEntriesMap.get(id)
        : unit.entries.find((e) => e.id === id);
      if (src) lastProcessedUnitRef.current = `${src.grade}-${src.unit}`;
      setProgress((prev) => {
        const difficult = prev.difficultEntryIds.includes(id)
          ? prev.difficultEntryIds
          : [...prev.difficultEntryIds, id];
        let grades = prev.grades;
        if (!difficultMode) {
          const gk = String(prev.activeGrade);
          const g = prev.grades[gk];
          if (g && !g.skippedEntryIds.includes(id)) {
            grades = {
              ...prev.grades,
              [gk]: { ...g, skippedEntryIds: [...g.skippedEntryIds, id] },
            };
          }
        }
        return { ...prev, difficultEntryIds: difficult, grades };
      });
      addMistake(id); // "我不会"也计入拼错/不会统计
      showToast("📝 已加入重点记忆列表");
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
      const processedNow =
        difficultMode ||
        gs.completedEntryIds.includes(entry.id) ||
        gs.skippedEntryIds.includes(entry.id);
      if (!processedNow) {
        showToast("请先完成当前拼写");
        return;
      }
      goNext();
    }
  };

  /**
   * 祝贺页"继续学习"：
   * - 单元级：在当前年级内推进到下一个未处理词条；
   * - 年级级（一轮通关，进度已清零）：进入下一个年级（恢复其进度），
   *   没有下一个年级 → 全部学完页面。
   */
  const continueFromCelebration = useCallback(() => {
    if (busyRef.current || !celebration) return;
    busyRef.current = true;
    setCelebration(null);

    if (celebration.level === "grade") {
      const grade = celebration.grade?.grade ?? progressRef.current.activeGrade;
      const gradesList = Array.from(new Set(cur.map((u) => u.grade))).sort(
        (a, b) => a - b
      );
      const nextGrade = gradesList.find((g) => g > grade);
      if (nextGrade === undefined) {
        setFinishedAll(true);
      } else {
        setProgress((prev) => {
          const pos = findResumePosition(prev, nextGrade, version);
          const gsNext =
            prev.grades[String(nextGrade)] ??
            freshGradeState(version, nextGrade);
          return {
            ...prev,
            activeGrade: nextGrade,
            grades: {
              ...prev.grades,
              [String(nextGrade)]: { ...gsNext, ...pos },
            },
          };
        });
        setAnimKey((k) => k + 1);
      }
    } else {
      // 单元级：年级内推进（显式推进进度，不依赖 progressRef 避免竞态）
      setProgress((prev) => {
        const next = nextPositionAfter(prev);
        if (next === "grade-complete") {
          // 防御：单元庆祝时年级刚好也完成 → 直接完成轮次
          const gk = String(prev.activeGrade);
          const grade = cur[prev.grades[gk]?.unitIndex ?? 0]?.grade ?? prev.activeGrade;
          return completeGradeRound(prev, grade);
        }
        const gk = String(prev.activeGrade);
        const g = prev.grades[gk];
        if (!g) return prev;
        return { ...prev, grades: { ...prev.grades, [gk]: { ...g, ...next } } };
      });
      setAnimKey((k) => k + 1);
    }
    lastProcessedUnitRef.current = null;
    window.setTimeout(() => {
      busyRef.current = false;
    }, 80);
  }, [
    celebration,
    cur,
    version,
    setProgress,
    nextPositionAfter,
    completeGradeRound,
  ]);

  /**
   * 祝贺页"重新学习本单元"：进度回滚到本单元第 1 个词条
   * （该单元词条从本轮完成/跳过集合移除，重学完成可再次获得积分与祝贺；
   * 已得积分不回收）。年级祝贺时触发的是新一轮中重学该单元。
   */
  const restartUnitFromCelebration = useCallback(() => {
    if (busyRef.current || !celebration) return;
    busyRef.current = true;
    const unitKey = celebration.unitKey;
    const unitInfo = cur.find((u) => `${u.grade}-${u.unit}` === unitKey);
    setCelebration(null);
    if (unitInfo) {
      const grade = unitInfo.grade;
      const unitIndex = cur.indexOf(unitInfo);
      setProgress((prev) => {
        const gk = String(grade);
        const g = prev.grades[gk] ?? freshGradeState(version, grade);
        const unitIds = new Set(unitInfo.entries.map((e) => e.id));
        const orderIsTarget =
          g.unitOrder.length > 0 && g.unitOrder.every((id) => unitIds.has(id));
        const nextGs: GradeState = {
          ...g,
          unitIndex,
          entryIndex: 0,
          unitOrder: orderIsTarget
            ? g.unitOrder
            : makeUnitOrder(unitIndex, version),
          completedEntryIds: g.completedEntryIds.filter(
            (id) => !unitIds.has(id)
          ),
          skippedEntryIds: g.skippedEntryIds.filter((id) => !unitIds.has(id)),
        };
        return {
          ...prev,
          activeGrade: grade,
          grades: { ...prev.grades, [gk]: nextGs },
          celebratedUnits: (prev.celebratedUnits ?? []).filter(
            (k) => k !== unitKey
          ),
        };
      });
      setAnimKey((k) => k + 1);
    }
    lastProcessedUnitRef.current = null;
    window.setTimeout(() => {
      busyRef.current = false;
    }, 80);
  }, [celebration, cur, version, setProgress]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 祝贺页打开时不响应（避免误触切题或返回首页播放音频）
      if (celebration) return;
      // 注意：不响应 Enter（拼写输入时按回车不应跳题）
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, celebration]);

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

  const restart = () => {
    const p = freshProgress(version);
    setProgress(p);
    saveProgress(user.id, p);
    setFinishedAll(false);
    setAnimKey((k) => k + 1);
  };

  // 重点记忆模式：当前词条已加过积分（重复学习不加分，答对卡不显示积分）
  const difficultAlreadyAwarded =
    difficultMode && !!entry?.id &&
    (progress.difficultAwardedIds ?? []).includes(entry.id);

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
            difficultMode ? difficultIndex + 1 : gs.entryIndex + 1
          }
          unitSize={
            difficultMode
              ? difficultOrder.length
              : gs.unitOrder.length || unit.entries.length
          }
          onComplete={markComplete}
          onNext={goNext}
          onDontKnow={markDontKnow}
          onMistake={addMistake}
          frozen={celebration !== null}
          autoNext={user.config.autoNext ?? false}
          hidePoints={!!difficultAlreadyAwarded}
          replay={speech.replayNow}
          stopAudio={speech.stop}
          startAudio={(t) => {
            primeSpeech();
            speech.start(t, 1.0, accent);
          }}
        />
      </div>

      {/* 单元/年级完成祝贺页 */}
      {celebration && (
        <div className="absolute inset-0 z-40 overflow-y-auto bg-gradient-to-b from-primary-lighter via-bg to-[#FFF9EC] px-8 py-12">
          <div className="mx-auto flex h-full max-w-sm flex-col items-center text-center">
            <div className="text-5xl animate-[badgePop_.5s_cubic-bezier(.34,1.56,.64,1)]">
              🎉
            </div>
            {celebration.level === "unit" ? (
              (() => {
                const unitInfo = cur.find(
                  (u) => `${u.grade}-${u.unit}` === celebration.unitKey
                );
                if (!unitInfo) return null;
                return (
                  <>
                    <h2 className="mt-3 text-xl font-semibold text-text">
                      恭喜完成 {gradeLabel(unitInfo.grade)}第{" "}
                      {unitInfo.unit} 单元！
                    </h2>
                    <p className="mt-1.5 text-sm leading-5 text-text2">
                      <span className="font-semibold text-text">
                        {unitInfo.title}
                      </span>
                      ——通过努力学习，你完成了本单元的听写练习，太棒了！
                    </p>
                  </>
                );
              })()
            ) : (
              <>
                <h2 className="mt-3 text-xl font-semibold text-text">
                  恭喜通关 {gradeLabel(celebration.grade?.grade ?? progress.activeGrade)}！
                </h2>
                <p className="mt-1.5 text-sm leading-5 text-text2">
                  {celebration.grade?.unitCount ?? 0} 个单元、
                  {celebration.grade?.doneCount ?? 0} 个词条全部学完，你用坚持和努力完成了整个年级的听写练习，太了不起了！
                </p>
              </>
            )}

            {/* 学习信息统计（仅年级完成时展示） */}
            {celebration.level === "grade" && celebration.grade && (
              <div className="mt-6 grid w-full grid-cols-2 gap-2.5">
                <StatCard label="📅 开始学习" value={formatDateTime(celebration.grade.startAt)} valueColor="text-text" />
                <StatCard label="⏱️ 完成用时" value={formatDuration(celebration.grade.durationMs)} valueColor="text-text" />
                <StatCard label="💪 拼错或不会" value={`${celebration.grade.mistakeCount} 个词条`} valueColor="text-error" />
                <StatCard label="✅ 一次做对" value={`${celebration.grade.onceRight} 个词条`} valueColor="text-success" />
                <StatCard label="⭐ 本轮积分" value={`+${celebration.grade.gradePoints} 分`} valueColor="text-gold" />
                <StatCard label="🔁 完成轮数" value={`第 ${celebration.grade.rounds} 轮`} valueColor="text-text" />
              </div>
            )}

            {/* 随机电影台词 */}
            <div className={`w-full rounded-2xl bg-[#FAEEDA] px-5 py-4 animate-[slideUp_.4s_ease] ${celebration.level === "unit" ? "mt-6" : "mt-4"}`}>
              {celebration.quote.en && (
                <p className="text-sm italic leading-6 text-[#854F0B]">
                  “{celebration.quote.en}”
                </p>
              )}
              <p className="mt-1.5 text-sm font-semibold leading-6 text-[#854F0B]">
                {celebration.quote.cn}
              </p>
              <p className="mt-1.5 text-xs text-[#854F0B]/70">
                —— 电影《{celebration.quote.movie}》
              </p>
            </div>

            {/* 操作按钮：重新学习本单元 / 返回首页 紧跟台词卡片上方；继续学习固定在页面最下方 */}
            <div className="mt-6 w-full">
              {/* 重新学习本单元：进度回滚到本单元第 1 个词条（积分不回收） */}
              <button
                type="button"
                onClick={restartUnitFromCelebration}
                className="w-full rounded-full bg-[#756CC5] py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(83,74,183,0.25)] transition-transform active:scale-[0.98]"
              >
                重新学习本单元
              </button>
              <button
                type="button"
                onClick={onExit}
                className="mt-3 w-full rounded-full border border-border bg-surface py-2.5 text-sm font-medium text-text2 transition-colors active:bg-primary-lighter"
              >
                返回首页
              </button>
            </div>

            <button
              type="button"
              onClick={continueFromCelebration}
              className="mt-auto w-full rounded-full bg-primary py-3 text-[15px] font-semibold text-white shadow-[0_6px_20px_rgba(83,74,183,0.35)] transition-transform active:scale-[0.98]"
            >
              继续学习
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

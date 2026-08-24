import {
  CURRICULUM_VERSION,
  getAllEntries,
  getCurriculum,
  type CurriculumVersion,
} from "../data/curriculum";
import { storageGet, storageRemove, storageSet } from "./storage";

// 进度按「用户 + 教材版本」隔离存储：eng-learning-progress-v3:{version}:{userId}
// v2（旧版，仅按用户）数据会在人教版本下自动迁移，其他版本为新进度
const STORAGE_PREFIX = "eng-learning-progress-v3";
const LEGACY_PREFIX = "eng-learning-progress-v2";

function storageKey(userId: string, version: CurriculumVersion) {
  return `${STORAGE_PREFIX}:${version}:${userId}`;
}

/**
 * 单个年级的独立学习状态（各年级进度互不影响）：
 * - completedEntryIds：本轮拼对过的词条（积分与"一轮完成"依据）
 * - skippedEntryIds：本轮点过"我不会"的词条（推进进度但不计分）
 * - rounds：已完整学完该年级所有词条的轮数（进度条清零后 +1）
 */
export interface GradeState {
  unitIndex: number; // 全局单元下标（属于该年级）
  entryIndex: number;
  unitOrder: string[]; // 当前单元的随机题目顺序（entry id 列表）
  completedEntryIds: string[];
  skippedEntryIds: string[];
  rounds: number;
}

export interface Progress {
  curriculumVersion: number; // 词库版本，不匹配时进度重置
  version: CurriculumVersion; // 教材版本
  /** 最近一次学习的年级（首页"继续学习"按钮入口；重点记忆学习不改此值） */
  activeGrade: number;
  /** 各年级独立学习状态（key: 年级号） */
  grades: Record<string, GradeState>;
  difficultEntryIds: string[]; // "我不会"的重点记忆列表（跨轮持续存在）
  /** 重点记忆学习已加过积分的词条（积分只加一次，之后重复学习不加分） */
  difficultAwardedIds?: string[];
  errorCounts: Record<string, number>;
  lastLearnedAt: number;
  /** 各单元首次开始学习的时间戳（key: `${grade}-${unit}`） */
  unitStartedAt?: Record<string, number>;
  /** 曾经拼错过或点过"我不会"的词条 id（去重），供年级完成页统计 */
  mistakeEntryIds?: string[];
  /** 已弹出过完成祝贺页的单元（key: `${grade}-${unit}`） */
  celebratedUnits?: string[];
  /**
   * 教材线标记：同版本号下区分教材结构变更前后/不同子线的数据。
   * "rj-g1"：人教版一年级起点去重线（3 年级起过滤 1-2 年级已学词）。
   * "wy-g1"：外研社一年级起点去重线。缺失表示旧混合线数据，加载时自动迁移。
   */
  lineTag?: string;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeUnitOrder(
  unitIndex: number,
  version: CurriculumVersion
): string[] {
  const unit = getCurriculum(version)[unitIndex];
  return unit ? shuffle(unit.entries.map((e) => e.id)) : [];
}

/** 某年级在课程数组中的第一个单元下标 */
export function gradeStartIndex(version: CurriculumVersion, grade: number): number {
  return getCurriculum(version).findIndex((u) => u.grade === grade);
}

/** 新年级初始状态：从该年级第一单元第一词开始 */
export function freshGradeState(
  version: CurriculumVersion,
  grade: number
): GradeState {
  const start = gradeStartIndex(version, grade);
  return {
    unitIndex: Math.max(start, 0),
    entryIndex: 0,
    unitOrder: makeUnitOrder(Math.max(start, 0), version),
    completedEntryIds: [],
    skippedEntryIds: [],
    rounds: 0,
  };
}

/** 某年级"本轮已处理"的词条集合（拼对 ∪ 点过我不会），进度条与轮次完成判定依据 */
export function processedOf(gs: GradeState): Set<string> {
  return new Set([...gs.completedEntryIds, ...gs.skippedEntryIds]);
}

/** 某年级本轮的学习统计（进度条数据；done = 拼对 + 我不会） */
export function gradeStats(p: Progress, grade: number) {
  const cur = getCurriculum(p.version);
  const units = cur.filter((u) => u.grade === grade);
  const gs = p.grades[String(grade)];
  const processed = gs ? processedOf(gs) : new Set<string>();
  const total = units.reduce((s, u) => s + u.entries.length, 0);
  const done = units.reduce(
    (s, u) => s + u.entries.filter((e) => processed.has(e.id)).length,
    0
  );
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
    rounds: gs?.rounds ?? 0,
  };
}

/**
 * 在指定年级内找到继续学习的位置（跳过本轮已处理词条）：
 * - 从该年级保存的位置向后找第一个未处理词条；
 * - 保存单元之后找不到 → 回到年级开头再找（处理中途跳学的边角）；
 * - 全年级本轮已处理完 → 回到该年级第一单元第一词（新一轮预习）。
 */
export function findResumePosition(
  p: Progress,
  grade: number,
  version: CurriculumVersion
): { unitIndex: number; entryIndex: number; unitOrder: string[] } {
  const cur = getCurriculum(version);
  const gradeStart = gradeStartIndex(version, grade);
  if (gradeStart < 0) return { unitIndex: 0, entryIndex: 0, unitOrder: [] };
  const gs = p.grades[String(grade)] ?? freshGradeState(version, grade);
  const processed = processedOf(gs);

  const firstOpenIn = (
    order: string[],
    from: number
  ): number => {
    let i = from;
    while (i < order.length && processed.has(order[i])) i += 1;
    return i;
  };

  // 1) 从保存的位置向后（含当前单元当前位置）
  for (
    let ui = gs.unitIndex;
    ui < cur.length && cur[ui].grade === grade;
    ui += 1
  ) {
    const order =
      ui === gs.unitIndex && gs.unitOrder.length
        ? gs.unitOrder
        : makeUnitOrder(ui, version);
    const from = ui === gs.unitIndex ? gs.entryIndex : 0;
    const ei = firstOpenIn(order, from);
    if (ei < order.length) return { unitIndex: ui, entryIndex: ei, unitOrder: order };
  }
  // 2) 年级开头到保存位置之前
  for (let ui = gradeStart; ui < gs.unitIndex; ui += 1) {
    const order = makeUnitOrder(ui, version);
    const ei = firstOpenIn(order, 0);
    if (ei < order.length) return { unitIndex: ui, entryIndex: ei, unitOrder: order };
  }
  // 3) 本轮全部处理完 → 回到年级起点（调用方一般会先完成轮次清零，这里是保险）
  return {
    unitIndex: gradeStart,
    entryIndex: 0,
    unitOrder: makeUnitOrder(gradeStart, version),
  };
}

/**
 * 清理进度中的失效词条引用（词库去重/结构变更后残留的 id）。
 * 同时校验各年级 unitIndex 归属、unitOrder 有效性并钳制 entryIndex。
 */
function sanitizeProgress(p: Progress, version: CurriculumVersion): Progress {
  const validIds = new Set(getAllEntries(version).map((e) => e.id));
  const cur = getCurriculum(version);
  const allGrades = new Set(cur.map((u) => u.grade));

  const difficult = p.difficultEntryIds.filter((id) => validIds.has(id));
  const difficultAwarded = (p.difficultAwardedIds ?? []).filter((id) =>
    validIds.has(id)
  );
  const mistake = (p.mistakeEntryIds ?? []).filter((id) => validIds.has(id));
  const errorCounts: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.errorCounts ?? {})) {
    if (validIds.has(k)) errorCounts[k] = v;
  }

  const grades: Record<string, GradeState> = {};
  for (const [g, raw] of Object.entries(p.grades ?? {})) {
    const grade = Number(g);
    if (!allGrades.has(grade) || !raw) continue;
    const gradeStart = gradeStartIndex(version, grade);
    const completed = raw.completedEntryIds.filter((id) => validIds.has(id));
    const skipped = raw.skippedEntryIds.filter((id) => validIds.has(id));
    // unitIndex 必须属于该年级，否则重置到年级起点
    let unitIndex =
      cur[raw.unitIndex]?.grade === grade ? raw.unitIndex : gradeStart;
    let entryIndex = raw.entryIndex;
    let unitOrder = raw.unitOrder ?? [];
    const unitIds = new Set(cur[unitIndex]?.entries.map((e) => e.id) ?? []);
    const filtered = unitOrder.filter((id) => unitIds.has(id));
    if (filtered.length > 0) {
      unitOrder = filtered;
      if (entryIndex >= unitOrder.length) {
        entryIndex = Math.max(0, unitOrder.length - 1);
      }
    } else {
      unitOrder = makeUnitOrder(unitIndex, version);
      entryIndex = 0;
    }
    grades[g] = {
      unitIndex,
      entryIndex,
      unitOrder,
      completedEntryIds: completed,
      skippedEntryIds: skipped,
      rounds: typeof raw.rounds === "number" ? raw.rounds : 0,
    };
  }

  // activeGrade 必须是有效年级；对应年级状态缺失时补建
  let activeGrade = p.activeGrade;
  if (!allGrades.has(activeGrade)) {
    activeGrade = cur[0]?.grade ?? 1;
  }
  if (!grades[String(activeGrade)]) {
    grades[String(activeGrade)] = freshGradeState(version, activeGrade);
  }

  return {
    ...p,
    activeGrade,
    grades,
    difficultEntryIds: difficult,
    difficultAwardedIds: difficultAwarded,
    mistakeEntryIds: mistake,
    errorCounts,
  };
}

/* ── 旧版（单全局进度）数据 → 年级独立模型迁移 ── */

interface OldProgress {
  curriculumVersion: number;
  version: CurriculumVersion;
  unitIndex: number;
  entryIndex: number;
  unitOrder: string[];
  completedEntryIds: string[];
  difficultEntryIds: string[];
  errorCounts: Record<string, number>;
  lastLearnedAt: number;
  unitStartedAt?: Record<string, number>;
  mistakeEntryIds?: string[];
  celebratedUnits?: string[];
  gradeProgress?: Record<
    string,
    { unitIndex: number; entryIndex: number; unitOrder: string[] }
  >;
  lineTag?: string;
}

/**
 * 旧单全局进度 → 年级独立进度：
 * - 旧全局 completedEntryIds 按词条所属年级分桶，作为各年级本轮完成记录
 * - 旧 difficultEntryIds（点过"我不会"）按年级分桶为 skipped
 * - 各年级位置取旧 gradeProgress 快照，无快照则该年级第一单元
 * - rounds 从 0 开始（历史轮次无法追溯）
 */
function toGradeModel(old: OldProgress, version: CurriculumVersion): Progress {
  const cur = getCurriculum(version);
  const idGrade = new Map(getAllEntries(version).map((e) => [e.id, e.grade]));
  const grades: Record<string, GradeState> = {};
  for (const g of new Set(cur.map((u) => u.grade))) {
    const start = gradeStartIndex(version, g);
    const completed = (old.completedEntryIds ?? []).filter(
      (id) => idGrade.get(id) === g
    );
    const difficult = (old.difficultEntryIds ?? []).filter(
      (id) => idGrade.get(id) === g
    );
    const skipped = difficult.filter((id) => !completed.includes(id));
    const saved = old.gradeProgress?.[String(g)];
    let unitIndex = start;
    let entryIndex = 0;
    let unitOrder = makeUnitOrder(start, version);
    if (saved && cur[saved.unitIndex]?.grade === g) {
      unitIndex = saved.unitIndex;
      unitOrder = saved.unitOrder?.length
        ? saved.unitOrder
        : makeUnitOrder(unitIndex, version);
      entryIndex = saved.entryIndex;
    }
    grades[String(g)] = {
      unitIndex,
      entryIndex,
      unitOrder,
      completedEntryIds: completed,
      skippedEntryIds: skipped,
      rounds: 0,
    };
  }
  const activeGrade = cur[old.unitIndex]?.grade ?? cur[0]?.grade ?? 1;
  return {
    curriculumVersion: old.curriculumVersion,
    version,
    activeGrade,
    grades,
    difficultEntryIds: old.difficultEntryIds ?? [],
    difficultAwardedIds: [],
    errorCounts: old.errorCounts ?? {},
    lastLearnedAt: old.lastLearnedAt ?? Date.now(),
    unitStartedAt: old.unitStartedAt ?? {},
    mistakeEntryIds: old.mistakeEntryIds ?? [],
    celebratedUnits: old.celebratedUnits ?? [],
    lineTag: old.lineTag,
  };
}

/** 旧版（v2）人教进度 → 迁移到新格式，避免升级后老用户进度丢失 */
function migrateLegacy(userId: string): Progress | null {
  try {
    const raw = storageGet(`${LEGACY_PREFIX}:${userId}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as OldProgress;
    if (
      typeof p.unitIndex === "number" &&
      p.unitIndex >= 0 &&
      p.unitIndex < getCurriculum("renjiao").length &&
      p.curriculumVersion === CURRICULUM_VERSION &&
      Array.isArray(p.completedEntryIds)
    ) {
      const migrated = toGradeModel(
        {
          ...p,
          version: "renjiao",
          difficultEntryIds: Array.isArray(p.difficultEntryIds)
            ? p.difficultEntryIds
            : [],
          errorCounts: p.errorCounts ?? {},
        },
        "renjiao"
      );
      saveProgress(userId, migrated);
      return sanitizeProgress(migrated, "renjiao");
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** 旧数据的兼容补全（缺字段补默认值） */
function normalizeOld(p: Partial<OldProgress>, version: CurriculumVersion): OldProgress {
  const cur = getCurriculum(version);
  return {
    curriculumVersion: p.curriculumVersion ?? CURRICULUM_VERSION,
    version,
    unitIndex:
      typeof p.unitIndex === "number" &&
      p.unitIndex >= 0 &&
      p.unitIndex < cur.length
        ? p.unitIndex
        : 0,
    entryIndex: typeof p.entryIndex === "number" ? p.entryIndex : 0,
    unitOrder: Array.isArray(p.unitOrder) ? p.unitOrder : makeUnitOrder(0, version),
    completedEntryIds: Array.isArray(p.completedEntryIds)
      ? p.completedEntryIds
      : [],
    difficultEntryIds: Array.isArray(p.difficultEntryIds)
      ? p.difficultEntryIds
      : [],
    errorCounts:
      p.errorCounts && typeof p.errorCounts === "object" ? p.errorCounts : {},
    lastLearnedAt: typeof p.lastLearnedAt === "number" ? p.lastLearnedAt : Date.now(),
    unitStartedAt:
      p.unitStartedAt && typeof p.unitStartedAt === "object"
        ? p.unitStartedAt
        : {},
    mistakeEntryIds: Array.isArray(p.mistakeEntryIds) ? p.mistakeEntryIds : [],
    celebratedUnits: Array.isArray(p.celebratedUnits) ? p.celebratedUnits : [],
    gradeProgress:
      p.gradeProgress && typeof p.gradeProgress === "object"
        ? p.gradeProgress
        : {},
    lineTag: p.lineTag,
  } as OldProgress;
}

export function loadProgress(
  userId: string,
  version: CurriculumVersion
): Progress {
  try {
    const raw = storageGet(storageKey(userId, version));
    if (raw) {
      const p = JSON.parse(raw);

      // ── 新模型（年级独立进度） ──
      if (p && typeof p === "object" && p.grades && typeof p.activeGrade === "number") {
        if (
          p.version === version &&
          p.curriculumVersion === CURRICULUM_VERSION
        ) {
          if (!Array.isArray(p.difficultEntryIds)) p.difficultEntryIds = [];
          if (!p.errorCounts || typeof p.errorCounts !== "object")
            p.errorCounts = {};
          return sanitizeProgress(p as Progress, version);
        }
        return freshProgress(version);
      }

      // ── 旧模型（单全局进度）迁移 ──
      if (
        typeof p.unitIndex === "number" &&
        p.unitIndex >= 0 &&
        p.unitIndex < getCurriculum(version).length &&
        p.version === version &&
        p.curriculumVersion === CURRICULUM_VERSION
      ) {
        const G1_LINE_TAGS: Partial<Record<CurriculumVersion, string>> = {
          renjiao: "rj-g1",
          waiyanshe: "wy-g1",
        };
        const expectTag = G1_LINE_TAGS[version];
        const old = normalizeOld(p, version);
        // 混合线 → 一年级起点去重线：保留学习记录（已学/错词/错误次数），
        // 仅重置各年级位置指针到年级起点（词库结构变更导致 unitIndex 错位）
        if (expectTag && old.lineTag !== expectTag) {
          old.lineTag = expectTag;
          old.gradeProgress = {};
          old.unitIndex = 0;
          old.entryIndex = 0;
        }
        const migrated = toGradeModel(old, version);
        migrated.lineTag = old.lineTag;
        saveProgress(userId, migrated);
        return sanitizeProgress(migrated, version);
      }
    }
  } catch {
    /* ignore corrupted data */
  }
  // 人教版本：尝试迁移 v2 旧进度
  if (version === "renjiao") {
    const legacy = migrateLegacy(userId);
    if (legacy) return legacy;
  }
  return freshProgress(version);
}

export function freshProgress(version: CurriculumVersion): Progress {
  const cur = getCurriculum(version);
  const firstGrade = cur[0]?.grade ?? 1;
  return {
    curriculumVersion: CURRICULUM_VERSION,
    version,
    lineTag:
      version === "renjiao"
        ? "rj-g1"
        : version === "waiyanshe"
          ? "wy-g1"
          : undefined,
    activeGrade: firstGrade,
    grades: { [String(firstGrade)]: freshGradeState(version, firstGrade) },
    difficultEntryIds: [],
    difficultAwardedIds: [],
    errorCounts: {},
    lastLearnedAt: Date.now(),
    unitStartedAt: {},
    mistakeEntryIds: [],
    celebratedUnits: [],
  };
}

export function saveProgress(userId: string, p: Progress) {
  p.lastLearnedAt = Date.now();
  storageSet(storageKey(userId, p.version), JSON.stringify(p));
}

export function resetProgress(userId: string, version: CurriculumVersion) {
  storageRemove(storageKey(userId, version));
  // 旧版 v2 数据一并清除，避免重复迁移
  storageRemove(`${LEGACY_PREFIX}:${userId}`);
}

export function totalEntryCount(version: CurriculumVersion): number {
  return getAllEntries(version).length;
}

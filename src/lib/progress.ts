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

/** 单个年级独立保存的学习位置（供首页年级卡片恢复进度） */
export interface GradeProgress {
  unitIndex: number; // 该年级内的全局单元下标
  entryIndex: number;
  unitOrder: string[]; // 当时单元的题目顺序
}

export interface Progress {
  curriculumVersion: number; // 词库版本，不匹配时进度重置
  version: CurriculumVersion; // 教材版本
  unitIndex: number;
  entryIndex: number;
  unitOrder: string[]; // 当前单元的随机题目顺序（entry id 列表）
  completedEntryIds: string[];
  difficultEntryIds: string[]; // "我不会"的条目
  errorCounts: Record<string, number>;
  lastLearnedAt: number;
  /** 各单元首次开始学习的时间戳（key: `${grade}-${unit}`） */
  unitStartedAt?: Record<string, number>;
  /** 曾经拼错或点过"我不会"的词条 id（去重） */
  mistakeEntryIds?: string[];
  /** 已弹出过完成祝贺页的单元（key: `${grade}-${unit}`） */
  celebratedUnits?: string[];
  /** 各年级独立保存的学习位置（key: 年级号），点年级卡片时恢复 */
  gradeProgress?: Record<string, GradeProgress>;
  /**
   * 教材线标记：同版本号下区分教材结构变更前后/不同子线的数据。
   * "wy-g1"：外研社一年级起点去重线（v8 结构）。缺失表示旧混合线数据，
   * 加载时自动迁移。
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
  return shuffle(unit.entries.map((e) => e.id));
}

/** 旧版（v2）人教进度 → 迁移到新格式，避免升级后老用户进度丢失 */
function migrateLegacy(userId: string): Progress | null {
  try {
    const raw = storageGet(`${LEGACY_PREFIX}:${userId}`);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      typeof p.unitIndex === "number" &&
      p.unitIndex >= 0 &&
      p.unitIndex < getCurriculum("renjiao").length &&
      p.curriculumVersion === CURRICULUM_VERSION &&
      Array.isArray(p.completedEntryIds)
    ) {
      const migrated: Progress = {
        ...p,
        version: "renjiao",
        difficultEntryIds: Array.isArray(p.difficultEntryIds)
          ? p.difficultEntryIds
          : [],
        errorCounts: p.errorCounts ?? {},
      };
      saveProgress(userId, migrated);
      return migrated;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function loadProgress(
  userId: string,
  version: CurriculumVersion
): Progress {
  try {
    const raw = storageGet(storageKey(userId, version));
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      // 外研社旧「混合线」进度 → 一年级起点去重线迁移：
      // 词库结构变更（3 年级起跨线去重 + 移除清空单元）导致 unitIndex 错位，
      // 但词条 id 完全不变——保留全部学习记录（已学/错词/错误次数），
      // 仅重置位置指针；startLearning 会自动跳到第一个未完成单元。
      if (
        version === "waiyanshe" &&
        p.lineTag !== "wy-g1" &&
        p.version === "waiyanshe" &&
        Array.isArray(p.completedEntryIds)
      ) {
        const migrated: Progress = {
          ...p,
          lineTag: "wy-g1",
          unitIndex: 0,
          entryIndex: 0,
          unitOrder: makeUnitOrder(0, version),
          gradeProgress: {},
        };
        if (!Array.isArray(migrated.difficultEntryIds))
          migrated.difficultEntryIds = [];
        if (!migrated.errorCounts || typeof migrated.errorCounts !== "object")
          migrated.errorCounts = {};
        if (!Array.isArray(migrated.mistakeEntryIds))
          migrated.mistakeEntryIds = [];
        saveProgress(userId, migrated);
        return migrated;
      }
      if (
        typeof p.unitIndex === "number" &&
        p.unitIndex >= 0 &&
        p.unitIndex < getCurriculum(version).length &&
        p.version === version &&
        // 词库版本不匹配时进度作废（条目 ID 已变），返回全新进度
        p.curriculumVersion === CURRICULUM_VERSION
      ) {
        // 兼容旧数据：补全 difficultEntryIds / 单元统计字段
        if (!Array.isArray(p.difficultEntryIds)) p.difficultEntryIds = [];
        if (!p.errorCounts || typeof p.errorCounts !== "object")
          p.errorCounts = {};
        if (!Array.isArray(p.mistakeEntryIds)) p.mistakeEntryIds = [];
        // 旧字段（年级粒度）迁移到新字段（单元粒度）：
        // 已庆祝过的年级 → 该年级下所有单元视为已庆祝；年级开始时间 → 复制到该年级各单元
        const legacyCelebrated = (p as unknown as { celebratedGrades?: number[] })
          .celebratedGrades;
        const legacyStarted = (p as unknown as {
          gradeStartedAt?: Record<string, number>;
        }).gradeStartedAt;
        if (!Array.isArray(p.celebratedUnits)) {
          p.celebratedUnits = [];
          if (Array.isArray(legacyCelebrated)) {
            const grades = new Set(legacyCelebrated);
            for (const u of getCurriculum(version)) {
              if (grades.has(u.grade)) p.celebratedUnits.push(`${u.grade}-${u.unit}`);
            }
          }
        }
        if (!p.unitStartedAt || typeof p.unitStartedAt !== "object") {
          p.unitStartedAt = {};
          if (legacyStarted && typeof legacyStarted === "object") {
            for (const u of getCurriculum(version)) {
              const t = legacyStarted[String(u.grade)];
              if (typeof t === "number") p.unitStartedAt[`${u.grade}-${u.unit}`] = t;
            }
          }
        }
        // 兼容旧数据：无年级独立进度时，把全局当前位置迁移为该年级的进度，
        // 老用户点年级卡片也能接着上次的位置继续学
        if (!p.gradeProgress || typeof p.gradeProgress !== "object") {
          p.gradeProgress = {};
          const gu = getCurriculum(version)[p.unitIndex];
          if (gu && p.completedEntryIds.length > 0) {
            p.gradeProgress[String(gu.grade)] = {
              unitIndex: p.unitIndex,
              entryIndex: p.entryIndex,
              unitOrder: p.unitOrder ?? [],
            };
          }
        }
        return p;
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
  return {
    curriculumVersion: CURRICULUM_VERSION,
    version,
    lineTag: version === "waiyanshe" ? "wy-g1" : undefined,
    unitIndex: 0,
    entryIndex: 0,
    unitOrder: makeUnitOrder(0, version),
    completedEntryIds: [],
    difficultEntryIds: [],
    errorCounts: {},
    lastLearnedAt: Date.now(),
    unitStartedAt: {},
    mistakeEntryIds: [],
    celebratedUnits: [],
    gradeProgress: {},
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

export function unitStats(p: Progress) {
  const total = totalEntryCount(p.version);
  const done = p.completedEntryIds.length;
  return { total, done, percent: Math.round((done / total) * 100) };
}

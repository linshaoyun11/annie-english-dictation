import type { EntryType, WordEntry } from "./curriculum";

let seq = 0;
const prefixSeqs = new Map<string, number>();

/**
 * 顺序生成词条 id（全局递增，跨数据文件不重复）。
 * ESM 求值顺序保证：curriculum.ts 依赖 mk.ts 与 grades4to9.ts，
 * 三者共用同一个 seq，id 全局唯一。
 */
export function mk(
  grade: number,
  unit: number,
  type: EntryType,
  english: string,
  phonetic: string,
  chinese: string
): WordEntry {
  seq += 1;
  return {
    id: `g${grade}u${unit}e${String(seq).padStart(4, "0")}`,
    grade,
    unit,
    type,
    english,
    phonetic,
    chinese,
  };
}

/**
 * 多教材版本专用：带前缀的独立 id（如 wy-g1u1e0001 / ox-g1u1e0001）。
 * 使用独立计数器，不占用 mk() 的全局序号——保证人教版词条的 id 稳定，
 * 预生成的 1061 个本地音频（按人教 id 命名）不会因新版本词库而失配。
 * 各版本 id 前缀不同，全局唯一。
 */
export function mkWithPrefix(
  prefix: string,
  grade: number,
  unit: number,
  type: EntryType,
  english: string,
  phonetic: string,
  chinese: string
): WordEntry {
  const n = (prefixSeqs.get(prefix) ?? 0) + 1;
  prefixSeqs.set(prefix, n);
  return {
    id: `${prefix}-g${grade}u${unit}e${String(n).padStart(4, "0")}`,
    grade,
    unit,
    type,
    english,
    phonetic,
    chinese,
  };
}

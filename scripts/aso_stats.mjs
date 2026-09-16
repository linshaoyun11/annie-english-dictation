/**
 * 词库规模统计（ASO 文案 / 宣传素材引用数字的唯一来源）。
 *
 * 用法：
 *   node scripts/aso_stats.mjs
 *
 * 为什么要真转译而不是数源码：教材线全部由 src/data/curriculum.ts 运行时派生，
 *   applyKebiaoTo 会在模块加载时往数组里 splice 课标单元，读源码得到的词条数必然偏小。
 *   （同 dump_curriculum.mjs 的理由，此处只做汇总统计，不列明细。）
 *
 * ⚠️ 去重口径：按 english **原样文本**（区分大小写）去重。
 *   IT/it、US/us、AM/am、WHO/who 是读音不同的词对，合并会低估词量。
 *
 * 转译用 rolldown（Vite 8 自带本地依赖）。
 */
import { unlinkSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const TMP_CUR = ".tmp-aso-cur.mjs";
const TMP_MQ = ".tmp-aso-mq.mjs";
process.on("exit", () => {
  for (const f of [TMP_CUR, TMP_MQ]) {
    try {
      unlinkSync(f);
    } catch {}
  }
});

async function load(entry, tmp) {
  await rolldownBuild({
    input: [entry],
    output: { file: tmp, format: "esm" },
    // rolldown 的 logLevel 只接受 debug|info|warn|silent，没有 "error"
    logLevel: "silent",
  });
  return import(`../${tmp}?t=${Date.now()}`);
}

const cur = await load("src/data/curriculum.ts", TMP_CUR);
const mq = await load("src/data/movieQuotes.ts", TMP_MQ);

const CURRICULA = cur.CURRICULA;
if (!CURRICULA) {
  console.error("未找到 CURRICULA 导出，可用 keys:", Object.keys(cur));
  process.exit(2);
}

// ---- 逐线统计 ----
const perLine = [];
const typeOf = new Map(); // english(原样) -> type
const lineOf = new Map(); // english(原样) -> Set<line>
const gradesOf = new Map(); // line -> Set<grade>
let totalEntries = 0;
let totalUnits = 0;

for (const [line, units] of Object.entries(CURRICULA)) {
  const texts = new Set();
  const grades = new Set();
  let entries = 0;
  for (const u of units) {
    grades.add(u.grade);
    for (const e of u.entries) {
      entries++;
      texts.add(e.english);
      if (!typeOf.has(e.english)) typeOf.set(e.english, e.type);
      if (!lineOf.has(e.english)) lineOf.set(e.english, new Set());
      lineOf.get(e.english).add(line);
    }
  }
  perLine.push({ line, units: units.length, entries, unique: texts.size, grades });
  gradesOf.set(line, grades);
  totalEntries += entries;
  totalUnits += units.length;
}

// ---- 跨线去重（全部 6 条线合并后）----
const allUnique = [...typeOf.keys()];
const nWord = allUnique.filter((t) => typeOf.get(t) === "word").length;
const nPhrase = allUnique.filter((t) => typeOf.get(t) === "phrase").length;
const nSentence = allUnique.filter((t) => typeOf.get(t) === "sentence").length;

// ---- 跨线共享度 ----
const shareBuckets = new Map(); // 被几条线用 -> 文本数
for (const set of lineOf.values()) {
  const k = set.size;
  shareBuckets.set(k, (shareBuckets.get(k) ?? 0) + 1);
}

// ---- 输出 ----
const pad = (s, n) => String(s).padEnd(n, " ");
const padL = (s, n) => String(s).padStart(n);

console.log("=".repeat(66));
console.log("教材线明细（运行时真相）");
console.log("=".repeat(66));
console.log(
  pad("line", 14) + padL("单元", 6) + padL("词条", 8) + padL("去重文本", 10) + " 年级",
);
for (const r of perLine) {
  const g = [...r.grades].sort((a, b) => a - b);
  const range = `${g[0]}-${g[g.length - 1]}`;
  console.log(
    pad(r.line, 14) + padL(r.units, 6) + padL(r.entries, 8) + padL(r.unique, 10) + " " + range,
  );
}
console.log("-".repeat(66));
console.log(
  pad("合计", 14) + padL(totalUnits, 6) + padL(totalEntries, 8) + padL(allUnique.length, 10),
);

console.log("");
console.log("=".repeat(66));
console.log("跨 6 线去重后（库里不重复的英文条目）");
console.log("=".repeat(66));
console.log(`  总计        ${allUnique.length}`);
console.log(`  ├ 单词 word  ${nWord}`);
console.log(`  ├ 短语 phrase ${nPhrase}`);
console.log(`  └ 句子 sentence ${nSentence}`);
console.log(`  单词 + 短语（不含句子）  ${nWord + nPhrase}`);

console.log("");
console.log("=".repeat(66));
console.log("跨线共享度（一个文本被几条线收录）");
console.log("=".repeat(66));
for (const k of [...shareBuckets.keys()].sort((a, b) => a - b)) {
  console.log(`  被 ${k} 条线收录: ${padL(shareBuckets.get(k), 5)} 个文本`);
}

if (mq.MOVIE_QUOTES) {
  const q = mq.MOVIE_QUOTES;
  const movies = new Set(q.map((x) => x.movie));
  const withEn = q.filter((x) => x.en && x.en.trim()).length;
  console.log("");
  console.log("=".repeat(66));
  console.log("电影台词库");
  console.log("=".repeat(66));
  console.log(`  台词条数    ${q.length}`);
  console.log(`  取材电影    ${movies.size} 部`);
  console.log(`  含英文原文  ${withEn} 条`);
  console.log(`  电影列表    ${[...movies].join("、")}`);
}

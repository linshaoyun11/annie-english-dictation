/**
 * 校对文档的前置数据体检：列出会影响打印校对质量的问题项。
 *   1. 中文释义为空
 *   2. 音标为空（分类型：句子无音标属正常，单词/短语缺失需补）
 *   3. 单元内重复词条
 *
 * 用法：node scripts/proofread_qc.mjs renjiao3
 */
import { build as rolldownBuild } from "rolldown";
import { unlinkSync } from "node:fs";

const line = process.argv[2] ?? "renjiao3";
const TMP = ".tmp-proofread-qc.mjs";
process.on("exit", () => { try { unlinkSync(TMP); } catch {} });

await rolldownBuild({ input: ["src/data/curriculum.ts"], output: { file: TMP, format: "esm" }, logLevel: "silent" });
const mod = await import(`../${TMP}?v=${Date.now()}`);
const CUR = mod.CURRICULA?.[line] ?? [];

const noCn = [];
const noPh = [];
const dup = [];

for (const u of CUR) {
  const seen = new Map();
  for (const e of u.entries) {
    const tag = `G${u.grade}·U${u.unit} ${u.title}`;
    if (!(e.chinese ?? "").trim()) noCn.push([tag, e.english, e.type]);
    if (!(e.phonetic ?? "").trim()) noPh.push([tag, e.english, e.type]);
    const k = (e.english ?? "").trim().toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const [k, c] of seen) if (c > 1) dup.push([`G${u.grade}·U${u.unit} ${u.title}`, k, c]);
}

const noPhWords = noPh.filter(([, , t]) => t !== "sentence");

console.log("=" .repeat(70));
console.log(` ${line} 校对前置体检  （${CUR.length} 单元 / ${CUR.reduce((s, u) => s + u.entries.length, 0)} 词条）`);
console.log("=".repeat(70));

console.log(`\n【1】中文释义为空：${noCn.length}`);
for (const [t, en, ty] of noCn) console.log(`   ${t}  →  «${en}»  [${ty}]`);

console.log(`\n【2】音标为空：${noPh.length}（其中单词/短语 ${noPhWords.length}，句子 ${noPh.length - noPhWords.length}）`);
console.log(`   句子本就无音标，属正常；需补的是单词/短语 ${noPhWords.length} 条：`);
for (const [t, en, ty] of noPhWords.slice(0, 40)) console.log(`   ${t}  →  «${en}»  [${ty}]`);
if (noPhWords.length > 40) console.log(`   …另有 ${noPhWords.length - 40} 条`);

console.log(`\n【3】单元内重复：${dup.length}`);
for (const [t, k, c] of dup) console.log(`   ${t}  →  «${k}» ×${c}`);

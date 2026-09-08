/**
 * renjiao3 全量数据体检脚本
 * 检查：单元结构 / 词条重复 / 空字段 / 音标格式 / 释义缺失 / 单元编号连续性
 * 用法: node scripts/audit_renjiao3.mjs
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// renjiao3 = curriculum.ts 的 G1-G3（filter grade>=3）+ grades4to9.ts 的 G4-G9
const files = ["src/data/curriculum.ts", "src/data/grades4to9.ts"];
const units = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  let cur = null;
  const lines = src.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const mTitle = ln.match(/^\s*title:\s*"((?:[^"\\]|\\.)*)",?\s*$/);
    const mGrade = ln.match(/^\s*grade:\s*(\d+),?\s*$/);
    const mUnit = ln.match(/^\s*unit:\s*(\d+),?\s*$/);
    if (mGrade && cur === null) { cur = { grade: +mGrade[1], unit: null, title: null, entries: [], file }; }
    if (cur && mUnit && cur.unit === null) cur.unit = +mUnit[1];
    if (cur && mTitle && cur.title === null) cur.title = mTitle[1];
    const mEntry = ln.match(/^\s*mk\((\d+),\s*(\d+),\s*"(word|phrase|sentence)",\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\),?\s*$/);
    if (mEntry && cur) {
      cur.entries.push({ type: mEntry[3], text: mEntry[4], ipa: mEntry[5], cn: mEntry[6], line: i + 1 });
    }
    if (cur && /^\s*\},\s*$/.test(ln) && cur.entries.length > 0 && cur.title) {
      if (cur.grade >= 3) units.push(cur); // renjiao3 = 三年级起点，过滤 G1/G2
      cur = null;
    }
  }
}

console.log(`# renjiao3 数据体检 · 源文件 ${files.join(" + ")}`);
console.log(`# 解析到 ${units.length} 个单元（字面量，不含运行时课标单元）\n`);

// ---- 1. 单元编号 / 年级分布 ----
const byGrade = new Map();
for (const u of units) {
  if (!byGrade.has(u.grade)) byGrade.set(u.grade, []);
  byGrade.get(u.grade).push(u);
}
console.log("=== 1. 单元编号连续性 ===");
for (const g of [...byGrade.keys()].sort((a, b) => a - b)) {
  const us = byGrade.get(g).sort((a, b) => a.unit - b.unit);
  const nums = us.map((u) => u.unit);
  const min = Math.min(...nums), max = Math.max(...nums);
  const expected = [];
  for (let n = min; n <= max; n++) expected.push(n);
  const missing = expected.filter((n) => !nums.includes(n));
  const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
  const words = us.reduce((s, u) => s + u.entries.length, 0);
  console.log(
    `  G${g}: ${us.length} 单元  unit ${min}-${max}  词条 ${words}  ` +
      (missing.length ? `❌ 缺编号 ${missing.join(",")}` : "✅ 编号连续") +
      (dup.length ? `  ❌ 重复编号 ${[...new Set(dup)].join(",")}` : "")
  );
}

// ---- 2. 每单元词条数异常（过少 / 过多）----
console.log("\n=== 2. 单元词条数分布（<15 或 >100 判异常）===");
let abnormal = 0;
for (const g of [...byGrade.keys()].sort((a, b) => a - b)) {
  for (const u of byGrade.get(g).sort((a, b) => a.unit - b.unit)) {
    const n = u.entries.length;
    if (n < 15 || n > 100) {
      abnormal++;
      console.log(`  ⚠️ G${g}U${u.unit} ${u.title} — ${n} 词条`);
    }
  }
}
if (!abnormal) console.log("  ✅ 无异常单元");

// ---- 3. 空字段检查 ----
console.log("\n=== 3. 字段完整性 ===");
let emptyText = 0, emptyCn = 0, emptyIpa = 0;
const emptyCnList = [];
for (const u of units) {
  for (const e of u.entries) {
    if (!e.text.trim()) emptyText++;
    if (!e.cn.trim()) { emptyCn++; emptyCnList.push(`G${u.grade}U${u.unit} "${e.text}"`); }
    if (!e.ipa.trim()) emptyIpa++;
  }
}
console.log(`  空 text: ${emptyText}`);
console.log(`  空释义: ${emptyCn}` + (emptyCnList.length ? `\n    ${emptyCnList.slice(0, 10).join("\n    ")}` : ""));
console.log(`  空音标: ${emptyIpa}（sentence 类型通常无音标，属正常）`);

// 空音标细分：word/phrase 应有音标
let wordNoIpa = [];
for (const u of units) {
  for (const e of u.entries) {
    if (e.type !== "sentence" && !e.ipa.trim()) wordNoIpa.push(`G${u.grade}U${u.unit} [${e.type}] ${e.text}`);
  }
}
console.log(`  ⚠️ word/phrase 无音标: ${wordNoIpa.length}` + (wordNoIpa.length ? `\n    ${wordNoIpa.slice(0, 15).join("\n    ")}` : ""));

// ---- 4. 单元内重复词条 ----
console.log("\n=== 4. 单元内重复词条 ===");
let dupTotal = 0;
for (const u of units) {
  const seen = new Map();
  for (const e of u.entries) {
    const k = e.text.trim().toLowerCase();
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  for (const [k, c] of seen) {
    if (c > 1) { dupTotal++; console.log(`  ❌ G${u.grade}U${u.unit} "${k}" ×${c}`); }
  }
}
if (!dupTotal) console.log("  ✅ 无单元内重复");

// ---- 5. 跨年级重复（教材循环复现，仅统计）----
console.log("\n=== 5. 跨年级重复词条（教材螺旋复现，属正常，仅统计）===");
const textGrades = new Map();
for (const u of units) {
  for (const e of u.entries) {
    const k = e.text.trim().toLowerCase();
    if (!textGrades.has(k)) textGrades.set(k, new Set());
    textGrades.get(k).add(u.grade);
  }
}
let crossDup = 0;
for (const [k, gs] of textGrades) if (gs.size > 1) crossDup++;
console.log(`  出现在 ≥2 个年级的词条: ${crossDup} / ${textGrades.size} (${((crossDup / textGrades.size) * 100).toFixed(1)}%)`);

// ---- 6. 类型分布 ----
console.log("\n=== 6. 词条类型分布 ===");
const typeCount = { word: 0, phrase: 0, sentence: 0 };
for (const u of units) for (const e of u.entries) typeCount[e.type]++;
const tot = Object.values(typeCount).reduce((a, b) => a + b, 0);
console.log(`  word ${typeCount.word} (${((typeCount.word / tot) * 100).toFixed(1)}%) / phrase ${typeCount.phrase} / sentence ${typeCount.sentence}`);

// ---- 7. 每年级词条合计 ----
console.log("\n=== 7. 各年级词条合计（字面量教材单元）===");
let grand = 0;
for (const g of [...byGrade.keys()].sort((a, b) => a - b)) {
  const us = byGrade.get(g);
  const w = us.reduce((s, u) => s + u.entries.length, 0);
  const avg = (w / us.length).toFixed(1);
  grand += w;
  console.log(`  G${g}: ${us.length} 单元 / ${w} 词条 / 平均 ${avg} 词条每单元`);
}
console.log(`  ── 合计: ${units.length} 单元 / ${grand} 词条`);

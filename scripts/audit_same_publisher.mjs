// scripts/audit_same_publisher.mjs
// 核心问题：同出版社「一年级起点 G3-G6」vs「三年级起点 G3-G6」真实教材是否一模一样？
//           现在 App 端数据是否一致？
// 比对方法：按 entry.english.toLowerCase() 文本内容查重合度，不看对象引用
import { readFileSync } from "node:fs";

const m = await import("../.tmp-curr.mjs");
const C = m.CURRICULA;

function byGradeAndUnit(units) {
  const m = new Map();
  for (const u of units) {
    const k = `${u.grade}|${u.unit}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(u);
  }
  return m;
}

function entryTextSet(u) {
  return new Set(u.entries.map((e) => e.english.trim().toLowerCase()));
}

function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// 比对 renjiao 一线 G3-G6 vs renjiao3 G3-G6
console.log("\n========== 人教版 renjiao 一线 G3-G6 vs renjiao3 三起 G3-G6 ==========");
const rj1 = byGradeAndUnit(C.renjiao);
const rj3 = byGradeAndUnit(C.renjiao3);

let rjGradeStats = [];
for (const g of [3, 4, 5, 6]) {
  let sameUnit = 0;
  let totalUnit = 0;
  let sameEntry = 0;
  let totalEntry = 0;
  let totalJaccard = 0;

  const units1 = [];
  for (const [k, v] of rj1.entries()) {
    const [gk, uk] = k.split("|").map(Number);
    if (gk === g) units1.push(...v);
  }
  const units3 = [];
  for (const [k, v] of rj3.entries()) {
    const [gk, uk] = k.split("|").map(Number);
    if (gk === g) units3.push(...v);
  }

  for (const u1 of units1) {
    // 找 rj3 同年级同单元号（title 不要求一样，按 unit 数字 + grade 找）
    const match = units3.find((u) => u.unit === u1.unit);
    if (!match) continue;
    totalUnit++;
    const t1 = entryTextSet(u1);
    const t3 = entryTextSet(match);
    for (const e of t1) {
      totalEntry++;
      if (t3.has(e)) sameEntry++;
    }
    totalJaccard += jaccard(t1, t3);
    // 单元 title 是否一致
    if (u1.title === match.title) sameUnit++;
  }
  console.log(
    `  G${g}: ${units1.length}U 一线 vs ${units3.length}U 三起, 按 unit 数字配对 ${totalUnit}U, title 完全相同 ${sameUnit}U, entry 重合 ${sameEntry}/${totalEntry} (${((sameEntry / totalEntry) * 100).toFixed(1)}%), 平均 Jaccard ${(totalJaccard / Math.max(totalUnit, 1)).toFixed(3)}`
  );
  rjGradeStats.push({ grade: g, jaccard: totalJaccard / Math.max(totalUnit, 1), sameRatio: sameEntry / totalEntry });
}

// 比对 waiyanshe 一线 G3-G6 vs waiyanshe3 三起 G3-G6
console.log("\n========== 外研社 waiyanshe 一线 G3-G6 vs waiyanshe3 三起 G3-G6 ==========");
const wy1 = byGradeAndUnit(C.waiyanshe);
const wy3 = byGradeAndUnit(C.waiyanshe3);

let wyGradeStats = [];
for (const g of [3, 4, 5, 6]) {
  let sameUnit = 0;
  let totalUnit = 0;
  let sameEntry = 0;
  let totalEntry = 0;
  let totalJaccard = 0;

  const units1 = [];
  for (const [k, v] of wy1.entries()) {
    const [gk, uk] = k.split("|").map(Number);
    if (gk === g) units1.push(...v);
  }
  const units3 = [];
  for (const [k, v] of wy3.entries()) {
    const [gk, uk] = k.split("|").map(Number);
    if (gk === g) units3.push(...v);
  }

  for (const u1 of units1) {
    const match = units3.find((u) => u.unit === u1.unit);
    if (!match) continue;
    totalUnit++;
    const t1 = entryTextSet(u1);
    const t3 = entryTextSet(match);
    for (const e of t1) {
      totalEntry++;
      if (t3.has(e)) sameEntry++;
    }
    totalJaccard += jaccard(t1, t3);
    if (u1.title === match.title) sameUnit++;
  }
  console.log(
    `  G${g}: ${units1.length}U 一线 vs ${units3.length}U 三起, 按 unit 数字配对 ${totalUnit}U, title 完全相同 ${sameUnit}U, entry 重合 ${sameEntry}/${totalEntry} (${((sameEntry / totalEntry) * 100).toFixed(1)}%), 平均 Jaccard ${(totalJaccard / Math.max(totalUnit, 1)).toFixed(3)}`
  );
  wyGradeStats.push({ grade: g, jaccard: totalJaccard / Math.max(totalUnit, 1), sameRatio: sameEntry / totalEntry });
}

// 同时比对 G7-G9 一致性（PEP / Go for it 7-9 年级是同一系列，不分起点）
console.log("\n========== 人教版 G7-G9 一线 vs 三起（不分起点）==========");
for (const g of [7, 8, 9]) {
  let totalEntry = 0;
  let sameEntry = 0;
  const u1s = [];
  const u3s = [];
  for (const [k, v] of rj1.entries()) {
    const [gk, uk] = k.split("|").map(Number);
    if (gk === g) u1s.push(...v);
  }
  for (const [k, v] of rj3.entries()) {
    const [gk, uk] = k.split("|").map(Number);
    if (gk === g) u3s.push(...v);
  }
  // 整条线合并算重合度
  const t1 = new Set();
  const t3 = new Set();
  for (const u of u1s) for (const e of u.entries) t1.add(e.english.trim().toLowerCase());
  for (const u of u3s) for (const e of u.entries) t3.add(e.english.trim().toLowerCase());
  for (const e of t1) {
    totalEntry++;
    if (t3.has(e)) sameEntry++;
  }
  console.log(
    `  G${g}: 一线 ${u1s.length}U/${t1.size} 词 vs 三起 ${u3s.length}U/${t3.size} 词, 词表重合 ${sameEntry}/${totalEntry} (${((sameEntry / Math.max(totalEntry, 1)) * 100).toFixed(1)}%), Jaccard ${jaccard(t1, t3).toFixed(3)}`
  );
}

console.log("\n========== 外研社 G7-G9 一线 vs 三起 ==========");
for (const g of [7, 8, 9]) {
  let totalEntry = 0;
  let sameEntry = 0;
  const u1s = [];
  const u3s = [];
  for (const [k, v] of wy1.entries()) {
    const [gk, uk] = k.split("|").map(Number);
    if (gk === g) u1s.push(...v);
  }
  for (const [k, v] of wy3.entries()) {
    const [gk, uk] = k.split("|").map(Number);
    if (gk === g) u3s.push(...v);
  }
  const t1 = new Set();
  const t3 = new Set();
  for (const u of u1s) for (const e of u.entries) t1.add(e.english.trim().toLowerCase());
  for (const u of u3s) for (const e of u.entries) t3.add(e.english.trim().toLowerCase());
  for (const e of t1) {
    totalEntry++;
    if (t3.has(e)) sameEntry++;
  }
  console.log(
    `  G${g}: 一线 ${u1s.length}U/${t1.size} 词 vs 三起 ${u3s.length}U/${t3.size} 词, 词表重合 ${sameEntry}/${totalEntry} (${((sameEntry / Math.max(totalEntry, 1)) * 100).toFixed(1)}%), Jaccard ${jaccard(t1, t3).toFixed(3)}`
  );
}

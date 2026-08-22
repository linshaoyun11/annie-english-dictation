// 分析外研社词库：一年级起点模式下，3-6 年级单元去掉 1-2 年级已学词后剩多少
const fs = require("fs");
const t = fs.readFileSync("src/data/waiyanshe.ts", "utf8");
const re = /mk\("wy",\s*(\d+),\s*(\d+),\s*"(\w+)",\s*"((?:[^"\\]|\\.)*)"/g;
const units = []; // {grade, unit, words[]}
let m;
while ((m = re.exec(t))) {
  const g = +m[1], u = +m[2];
  let cur = units.find(x => x.grade === g && x.unit === u);
  if (!cur) { cur = { grade: g, unit: u, words: [] }; units.push(cur); }
  cur.words.push(m[4].toLowerCase());
}
units.sort((a, b) => a.grade - b.grade || a.unit - b.unit);

const early = new Set();
for (const un of units) if (un.grade <= 2) un.words.forEach(w => early.add(w));
console.log("1-2 年级（一年级起点教材）总词数:", early.size);

let removed = 0, empty = 0, thin = 0;
for (const un of units) {
  if (un.grade < 3) continue;
  const remain = un.words.filter(w => !early.has(w));
  removed += un.words.length - remain.length;
  if (remain.length === 0) { empty++; console.log(`  [空] ${un.grade}年级 U${un.unit}: 全部 ${un.words.length} 词已学`); }
  else if (remain.length <= 3) { thin++; console.log(`  [薄] ${un.grade}年级 U${un.unit}: ${un.words.length} -> ${remain.length} 词 (剩: ${remain.join(", ")})`); }
}
const g36 = units.filter(u => u.grade >= 3 && u.grade <= 6);
const total36 = g36.reduce((s, u) => s + u.words.length, 0);
console.log(`\n3-6 年级总词 ${total36}，去重删除 ${removed}，剩余 ${total36 - removed}`);
console.log(`空单元 ${empty} 个，≤3词单元 ${thin} 个`);
// 7-9 年级去重后空/薄单元
for (const un of units.filter(u => u.grade >= 7)) {
  const remain = un.words.filter(w => !early.has(w));
  if (remain.length <= 3) console.log(JSON.stringify({ g: un.grade, u: un.unit, total: un.words.length, remain: remain.length, words: remain }));
}
console.log("7-9 单元总数:", units.filter(u => u.grade >= 7).length);
// 一年级起点线还应该统计 3-6 年级内部跨单元重复（同一孩子连学 3-6 也会重复）
const seen = new Set(early);
let internal = 0;
for (const un of g36) for (const w of un.words) { if (seen.has(w)) internal++; else seen.add(w); }
console.log(`3-6 年级内部跨单元重复: ${internal} 词`);

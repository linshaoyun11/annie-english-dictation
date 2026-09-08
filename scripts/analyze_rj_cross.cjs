// 人教版：量化 1-2 年级（新起点）→ 3-9 年级（PEP/Go for it）跨线重复
const c = require("../.tmp-curriculum2.cjs");
const cur = c.getCurriculum("renjiao");

const early = new Map(); // word -> first {grade,unit}
for (const u of cur.filter((u) => u.grade <= 2))
  for (const e of u.entries) if (!early.has(e.english.toLowerCase())) early.set(e.english.toLowerCase(), u);

let cross = 0;
const perUnit = [];
for (const u of cur.filter((u) => u.grade >= 3)) {
  const dups = u.entries.filter((e) => early.has(e.english.toLowerCase())).map((e) => e.english.toLowerCase());
  if (dups.length) {
    cross += dups.length;
    perUnit.push({ g: u.grade, u: u.unit, title: u.title, total: u.entries.length, dups });
  }
}
console.log(`1-2 年级已学词在 3-9 年级重现: ${cross} 词次，分布在 ${perUnit.length} 个单元`);
for (const p of perUnit.sort((a, b) => b.dups.length - a.dups.length).slice(0, 20)) {
  console.log(`  ${p.g}年级U${p.u} ${p.title} [${p.dups.length}/${p.total}]: ${p.dups.slice(0, 10).join(", ")}`);
}
const emptied = perUnit.filter((p) => p.dups.length === p.total);
console.log(`若跨线去重会被清空的单元: ${emptied.length} 个`, emptied.map((p) => `${p.g}U${p.u}`).join(" "));
const thin = perUnit.filter((p) => p.dups.length >= p.total - 2 && p.dups.length < p.total);
console.log(`去重后仅剩 1-2 词的薄单元: ${thin.length} 个`, thin.map((p) => `${p.g}U${p.u}(剩${p.total - p.dups.length})`).join(" "));

// 3-9 年级内部的重复（非跨线）
const seen = new Set();
for (const u of cur.filter((u) => u.grade <= 2)) u.entries.forEach((e) => seen.add(e.english.toLowerCase()));
let internal = 0;
const seen2 = new Set();
for (const u of cur.filter((u) => u.grade >= 3)) {
  for (const e of u.entries) {
    const k = e.english.toLowerCase();
    if (seen2.has(k)) internal++;
    seen2.add(k);
  }
}
console.log(`3-9 年级内部重复（教材自身复现）: ${internal} 词次`);

// 课标补全单元（各年级末尾新单元）贡献的重复
const lastUnit = {};
for (const u of cur) lastUnit[u.grade] = Math.max(lastUnit[u.grade] || 0, u.unit);
console.log("各年级最大单元号:", JSON.stringify(lastUnit));

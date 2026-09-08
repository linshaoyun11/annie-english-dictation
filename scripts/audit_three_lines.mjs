// scripts/audit_three_lines.mjs
// 精确核实 renjiao / waiyanshe / oxford 三条"一年级起点"线 G3+ 是否真教材
import { readFileSync } from "node:fs";

const m = await import("../.tmp-curr.mjs");
const C = m.CURRICULA;

function summarize(name, arr, mtime) {
  const gradeMap = new Map();
  for (const u of arr) {
    const g = u.grade;
    if (!gradeMap.has(g)) gradeMap.set(g, { units: 0, entries: 0, titles: [] });
    const slot = gradeMap.get(g);
    slot.units += 1;
    slot.entries += u.entries.length;
    slot.titles.push(
      `G${u.grade}U${u.unit}(${u.title.slice(0, 12)}/${u.entries.length})`
    );
  }
  console.log(`\n=== ${name} 共 ${arr.length} U / ${arr.reduce((s, u) => s + u.entries.length, 0)} 条 ===`);
  for (const [g, s] of [...gradeMap.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  G${g}: ${s.units} U / ${s.entries} 条  ${s.titles.join(" · ")}`);
  }
}

// 注：withKebiao 已经浅拷贝了一层 entries，但 WordEntry 对象仍是引用
// 为安全起见，先看 waiyanshe 一线实际数据
summarize("renjiao (一线)", C.renjiao);
summarize("renjiao3 (三起·基线)", C.renjiao3);
summarize("waiyanshe (一线)", C.waiyanshe);
summarize("waiyanshe3 (三起·基线 grade>=3)", C.waiyanshe3);
summarize("oxford (一线)", C.oxford);

// 关键检测：waiyanshe 一线 G3+ 是否 == waiyanshe3 G3+
// 由于 .map() 浅拷贝，对比 entries 指针是否同源
// ⚠️ 这个指标是次要的：**修了深拷贝必然 0%**，不代表数据不一样。
// 真正的"内容是否一致"请看 scripts/audit_same_publisher.mjs ——
// 那个按 entry.english 文本查，是金标准。
console.log("\n=== 三起线 G3+ 与一起线 G3+ 数据同源检测（次要指标，仅作架构验证） ===");
const wy3_g3plus = C.waiyanshe3; // 本就是 WAIYANSHE_CURRICULUM.filter(grade>=3)，是源数组
const wy1_g3plus = C.waiyanshe.filter((u) => u.grade >= 3);
// withKebiao 返回的是 map() 浅拷贝，但 entries 数组仍是引用
let sameEntryObjCount = 0;
let totalEntries = 0;
for (const u1 of wy1_g3plus) {
  for (const u3 of wy3_g3plus) {
    if (u3.grade === u1.grade && u3.unit === u1.unit) {
      // 同单元 → 逐条 entry 对比
      if (u3.entries.length === u1.entries.length) {
        for (let i = 0; i < u3.entries.length; i++) {
          totalEntries++;
          if (u3.entries[i] === u1.entries[i]) sameEntryObjCount++;
        }
      }
    }
  }
}
console.log(
  `wy 一线 G3+ vs wy 三起 G3+：对比 ${totalEntries} 条 entry，${sameEntryObjCount} 条对象引用相同（占比 ${((sameEntryObjCount / totalEntries) * 100).toFixed(1)}%）`
);
console.log(
  wy1_g3plus.length === wy3_g3plus.length
    ? "  ✓ 一线 G3+ 单元数 = 三起线 G3+ 单元数"
    : `  ⚠️  单元数不一致：一线 ${wy1_g3plus.length} ≠ 三起 ${wy3_g3plus.length}`
);

// 同理 renjiao
const rj3_g3plus = C.renjiao3;
const rj1_g3plus = C.renjiao.filter((u) => u.grade >= 3);
let rjSame = 0, rjTotal = 0;
for (const u1 of rj1_g3plus) {
  for (const u3 of rj3_g3plus) {
    if (u3.grade === u1.grade && u3.unit === u1.unit && u3.title === u1.title) {
      if (u3.entries.length === u1.entries.length) {
        for (let i = 0; i < u3.entries.length; i++) {
          rjTotal++;
          if (u3.entries[i] === u1.entries[i]) rjSame++;
        }
      }
    }
  }
}
console.log(
  `renjiao 一线 G3+ vs renjiao3 G3+：对比 ${rjTotal} 条 entry，${rjSame} 条对象引用相同（占比 ${((rjSame / rjTotal) * 100).toFixed(1)}%）`
);

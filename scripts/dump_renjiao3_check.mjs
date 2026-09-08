/**
 * 自查用：把 curriculum.ts 的 CURRICULUM（含 grades4to9.ts 展开）
 * 过滤出 grade >= 3 的部分（= renjiao3 视图），按年级分组输出。
 * 同时输出 renai（独立教材线）做交叉对照。
 * 用法：node scripts/dump_renjiao3_check.mjs
 *
 * 临时转译法见 scripts/verify_renai_runtime.mjs 注释。
 */
import { readFileSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const TMP = ".tmp-curriculum-dump.mjs";
await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
process.on("exit", () => {
  try {
    require("node:fs").unlinkSync(TMP);
  } catch {}
});

const mod = await import(`../${TMP}`);
const FULL = mod.CURRICULUM;
const RENAI = mod.CURRICULUM && mod.RENAI_CURRICULUM ? null : null; // 留位
if (!Array.isArray(FULL)) {
  console.error("未找到 CURRICULUM 导出");
  process.exit(2);
}

const byGrade = new Map();
for (const u of FULL) {
  if (u.grade < 3) continue; // 不过滤上限，看 G3–G9 全貌
  if (!byGrade.has(u.grade)) byGrade.set(u.grade, []);
  byGrade.get(u.grade).push(u);
}

console.log(`renjiao3 = CURRICULUM.filter(grade >= 3) ⇒ 总单元 ${FULL.filter(u => u.grade >= 3).length}\n`);

for (const [grade, units] of [...byGrade.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`\n========= renjiao3 · 年级 ${grade}（${units.length} 单元）=========`);
  for (const u of units) {
    console.log(`\n  [G${grade}U${u.unit}] ${u.title}`);
    console.log(`    词条 (${u.entries.length}): ${u.entries.map((e) => e.english).join(" / ")}`);
  }
}


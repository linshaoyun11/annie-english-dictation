/**
 * 核验课标补全归属：
 *  - 重建线 renjiao3 / waiyanshe3 / renai ⇒ 课标单元数必须为 0
 *  - 保留线 renjiao / waiyanshe / oxford ⇒ 课标单元数必须 > 0
 * 并输出各线单元数 / 词条数 / 年级分布。
 *
 * 用法：node scripts/verify_kebiao_scope.mjs
 */
import { existsSync, unlinkSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const TMP = ".tmp-kebiao-runtime.mjs";
await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
process.on("exit", () => {
  if (existsSync(TMP)) unlinkSync(TMP);
});

const m = await import(`../${TMP}`);
const { CURRICULA, CURRICULUM_VERSION } = m;

const LABEL = {
  renjiao: "人教 一年级起点",
  renjiao3: "人教 三年级起点",
  waiyanshe: "外研 一年级起点",
  waiyanshe3: "外研 三年级起点",
  oxford: "牛津上海版",
  renai: "仁爱 七年级起点",
};
const NO_KEBIAO = new Set(["renjiao3", "waiyanshe3", "renai"]);

console.log("CURRICULUM_VERSION =", CURRICULUM_VERSION);
console.log(
  "教材线".padEnd(20),
  "单元".padStart(5),
  "词条".padStart(6),
  "课标单元".padStart(8),
  "课标词条".padStart(8),
  " 年级分布"
);
let bad = 0;
for (const [k, units] of Object.entries(CURRICULA)) {
  const kbUnits = units.filter((u) => u.title.startsWith("课标词汇"));
  const entries = units.flatMap((u) => u.entries);
  const kbEntries = kbUnits.flatMap((u) => u.entries);
  const byGrade = {};
  for (const u of units) byGrade[u.grade] = (byGrade[u.grade] ?? 0) + 1;
  const gradeStr = Object.entries(byGrade)
    .map(([g, n]) => `G${g}:${n}`)
    .join(" ");
  const expectZero = NO_KEBIAO.has(k);
  const ok = expectZero ? kbUnits.length === 0 : kbUnits.length > 0;
  if (!ok) bad++;
  console.log(
    `${LABEL[k] ?? k}(${k})`.padEnd(20),
    String(units.length).padStart(5),
    String(entries.length).padStart(6),
    String(kbUnits.length).padStart(8),
    String(kbEntries.length).padStart(8),
    (ok ? "  " : "❌") + gradeStr
  );
}

// id 唯一性：只在**单条教材线内**检查。
// 跨线必然重复（renjiao 与 renjiao3 共享同一批 grade>=3 词条对象，id 相同），
// 这是设计使然（两条线指向同一批预生成音频），不算问题。
let dupTotal = 0;
for (const [k, units] of Object.entries(CURRICULA)) {
  const ids = units.flatMap((u) => u.entries.map((e) => e.id));
  const seen = new Set();
  const dup = [];
  for (const id of ids) {
    if (seen.has(id)) dup.push(id);
    seen.add(id);
  }
  dupTotal += dup.length;
  if (dup.length) {
    bad++;
    console.log(`❌ ${k} 线内重复 id ${dup.length} 个，样例:`, dup.slice(0, 5).join(", "));
  }
}
console.log("\n六条线内重复 id 合计:", dupTotal);

console.log(bad === 0 ? "\n✅ 课标归属正确" : `\n❌ ${bad} 项不符合预期`);
process.exitCode = bad === 0 ? 0 : 1;

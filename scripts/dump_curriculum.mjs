/**
 * 教材线全量 dump（audit / 重建时的基础工具）。
 *
 * 用法：
 *   node scripts/dump_curriculum.mjs                 # dump 全部 6 条线
 *   node scripts/dump_curriculum.mjs renjiao3        # 只 dump 人教三起
 *   node scripts/dump_curriculum.mjs renai --out x.txt
 *   node scripts/dump_curriculum.mjs renjiao3 --grades 3,4   # 限定年级
 *   node scripts/dump_curriculum.mjs renjiao3 --titles-only  # 只要标题（对目录页最快）
 *
 * 为什么要真转译而不是读源码：教材线全部由 src/data/curriculum.ts 派生，
 * 不存在 renjiao3.ts / waiyanshe3.ts 独立文件；且 applyKebiaoTo 会在模块加载时
 * 往数组里 splice 课标单元，只有真跑一遍才能得到运行时真相。
 * （history: 2026-09-04 曾因读代码注释当"运行时抽查"证据，误判 renjiao3 小学
 *   "100% 真实"，实际对照的是 PEP 2012 旧版而非 2024 秋新版。此脚本即为纠正。）
 *
 * 转译用 rolldown（Vite 8 自带本地依赖）。
 */
import { writeFileSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const args = process.argv.slice(2);
const posArgs = args.filter((a) => !a.startsWith("--"));
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

const TMP = ".tmp-curriculum-dump.mjs";
await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  // rolldown 的 logLevel 只接受 debug|info|warn|silent，没有 "error"
  logLevel: "silent",
});
process.on("exit", () => {
  try {
    require("node:fs").unlinkSync(TMP);
  } catch {}
});

const mod = await import(`../${TMP}`);
const CURRICULA = mod.CURRICULA;
if (!CURRICULA) {
  console.error("未找到 CURRICULA 导出，可用 keys:", Object.keys(mod));
  process.exit(2);
}

const wantLine = posArgs[0] || "all";
const lines = wantLine === "all" ? Object.keys(CURRICULA) : [wantLine];
const gradesOpt = opt("grades");
const onlyGrades = gradesOpt ? gradesOpt.split(",").map(Number) : null;
const titlesOnly = flag("titles-only");
const outFile = opt("out");

const chunks = [];
const say = (s) => {
  chunks.push(s);
  if (!outFile) console.log(s);
};

say(`# 教材线 dump · ${new Date().toISOString().slice(0, 10)}`);
say(`# filter: line=${wantLine}${onlyGrades ? ` grades=${onlyGrades}` : ""}${titlesOnly ? " titles-only" : ""}\n`);

for (const line of lines) {
  const units = CURRICULA[line];
  if (!units) {
    say(`\n## ${line}  ❌ 不存在（可用: ${Object.keys(CURRICULA).join(", ")}）`);
    continue;
  }

  const filtered = onlyGrades ? units.filter((u) => onlyGrades.includes(u.grade)) : units;
  const real = filtered.filter((u) => !u.title.startsWith("课标词汇"));
  const kebiao = filtered.filter((u) => u.title.startsWith("课标词汇"));
  const totalEntries = filtered.reduce((n, u) => n + u.entries.length, 0);

  const grades = [...new Set(filtered.map((u) => u.grade))].sort((a, b) => a - b);
  const perGrade = grades.map((g) => `${g}:${filtered.filter((u) => u.grade === g).length}`).join(" ");

  say(`\n${"=".repeat(64)}`);
  say(`## ${line}  —  ${filtered.length} 单元 = 教材 ${real.length} + 课标 ${kebiao.length}`);
  say(`   年级分布 ${perGrade}   词条合计 ${totalEntries}`);
  say(`${"=".repeat(64)}`);

  for (const g of grades) {
    const us = filtered.filter((u) => u.grade === g);
    say(`\n----- ${line} · 年级 ${g}（${us.length} 单元）-----`);
    for (const u of us) {
      if (titlesOnly) {
        say(`  [G${g}U${u.unit}] ${u.title}  (${u.entries.length})`);
      } else {
        say(`\n  [G${g}U${u.unit}] ${u.title}`);
        say(`    ${u.entries.map((e) => e.english).join(" / ")}`);
      }
    }
  }
}

if (outFile) {
  writeFileSync(outFile, chunks.join("\n"), "utf8");
  console.log(`✅ 已写出 ${outFile}（${chunks.length} 行）`);
}

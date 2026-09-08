/**
 * 检查某教材线某年级的全部词条在本地音频 manifest 里的覆盖率。
 * 用法：node scripts/check_audio_coverage.mjs [line] [grades]
 *   node scripts/check_audio_coverage.mjs renjiao3 3
 *   node scripts/check_audio_coverage.mjs renjiao3 3,4,5 --missing-only
 *
 * 音频解析按「文本」查 manifest（src/lib/audio.ts:96），与 entry.id 无关，
 * 所以 id 偏移不影响音频；本脚本只查「文本是否在 manifest 里」。
 */
import { readFileSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const line = process.argv[2] ?? "renjiao3";
const gradesArg = process.argv[3] ?? "";
const missingOnly = process.argv.includes("--missing-only");

const TMP = ".tmp-audio-cov.mjs";
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
const CUR = mod.CURRICULA?.[line];
if (!Array.isArray(CUR)) {
  console.error(`未找到教材线 "${line}"，可选：`, Object.keys(mod.CURRICULA ?? {}));
  process.exit(2);
}

const manifestUs = JSON.parse(readFileSync("public/audio/manifest.json", "utf8"));
const manifestUk = JSON.parse(readFileSync("public/audio/manifest-uk.json", "utf8"));

const gradeFilter = gradesArg
  ? new Set(gradesArg.split(",").map((g) => Number(g.trim())))
  : null;

const seen = new Set(); // 去重：同一文本多次出现只统计一次
const rows = [];

for (const u of CUR) {
  if (gradeFilter && !gradeFilter.has(u.grade)) continue;
  for (const e of u.entries) {
    const t = (e.english ?? "").trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    const us = manifestUs[t] ?? null;
    const uk = manifestUk[t] ?? null;
    if (missingOnly && us && uk) continue;
    rows.push({ g: u.grade, unit: u.unit, text: t, us, uk, cn: e.chinese ?? "" });
  }
}

const missUs = rows.filter((r) => !r.us);
const missUk = rows.filter((r) => !r.uk);
const total = seen.size;

console.log(`# 音频覆盖检查 · ${line}${gradesArg ? ` 年级 ${gradesArg}` : " 全年级"}`);
console.log(`# manifest: 美音 ${Object.keys(manifestUs).length} 键 / 英音 ${Object.keys(manifestUk).length} 键\n`);
console.log(`去重词条总数: ${total}`);
console.log(`美音缺失: ${missUs.length}  (覆盖 ${(((total - missUs.length) / total) * 100).toFixed(1)}%)`);
console.log(`英音缺失: ${missUk.length}  (覆盖 ${(((total - missUk.length) / total) * 100).toFixed(1)}%)`);

if (!missingOnly) {
  console.log(`\n明细（前 30 条）:`);
  for (const r of rows.slice(0, 30)) {
    console.log(
      `  G${r.g}U${r.unit}  ${r.text.padEnd(28)} us=${r.us ? "✓" : "✗"} uk=${r.uk ? "✓" : "✗"}  ${r.cn}`
    );
  }
}

if (missUs.length) {
  console.log(`\n===== 美音缺失清单（${missUs.length} 条）=====`);
  for (const r of missUs) {
    console.log(`  G${r.g}U${r.unit}\t${r.text}\t${r.cn}`);
  }
}
if (missUk.length) {
  console.log(`\n===== 英音缺失清单（${missUk.length} 条）=====`);
  for (const r of missUk) {
    console.log(`  G${r.g}U${r.unit}\t${r.text}\t${r.cn}`);
  }
}

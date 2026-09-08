/**
 * 缺失音频的类型分布 —— 用于估算 TTS 生成成本
 * 用法：node scripts/analyze_missing_types.mjs [line] [grades]
 */
import { readFileSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const line = process.argv[2] ?? "renjiao3";
const gradesArg = process.argv[3] ?? "";

const TMP = ".tmp-miss-types.mjs";
await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
process.on("exit", () => {
  try { require("node:fs").unlinkSync(TMP); } catch {}
});

const mod = await import(`../${TMP}`);
const CUR = mod.CURRICULA?.[line];
if (!Array.isArray(CUR)) { console.error("未找到线", line); process.exit(2); }

const manifestUs = JSON.parse(readFileSync("public/audio/manifest.json", "utf8"));
const grades = gradesArg ? new Set(gradesArg.split(",").map(Number)) : null;

const seen = new Set();
const rows = [];
for (const u of CUR) {
  if (grades && !grades.has(u.grade)) continue;
  for (const e of u.entries) {
    const t = (e.english ?? "").trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    if (manifestUs[t]) continue; // 已有音频
    rows.push({ g: u.grade, unit: u.unit, type: e.type ?? "word", text: t, cn: e.chinese ?? "" });
  }
}

const byType = {};
for (const r of rows) {
  byType[r.type] ??= { n: 0, chars: 0, maxLen: 0, sample: r.text };
  byType[r.type].n++;
  byType[r.type].chars += r.text.length;
  if (r.text.length > byType[r.type].maxLen) {
    byType[r.type].maxLen = r.text.length;
    byType[r.type].sample = r.text;
  }
}

console.log(`# 缺失音频类型分布 · ${line}${gradesArg ? " 年级 " + gradesArg : ""}`);
console.log(`# 缺失总数（去重）: ${rows.length}\n`);
console.log("类型        条数    占比    平均字符  最长字符  最长样例");
const total = rows.length;
for (const [type, v] of Object.entries(byType).sort((a, b) => b[1].n - a[1].n)) {
  console.log(
    `${type.padEnd(10)} ${String(v.n).padStart(5)}  ${((v.n / total) * 100).toFixed(1).padStart(5)}%  ${(v.chars / v.n).toFixed(1).padStart(7)}  ${String(v.maxLen).padStart(8)}  ${v.sample.slice(0, 40)}`
  );
}

// 按年级 × 类型
console.log("\n分年级 × 类型：");
console.log("年级    word  phrase  sentence   合计");
const gmap = new Map();
for (const r of rows) {
  gmap.set(r.g, gmap.get(r.g) ?? { word: 0, phrase: 0, sentence: 0 });
  gmap.get(r.g)[r.type] = (gmap.get(r.g)[r.type] ?? 0) + 1;
}
let tw = 0, tp = 0, ts = 0;
for (const g of [...gmap.keys()].sort((a, b) => a - b)) {
  const v = gmap.get(g);
  tw += v.word; tp += v.phrase; ts += v.sentence;
  console.log(`  G${g}  ${String(v.word).padStart(5)}  ${String(v.phrase).padStart(6)}  ${String(v.sentence).padStart(8)}  ${String(v.word + v.phrase + v.sentence).padStart(5)}`);
}
console.log(`  合计 ${String(tw).padStart(5)}  ${String(tp).padStart(6)}  ${String(ts).padStart(8)}  ${String(tw + tp + ts).padStart(5)}`);

// 最长 20 条 sentence（TTS 成本最高）
const sentences = rows.filter((r) => r.type === "sentence").sort((a, b) => b.text.length - a.text.length);
console.log(`\n最长的 15 条 sentence（TTS 时长/成本最高）：`);
for (const s of sentences.slice(0, 15)) {
  console.log(`  G${s.g}U${s.unit} [${s.text.length}字符] ${s.text}`);
}

const avgChars = rows.reduce((a, r) => a + r.text.length, 0) / total;
console.log(`\n总字符数: ${rows.reduce((a, r) => a + r.text.length, 0)}，平均 ${avgChars.toFixed(1)} 字符/条`);
console.log(`预估 TTS 调用: ${total} 条 × 2（美音+英音）= ${total * 2} 个文件`);

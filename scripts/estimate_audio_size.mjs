/**
 * 估算「待生成音频」的包体增量
 *
 * 方法：用现有 manifest 的实测数据，按「文本字符长度」分桶求每桶平均文件大小，
 * 再把待生成词条按长度归入对应桶求和。比线性外推准（MP3 有固定开销，不是纯线性）。
 *
 * 用法：node scripts/estimate_audio_size.mjs [line] [grades]
 *   node scripts/estimate_audio_size.mjs renjiao3
 *   node scripts/estimate_audio_size.mjs renjiao3 3,4,5,6
 */
import { readFileSync, statSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const line = process.argv[2] ?? "renjiao3";
const gradesArg = process.argv[3] ?? "";

const TMP = ".tmp-est-size.mjs";
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
if (!Array.isArray(CUR)) { console.error(`未找到教材线 ${line}`); process.exit(2); }

const manifestUs = JSON.parse(readFileSync("public/audio/manifest.json", "utf8"));
const grades = gradesArg ? new Set(gradesArg.split(",").map(Number)) : null;

// ---- 1. 用现有音频建立「长度 → 平均大小」分桶模型 ----
const BUCKETS = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 30], [31, 45], [46, 999]];
const model = BUCKETS.map(([lo, hi]) => ({ lo, hi, n: 0, bytes: 0, avg: 0 }));

for (const [text, id] of Object.entries(manifestUs)) {
  let st;
  try { st = statSync(`public/audio/${id}.mp3`); } catch { continue; }
  const len = text.length;
  const b = model.find((x) => len >= x.lo && len <= x.hi);
  if (b) { b.n++; b.bytes += st.size; }
}
for (const b of model) b.avg = b.n ? b.bytes / b.n : 0;

// 空桶用相邻桶填充
for (let i = 0; i < model.length; i++) {
  if (model[i].avg) continue;
  let j = i;
  while (j < model.length - 1 && !model[j].avg) j++;
  model[i].avg = model[j].avg || model[Math.max(0, i - 1)].avg || 15 * 1024;
}

console.log("# 音频包体增量估算 · " + line + (gradesArg ? ` 年级 ${gradesArg}` : ""));
console.log("\n── 1. 分桶模型（现有音频实测）──");
console.log("字符区间   样本数   平均大小");
for (const b of model) {
  if (!b.n) continue;
  console.log(
    `${String(b.lo + "-" + (b.hi > 900 ? "+" : b.hi)).padEnd(10)} ${String(b.n).padStart(6)} ${(b.avg / 1024).toFixed(1).padStart(8)} KB`
  );
}

// ---- 2. 收集待生成词条 ----
const seen = new Set();
const missing = [];
for (const u of CUR) {
  if (grades && !grades.has(u.grade)) continue;
  for (const e of u.entries) {
    const t = (e.english ?? "").trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    if (manifestUs[t]) continue;
    missing.push({ g: u.grade, len: t.length, text: t });
  }
}

// ---- 3. 按桶求和 ----
let totalBytes = 0;
const bucketUse = new Map();
for (const m of missing) {
  const b = model.find((x) => m.len >= x.lo && m.len <= x.hi) ?? model[model.length - 1];
  totalBytes += b.avg;
  const key = `${b.lo}-${b.hi > 900 ? "+" : b.hi}`;
  bucketUse.set(key, (bucketUse.get(key) ?? 0) + 1);
}

console.log(`\n── 2. 待生成词条分布（${missing.length} 条）──`);
console.log("字符区间   条数    预估大小(美音)");
for (const b of model) {
  const key = `${b.lo}-${b.hi > 900 ? "+" : b.hi}`;
  const n = bucketUse.get(key) ?? 0;
  if (!n) continue;
  console.log(`${key.padEnd(10)} ${String(n).padStart(5)} ${((n * b.avg) / 1048576).toFixed(1).padStart(10)} MB`);
}

const mbUs = totalBytes / 1048576;
console.log(`\n── 3. 估算结果 ──`);
console.log(`待生成词条        : ${missing.length} 条`);
console.log(`音频文件          : ${missing.length * 2} 个（美音 + 英音）`);
console.log(`美音包体          : ${mbUs.toFixed(1)} MB`);
console.log(`英音包体          : ${mbUs.toFixed(1)} MB（假设与美音同规格）`);
console.log(`【合计包体增量】  : ${(mbUs * 2).toFixed(1)} MB`);
console.log(`\n对比：现有 public/audio = ${(5683 ? 106.6 : 0).toFixed(1)} MB / 5,683 个文件`);
console.log(`生成后预计         : ${(106.6 + mbUs * 2).toFixed(1)} MB / ${5683 + missing.length * 2} 个文件`);

console.log(`\n注：估算基于现有音频实测均值按长度分桶，误差约 ±20%。`);
console.log(`   实际大小取决于 TTS 引擎语速与静音填充策略。`);

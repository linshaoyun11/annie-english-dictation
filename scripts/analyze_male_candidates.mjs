/**
 * 男声候选综合分析：
 * 1. 解析 src/data 全部词库文件，建立 id → 文本 映射（g/wy/ox 前缀）
 *    kb 前缀用 manifest 反查补全
 * 2. 读取 detect_male_voice.py 产出的 F0 报告
 * 3. 对"实际会被播放"的文件（manifest 引用的 id）按阈值列出男声候选
 * 4. 同文本跨版本交叉验证：同一文本的其他版本文件 F0 明显更高 → 该文件确系不同（男声）录音
 *
 * 用法：node scripts/analyze_male_candidates.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = join(ROOT, "public", "audio");

// ---------- 1. id → 文本 ----------
const id2text = new Map();

// 人教（6 参 mk，序号跨文件全局递增）
const MK_RE = /mk\(\s*(\d+),\s*(\d+),\s*"(word|phrase|sentence)",\s*"((?:[^"\\]|\\.)*)"/g;
function parseMk(file) {
  const src = readFileSync(join(ROOT, "src", "data", file), "utf8");
  const out = [];
  let m;
  MK_RE.lastIndex = 0;
  while ((m = MK_RE.exec(src)) !== null) {
    out.push({ grade: Number(m[1]), unit: Number(m[2]), english: m[4] });
  }
  return out;
}
let seq = 0;
for (const c of [...parseMk("grades4to9.ts"), ...parseMk("curriculum.ts")]) {
  seq += 1;
  id2text.set(`g${c.grade}u${c.unit}e${String(seq).padStart(4, "0")}`, c.english);
}

// 外研/牛津（7 参 mk，prefix 各自独立序号）
const MK7_RE =
  /mk\(\s*"([a-z]+)"\s*,\s*(\d+),\s*(\d+),\s*"(word|phrase|sentence)",\s*"((?:[^"\\]|\\.)*)"/g;
function parseMk7(file) {
  const src = readFileSync(join(ROOT, "src", "data", file), "utf8");
  const out = [];
  let m;
  MK7_RE.lastIndex = 0;
  while ((m = MK7_RE.exec(src)) !== null) {
    out.push({
      prefix: m[1],
      grade: Number(m[2]),
      unit: Number(m[3]),
      english: m[5].replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
    });
  }
  return out;
}
const seqMap = new Map();
for (const c of [...parseMk7("waiyanshe.ts"), ...parseMk7("oxford.ts")]) {
  const n = (seqMap.get(c.prefix) ?? 0) + 1;
  seqMap.set(c.prefix, n);
  id2text.set(`${c.prefix}-g${c.grade}u${c.unit}e${String(n).padStart(4, "0")}`, c.english);
}

// ---------- 2. manifest（实际播放的文件集合） ----------
const usManifest = JSON.parse(readFileSync(join(AUDIO_DIR, "manifest.json"), "utf8")); // text -> id
const ukManifest = JSON.parse(readFileSync(join(AUDIO_DIR, "manifest-uk.json"), "utf8"));
const playedUs = new Set(Object.values(usManifest));
const playedUk = new Set(Object.values(ukManifest));
// kb 及漏网 id 用 manifest 反查补全
for (const [text, id] of Object.entries(usManifest)) if (!id2text.has(id)) id2text.set(id, text);

// ---------- 3. F0 报告 ----------
const reportLines = readFileSync(join(ROOT, "scripts", "male_voice_report.tsv"), "utf8")
  .split("\n")
  .slice(1)
  .filter(Boolean);
const f0map = new Map(); // 文件名(不含扩展名) -> {f0, ratio}
for (const line of reportLines) {
  const [fn, f0, ratio] = line.split("\t");
  if (f0) f0map.set(fn.replace(/\.mp3$/, ""), { f0: Number(f0), ratio: Number(ratio) });
}

// ---------- 4. 文本 → 全部版本文件 ----------
const text2files = new Map(); // text -> [{id, f0, ratio, played}]
for (const [fn, info] of f0map) {
  const isUk = fn.endsWith("-uk");
  const eid = fn.replace(/-uk$/, "");
  const text = id2text.get(eid);
  if (!text) continue;
  const key = text.trim().toLowerCase();
  if (!text2files.has(key)) text2files.set(key, []);
  const played = isUk ? playedUk.has(eid) : playedUs.has(eid);
  text2files.get(key).push({ fn, isUk, played, ...info });
}

// ---------- 5. 输出男声候选（仅实际播放的文件） ----------
const THRESHOLD = Number(process.env.TH ?? 160);
const rows = [];
for (const [text, files] of text2files) {
  for (const f of files) {
    if (!f.played) continue;
    if (f.f0 >= THRESHOLD) continue;
    // 同文本其他版本（交叉验证）
    const siblings = files
      .filter((x) => x.fn !== f.fn)
      .map((x) => `${x.fn}${x.isUk ? "(uk)" : ""}:${Math.round(x.f0)}Hz${x.played ? "*" : ""}`);
    const maxSibling = files.filter((x) => x.fn !== f.fn).reduce((a, x) => Math.max(a, x.f0), 0);
    rows.push({
      fn: f.fn,
      isUk: f.isUk,
      f0: f.f0,
      ratio: f.ratio,
      text,
      siblings,
      siblingGap: Math.round(maxSibling - f.f0),
    });
  }
}
rows.sort((a, b) => a.f0 - b.f0);

console.log(`实际播放且 F0 < ${THRESHOLD}Hz 的文件：${rows.length} 个`);
console.log(`（* = 实际播放版本；siblings 为同文本其他版本文件及其 F0）\n`);
for (const r of rows) {
  console.log(
    `${r.fn}${r.isUk ? "(uk)" : ""}  ${Math.round(r.f0)}Hz  ${Math.round(r.ratio * 100)}%  "${r.text}"  同文本版本: ${r.siblings.join(" | ") || "无"}`
  );
}

writeFileSync(
  join(ROOT, "scripts", "male_candidates.json"),
  JSON.stringify(rows, null, 2),
  "utf8"
);
console.log(`\n明细已写入 scripts/male_candidates.json`);

/**
 * 批量生成全部词条音频（有道词典口音，type=2 美音）
 *
 * 原理：
 * - 用正则从 grades4to9.ts / curriculum.ts 提取所有 mk() 调用（顺序与 ESM 求值一致：
 *   grades4to9.ts 先于 curriculum.ts，序号从 1 开始，与 mk.ts 的 seq 对齐）
 * - 单词：文本清理为纯字母后请求有道（与运行时 youdaoUrl 规则一致，防 404）
 * - 短语/句子：保留空格与标点请求有道（发音自然，本地文件不受运行时清理影响）
 * - 输出：public/audio/<id>.mp3 + public/audio/manifest.json
 *   manifest 为 { "归一化文本": "id" }，运行时按文本查表定位本地音频
 *
 * 用法：node scripts/generate_audio.mjs
 * 可断点续传：已存在且非空的 mp3 自动跳过。
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = join(ROOT, "public", "audio");
const FAIL_LOG = join(ROOT, "scripts", "audio_failed.log");

// ---------- 1. 解析 mk 调用（跨行正则，第 4 个参数为英文文本） ----------
const MK_RE = /mk\(\s*(\d+),\s*(\d+),\s*"(word|phrase|sentence)",\s*"((?:[^"\\]|\\.)*)"/g;

/** 读取一个数据文件中的所有 mk 调用，按出现顺序返回 */
function parseMkCalls(file) {
  const src = readFileSync(join(ROOT, "src", "data", file), "utf8");
  const out = [];
  let m;
  MK_RE.lastIndex = 0;
  while ((m = MK_RE.exec(src)) !== null) {
    out.push({
      grade: Number(m[1]),
      unit: Number(m[2]),
      type: m[3],
      english: m[4],
    });
  }
  return out;
}

// ESM 求值顺序：curriculum.ts 依赖 mk.ts 与 grades4to9.ts，
// 因此 grades4to9.ts 的 mk 调用先执行（先占 seq），随后才是 curriculum.ts 的。
const calls = [...parseMkCalls("grades4to9.ts"), ...parseMkCalls("curriculum.ts")];

let seq = 0;
const entries = calls.map((c) => {
  seq += 1;
  return {
    ...c,
    id: `g${c.grade}u${c.unit}e${String(seq).padStart(4, "0")}`,
  };
});

console.log(`解析到 ${entries.length} 条词条（应为 1060）`);

// ---------- 2. 构造有道请求 URL ----------
function youdaoUrlFor(entry) {
  if (entry.type === "word") {
    // 与运行时 youdaoUrl 一致：只留 a-z（don't→dont、good-bye→goodbye）
    const clean = entry.english.toLowerCase().replace(/[^a-z]/g, "");
    if (!clean) return null;
    return `https://dict.youdao.com/dictvoice?audio=${clean}&type=2`;
  }
  // 短语/句子：保留空格与标点，发音更自然
  const text = entry.english.trim();
  if (!text) return null;
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`;
}

// ---------- 3. 下载（串行 + 抖动间隔 + 重试，防频控） ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 150 + Math.floor(Math.random() * 150); // 150~300ms

async function download(url, outPath, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error(`audio too small (${buf.length}B)`);
      writeFileSync(outPath, buf);
      return buf.length;
    } catch (e) {
      clearTimeout(timer);
      if (attempt < retries) {
        const wait = [1000, 3000, 8000][attempt] ?? 10000;
        console.log(`  重试(${attempt + 1}/${retries}) ${url} -> ${e.message}，等待 ${wait}ms`);
        await sleep(wait);
      } else {
        throw e;
      }
    }
  }
}

// ---------- 4. 主流程 ----------
mkdirSync(AUDIO_DIR, { recursive: true });

const manifest = {};
const failed = [];
let skipped = 0;
let downloaded = 0;

console.log(`输出目录：${AUDIO_DIR}\n开始下载…`);

for (let i = 0; i < entries.length; i++) {
  const entry = entries[i];
  const key = entry.english.trim().toLowerCase();
  if (!(key in manifest)) manifest[key] = entry.id; // 重复文本取首个 id

  const outPath = join(AUDIO_DIR, `${entry.id}.mp3`);
  if (existsSync(outPath)) {
    const size = readFileSync(outPath).length;
    if (size >= 1000) {
      skipped += 1;
      continue;
    }
  }

  const url = youdaoUrlFor(entry);
  if (!url) {
    failed.push(`${entry.id}\t${entry.english}\t无有效 URL`);
    continue;
  }

  try {
    const size = await download(url, outPath);
    downloaded += 1;
    if (downloaded % 50 === 0) {
      console.log(`  进度 ${i + 1}/${entries.length}（已下载 ${downloaded}，跳过 ${skipped}）`);
    }
    void size;
  } catch (e) {
    failed.push(`${entry.id}\t${entry.english}\t${e.message}`);
    console.log(`  失败：${entry.id} ${entry.english} -> ${e.message}`);
  }
  await sleep(jitter());
}

// ---------- 5. 写 manifest ----------
writeFileSync(
  join(AUDIO_DIR, "manifest.json"),
  JSON.stringify(manifest, null, 0),
  "utf8"
);

// ---------- 6. 汇总 ----------
if (failed.length) {
  writeFileSync(FAIL_LOG, failed.join("\n") + "\n", "utf8");
}
console.log("\n========== 完成 ==========");
console.log(`总词条：${entries.length}`);
console.log(`已下载：${downloaded}`);
console.log(`已跳过：${skipped}`);
console.log(`失败：${failed.length}`);
console.log(`manifest 键数：${Object.keys(manifest).length}`);
if (failed.length) {
  console.log(`失败清单：${FAIL_LOG}`);
  for (const f of failed.slice(0, 20)) console.log("  " + f);
}

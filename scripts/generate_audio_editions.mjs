/**
 * 生成外研社 / 沪教牛津版词条音频（有道词典美音 type=2，失败用百度 TTS 补全）
 *
 * 与人教 1060 条音频的区别：
 * - 七参 mk 调用：mk("wy"|"ox", grade, unit, type, english, ...)
 * - id 带前缀且按 prefix 独立全局序号：wy-g4u1e0001 / ox-g3u5e0123
 *   （与 mk.ts 的 mkWithPrefix 逻辑一致：序号按文件内调用顺序全局递增）
 * - manifest 合并：已存在的文本键（人教词）直接复用，不重复下载；
 *   新键追加到 manifest.json，重叠文本运行时命中人教本地音频
 *
 * 用法：node scripts/generate_audio_editions.mjs
 * 可断点续传：已存在且非空的 mp3 自动跳过。
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = join(ROOT, "public", "audio");
const MANIFEST = join(AUDIO_DIR, "manifest.json");
const FAIL_LOG = join(ROOT, "scripts", "audio_editions_failed.log");

const BAIDU = "https://fanyi.baidu.com/gettts";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** 七参 mk 调用：mk("prefix", grade, unit, "type", "english", ...) */
const MK_RE =
  /mk\(\s*"([a-z]+)"\s*,\s*(\d+),\s*(\d+),\s*"(word|phrase|sentence)",\s*"((?:[^"\\]|\\.)*)"/g;

function parseMkCalls(file) {
  const src = readFileSync(join(ROOT, "src", "data", file), "utf8");
  const out = [];
  let m;
  MK_RE.lastIndex = 0;
  while ((m = MK_RE.exec(src)) !== null) {
    out.push({
      prefix: m[1],
      grade: Number(m[2]),
      unit: Number(m[3]),
      type: m[4],
      english: m[5].replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
    });
  }
  return out;
}

// 两个文件按顺序解析，prefix 各自独立计数（与 mkWithPrefix 的 prefixSeqs 一致）
const calls = [
  ...parseMkCalls("waiyanshe.ts").map((c) => ({ ...c })),
  ...parseMkCalls("oxford.ts").map((c) => ({ ...c })),
];
const seqMap = new Map();
const entries = calls.map((c) => {
  const n = (seqMap.get(c.prefix) ?? 0) + 1;
  seqMap.set(c.prefix, n);
  return {
    ...c,
    id: `${c.prefix}-g${c.grade}u${c.unit}e${String(n).padStart(4, "0")}`,
  };
});
console.log(`解析到 ${entries.length} 条（外研 ${seqMap.get("wy")} / 牛津 ${seqMap.get("ox")}）`);

// ---------- 现有 manifest（人教） ----------
let manifest = {};
if (existsSync(MANIFEST)) {
  try {
    manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch {
    manifest = {};
  }
}
console.log(`现有 manifest 键数：${Object.keys(manifest).length}`);

// ---------- 构造请求 URL ----------
function youdaoUrlFor(entry) {
  if (entry.type === "word") {
    const clean = entry.english.toLowerCase().replace(/[^a-z]/g, "");
    if (!clean) return null;
    return `https://dict.youdao.com/dictvoice?audio=${clean}&type=2`;
  }
  const text = entry.english.trim();
  if (!text) return null;
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`;
}

function baiduUrl(entry) {
  return `${BAIDU}?lan=en&text=${encodeURIComponent(entry.english)}&spd=3&source=web`;
}

// ---------- 下载（并发池 3 + 抖动，防频控） ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(url, outPath, headers = {}, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error(`audio too small (${buf.length}B)`);
      writeFileSync(outPath, buf);
      return buf.length;
    } catch (e) {
      clearTimeout(timer);
      if (attempt < retries) {
        const wait = [1500, 4000, 9000][attempt] ?? 10000;
        await sleep(wait);
      } else {
        throw e;
      }
    }
  }
}

mkdirSync(AUDIO_DIR, { recursive: true });

const tasks = [];
let reused = 0;
let skipExisting = 0;
for (const entry of entries) {
  const key = entry.english.trim().toLowerCase();
  if (key in manifest) {
    reused += 1; // 与人教/已生成文本重叠 → 直接复用，不重复下载
    continue;
  }
  const outPath = join(AUDIO_DIR, `${entry.id}.mp3`);
  if (existsSync(outPath) && readFileSync(outPath).length >= 1000) {
    manifest[key] = entry.id; // 断点续传：已有文件则补映射
    skipExisting += 1;
    continue;
  }
  tasks.push({ entry, key, outPath });
}
console.log(`直接复用已有音频：${reused} 条；断点续传跳过：${skipExisting} 条；需下载：${tasks.length} 条`);

// 并发池
const CONCURRENCY = 3;
let done = 0;
const failed = [];
const CONSOLE_EVERY = 50;

async function worker() {
  while (tasks.length) {
    const { entry, key, outPath } = tasks.shift();
    const url = youdaoUrlFor(entry);
    let ok = false;
    if (url) {
      try {
        await download(url, outPath);
        manifest[key] = entry.id;
        ok = true;
      } catch (e) {
        failed.push({ entry, msg: e.message });
      }
    } else {
      failed.push({ entry, msg: "no url" });
    }
    // 有道失败 → 百度 TTS 补全（同轮完成，免二次扫描）
    if (!ok) {
      try {
        await download(
          baiduUrl(entry),
          outPath,
          { "User-Agent": UA, Referer: "https://fanyi.baidu.com/" }
        );
        manifest[key] = entry.id;
        ok = true;
        failed.pop();
        console.log(`  百度补全 OK：${entry.id} ${entry.english}`);
      } catch (e) {
        console.log(`  失败：${entry.id} ${entry.english} -> 有道 ${failed[failed.length - 1]?.msg} / 百度 ${e.message}`);
      }
    }
    done += 1;
    if (done % CONSOLE_EVERY === 0) {
      console.log(`  进度 ${done}/${tasks.length + done}（复用 ${reused}）`);
    }
    await sleep(120 + Math.random() * 180);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

// ---------- 写回 manifest（合并） ----------
writeFileSync(MANIFEST, JSON.stringify(manifest), "utf8");

// ---------- 汇总 ----------
const realFailed = failed.filter((f) => !existsSync(join(AUDIO_DIR, `${f.entry.id}.mp3`)));
if (realFailed.length) {
  writeFileSync(
    FAIL_LOG,
    realFailed.map((f) => `${f.entry.id}\t${f.entry.english}\t${f.msg}`).join("\n") + "\n",
    "utf8"
  );
}
console.log("\n========== 完成 ==========");
console.log(`总词条：${entries.length}（外研 960 / 牛津 960）`);
console.log(`复用已有：${reused}`);
console.log(`断点续传：${skipExisting}`);
console.log(`本次下载：${done - realFailed.length}`);
console.log(`失败：${realFailed.length}`);
console.log(`manifest 键数：${Object.keys(manifest).length}`);
if (realFailed.length) {
  console.log(`失败清单：${FAIL_LOG}`);
  for (const f of realFailed.slice(0, 20)) console.log("  " + f);
}

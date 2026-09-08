/**
 * 生成英式发音音频（有道 type=1 英音），覆盖三套词库全部去重文本
 *
 * 输入：public/audio/manifest.json（文本 → id，三套词库去重后约 1600 键）
 * 输出：
 *  - public/audio/{id}-uk.mp3      英音文件（美音 {id}.mp3 保持不动）
 *  - public/audio/manifest-uk.json 文本 → id（仅含成功生成的条目）
 *  - scripts/audio_uk_failed.log   失败清单（运行时回退本地美音）
 *
 * 注意：失败条目不用百度补全——百度 gettts 是美音，放 -uk 文件会污染英音目录，
 * 让运行时沿链路回退到本地美音（{id}.mp3）即可。
 *
 * 用法：node scripts/generate_audio_uk.mjs
 * 断点续传：已存在且非空的 -uk.mp3 自动跳过。
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = join(ROOT, "public", "audio");
const MANIFEST = join(AUDIO_DIR, "manifest.json");
const UK_MANIFEST = join(AUDIO_DIR, "manifest-uk.json");
const FAIL_LOG = join(ROOT, "scripts", "audio_uk_failed.log");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(url, outPath, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
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
        await sleep([1500, 4000, 9000][attempt] ?? 10000);
      } else {
        throw e;
      }
    }
  }
}

/** 有道英音 URL：与运行时 youdaoUrl 的清洗规则一致（去标点，保留空格） */
function youdaoUkUrl(key) {
  const clean = key.replace(/[^a-z ]/g, "").trim();
  if (!clean) return null;
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(clean)}&type=1`;
}

// ---------- 读取 manifest ----------
let manifest = {};
if (existsSync(MANIFEST)) {
  try {
    manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch {
    manifest = {};
  }
}
const pairs = Object.entries(manifest);
console.log(`manifest 键数：${pairs.length}`);

// ---------- 已有英音 manifest（断点续传） ----------
let ukManifest = {};
if (existsSync(UK_MANIFEST)) {
  try {
    ukManifest = JSON.parse(readFileSync(UK_MANIFEST, "utf8"));
  } catch {
    ukManifest = {};
  }
}
console.log(`已有英音清单键数：${Object.keys(ukManifest).length}`);

mkdirSync(AUDIO_DIR, { recursive: true });

const tasks = [];
let skipExisting = 0;
for (const [key, id] of pairs) {
  if (key in ukManifest) {
    skipExisting += 1;
    continue;
  }
  const outPath = join(AUDIO_DIR, `${id}-uk.mp3`);
  if (existsSync(outPath)) {
    const len = readFileSync(outPath).length;
    if (len >= 1000) {
      ukManifest[key] = id;
      skipExisting += 1;
      continue;
    }
  }
  tasks.push({ key, id, outPath });
}
console.log(`断点续传跳过：${skipExisting} 条；需下载：${tasks.length} 条`);

// ---------- 并发下载 ----------
const CONCURRENCY = 3;
let done = 0;
const failed = [];

async function worker() {
  while (tasks.length) {
    const { key, id, outPath } = tasks.shift();
    const url = youdaoUkUrl(key);
    try {
      if (!url) throw new Error("no url");
      await download(url, outPath);
      ukManifest[key] = id;
    } catch (e) {
      failed.push({ id, key, msg: e.message });
    }
    done += 1;
    if (done % 50 === 0) {
      console.log(`  进度 ${done}/${tasks.length + done}（成功 ${Object.keys(ukManifest).length - skipExisting} / 失败 ${failed.length}）`);
    }
    await sleep(120 + Math.random() * 180);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

// ---------- 写回英音清单 ----------
writeFileSync(UK_MANIFEST, JSON.stringify(ukManifest), "utf8");

if (failed.length) {
  writeFileSync(
    FAIL_LOG,
    failed.map((f) => `${f.id}\t${f.key}\t${f.msg}`).join("\n") + "\n",
    "utf8"
  );
}

console.log("\n========== 英音生成完成 ==========");
console.log(`英音清单键数：${Object.keys(ukManifest).length}`);
console.log(`本次成功：${Object.keys(ukManifest).length - skipExisting}`);
console.log(`失败（回退本地美音）：${failed.length}`);
if (failed.length) {
  console.log(`失败清单：${FAIL_LOG}`);
  for (const f of failed.slice(0, 20)) console.log("  " + f);
}

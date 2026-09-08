/**
 * 生成课标补全词汇的本地音频（美音 type=2 + 英音 type=1）
 *
 * 输入：src/data/kebiaoBank.ts 中的 KEBIAO_BANK 数组
 * 输出：
 *  - public/audio/kb{seq}.mp3      美音（有道 type=2，百度 TTS 兜底）
 *  - public/audio/kb{seq}-uk.mp3   英音（有道 type=1，失败回退运行时在线）
 *  - manifest.json / manifest-uk.json  追加新键
 *
 * id 方案：kb + 4 位序号（kb0001 起），与既有 g/wy/ox 前缀不冲突。
 * manifest 映射 text → id，运行时按文本查表定位本地音频，跨三套教材共享。
 *
 * 用法：node scripts/generate_audio_kebiao.mjs
 * 断点续传：已存在且非空的 mp3 自动跳过。
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = join(ROOT, "public", "audio");
const MANIFEST = join(AUDIO_DIR, "manifest.json");
const UK_MANIFEST = join(AUDIO_DIR, "manifest-uk.json");
const FAIL_LOG_US = join(ROOT, "scripts", "audio_kebiao_failed.log");
const FAIL_LOG_UK = join(ROOT, "scripts", "audio_kebiao_uk_failed.log");

const BAIDU = "https://fanyi.baidu.com/gettts";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// ---------- 1. 解析 KEBIAO_BANK ----------
const BANK_RE = /\{\s*en:\s*"((?:[^"\\]|\\.)*)"/g;
const src = readFileSync(join(ROOT, "src", "data", "kebiaoBank.ts"), "utf8");
const words = [];
let m;
BANK_RE.lastIndex = 0;
while ((m = BANK_RE.exec(src)) !== null) {
  words.push(m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
}
console.log(`KEBIAO_BANK 解析：${words.length} 词`);

// ---------- 2. 读取现有 manifest ----------
let manifest = {};
if (existsSync(MANIFEST)) {
  manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
}
let ukManifest = {};
if (existsSync(UK_MANIFEST)) {
  ukManifest = JSON.parse(readFileSync(UK_MANIFEST, "utf8"));
}
console.log(`现有美音 manifest 键数：${Object.keys(manifest).length}`);
console.log(`现有英音 manifest 键数：${Object.keys(ukManifest).length}`);

// ---------- 3. 找出缺失词 ----------
const missing = [];
for (const w of words) {
  const key = w.trim().toLowerCase();
  if (!key) continue;
  if (!(key in manifest)) missing.push({ en: w, key });
}
console.log(`缺失美音：${missing.length} 词`);
const missingUk = missing.filter((e) => !(e.key in ukManifest));
console.log(`缺失英音：${missingUk.length} 词`);

// ---------- 4. 分配 id ----------
let kbSeq = 0;
// 找已用最大 kb 序号
for (const id of Object.values(manifest)) {
  const sm = String(id).match(/^kb(\d+)$/);
  if (sm) kbSeq = Math.max(kbSeq, Number(sm[1]));
}
const idMap = new Map();
for (const item of missing) {
  kbSeq += 1;
  const id = `kb${String(kbSeq).padStart(4, "0")}`;
  idMap.set(item.key, id);
}

// ---------- 5. 下载工具 ----------
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

function youdaoUrl(text, type) {
  const hasSpace = text.trim().includes(" ");
  let clean;
  if (hasSpace) {
    clean = text.toLowerCase().replace(/[^a-z ]/g, "").trim();
  } else {
    clean = text.toLowerCase().replace(/[^a-z]/g, "");
  }
  if (!clean) return null;
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(clean)}&type=${type}`;
}

function baiduUrl(text) {
  return `${BAIDU}?lan=en&text=${encodeURIComponent(text)}&spd=3&source=web`;
}

mkdirSync(AUDIO_DIR, { recursive: true });

// ---------- 6. 下载美音（串行 + 抖动） ----------
console.log("\n===== 开始下载美音 =====");
const failedUs = [];
let dlUs = 0;
let skipUs = 0;

for (let i = 0; i < missing.length; i++) {
  const { en, key } = missing[i];
  const id = idMap.get(key);
  const outPath = join(AUDIO_DIR, `${id}.mp3`);

  // 断点续传
  if (existsSync(outPath) && readFileSync(outPath).length >= 1000) {
    manifest[key] = id;
    skipUs += 1;
    continue;
  }

  const url = youdaoUrl(en, 2);
  if (url) {
    try {
      await download(url, outPath);
      manifest[key] = id;
      dlUs += 1;
    } catch (e) {
      // 有道失败 → 百度兜底
      try {
        await download(baiduUrl(en), outPath, { "User-Agent": UA, Referer: "https://fanyi.baidu.com/" });
        manifest[key] = id;
        dlUs += 1;
        console.log(`  百度补全 OK：${id} ${en}`);
      } catch (e2) {
        failedUs.push(`${id}\t${en}\tyoudao:${e.message} / baidu:${e2.message}`);
      }
    }
  } else {
    failedUs.push(`${id}\t${en}\tno url`);
  }

  if ((dlUs + skipUs) % 50 === 0 && (dlUs + skipUs) > 0) {
    console.log(`  美音进度 ${i + 1}/${missing.length}（下载 ${dlUs}，跳过 ${skipUs}，失败 ${failedUs.length}）`);
  }
  await sleep(120 + Math.random() * 180);
}

// 写回美音 manifest
writeFileSync(MANIFEST, JSON.stringify(manifest), "utf8");
console.log(`\n美音完成：下载 ${dlUs}，跳过 ${skipUs}，失败 ${failedUs.length}`);
if (failedUs.length) {
  writeFileSync(FAIL_LOG_US, failedUs.join("\n") + "\n", "utf8");
  console.log(`失败清单：${FAIL_LOG_US}`);
}

// ---------- 7. 下载英音（并发池 3） ----------
console.log("\n===== 开始下载英音 =====");
const ukTasks = [];
for (const { en, key } of missingUk) {
  const id = idMap.get(key);
  if (!id) continue; // 美音也失败的词跳过
  const outPath = join(AUDIO_DIR, `${id}-uk.mp3`);
  if (existsSync(outPath) && readFileSync(outPath).length >= 1000) {
    ukManifest[key] = id;
    continue;
  }
  ukTasks.push({ en, key, id, outPath });
}
console.log(`需下载英音：${ukTasks.length} 词`);

const CONCURRENCY = 3;
let ukDone = 0;
const failedUk = [];

async function ukWorker() {
  while (ukTasks.length) {
    const { en, key, id, outPath } = ukTasks.shift();
    const url = youdaoUrl(en, 1);
    let ok = false;
    if (url) {
      try {
        await download(url, outPath);
        ukManifest[key] = id;
        ok = true;
      } catch (e) {
        // 英音失败不补百度（百度是美音，会污染英音目录）
      }
    }
    if (!ok) failedUk.push(`${id}\t${en}`);
    ukDone += 1;
    if (ukDone % 50 === 0) {
      console.log(`  英音进度 ${ukDone}/${ukTasks.length + (missingUk.length - ukTasks.length - ukDone)}（成功 ${Object.keys(ukManifest).length} / 失败 ${failedUk.length}）`);
    }
    await sleep(120 + Math.random() * 180);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => ukWorker()));

writeFileSync(UK_MANIFEST, JSON.stringify(ukManifest), "utf8");
console.log(`\n英音完成：成功 ${Object.keys(ukManifest).length}，失败 ${failedUk.length}`);
if (failedUk.length) {
  writeFileSync(FAIL_LOG_UK, failedUk.join("\n") + "\n", "utf8");
  console.log(`英音失败清单（运行时回退在线/本地美音）：${FAIL_LOG_UK}`);
}

// ---------- 8. 汇总 ----------
console.log("\n========== 全部完成 ==========");
console.log(`课标总词：${words.length}`);
console.log(`已有（复用）：${words.length - missing.length}`);
console.log(`美音新增：${dlUs}（失败 ${failedUs.length}）`);
console.log(`英音新增：${ukDone - failedUk.length}（失败 ${failedUk.length}）`);
console.log(`manifest 总键数：${Object.keys(manifest).length}`);
console.log(`manifest-uk 总键数：${Object.keys(ukManifest).length}`);

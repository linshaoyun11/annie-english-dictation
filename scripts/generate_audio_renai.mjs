/**
 * 生成仁爱版（Project English 初中 7-9 年级）词条音频
 *
 * 美音：有道 dictvoice type=2，失败用百度 TTS 补全 → manifest.json
 * 英音：有道 dictvoice type=1（不兜底）→ manifest-uk.json
 *   英音失败不阻塞：运行时 audio.ts 的 resolveAudio 在英音缺失时
 *   自动回落到本地美音，不会没声音。失败清单写入
 *   scripts/audio_renai_uk_failed.log，后续可用 edge-tts 补。
 *
 * id 规则与 mk.ts 的 mkWithPrefix 一致：ra-g{grade}u{unit}e{0001}
 * （按文件内 mk 调用顺序独立计数，不占用人教全局 seq）
 *
 * 用法：node scripts/generate_audio_renai.mjs
 *      node scripts/generate_audio_renai.mjs --us   仅美音
 *      node scripts/generate_audio_renai.mjs --uk   仅英音
 * 可断点续传：已存在且非空的 mp3 自动跳过。
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = join(ROOT, "public", "audio");
const MANIFEST_US = join(AUDIO_DIR, "manifest.json");
const MANIFEST_UK = join(AUDIO_DIR, "manifest-uk.json");
const FAIL_LOG_US = join(ROOT, "scripts", "audio_renai_us_failed.log");
const FAIL_LOG_UK = join(ROOT, "scripts", "audio_renai_uk_failed.log");

const BAIDU = "https://fanyi.baidu.com/gettts";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const argv = process.argv.slice(2);
const DO_US = !argv.includes("--uk");
const DO_UK = !argv.includes("--us");
/** --limit=N 仅处理前 N 条（试跑验证用） */
const LIMIT_ARG = argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split("=")[1]) : 0;

/** 七参 mk 调用：mk("ra", grade, unit, "type", "english", ...) */
const MK_RE =
  /mk\(\s*"ra"\s*,\s*(\d+),\s*(\d+),\s*"(word|phrase|sentence)",\s*"((?:[^"\\]|\\.)*)"/g;

function parseRenai() {
  const src = readFileSync(join(ROOT, "src", "data", "renai.ts"), "utf8");
  const out = [];
  let m;
  MK_RE.lastIndex = 0;
  while ((m = MK_RE.exec(src)) !== null) {
    out.push({
      grade: Number(m[1]),
      unit: Number(m[2]),
      type: m[3],
      english: m[4].replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
    });
  }
  // id 按调用顺序独立计数（与 mkWithPrefix 的 prefixSeqs 一致）
  return out.map((c, i) => ({
    ...c,
    id: `ra-g${c.grade}u${c.unit}e${String(i + 1).padStart(4, "0")}`,
  }));
}

const allEntries = parseRenai();
const entries = LIMIT ? allEntries.slice(0, LIMIT) : allEntries;
console.log(
  `解析到仁爱版词条 ${allEntries.length} 条${LIMIT ? `（本次处理前 ${entries.length} 条）` : ""}`
);

/* ---------- manifest ---------- */
const manifestUs = existsSync(MANIFEST_US)
  ? JSON.parse(readFileSync(MANIFEST_US, "utf8"))
  : {};
const manifestUk = existsSync(MANIFEST_UK)
  ? JSON.parse(readFileSync(MANIFEST_UK, "utf8"))
  : {};
console.log(
  `现有 manifest：美音 ${Object.keys(manifestUs).length} 键 / 英音 ${Object.keys(manifestUk).length} 键`
);

/* ---------- URL 构造（清洗规则与 generate_audio_editions / _uk 保持一致） ---------- */
function youdaoUsUrl(entry) {
  if (entry.type === "word") {
    const clean = entry.english.toLowerCase().replace(/[^a-z]/g, "");
    if (!clean) return null;
    return `https://dict.youdao.com/dictvoice?audio=${clean}&type=2`;
  }
  const text = entry.english.trim();
  if (!text) return null;
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`;
}

function youdaoUkUrl(key) {
  const clean = key.replace(/[^a-z ]/g, "").trim();
  if (!clean) return null;
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(clean)}&type=1`;
}

function baiduUrl(entry) {
  return `${BAIDU}?lan=en&text=${encodeURIComponent(entry.english)}&spd=3&source=web`;
}

/* ---------- 下载（并发池 3 + 抖动，防频控） ---------- */
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
        await sleep([1500, 4000, 9000][attempt] ?? 10000);
      } else {
        throw e;
      }
    }
  }
}

mkdirSync(AUDIO_DIR, { recursive: true });

/** 收集待下载任务：已有映射或文件已存在的都跳过 */
function collectTasks(manifest, suffix) {
  const tasks = [];
  let reused = 0;
  let skip = 0;
  for (const entry of entries) {
    const key = entry.english.trim().toLowerCase();
    if (key in manifest) {
      reused += 1; // 与人教/外研/牛津/已生成文本重叠 → 直接复用
      continue;
    }
    const outPath = join(AUDIO_DIR, `${entry.id}${suffix}.mp3`);
    if (existsSync(outPath) && readFileSync(outPath).length >= 1000) {
      manifest[key] = entry.id; // 断点续传：已有文件则补映射
      skip += 1;
      continue;
    }
    tasks.push({ entry, key, outPath });
  }
  return { tasks, reused, skip };
}

async function runPool(tasks, workerFn, label, every = 25) {
  const CONCURRENCY = 3;
  let done = 0;
  const failed = [];
  async function worker() {
    while (tasks.length) {
      const task = tasks.shift();
      const err = await workerFn(task);
      if (err) failed.push({ entry: task.entry, msg: err });
      done += 1;
      if (done % every === 0) console.log(`  [${label}] 进度 ${done}/${done + tasks.length}`);
      await sleep(120 + Math.random() * 180);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { done, failed };
}

const summary = {};

/* ==================== 美音 ==================== */
if (DO_US) {
  const { tasks, reused, skip } = collectTasks(manifestUs, "");
  console.log(
    `\n【美音】复用已有 ${reused} / 断点续传 ${skip} / 需下载 ${tasks.length}`
  );
  const { done, failed } = await runPool(tasks, async ({ entry, key, outPath }) => {
    try {
      await download(youdaoUsUrl(entry), outPath);
      manifestUs[key] = entry.id;
      return null;
    } catch (e1) {
      try {
        await download(baiduUrl(entry), outPath, {
          "User-Agent": UA,
          Referer: "https://fanyi.baidu.com/",
        });
        manifestUs[key] = entry.id;
        console.log(`  百度补全 OK：${entry.id} ${entry.english}`);
        return null;
      } catch (e2) {
        console.log(`  失败：${entry.id} ${entry.english} -> 有道 ${e1.message} / 百度 ${e2.message}`);
        return `${e1.message} | ${e2.message}`;
      }
    }
  }, "us");
  writeFileSync(MANIFEST_US, JSON.stringify(manifestUs), "utf8");
  summary.us = { done, failed: failed.length, reused, skip, tasks: tasks.length };
}

/* ==================== 英音（无兜底，失败由运行时回落美音） ==================== */
if (DO_UK) {
  const { tasks, reused, skip } = collectTasks(manifestUk, "-uk");
  console.log(
    `\n【英音】复用已有 ${reused} / 断点续传 ${skip} / 需下载 ${tasks.length}`
  );
  const { done, failed } = await runPool(tasks, async ({ entry, key, outPath }) => {
    const url = youdaoUkUrl(key);
    if (!url) return "empty text after clean";
    try {
      await download(url, outPath);
      manifestUk[key] = entry.id;
      return null;
    } catch (e) {
      console.log(`  英音失败（运行时将回落美音）：${entry.id} ${entry.english} -> ${e.message}`);
      return e.message;
    }
  }, "uk");
  writeFileSync(MANIFEST_UK, JSON.stringify(manifestUk), "utf8");
  if (failed.length) {
    writeFileSync(
      FAIL_LOG_UK,
      failed.map((f) => `${f.entry.id}\t${f.entry.english}\t${f.msg}`).join("\n") + "\n",
      "utf8"
    );
  }
  summary.uk = { done, failed: failed.length, reused, skip, tasks: tasks.length };
}

/* ==================== 汇总 ==================== */
console.log("\n========== 完成 ==========");
for (const [k, s] of Object.entries(summary)) {
  console.log(
    `${k === "us" ? "美音" : "英音"}：需下载 ${s.tasks} / 下载 ${s.done - s.failed} / 失败 ${s.failed} / 复用 ${s.reused} / 续传 ${s.skip}`
  );
}
console.log(
  `manifest 键数：美音 ${Object.keys(manifestUs).length} / 英音 ${Object.keys(manifestUk).length}`
);

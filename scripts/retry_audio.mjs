/**
 * 补全有道词典库缺失的音频（短语/句子），使用百度翻译 TTS 生成。
 *
 * 背景：有道 dictvoice 是"词典发音库"查询，词典中不存在的词组/例句
 * 返回 500 "returned null audio"（实测约 57 条）。这些条目用百度
 * 通用 TTS（en 美音）补全，保证发布后全部音频本地化、零运行时依赖。
 *
 * 用法：node scripts/retry_audio.mjs
 * 步骤：
 *   1. 读取 scripts/audio_failed.log（第一轮失败清单）
 *   2. 每条先用百度 TTS 生成到 public/audio/<id>.mp3
 *   3. 重新解析全部 1060 条，重建 manifest.json
 *      （重复文本映射到第一个"文件存在"的 id）
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = join(ROOT, "public", "audio");
const FAIL_LOG = join(ROOT, "scripts", "audio_failed.log");
const BAIDU = "https://fanyi.baidu.com/gettts";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 从失败日志解析 [id, english] */
function readFailures() {
  if (!existsSync(FAIL_LOG)) return [];
  return readFileSync(FAIL_LOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [id, english] = line.split("\t");
      return { id, english };
    });
}

async function download(url, outPath, headers, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error(`too small (${buf.length}B)`);
      writeFileSync(outPath, buf);
      return buf.length;
    } catch (e) {
      clearTimeout(timer);
      if (attempt < retries) {
        const wait = [1500, 4000, 9000][attempt] ?? 10000;
        console.log(`  重试(${attempt + 1}/${retries}) ${url} -> ${e.message}`);
        await sleep(wait);
      } else {
        throw e;
      }
    }
  }
}

// ---------- 1. 补全下载 ----------
const failures = readFailures();
console.log(`失败清单 ${failures.length} 条，开始百度 TTS 补全…`);

let ok = 0;
const stillFailed = [];
for (const { id, english } of failures) {
  const outPath = join(AUDIO_DIR, `${id}.mp3`);
  if (existsSync(outPath)) {
    const size = readFileSync(outPath).length;
    if (size >= 1000) {
      console.log(`  已存在跳过：${id} ${english}`);
      ok += 1;
      continue;
    }
  }
  const url = `${BAIDU}?lan=en&text=${encodeURIComponent(english)}&spd=3&source=web`;
  try {
    const size = await download(url, outPath, { "User-Agent": UA, Referer: "https://fanyi.baidu.com/" });
    ok += 1;
    console.log(`  OK ${id} ${english} (${size}B)`);
  } catch (e) {
    stillFailed.push(`${id}\t${english}\t${e.message}`);
    console.log(`  仍失败：${id} ${english} -> ${e.message}`);
  }
  await sleep(400 + Math.random() * 300);
}

// ---------- 2. 重建 manifest ----------
const MK_RE = /mk\(\s*(\d+),\s*(\d+),\s*"(word|phrase|sentence)",\s*"((?:[^"\\]|\\.)*)"/g;
function parseMkCalls(file) {
  const src = readFileSync(join(ROOT, "src", "data", file), "utf8");
  const out = [];
  let m;
  MK_RE.lastIndex = 0;
  while ((m = MK_RE.exec(src)) !== null) {
    out.push({ grade: Number(m[1]), unit: Number(m[2]), type: m[3], english: m[4] });
  }
  return out;
}
const calls = [...parseMkCalls("grades4to9.ts"), ...parseMkCalls("curriculum.ts")];
let seq = 0;
const entries = calls.map((c) => {
  seq += 1;
  return { ...c, id: `g${c.grade}u${c.unit}e${String(seq).padStart(4, "0")}` };
});

const manifest = {};
let missing = 0;
for (const e of entries) {
  const key = e.english.trim().toLowerCase();
  if (key in manifest) continue; // 重复文本保留首个映射
  const f = join(AUDIO_DIR, `${e.id}.mp3`);
  if (existsSync(f) && readFileSync(f).length >= 1000) {
    manifest[key] = e.id;
  } else {
    missing += 1;
  }
}
writeFileSync(join(AUDIO_DIR, "manifest.json"), JSON.stringify(manifest), "utf8");

// ---------- 3. 汇总 ----------
console.log("\n========== 补全完成 ==========");
console.log(`成功：${ok}/${failures.length}`);
console.log(`仍失败：${stillFailed.length}`);
console.log(`manifest 键数：${Object.keys(manifest).length}（缺失 ${missing}）`);
if (stillFailed.length) {
  writeFileSync(FAIL_LOG, stillFailed.join("\n") + "\n", "utf8");
  console.log(`剩余失败清单已写回 ${FAIL_LOG}`);
  for (const f of stillFailed) console.log("  " + f);
} else if (existsSync(FAIL_LOG)) {
  // 全部成功则清空失败日志
  writeFileSync(FAIL_LOG, "", "utf8");
}

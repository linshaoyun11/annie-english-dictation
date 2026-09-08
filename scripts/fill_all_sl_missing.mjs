#!/usr/bin/env node
/**
 * scripts/fill_all_sl_missing.mjs
 * 高效补录 renjiao/waiyanshe/oxford 一线 SL 缺失音频
 *  - 只处理 audit 显示的 no-manifest 缺失项（不扫全部）
 *  - 三条线并行下载
 *  - 有道失败用 Edge 兜底
 */
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const AUDIO_DIR = join(ROOT, "public", "audio");
const MANIFEST = join(AUDIO_DIR, "manifest.json");
const MANIFEST_UK = join(AUDIO_DIR, "manifest-uk.json");

const PYTHON =
  "C:/Users/huawei/.workbuddy/binaries/python/envs/default/Scripts/python.exe";

// 加载 manifest
let manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
let manifestUk = JSON.parse(readFileSync(MANIFEST_UK, "utf8"));

// 加载三条线全部 unique entries
const m = await import("../.tmp-curr.mjs");
const allLines = ["renjiao", "waiyanshe", "oxford"];

const TASKS = []; // {id, text, variant}
for (const line of allLines) {
  const uniq = new Map();
  for (const u of m.CURRICULA[line]) {
    for (const e of u.entries) {
      const k = e.english.trim().toLowerCase();
      if (!uniq.has(k)) uniq.set(k, e.id);
    }
  }
  for (const [text, id] of uniq) {
    if (!manifest[text]) TASKS.push({ id, text, variant: "us" });
    if (!manifestUk[text]) TASKS.push({ id, text, variant: "uk" });
  }
}
console.log(`待下载任务数：${TASKS.length}`);
if (TASKS.length === 0) {
  console.log("无缺失，退出");
  process.exit(0);
}

function fileLooksGood(p) {
  if (!existsSync(p)) return false;
  const sz = statSync(p).size;
  if (sz < 1024 || sz > 60 * 1024) return false;
  const head = readFileSync(p, { encoding: null }).subarray(0, 3);
  const isID3 = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33;
  const isMP3 = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
  return isID3 || isMP3;
}

async function youdaoMp3(text, type) {
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${type}`;
  return new Promise((resolve, reject) => {
    const chunks = [];
    const proc = spawn(
      "curl",
      ["-sS", "-A", "Mozilla/5.0", "-w", "%{http_code}", "-o", "-", url],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let httpCode = "";
    proc.stdout.on("data", (c) => {
      const s = c.toString();
      if (/^\d{3}$/.test(s.trim())) httpCode = s.trim();
      else chunks.push(c);
    });
    proc.stderr.on("data", () => {});
    proc.on("close", () => {
      const buf = Buffer.concat(chunks);
      if (httpCode !== "200") return reject(new Error(`http ${httpCode}`));
      if (buf.length < 1024) return reject(new Error("too small"));
      if (buf.length > 120 * 1024) return reject(new Error(`too big ${buf.length}B`));
      resolve(buf);
    });
  });
}

function edgeTts(text, voice, outPath) {
  return new Promise((resolve, reject) => {
    const py = spawn(
      PYTHON,
      [
        "-c",
        `import edge_tts, asyncio; asyncio.run(edge_tts.Communicate(text=${JSON.stringify(text)}, voice=${JSON.stringify(voice)}).save(${JSON.stringify(outPath)}))`,
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    let err = "";
    py.stderr.on("data", (c) => (err += c.toString()));
    py.on("close", (code) => {
      if (code !== 0) return reject(new Error(`edge_tts exit ${code}: ${err}`));
      resolve();
    });
  });
}

const RESULTS = { ok: 0, youdao: 0, edge: 0, failed: [] };

// 并发 6 个下载任务
const CONCURRENCY = 6;
let nextIdx = 0;
async function worker() {
  while (nextIdx < TASKS.length) {
    const idx = nextIdx++;
    const { id, text, variant } = TASKS[idx];
    const type = variant === "us" ? 2 : 1;
    const suffix = variant === "uk" ? "-uk" : "";
    const outPath = join(AUDIO_DIR, `${id}${suffix}.mp3`);
    const targetManifest = variant === "us" ? manifest : manifestUk;

    if (fileLooksGood(outPath)) {
      targetManifest[text] = id;
      RESULTS.ok++;
      continue;
    }

    try {
      const buf = await youdaoMp3(text, type);
      if (buf.length > 60 * 1024) {
        throw new Error("oversized");
      }
      writeFileSync(outPath, buf);
      targetManifest[text] = id;
      RESULTS.youdao++;
      process.stdout.write(`✓`);
    } catch (e1) {
      try {
        await edgeTts(
          text,
          variant === "us" ? "en-US-AriaNeural" : "en-GB-RyanNeural",
          outPath
        );
        if (!fileLooksGood(outPath)) throw new Error("edge output invalid");
        targetManifest[text] = id;
        RESULTS.edge++;
        process.stdout.write(`e`);
      } catch (e2) {
        RESULTS.failed.push({ id, text, variant, error: e2.message });
        process.stdout.write(`x`);
      }
    }

    // 每 50 个保存一次 manifest
    if ((idx + 1) % 50 === 0) {
      writeFileSync(MANIFEST, JSON.stringify(manifest), "utf8");
      writeFileSync(MANIFEST_UK, JSON.stringify(manifestUk), "utf8");
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
writeFileSync(MANIFEST, JSON.stringify(manifest), "utf8");
writeFileSync(MANIFEST_UK, JSON.stringify(manifestUk), "utf8");

console.log(`\n\n========== 完成 ==========`);
console.log(`总任务：${TASKS.length}`);
console.log(`已存在跳过：${RESULTS.ok}`);
console.log(`有道成功：${RESULTS.youdao}`);
console.log(`Edge 兜底成功：${RESULTS.edge}`);
console.log(`失败：${RESULTS.failed.length}`);
console.log(`manifest.json 键数：${Object.keys(manifest).length}`);
console.log(`manifest-uk.json 键数：${Object.keys(manifestUk).length}`);
if (RESULTS.failed.length) {
  console.log("失败明细：");
  for (const f of RESULTS.failed) console.log(`  - ${f.id} «${f.text}» (${f.variant}): ${f.error}`);
}

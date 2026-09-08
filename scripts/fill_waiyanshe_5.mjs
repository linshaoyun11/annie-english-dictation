/**
 * 一次性补齐外研 5 个 unique 短句音频（同时补美英两版，避免将来再回头）
 *
 * 2026-09-08 audit_all_playback 实测缺口：
 *   美音 1：fold
 *   英音 4：lift sb's spirits / clear sb's throat / feather-covered / great-aunt
 *
 * 5 条 entry 全部在 src/data/waiyanshe.ts：
 *   wy-g6u4e1158   «fold»                  word
 *   wy-g7u10e1640  «lift sb's spirits»     phrase
 *   wy-g8u5e2016   «clear sb's throat»     phrase
 *   wy-g8u11e2244  «feather-covered»       word
 *   wy-g9u4e2434   «great-aunt»            word
 *
 * 音源策略：有道优先（type=2 美 / type=1 英）；失败/异常（<1KB / >100KB）用 Edge 兜底。
 * 现状：2026-09-07 实测有道可用。
 *
 * 用法：node scripts/fill_waiyanshe_5.mjs
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = join(ROOT, "public", "audio");
const MANIFEST = join(AUDIO_DIR, "manifest.json");
const MANIFEST_UK = join(AUDIO_DIR, "manifest-uk.json");

const PYTHON =
  process.env.WB_PYTHON ||
  "C:/Users/huawei/.workbuddy/binaries/python/envs/default/Scripts/python.exe";

/** [text, id] —— id 直接来自 audit_all_playback 报值 */
const ENTRIES = [
  { id: "wy-g6u4e1158", text: "fold", youdao: "fold" },
  { id: "wy-g7u10e1640", text: "lift sb's spirits", youdao: "lift sb's spirits" },
  { id: "wy-g8u5e2016", text: "clear sb's throat", youdao: "clear sb's throat" },
  { id: "wy-g8u11e2244", text: "feather-covered", youdao: "feather-covered" },
  { id: "wy-g9u4e2434", text: "great-aunt", youdao: "great-aunt" },
];

// ---------- 现有 manifest（同时加载 us / uk 两份） ----------
let manifest = {};
let manifestUk = {};
if (existsSync(MANIFEST)) {
  try {
    manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch {
    manifest = {};
  }
}
if (existsSync(MANIFEST_UK)) {
  try {
    manifestUk = JSON.parse(readFileSync(MANIFEST_UK, "utf8"));
  } catch {
    manifestUk = {};
  }
}

// ---------- 下载 ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fileLooksGood(p) {
  if (!existsSync(p)) return false;
  const sz = statSync(p).size;
  // audit 阈值 1KB–60KB 是真理标准；越界视为异常
  if (sz < 1024 || sz > 60000) return false;
  const head = readFileSync(p, { encoding: null }).subarray(0, 3);
  const isID3 = head[0] === 0x49 /* I */ && head[1] === 0x44 /* D */ && head[2] === 0x33 /* 3 */;
  const isMP3 = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
  return isID3 || isMP3;
}

async function fetchYoudao(text, type /* 1=uk 2=us */) {
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
    text
  )}&type=${type}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) throw new Error(`too small (${buf.length}B)`);
    if (buf.length > 60000) throw new Error(`too big (${buf.length}B)`);
    const head = buf.subarray(0, 3);
    const isID3 =
      head[0] === 0x49 /* I */ && head[1] === 0x44 /* D */ && head[2] === 0x33 /* 3 */;
    const isMP3 = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
    if (!isID3 && !isMP3) throw new Error("bad magic");
    return buf;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/** Edge TTS 兜底：Python 子进程 → 直接写目标文件（沙箱拦截 unlink） */
function edgeTts(text, voice, outPath) {
  return new Promise((resolve, reject) => {
    writeFileSync(outPath, "");
    const code = [
      "import asyncio, sys",
      "from edge_tts import Communicate",
      "async def main():",
      "    c = Communicate(sys.argv[1].replace('\\n',' '), voice=sys.argv[2])",
      "    async for chunk in c.stream():",
      "        if chunk['type'] == 'audio':",
      "            with open(sys.argv[3], 'ab') as f: f.write(chunk['data'])",
      "asyncio.run(main())",
    ].join("\n");
    const py = spawn(PYTHON, ["-c", code, text, voice, outPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    py.stderr.on("data", (d) => (stderr += d.toString()));
    py.on("close", (code2) => {
      if (code2 !== 0)
        return reject(new Error(`edge exit ${code2}: ${stderr.slice(0, 200)}`));
      const sz = statSync(outPath).size;
      if (sz < 1024) reject(new Error(`edge output too small (${sz}B)`));
      else resolve(sz);
    });
  });
}

const RESULTS = [];
async function processOne(entry) {
  const { id, text, youdao } = entry;
  const manifestKey = text.trim().toLowerCase();

  for (const variant of ["us", "uk"]) {
    const suffix = variant === "uk" ? "-uk" : "";
    const outPath = join(AUDIO_DIR, `${id}${suffix}.mp3`);
    const youdaoType = variant === "uk" ? 1 : 2;
    const edgeVoice = variant === "uk" ? "en-GB-SoniaNeural" : "en-US-AriaNeural";

    if (fileLooksGood(outPath)) {
      console.log(`  ✓ 已有 ${id}${suffix}.mp3 (${variant})`);
      RESULTS.push({ id, variant, source: "cached" });
      if (variant === "us") manifest[manifestKey] = id;
      else manifestUk[manifestKey] = id;
      continue;
    }

    // 有道优先
    let source = "youdao";
    try {
      const buf = await fetchYoudao(youdao, youdaoType);
      writeFileSync(outPath, buf);
      console.log(`  ✓ 有道 ${variant} ${id}${suffix}.mp3 (${buf.length}B)`);
    } catch (e) {
      console.log(`  • 有道 ${variant} 失败(${e.message})，Edge 兜底...`);
      source = "edge";
      try {
        await edgeTts(text, edgeVoice, outPath);
        const sz = statSync(outPath).size;
        console.log(`  ✓ Edge ${variant} ${id}${suffix}.mp3 (${sz}B)`);
      } catch (e2) {
        console.error(`  ✗ Edge ${variant} 也失败：${e2.message}`);
        RESULTS.push({ id, variant, source: "failed", error: e2.message });
        continue;
      }
    }
    if (variant === "us") manifest[manifestKey] = id;
    else manifestUk[manifestKey] = id;
    RESULTS.push({ id, variant, source });
  }
}

console.log(`开始补齐 5 个短句 × 2 口音 = 10 文件...\n`);
for (const entry of ENTRIES) {
  console.log(`▶ ${entry.text}  → ${entry.id}`);
  await processOne(entry);
  await sleep(300);
}

writeFileSync(MANIFEST, JSON.stringify(manifest), "utf8");
writeFileSync(MANIFEST_UK, JSON.stringify(manifestUk), "utf8");

console.log(`\n========== 完成 ==========`);
console.log(
  `成功：${RESULTS.filter((r) => r.source !== "failed").length} / ${RESULTS.length}`
);
const failed = RESULTS.filter((r) => r.source === "failed");
if (failed.length) {
  console.log(`失败：`);
  for (const f of failed) console.log(`  - ${f.id} (${f.variant}): ${f.error}`);
} else {
  console.log(`失败：无`);
}
console.log(`manifest (us) 键数：${Object.keys(manifest).length}`);
console.log(`manifest-uk     键数：${Object.keys(manifestUk).length}`);

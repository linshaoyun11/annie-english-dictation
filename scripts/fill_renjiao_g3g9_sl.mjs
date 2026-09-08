// 一次性补完 renjiao 一线 G3-G9 SL 重建后的新词音频（约 180 个 unique × 2 accent = 360 mp3）
// 复用 fill_waiyanshe_g1g2.mjs 逻辑：有道优先，60KB 阈值强制 Edge 重生
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

// 加载待补 unique 列表
const m = await import("../.tmp-curr.mjs");
const rj = m.CURRICULA.renjiao.filter((u) => u.grade >= 3);
const uniq = new Map();
for (const u of rj)
  for (const e of u.entries) {
    const k = e.english.trim().toLowerCase();
    if (!uniq.has(k)) uniq.set(k, e.id);
  }
const ENTRIES = [...uniq.entries()].map(([text, id]) => ({ id, text }));
console.log(`Loaded ${ENTRIES.length} unique text→id from renjiao 一线 G3-G9`);

// 加载现有 manifest
let manifest = {},
  manifestUk = {};
for (const [path, target] of [
  [MANIFEST, "us"],
  [MANIFEST_UK, "uk"],
]) {
  if (existsSync(path)) {
    try {
      Object.assign(
        target === "us" ? manifest : manifestUk,
        JSON.parse(readFileSync(path, "utf8"))
      );
    } catch {}
  }
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

const RESULTS = { ok: [], us_added: [], uk_added: [], failed: [] };

for (const { id, text } of ENTRIES) {
  const tasks = [
    { variant: "us", type: 2, suffix: "", manifestKey: text },
    { variant: "uk", type: 1, suffix: "-uk", manifestKey: text },
  ];
  for (const t of tasks) {
    const outPath = join(AUDIO_DIR, `${id}${t.suffix}.mp3`);
    const targetManifest = t.variant === "us" ? manifest : manifestUk;
    if (fileLooksGood(outPath)) {
      targetManifest[t.manifestKey] = id;
      RESULTS.ok.push({ id, variant: t.variant, source: "cached" });
      continue;
    }
    let needRegen = false;
    try {
      const buf = await youdaoMp3(text, t.type);
      if (buf.length > 60 * 1024) {
        console.log(`  • 有道 ${t.variant} huge(${buf.length}B) → Edge ${t.variant}`);
        needRegen = true;
        throw new Error("oversized");
      }
      writeFileSync(outPath, buf);
      console.log(`  ✓ 有道 ${t.variant} ${id}${t.suffix}.mp3 (${buf.length}B)`);
    } catch (e) {
      const reason = needRegen ? "huge" : e.message;
      console.log(`  • 有道 ${t.variant} 失败(${reason}) → Edge ${t.variant}`);
      try {
        await edgeTts(text, t.variant === "us" ? "en-US-AriaNeural" : "en-GB-RyanNeural", outPath);
        if (!fileLooksGood(outPath)) throw new Error("edge output invalid");
        const sz = statSync(outPath).size;
        console.log(`  ✓ Edge ${t.variant} ${id}${t.suffix}.mp3 (${sz}B)`);
      } catch (e2) {
        console.error(`  ✗ Edge ${t.variant} 也失败：${e2.message}`);
        RESULTS.failed.push({ id, variant: t.variant, error: e2.message });
        continue;
      }
    }
    targetManifest[t.manifestKey] = id;
    (t.variant === "us" ? RESULTS.us_added : RESULTS.uk_added).push({ id, source: "edge" });
  }
}

writeFileSync(MANIFEST, JSON.stringify(manifest), "utf8");
writeFileSync(MANIFEST_UK, JSON.stringify(manifestUk), "utf8");

console.log(`\n========== 完成 ==========`);
console.log(`总 unique：${ENTRIES.length}`);
console.log(`成功（us+uk）：${RESULTS.us_added.length + RESULTS.uk_added.length}`);
console.log(`失败：${RESULTS.failed.length}`);
console.log(`manifest.json 键数：${Object.keys(manifest).length}`);
console.log(`manifest-uk.json 键数：${Object.keys(manifestUk).length}`);
if (RESULTS.failed.length) {
  console.log("失败明细：");
  for (const f of RESULTS.failed) console.log(`  - ${f.id} (${f.variant}): ${f.error}`);
}
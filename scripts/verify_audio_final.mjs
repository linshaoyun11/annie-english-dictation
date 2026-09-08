/**
 * 音频覆盖终检（运行时口径）
 *
 * 检查项：
 *   1. 6 条教材线全部词条文本，美音/英音是否都能在 manifest 命中
 *   2. 命中的 id 对应的文件是否存在
 *   3. 文件是否真的是 MP3（魔数校验）—— 防 WAV 伪装文件重现
 *   4. manifest 里的孤儿键（有映射但没有任何教材在用）
 *
 * 用法：node scripts/verify_audio_final.mjs
 */
import { readFileSync, statSync, openSync, readSync, closeSync, unlinkSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const AUDIO = path.join(ROOT, "public", "audio");
const TMP = ".tmp-verify-audio.mjs";
process.on("exit", () => {
  try { unlinkSync(TMP); } catch {}
});

await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
const mod = await import(`../${TMP}?v=${Date.now()}`);
const CURRICULA = mod.CURRICULA;

const manifest = JSON.parse(readFileSync(path.join(AUDIO, "manifest.json"), "utf8"));
const manifestUk = JSON.parse(readFileSync(path.join(AUDIO, "manifest-uk.json"), "utf8"));

const MP3_MAGIC = [Buffer.from("ID3"), Buffer.from([0xff, 0xfb]), Buffer.from([0xff, 0xf3]),
                   Buffer.from([0xff, 0xf2]), Buffer.from([0xff, 0xfa]), Buffer.from([0xff, 0xe3])];

let cache = new Map();
function fileOk(name) {
  if (cache.has(name)) return cache.get(name);
  let res = { exists: false, isMp3: false, size: 0 };
  try {
    const p = path.join(AUDIO, name);
    const st = statSync(p);
    res.exists = true; res.size = st.size;
    const fd = openSync(p, "r");
    const buf = Buffer.alloc(3);
    readSync(fd, buf, 0, 3, 0);
    closeSync(fd);
    res.isMp3 = res.size >= 1024 && MP3_MAGIC.some((m) => buf.subarray(0, m.length).equals(m));
  } catch { /* 不存在 */ }
  cache.set(name, res);
  return res;
}

// ---- 收集运行时全部文本 ----
const all = new Map(); // key -> {text, lines:Set, grades:Set}
for (const [line, units] of Object.entries(CURRICULA)) {
  for (const u of units) {
    for (const e of u.entries) {
      const key = (e.english ?? "").trim().toLowerCase();
      if (!key) continue;
      let r = all.get(key);
      if (!r) { r = { text: (e.english ?? "").trim(), lines: new Set(), grades: new Set() }; all.set(key, r); }
      r.lines.add(line); r.grades.add(u.grade);
    }
  }
}

console.log("=" .repeat(78));
console.log(" 音频覆盖终检（运行时口径）");
console.log("=".repeat(78));
console.log(`运行时去重文本：${all.size}`);
console.log(`manifest 键数：美音 ${Object.keys(manifest).length} / 英音 ${Object.keys(manifestUk).length}\n`);

let missUs = 0, missUk = 0, noFileUs = 0, noFileUk = 0, badMp3 = 0;
const badSamples = [];
const missSamples = [];

for (const [key, rec] of all) {
  const idUs = manifest[key];
  const idUk = manifestUk[key];
  if (!idUs) { missUs++; if (missSamples.length < 10) missSamples.push(`[缺美音] ${rec.text}`); }
  if (!idUk) { missUk++; if (missSamples.length < 10) missSamples.push(`[缺英音] ${rec.text}`); }

  for (const [id, kind] of [[idUs, "us"], [idUk, "uk"]]) {
    if (!id) continue;
    const fname = `${id}${kind === "uk" ? "-uk" : ""}.mp3`;
    const r = fileOk(fname);
    if (!r.exists) { kind === "us" ? noFileUs++ : noFileUk++; }
    else if (!r.isMp3) {
      badMp3++;
      if (badSamples.length < 10) badSamples.push(`${fname}  ${r.size}B  非 MP3`);
    }
  }
}

console.log("── 1. manifest 命中 ──");
console.log(`  缺美音映射：${missUs}`);
console.log(`  缺英音映射：${missUk}`);
console.log(`  美音覆盖率：${(((all.size - missUs) / all.size) * 100).toFixed(2)}%`);
console.log(`  英音覆盖率：${(((all.size - missUk) / all.size) * 100).toFixed(2)}%`);

console.log("\n── 2. 文件实体 ──");
console.log(`  美音文件缺失：${noFileUs}`);
console.log(`  英音文件缺失：${noFileUk}`);
console.log(`  非 MP3（魔数校验失败）：${badMp3}`);
for (const s of badSamples) console.log("    " + s);
for (const s of missSamples) console.log("    " + s);

// ---- 3. 各线覆盖 ----
console.log("\n── 3. 各教材线覆盖 ──");
console.log("  教材线         文本数   缺美音  缺英音   覆盖");
for (const [line, units] of Object.entries(CURRICULA)) {
  const s = new Set();
  for (const u of units) for (const e of u.entries) {
    const k = (e.english ?? "").trim().toLowerCase(); if (k) s.add(k);
  }
  const mu = [...s].filter((k) => !(k in manifest)).length;
  const mk = [...s].filter((k) => !(k in manifestUk)).length;
  const cov = (((s.size - Math.max(mu, mk)) / s.size) * 100).toFixed(1);
  console.log(`  ${line.padEnd(13)} ${String(s.size).padStart(6)}  ${String(mu).padStart(6)}  ${String(mk).padStart(6)}  ${cov.padStart(6)}%`);
}

// ---- 4. 孤儿键 ----
const orphanUs = [...Object.keys(manifest)].filter((k) => !all.has(k));
const orphanUk = [...Object.keys(manifestUk)].filter((k) => !all.has(k));
console.log("\n── 4. manifest 孤儿键（无教材在用，可回收）──");
console.log(`  美音 ${orphanUs.length} / 英音 ${orphanUk.length}`);

// ---- 5. 体积 ----
const fs = await import("node:fs/promises");
const files = (await fs.readdir(AUDIO)).filter((f) => f.endsWith(".mp3"));
let total = 0;
for (const f of files) total += (await fs.stat(path.join(AUDIO, f))).size;
const newFiles = files.filter((f) => f.startsWith("n")).length;
console.log("\n── 5. 体积 ──");
console.log(`  .mp3 文件数：${files.length}（其中本次新增 ${newFiles}）`);
console.log(`  总占用：${(total / 1024 / 1024).toFixed(1)} MB`);
console.log(`  平均：${(total / files.length / 1024).toFixed(1)} KB`);

const ok = missUs === 0 && missUk === 0 && noFileUs === 0 && noFileUk === 0 && badMp3 === 0;
console.log("\n" + (ok ? "✅ 全部通过：100% 覆盖，全部为合法 MP3" : "❌ 存在问题，见上"));
process.exit(ok ? 0 : 1);

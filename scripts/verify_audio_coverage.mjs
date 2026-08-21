/**
 * 校验三套教材（人教/外研/牛津）词条的美音/英音本地音频覆盖率
 *
 * 逻辑：
 * 1. 正则解析所有词库文件的 mk 调用（人教 6 参 / 外研·牛津 7 参），
 *    按 mk.ts 的规则重建词条 id（人教全局 seq；带前缀版本独立 seq）。
 * 2. 读取 public/audio/manifest.json（美音）与 manifest-uk.json（英音）。
 * 3. 判定标准：词条文本（trim + toLowerCase）在 manifest 中命中 → 本地可播放；
 *    同时校验 manifest 映射到的 id 对应 mp3 文件真实存在。
 * 4. 输出每套教材的覆盖统计与缺失清单。
 *
 * 用法：node scripts/verify_audio_coverage.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = join(ROOT, "public", "audio");

const MK6_RE =
  /mk\(\s*(\d+),\s*(\d+),\s*"(word|phrase|sentence)",\s*"((?:[^"\\]|\\.)*)"/g;
const MK7_RE =
  /mk\(\s*"([a-z]+)"\s*,\s*(\d+),\s*(\d+),\s*"(word|phrase|sentence)",\s*"((?:[^"\\]|\\.)*)"/g;

function parseEntries() {
  const entries = [];
  // 人教：curriculum.ts + grades4to9.ts（全局 seq）
  let seq = 0;
  for (const file of ["curriculum.ts", "grades4to9.ts"]) {
    const src = readFileSync(join(ROOT, "src", "data", file), "utf8");
    MK6_RE.lastIndex = 0;
    let m;
    while ((m = MK6_RE.exec(src)) !== null) {
      seq += 1;
      entries.push({
        version: "renjiao",
        id: `g${m[1]}u${m[2]}e${String(seq).padStart(4, "0")}`,
        type: m[3],
        english: m[4].replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
      });
    }
  }
  // 外研/牛津：waiyanshe.ts + oxford.ts（prefix 独立 seq）
  const prefixSeqs = new Map();
  for (const [file, prefix] of [
    ["waiyanshe.ts", "wy"],
    ["oxford.ts", "ox"],
  ]) {
    const src = readFileSync(join(ROOT, "src", "data", file), "utf8");
    MK7_RE.lastIndex = 0;
    let m;
    while ((m = MK7_RE.exec(src)) !== null) {
      if (m[1] !== prefix) {
        console.warn(`!! ${file} 中出现非 ${prefix} 前缀: ${m[1]}`);
        continue;
      }
      const n = (prefixSeqs.get(prefix) ?? 0) + 1;
      prefixSeqs.set(prefix, n);
      entries.push({
        version: prefix === "wy" ? "waiyanshe" : "oxford",
        id: `${prefix}-g${m[2]}u${m[3]}e${String(n).padStart(4, "0")}`,
        type: m[4],
        english: m[5].replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
      });
    }
  }
  return entries;
}

function loadManifest(file) {
  const p = join(AUDIO_DIR, file);
  if (!existsSync(p)) {
    console.error(`!! manifest 不存在: ${p}`);
    return new Map();
  }
  return new Map(Object.entries(JSON.parse(readFileSync(p, "utf8"))));
}

const entries = parseEntries();
console.log(`\n========== 词库统计 ==========`);
const byVersion = {};
for (const e of entries) (byVersion[e.version] ??= []).push(e);
for (const [v, list] of Object.entries(byVersion)) {
  const types = {};
  for (const e of list) types[e.type] = (types[e.type] ?? 0) + 1;
  console.log(
    `${v}: ${list.length} 条（单词 ${types.word ?? 0} / 短语 ${types.phrase ?? 0} / 句子 ${types.sentence ?? 0}）`
  );
}
console.log(`合计: ${entries.length} 条`);

// 唯一文本（运行时的查询键）
const norm = (s) => s.trim().toLowerCase();
const uniqueTexts = [...new Set(entries.map((e) => norm(e.english)))];
console.log(`去重后唯一文本: ${uniqueTexts.length} 个`);

const manifests = {
  us: loadManifest("manifest.json"),
  uk: loadManifest("manifest-uk.json"),
};
console.log(
  `manifest.json（美音）键数: ${manifests.us.size}；manifest-uk.json（英音）键数: ${manifests.uk.size}`
);

// 文件存在性检查
function checkFiles(m, suffix) {
  const missingFiles = [];
  for (const [text, id] of m) {
    const p = join(AUDIO_DIR, `${id}${suffix}.mp3`);
    if (!existsSync(p)) missingFiles.push({ text, id });
  }
  return missingFiles;
}
const missingUsFiles = checkFiles(manifests.us, "");
const missingUkFiles = checkFiles(manifests.uk, "-uk");
console.log(`\n== 文件存在性 ==`);
console.log(`manifest.json 引用但 mp3 缺失: ${missingUsFiles.length} 个`);
if (missingUsFiles.length) console.log(missingUsFiles.slice(0, 20));
console.log(`manifest-uk.json 引用但 mp3 缺失: ${missingUkFiles.length} 个`);
if (missingUkFiles.length) console.log(missingUkFiles.slice(0, 20));

// 每套教材覆盖分析
console.log(`\n========== 覆盖分析（按词条） ==========`);
for (const [v, list] of Object.entries(byVersion)) {
  const missingUs = [];
  const missingUk = [];
  for (const e of list) {
    const key = norm(e.english);
    if (!manifests.us.has(key)) missingUs.push(e);
    if (!manifests.uk.has(key)) missingUk.push(e);
  }
  console.log(`\n--- ${v}（${list.length} 条） ---`);
  console.log(`美音本地覆盖: ${list.length - missingUs.length}/${list.length}`);
  if (missingUs.length) {
    console.log(`  美音缺失 ${missingUs.length} 条:`);
    for (const e of missingUs.slice(0, 50))
      console.log(`    ${e.id}\t${e.type}\t${e.english}`);
  }
  console.log(`英音本地覆盖: ${list.length - missingUk.length}/${list.length}`);
  if (missingUk.length) {
    console.log(`  英音缺失 ${missingUk.length} 条:`);
    for (const e of missingUk.slice(0, 50))
      console.log(`    ${e.id}\t${e.type}\t${e.english}`);
  }
}

// 唯一文本维度的覆盖（运行时真正生效的口径）
console.log(`\n========== 覆盖分析（按唯一文本） ==========`);
const missUs = uniqueTexts.filter((t) => !manifests.us.has(t));
const missUk = uniqueTexts.filter((t) => !manifests.uk.has(t));
console.log(`美音: ${uniqueTexts.length - missUs.length}/${uniqueTexts.length}`);
if (missUs.length) console.log(`  缺失: ${missUs.slice(0, 50).join(" | ")}`);
console.log(`英音: ${uniqueTexts.length - missUk.length}/${uniqueTexts.length}`);
if (missUk.length) console.log(`  缺失: ${missUk.slice(0, 50).join(" | ")}`);

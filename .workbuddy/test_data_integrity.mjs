import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src", "data");

// ---- 1. Parse mk() calls from source files (same logic as generate_audio.mjs) ----
const MK_RE = /mk\(\s*(\d+),\s*(\d+),\s*"(word|phrase|sentence)",\s*"((?:[^"\\]|\\.)*)"/g;
const MK_PREFIX_RE = /mk\(\s*"([a-z]+)"\s*,\s*(\d+),\s*(\d+),\s*"(word|phrase|sentence)",\s*"((?:[^"\\]|\\.)*)"/g;

function parseMk(file) {
  const src = readFileSync(join(SRC, file), "utf8");
  const out = [];
  let m;
  MK_RE.lastIndex = 0;
  while ((m = MK_RE.exec(src)) !== null) {
    out.push({ grade: +m[1], unit: +m[2], type: m[3], english: m[4] });
  }
  return out;
}
function parseMkPrefix(file) {
  const src = readFileSync(join(SRC, file), "utf8");
  const out = [];
  let m;
  MK_PREFIX_RE.lastIndex = 0;
  while ((m = MK_PREFIX_RE.exec(src)) !== null) {
    out.push({ prefix: m[1], grade: +m[2], unit: +m[3], type: m[4], english: m[5] });
  }
  return out;
}

// ---- 2. Parse KEBIAO_BANK ----
const kbSrc = readFileSync(join(SRC, "kebiaoBank.ts"), "utf8");
const BANK_RE = /\{\s*en:\s*"((?:[^"\\]|\\.)*)"/g;
const bankWords = [];
let bm;
BANK_RE.lastIndex = 0;
while ((bm = BANK_RE.exec(kbSrc)) !== null) {
  bankWords.push(bm[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
}

// ---- 3. Check CURRICULUM_VERSION ----
const currSrc = readFileSync(join(SRC, "curriculum.ts"), "utf8");
const verMatch = currSrc.match(/CURRICULUM_VERSION\s*=\s*(\d+)/);
const version = verMatch ? +verMatch[1] : -1;

// ---- 4. Count entries per edition ----
// Renjiao: grades4to9 mk calls + curriculum.ts mk calls (excluding prefix calls)
const g4to9Calls = parseMk("grades4to9.ts");
const currCalls = parseMk("curriculum.ts");
const renjiaoBase = [...g4to9Calls, ...currCalls];

// Waiyanshe / Oxford: prefix mk calls
const wyCalls = parseMkPrefix("waiyanshe.ts");
const oxCalls = parseMkPrefix("oxford.ts");

// Kebiao words that will be added (deduplicated against existing)
const renjiaoExisting = new Set(renjiaoBase.map(c => c.english.toLowerCase()));
const wyExisting = new Set(wyCalls.map(c => c.english.toLowerCase()));
const oxFExisting = new Set(oxCalls.map(c => c.english.toLowerCase()));

// buildKebiaoUnits deduplicates against existing texts
// band 2 → elem grades, band 3 → mid grades
// For renjiao: elem=3-6, mid=7-9
// For waiyanshe: elem=3-6, mid=7-9
// For oxford: elem=3-6, mid=7-9
function countKebiao(existing) {
  const hasWord = (w) => existing.has(w.toLowerCase());
  const missing = bankWords.filter(w => !hasWord(w));
  return missing.length;
}

const renjiaoKebiao = countKebiao(renjiaoExisting);
const wyKebiao = countKebiao(wyExisting);
const oxFKebiao = countKebiao(oxFExisting);

console.log("===== 数据完整性检查 =====");
console.log();
console.log("--- 版本号 ---");
console.log(`CURRICULUM_VERSION = ${version} ${version === 7 ? "✓" : "✗ (应为 7)"}`);
console.log();
console.log("--- 人教（renjiao）---");
console.log(`  基础词条 mk() 调用: ${renjiaoBase.length}`);
console.log(`  课标补全词（去重后）: ${renjiaoKebiao}`);
console.log(`  预期总计: ${renjiaoBase.length + renjiaoKebiao}`);
console.log();
console.log("--- 外研社（waiyanshe）---");
console.log(`  基础词条 mk() 调用: ${wyCalls.length}`);
console.log(`  课标补全词（去重后）: ${wyKebiao}`);
console.log(`  预期总计: ${wyCalls.length + wyKebiao}`);
console.log();
console.log("--- 牛津（oxford）---");
console.log(`  基础词条 mk() 调用: ${oxCalls.length}`);
console.log(`  课标补全词（去重后）: ${oxFKebiao}`);
console.log(`  预期总计: ${oxCalls.length + oxFKebiao}`);
console.log();

// ---- 5. Duplicate check (within renjiao base) ----
const rjTexts = renjiaoBase.map(c => c.english.toLowerCase());
const rjDups = rjTexts.filter((t, i) => rjTexts.indexOf(t) !== i);
console.log("--- 去重检查 ---");
console.log(`  人教基础词条重复: ${rjDups.length} ${rjDups.length === 0 ? "✓" : "✗ " + rjDups.slice(0, 10).join(", ")}`);
const wyTexts = wyCalls.map(c => c.english.toLowerCase());
const wyDups = wyTexts.filter((t, i) => wyTexts.indexOf(t) !== i);
console.log(`  外研社基础词条重复: ${wyDups.length} ${wyDups.length === 0 ? "✓" : "✗"}`);
const oxTexts = oxCalls.map(c => c.english.toLowerCase());
const oxDups = oxTexts.filter((t, i) => oxTexts.indexOf(t) !== i);
console.log(`  牛津基础词条重复: ${oxDups.length} ${oxDups.length === 0 ? "✓" : "✗"}`);
console.log();

// ---- 6. KEBIAO_BANK internal duplicates ----
const bankTexts = bankWords.map(w => w.toLowerCase());
const bankDups = bankTexts.filter((t, i) => bankTexts.indexOf(t) !== i);
console.log(`--- 课标库内部重复 ---`);
console.log(`  KEBIAO_BANK 内重复: ${bankDups.length} ${bankDups.length === 0 ? "✓" : "✗ " + [...new Set(bankDups)].slice(0, 10).join(", ")}`);
console.log();

// ---- 7. Grade range check ----
const rjGrades = [...new Set(renjiaoBase.map(c => c.grade))].sort((a, b) => a - b);
const wyGrades = [...new Set(wyCalls.map(c => c.grade))].sort((a, b) => a - b);
const oxGrades = [...new Set(oxCalls.map(c => c.grade))].sort((a, b) => a - b);
console.log("--- 年级覆盖 ---");
console.log(`  人教年级: ${JSON.stringify(rjGrades)}`);
console.log(`  外研社年级: ${JSON.stringify(wyGrades)}`);
console.log(`  牛津年级: ${JSON.stringify(oxGrades)}`);
console.log();

// ---- 8. Audio manifest check ----
const manifest = JSON.parse(readFileSync(join(ROOT, "public", "audio", "manifest.json"), "utf8"));
const ukManifest = JSON.parse(readFileSync(join(ROOT, "public", "audio", "manifest-uk.json"), "utf8"));

const allTexts = new Set([
  ...renjiaoBase.map(c => c.english.toLowerCase()),
  ...wyCalls.map(c => c.english.toLowerCase()),
  ...oxCalls.map(c => c.english.toLowerCase()),
  ...bankWords.map(w => w.toLowerCase()),
]);

let missingUs = 0, missingUk = 0;
const missingUsList = [], missingUkList = [];
for (const t of allTexts) {
  if (!manifest[t]) { missingUs++; if (missingUsList.length < 10) missingUsList.push(t); }
  if (!ukManifest[t]) { missingUk++; if (missingUkList.length < 10) missingUkList.push(t); }
}

console.log("--- 音频覆盖 ---");
console.log(`  全部去重词条数: ${allTexts.size}`);
console.log(`  美音 manifest 覆盖: ${allTexts.size - missingUs}/${allTexts.size} ${missingUs === 0 ? "✓" : "✗ 缺失 " + missingUs + " 词"}`);
if (missingUs > 0) console.log(`    缺失样例: ${missingUsList.join(", ")}`);
console.log(`  英音 manifest 覆盖: ${allTexts.size - missingUk}/${allTexts.size} ${missingUk === 0 ? "✓" : "✗ 缺失 " + missingUk + " 词"}`);
if (missingUk > 0) console.log(`    缺失样例: ${missingUkList.join(", ")}`);

// ---- 9. Audio file existence spot check ----
import { statSync } from "fs";
let fileMissing = 0;
const fileMissingList = [];
for (const [text, id] of Object.entries(manifest)) {
  const p = join(ROOT, "public", "audio", `${id}.mp3`);
  try { if (statSync(p).size < 1000) { fileMissing++; if (fileMissingList.length < 5) fileMissingList.push(`${text}/${id}`); } }
  catch { fileMissing++; if (fileMissingList.length < 5) fileMissingList.push(`${text}/${id}`); }
}
console.log(`  美音文件存在且非空: ${Object.keys(manifest).length - fileMissing}/${Object.keys(manifest).length} ${fileMissing === 0 ? "✓" : "✗ " + fileMissing + " 个问题"}`);
if (fileMissing > 0) console.log(`    问题样例: ${fileMissingList.join(", ")}`);

let ukFileMissing = 0;
const ukFileMissingList = [];
for (const [text, id] of Object.entries(ukManifest)) {
  const p = join(ROOT, "public", "audio", `${id}-uk.mp3`);
  try { if (statSync(p).size < 1000) { ukFileMissing++; if (ukFileMissingList.length < 5) ukFileMissingList.push(`${text}/${id}`); } }
  catch { ukFileMissing++; if (ukFileMissingList.length < 5) ukFileMissingList.push(`${text}/${id}`); }
}
console.log(`  英音文件存在且非空: ${Object.keys(ukManifest).length - ukFileMissing}/${Object.keys(ukManifest).length} ${ukFileMissing === 0 ? "✓" : "✗ " + ukFileMissing + " 个问题"}`);
if (ukFileMissing > 0) console.log(`    问题样例: ${ukFileMissingList.join(", ")}`);

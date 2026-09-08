/**
 * 音频缺口成因分析
 *
 * 对比「重建前（git 80a5b59, 2026-09-03）」与「当前」的 renjiao3 词条集合，
 * 拆解音频缺失 1592 条的成因：
 *   A. 重建新增文本（旧词库没有 ⇒ 显然没有音频）
 *   B. 旧词库原有文本但历史也没生成音频
 *   C. 被删除的旧文本（释放出来的音频）
 *
 * 用法：node scripts/analyze_audio_gap.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const MANIFEST_US = "public/audio/manifest.json";
const MANIFEST_UK = "public/audio/manifest-uk.json";

const manifestUs = JSON.parse(readFileSync(MANIFEST_US, "utf8"));
const manifestUk = JSON.parse(readFileSync(MANIFEST_UK, "utf8"));
const manifestKeys = new Set(Object.keys(manifestUs));

/** 从源码文本里抽所有 mk(...) 调用，返回 [{grade,unit,type,text}] */
function extractEntries(src, fileTag) {
  const out = [];
  // 两种形态：mk(g, u, "word", "text", "ipa", "cn")  和  mk("wy", g, u, "word", ...)
  const re =
    /\bmk\(\s*(?:"(\w+)"\s*,\s*)?(\d+)\s*,\s*(\d+)\s*,\s*"(word|phrase|sentence)"\s*,\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const prefix = m[1] ?? null;
    const grade = Number(m[2]);
    const unit = Number(m[3]);
    const type = m[4];
    const text = m[5].replace(/\\"/g, '"').replace(/\\'/g, "'");
    out.push({ prefix, grade, unit, type, text, file: fileTag });
  }
  return out;
}

function readCurrent(relPath) {
  return readFileSync(relPath, "utf8");
}

function readAtCommit(commit, relPath) {
  try {
    return execSync(`git show ${commit}:${relPath}`, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

const OLD_COMMIT = process.env.OLD_COMMIT ?? "80a5b59"; // 2026-09-03 重建前

// ---------- 收集「当前」renjiao3 教材字面量词条 ----------
// renjiao3 = curriculum.ts 中 grade>=3 的段 + grades4to9.ts 全部（G4-G9）
const curG3 = extractEntries(readCurrent("src/data/curriculum.ts"), "curriculum.ts");
const curG49 = extractEntries(readCurrent("src/data/grades4to9.ts"), "grades4to9.ts");
const curAll = [...curG3, ...curG49].filter(
  (e) => !e.prefix && e.grade >= 3
);

// ---------- 收集「重建前」renjiao3 教材字面量词条 ----------
const oldG3 = extractEntries(readAtCommit(OLD_COMMIT, "src/data/curriculum.ts"), "curriculum.ts");
const oldG49 = extractEntries(readAtCommit(OLD_COMMIT, "src/data/grades4to9.ts"), "grades4to9.ts");
const oldAll = [...oldG3, ...oldG49].filter((e) => !e.prefix && e.grade >= 3);

const norm = (t) => t.trim().toLowerCase();

const curSet = new Set(curAll.map((e) => norm(e.text)));
const oldSet = new Set(oldAll.map((e) => norm(e.text)));

const added = [...curSet].filter((t) => !oldSet.has(t)); // 重建新增
const kept = [...curSet].filter((t) => oldSet.has(t)); // 一直都在
const removed = [...oldSet].filter((t) => !curSet.has(t)); // 被删掉

const has = (t) => manifestKeys.has(t);

const addedMissing = added.filter((t) => !has(t));
const keptMissing = kept.filter((t) => !has(t));

// ---------- 输出 ----------
console.log("=".repeat(72));
console.log(" renjiao3 音频缺口成因分析");
console.log("=".repeat(72));
console.log(`对比基准: git ${OLD_COMMIT} (2026-09-03 重建前)  →  当前工作区`);
console.log(`manifest 键数: 美音 ${Object.keys(manifestUs).length} / 英音 ${Object.keys(manifestUk).length}\n`);

console.log("── 1. 词条规模变化（教材字面量，不含运行时课标单元）──");
console.log(`  重建前: ${oldSet.size} 条`);
console.log(`  当前  : ${curSet.size} 条   (${curSet.size >= oldSet.size ? "+" : ""}${curSet.size - oldSet.size})`);
console.log(`  ├ 新增文本  : ${added.length}`);
console.log(`  ├ 保留文本  : ${kept.length}`);
console.log(`  └ 删除文本  : ${removed.length}`);

const growth = oldSet.size ? (((curSet.size - oldSet.size) / oldSet.size) * 100).toFixed(1) : "n/a";
console.log(`  增长率: ${growth}%\n`);

console.log("── 2. 音频缺口拆解（教材字面量部分）──");
console.log(`  新增文本 ${added.length} 条中，缺音频: ${addedMissing.length} (${((addedMissing.length / added.length) * 100).toFixed(1)}%)`);
console.log(`  保留文本 ${kept.length} 条中，缺音频: ${keptMissing.length} (${((keptMissing.length / kept.length) * 100).toFixed(1)}%)`);
console.log(`  ⇒ 字面量缺口合计: ${addedMissing.length + keptMissing.length}`);
console.log(`     ├ 原因 A 重建新增（旧库根本没有的词）: ${addedMissing.length}  (${((addedMissing.length / (addedMissing.length + keptMissing.length)) * 100).toFixed(1)}%)`);
console.log(`     └ 原因 B 旧库就有但一直没音频      : ${keptMissing.length}  (${((keptMissing.length / (addedMissing.length + keptMissing.length)) * 100).toFixed(1)}%)`);

console.log(`\n  删除文本 ${removed.length} 条中，原本有音频的: ${removed.filter((t) => has(t)).length}（这批音频已无用）`);

console.log("\n── 3. 分年级：新增 vs 缺口 ──");
const byGrade = new Map();
for (const e of curAll) {
  const t = norm(e.text);
  if (!byGrade.has(e.grade)) byGrade.set(e.grade, { total: 0, added: 0, missAdded: 0, missKept: 0 });
  const g = byGrade.get(e.grade);
  g.total++;
  const isNew = !oldSet.has(t);
  const missing = !has(t);
  if (isNew) g.added++;
  if (missing) {
    if (isNew) g.missAdded++;
    else g.missKept++;
  }
}
console.log("  年级  总词条   新增   缺(新增)  缺(原有)  缺口合计  覆盖率");
let sumTotal = 0, sumAdded = 0, sumMA = 0, sumMK = 0;
for (const g of [...byGrade.keys()].sort((a, b) => a - b)) {
  const v = byGrade.get(g);
  const miss = v.missAdded + v.missKept;
  sumTotal += v.total; sumAdded += v.added; sumMA += v.missAdded; sumMK += v.missKept;
  console.log(
    `   G${g}   ${String(v.total).padStart(5)}  ${String(v.added).padStart(5)}  ${String(v.missAdded).padStart(7)}  ${String(v.missKept).padStart(8)}  ${String(miss).padStart(8)}  ${(((v.total - miss) / v.total) * 100).toFixed(1)}%`
  );
}
console.log(
  `  合计  ${String(sumTotal).padStart(5)}  ${String(sumAdded).padStart(5)}  ${String(sumMA).padStart(7)}  ${String(sumMK).padStart(8)}  ${String(sumMA + sumMK).padStart(8)}  ${(((sumTotal - sumMA - sumMK) / sumTotal) * 100).toFixed(1)}%`
);

const TMP = ".tmp-audio-gap.mjs";
process.on("exit", () => {
  try { unlinkSync(TMP); } catch {}
});

// ---------- 【运行时口径】分年级统计：与 check_audio_coverage.mjs 全量口径一致 ----------
// 说明：上面第 1/2/3 部分是「字面量口径」——只扫源文件里的 mk(...) 调用，
//       不含运行时生成的课标单元，且年级内不去重。
//       这里改用运行时 CURRICULA（含课标、跨年级去重），与
//       `node scripts/check_audio_coverage.mjs renjiao3` 的 1,592 完全对齐。
await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
const mod = await import(`../${TMP}?runtime=1`);
const CUR = mod.CURRICULA?.renjiao3 ?? [];

const rtSeen = new Set();
const rtByGrade = new Map();
for (const u of CUR) {
  for (const e of u.entries) {
    const t = (e.english ?? "").trim().toLowerCase();
    if (!t || rtSeen.has(t)) continue; // 跨年级去重，归属首次出现的年级
    rtSeen.add(t);
    if (!rtByGrade.has(u.grade)) rtByGrade.set(u.grade, { total: 0, miss: 0 });
    const g = rtByGrade.get(u.grade);
    g.total++;
    if (!has(t)) g.miss++;
  }
}

console.log("\n── 4. 分年级缺口【运行时口径 · 权威】──");
console.log("  （含课标单元，跨年级去重；各年级之和 = 全量 1,592，与 check_audio_coverage 对齐）");
console.log("  年级   词条总数    缺口   覆盖率");
let rtT = 0, rtM = 0;
for (const g of [...rtByGrade.keys()].sort((a, b) => a - b)) {
  const v = rtByGrade.get(g);
  rtT += v.total; rtM += v.miss;
  console.log(
    `   G${g}   ${String(v.total).padStart(6)}  ${String(v.miss).padStart(6)}   ${(((v.total - v.miss) / v.total) * 100).toFixed(1).padStart(5)}%`
  );
}
console.log(`  合计   ${String(rtT).padStart(6)}  ${String(rtM).padStart(6)}   ${(((rtT - rtM) / rtT) * 100).toFixed(1).padStart(5)}%`);
console.log(`  ↑ 这里的「合计缺口 ${rtM}」= check_audio_coverage 的 ${rtM}，是报给用户用的权威数字。`);

console.log("\n── 5. manifest 里 renjiao3 用不上的键 ──");
const usedByCur = new Set(curAll.map((e) => norm(e.text)));
const allLinesTexts = new Set();
for (const f of ["waiyanshe.ts", "oxford.ts", "renai.ts"]) {
  try {
    for (const e of extractEntries(readCurrent(`src/data/${f}`), f)) allLinesTexts.add(norm(e.text));
  } catch {}
}
try {
  for (const e of extractEntries(readCurrent("src/data/movieQuotes.ts"), "movieQuotes")) allLinesTexts.add(norm(e.text));
} catch {}
const orphan = [...manifestKeys].filter((t) => !usedByCur.has(t) && !allLinesTexts.has(t));
console.log(`  manifest ${manifestKeys.size} 键中，renjiao3 教材未使用: ${manifestKeys.size - [...manifestKeys].filter((t) => usedByCur.has(t)).length}`);
console.log(`  其它教材线/台词库也用不上的「孤儿音频」: ${orphan.length}`);
console.log(`  （孤儿 = 旧词库删掉的词条留下的音频，可回收）`);

console.log("\n── 6. 新增文本里缺音频的样例（前 25 条）──");
for (const t of addedMissing.slice(0, 25)) {
  const e = curAll.find((x) => norm(x.text) === t);
  console.log(`  G${e.grade}U${e.unit} [${e.type}] ${e.text}`);
}

// 导出结构化数据供报告用
const out = {
  oldCommit: OLD_COMMIT,
  manifestUsKeys: Object.keys(manifestUs).length,
  manifestUkKeys: Object.keys(manifestUk).length,
  oldCount: oldSet.size,
  curCount: curSet.size,
  added: added.length,
  kept: kept.length,
  removed: removed.length,
  addedMissing: addedMissing.length,
  keptMissing: keptMissing.length,
  removedHadAudio: removed.filter((t) => has(t)).length,
  orphan: orphan.length,
  byGrade: [...byGrade.entries()].sort((a, b) => a[0] - b[0]).map(([g, v]) => ({
    grade: g, total: v.total, added: v.added,
    missAdded: v.missAdded, missKept: v.missKept,
    miss: v.missAdded + v.missKept,
    coverage: +(((v.total - v.missAdded - v.missKept) / v.total) * 100).toFixed(1),
  })),
};
console.log("\n__JSON__" + JSON.stringify(out));

/**
 * 6 条教材线全量数据体检
 *
 * 用法: node scripts/audit_all_curricula.mjs [line]
 *   无参 = 跑全部 6 条线
 *   单参 = 只跑指定线（renjiao / renjiao3 / waiyanshe / waiyanshe3 / oxford / renai）
 *
 * 每条线体检内容（与 audit_renjiao3.mjs 同 7 项）：
 *   1. 单元编号连续性（缺号/重号）
 *   2. 单元词条数异常（<15 或 >100）
 *   3. 字段完整性（空 text/IPA/中文释义）
 *   4. 单元内重复
 *   5. 跨年级重复（教材螺旋复现，仅统计）
 *   6. 词条类型分布（word/phrase/sentence）
 *   7. 各年级合计
 *
 * 设计要点（每条线文件分布不同）：
 *   - renjiao / renjiao3：curriculum.ts + grades4to9.ts，按 grade 范围过滤
 *      （renjiao 仅 G1-2；renjiao3 仅 G3-9）
 *   - waiyanshe / waiyanshe3：**waiyanshe.ts**（前缀 wy，G1-G9）
 *   - oxford：oxford.ts（前缀 ox，**G1-G9**）
 *   - renai：renai.ts（前缀 ra，G7-G9）
 *   - mk 调用有两种形式：mk(g, u, ...) 或 mk("prefix", g, u, ...)，统一正则匹配
 */
import { readFileSync } from "node:fs";

// ---- 每条线的源文件 + grade 范围 ----
// ⚠️ 2026-09-06 修正：此前 waiyanshe / waiyanshe3 错配成 curriculum.ts + grades4to9.ts
//    （那是**人教**的文件），导致外研两条线实际体检的是人教数据，报出与 renjiao3
//     完全相同的 97U/3971 —— 假象「waiyanshe3 是 renjiao3 的镜像」。
//     oxford 的 grades 也只配到 6，漏掉 G7-G9（真实覆盖 G1-G9）。
//     外研真实文件是 src/data/waiyanshe.ts（前缀 wy，G1-G9）。
const LINE_CONFIG = {
  renjiao:   { files: ["src/data/curriculum.ts", "src/data/grades4to9.ts"], grades: [1, 2] },
  renjiao3:  { files: ["src/data/curriculum.ts", "src/data/grades4to9.ts"], grades: [3, 4, 5, 6, 7, 8, 9] },
  waiyanshe: { files: ["src/data/waiyanshe.ts"], grades: [1, 2] },
  waiyanshe3:{ files: ["src/data/waiyanshe.ts"], grades: [3, 4, 5, 6, 7, 8, 9] },
  oxford:    { files: ["src/data/oxford.ts"], grades: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  renai:     { files: ["src/data/renai.ts"], grades: [7, 8, 9] },
};

// 通用 mk(...) 正则：支持无前缀 mk(g,u,...) 和带前缀 mk("p",g,u,...)
const ENTRY_RE = /^\s*mk\(\s*(?:"([^"]+)",\s*)?(\d+)\s*,\s*(\d+)\s*,\s*"(word|phrase|sentence)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\),?\s*$/;

function parseLine(line) {
  const files = LINE_CONFIG[line].files;
  const grades = new Set(LINE_CONFIG[line].grades);
  const units = [];

  for (const file of files) {
    let src;
    try { src = readFileSync(file, "utf8"); }
    catch (e) { console.log(`  ⚠️ 跳过 ${file}: ${e.message}`); continue; }

    let cur = null;
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const mTitle = ln.match(/^\s*title:\s*"((?:[^"\\]|\\.)*)",?\s*$/);
      const mGrade = ln.match(/^\s*grade:\s*(\d+),?\s*$/);
      const mUnit  = ln.match(/^\s*unit:\s*(\d+),?\s*$/);
      if (mGrade && cur === null) cur = { grade: +mGrade[1], unit: null, title: null, entries: [], file };
      if (cur && mUnit && cur.unit === null) cur.unit = +mUnit[1];
      if (cur && mTitle && cur.title === null) cur.title = mTitle[1];
      const mEntry = ln.match(ENTRY_RE);
      if (mEntry && cur) {
        cur.entries.push({ prefix: mEntry[1] || "", type: mEntry[4], text: mEntry[5], ipa: mEntry[6], cn: mEntry[7], line: i + 1 });
      }
      if (cur && /^\s*\},?\s*$/.test(ln) && cur.entries.length > 0 && cur.title) {
        if (grades.has(cur.grade)) units.push(cur);
        cur = null;
      }
    }
  }
  return units;
}

function audit(line) {
  const units = parseLine(line);
  console.log(`\n${"=".repeat(70)}\n# ${line.toUpperCase()} 数据体检 · ${units.length} 单元（字面量）\n${"=".repeat(70)}`);

  if (!units.length) { console.log("  ⚠️ 0 单元，疑似源文件路径错误"); return { line, summary: {} }; }

  const byGrade = new Map();
  for (const u of units) {
    if (!byGrade.has(u.grade)) byGrade.set(u.grade, []);
    byGrade.get(u.grade).push(u);
  }

  // 1. 编号连续性
  console.log("\n=== 1. 单元编号连续性 ===");
  let allOk = true;
  for (const g of [...byGrade.keys()].sort((a, b) => a - b)) {
    const us = byGrade.get(g).sort((a, b) => a.unit - b.unit);
    const nums = us.map((u) => u.unit);
    const min = Math.min(...nums), max = Math.max(...nums);
    const expected = [];
    for (let n = min; n <= max; n++) expected.push(n);
    const missing = expected.filter((n) => !nums.includes(n));
    const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
    const words = us.reduce((s, u) => s + u.entries.length, 0);
    const tag = missing.length ? "❌ 缺" + missing.join(",") : (dup.length ? "❌ 重" + [...new Set(dup)].join(",") : "✅");
    console.log(`  G${g}: ${us.length}U unit ${min}-${max} 词条 ${words}  ${tag}`);
    if (missing.length || dup.length) allOk = false;
  }

  // 2. 单元词条数异常
  console.log("\n=== 2. 单元词条数异常（<15 或 >100）===");
  let abnormal = 0;
  for (const g of [...byGrade.keys()].sort((a, b) => a - b)) {
    for (const u of byGrade.get(g).sort((a, b) => a.unit - b.unit)) {
      const n = u.entries.length;
      if (n < 15 || n > 100) {
        abnormal++;
        const flag = n < 15 ? "🔴 疑似精简版" : "🟡 偏多";
        console.log(`  ${flag} G${g}U${u.unit} ${u.title} — ${n} 词条`);
      }
    }
  }
  if (!abnormal) console.log("  ✅ 无异常");

  // 3. 字段完整性
  console.log("\n=== 3. 字段完整性 ===");
  let emptyText = 0, emptyCn = 0, emptyIpa = 0;
  const emptyCnList = [], wordNoIpaList = [];
  for (const u of units) for (const e of u.entries) {
    if (!e.text.trim()) emptyText++;
    if (!e.cn.trim()) { emptyCn++; emptyCnList.push(`G${u.grade}U${u.unit} "${e.text}"`); }
    if (!e.ipa.trim()) emptyIpa++;
    if (e.type !== "sentence" && !e.ipa.trim()) wordNoIpaList.push(`G${u.grade}U${u.unit} [${e.type}] ${e.text}`);
  }
  console.log(`  空 text: ${emptyText}  空释义: ${emptyCn}  空音标: ${emptyIpa}`);
  console.log(`  ⚠️ word/phrase 无音标: ${wordNoIpaList.length}`);
  if (emptyCn > 0 && emptyCn <= 8) console.log(`    ${emptyCnList.join(" / ")}`);
  if (wordNoIpaList.length > 0 && wordNoIpaList.length <= 6) console.log(`    ${wordNoIpaList.join(" / ")}`);

  // 4. 单元内重复
  console.log("\n=== 4. 单元内重复词条 ===");
  let dupTotal = 0;
  for (const u of units) {
    const seen = new Map();
    for (const e of u.entries) seen.set(e.text.trim().toLowerCase(), (seen.get(e.text.trim().toLowerCase()) || 0) + 1);
    for (const [k, c] of seen) if (c > 1) { dupTotal++; console.log(`  ❌ G${u.grade}U${u.unit} "${k}" ×${c}`); }
  }
  if (!dupTotal) console.log("  ✅ 无");

  // 5. 跨年级重复（仅统计）
  console.log("\n=== 5. 跨年级重复词条（教材螺旋复现，正常，仅统计）===");
  const textGrades = new Map();
  for (const u of units) for (const e of u.entries) {
    const k = e.text.trim().toLowerCase();
    if (!textGrades.has(k)) textGrades.set(k, new Set());
    textGrades.get(k).add(u.grade);
  }
  let crossDup = 0;
  for (const [, gs] of textGrades) if (gs.size > 1) crossDup++;
  console.log(`  出现在 ≥2 个年级的词条: ${crossDup} / ${textGrades.size} (${((crossDup / textGrades.size) * 100).toFixed(1)}%)`);

  // 6. 类型分布
  console.log("\n=== 6. 词条类型分布 ===");
  const typeCount = { word: 0, phrase: 0, sentence: 0 };
  for (const u of units) for (const e of u.entries) typeCount[e.type]++;
  const tot = Object.values(typeCount).reduce((a, b) => a + b, 0);
  console.log(`  word ${typeCount.word} (${((typeCount.word / tot) * 100).toFixed(1)}%) / phrase ${typeCount.phrase} / sentence ${typeCount.sentence}`);

  // 7. 各年级合计
  console.log("\n=== 7. 各年级词条合计 ===");
  let grand = 0;
  for (const g of [...byGrade.keys()].sort((a, b) => a - b)) {
    const us = byGrade.get(g);
    const w = us.reduce((s, u) => s + u.entries.length, 0);
    const avg = (w / us.length).toFixed(1);
    grand += w;
    console.log(`  G${g}: ${us.length} 单元 / ${w} 词条 / 平均 ${avg} 词条每单元`);
  }
  console.log(`  ── 合计: ${units.length} 单元 / ${grand} 词条`);

  return { line, summary: { totalUnits: units.length, totalWords: grand, abnormal, dupTotal, emptyCn, wordNoIpa: wordNoIpaList.length } };
}

const argv = process.argv.slice(2);
const targets = argv.length ? argv : Object.keys(LINE_CONFIG);
const results = [];
for (const line of targets) {
  if (!LINE_CONFIG[line]) { console.error(`未知教材线: ${line}（可选: ${Object.keys(LINE_CONFIG).join(", ")})`); continue; }
  results.push(audit(line));
}

// 总览
console.log("\n" + "=".repeat(70));
console.log("# 总览");
console.log("=".repeat(70));
console.log("教材线          单元  词条   平均   异常U  重复  空cn  word无IPA");
for (const r of results) {
  const s = r.summary;
  if (!s.totalUnits) { console.log(`${r.line.padEnd(14)}  ⚠️ 0 单元`); continue; }
  const avg = (s.totalWords / s.totalUnits).toFixed(1);
  console.log(
    `${r.line.padEnd(14)}  ${String(s.totalUnits).padStart(4)}  ${String(s.totalWords).padStart(5)}  ${avg.padStart(5)}    ${String(s.abnormal).padStart(3)}  ${String(s.dupTotal).padStart(3)}  ${String(s.emptyCn).padStart(4)}  ${String(s.wordNoIpa).padStart(4)}`
  );
}
/**
 * 构建「缺失音频」任务清单（全 6 条教材线，运行时口径）
 *
 * 为什么必须运行时加载：
 *   renjiao3 / waiyanshe3 没有独立数据文件，由 curriculum.ts 派生；
 *   applyKebiaoTo() 在模块加载时 splice 课标单元。只有真跑一遍才是运行时真相。
 *
 * 为什么按「文本」而不是按 entry.id：
 *   src/lib/audio.ts:96 = manifest.get(text.trim().toLowerCase())
 *   ⇒ 音频只按文本查表，不碰 entry.id。同一文本跨教材/跨年级自动复用。
 *   ⇒ 新音频只需一个不与现有文件名冲突的新 id 命名空间即可。
 *
 * 输出：.workbuddy/tmp/audio-tasks.json
 *   { texts: [{ text, id, types:[word|phrase|sentence], lines:[...], grades:[...] }], ... }
 *
 * 用法：node scripts/build_audio_tasks.mjs
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const TMP = ".tmp-audio-tasks.mjs";
process.on("exit", () => {
  try {
    unlinkSync(TMP);
  } catch {}
});

await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
const mod = await import(`../${TMP}?v=${Date.now()}`);
const CURRICULA = mod.CURRICULA;

const manifestUs = JSON.parse(readFileSync("public/audio/manifest.json", "utf8"));
const manifestUk = JSON.parse(readFileSync("public/audio/manifest-uk.json", "utf8"));
const haveUs = new Set(Object.keys(manifestUs));
const haveUk = new Set(Object.keys(manifestUk));

// 现有 id 全集合（防文件名冲突）
const usedIds = new Set([...Object.values(manifestUs), ...Object.values(manifestUk)]);

// ---------- 收集运行时全部文本 ----------
/** key=归一化文本 → { text(首个原始形态), types, lines, grades, count } */
const agg = new Map();

for (const [line, units] of Object.entries(CURRICULA)) {
  for (const u of units) {
    for (const e of u.entries) {
      const raw = (e.english ?? "").trim();
      const key = raw.toLowerCase();
      if (!key) continue;
      let rec = agg.get(key);
      if (!rec) {
        rec = { key, text: raw, types: new Set(), lines: new Set(), grades: new Set(), count: 0 };
        agg.set(key, rec);
      }
      rec.count++;
      rec.types.add(e.type);
      rec.lines.add(line);
      rec.grades.add(u.grade);
    }
  }
}

console.log(`运行时去重文本总数：${agg.size}`);

const missingUs = [];
const missingUk = [];
for (const rec of agg.values()) {
  if (!haveUs.has(rec.key)) missingUs.push(rec);
  if (!haveUk.has(rec.key)) missingUk.push(rec);
}

console.log(`美音缺失：${missingUs.length}`);
console.log(`英音缺失：${missingUk.length}`);
console.log(`美音覆盖率：${(((agg.size - missingUs.length) / agg.size) * 100).toFixed(2)}%`);
console.log(`英音覆盖率：${(((agg.size - missingUk.length) / agg.size) * 100).toFixed(2)}%`);

// ---------- 分配新 id（命名空间 n + 5 位序号，按文本排序保证可复现） ----------
// 只给「美音缺 OR 英音缺」的文本分配；与 manifest 现有键逐一比对防冲突
const need = [...agg.values()].filter((r) => !haveUs.has(r.key) || !haveUk.has(r.key));
need.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

let n = 0;
for (const rec of need) {
  let id;
  do {
    n += 1;
    id = `n${String(n).padStart(5, "0")}`;
  } while (usedIds.has(id));
  rec.id = id;
}

console.log(`\n需新增/补生成文本：${need.length}`);
console.log(`id 命名空间：n00001 … n${String(n).padStart(5, "0")}（与现有 ${usedIds.size} 个 id 零冲突）`);

// ---------- 诊断：哪些已有音频其实缺英音 ----------
const usOnly = [...agg.values()].filter((r) => haveUs.has(r.key) && !haveUk.has(r.key));
console.log(`\n⚠️ 有美音无英音：${usOnly.length} 条（补英音即可，无需重下美音）`);
const ukOnly = [...agg.values()].filter((r) => !haveUs.has(r.key) && haveUk.has(r.key));
console.log(`⚠️ 有英音无美音：${ukOnly.length} 条`);
for (const r of usOnly.slice(0, 10)) console.log(`   [us-only] ${r.text}`);
for (const r of ukOnly.slice(0, 10)) console.log(`   [uk-only] ${r.text}`);

// ---------- 分线统计缺口 ----------
console.log("\n── 各教材线缺口（按该线运行时文本去重）──");
console.log("  教材线        文本数    缺美音   缺英音");
for (const [line, units] of Object.entries(CURRICULA)) {
  const s = new Set();
  for (const u of units) for (const e of u.entries) {
    const k = (e.english ?? "").trim().toLowerCase();
    if (k) s.add(k);
  }
  const mu = [...s].filter((k) => !haveUs.has(k)).length;
  const mk = [...s].filter((k) => !haveUk.has(k)).length;
  console.log(`  ${line.padEnd(12)} ${String(s.size).padStart(6)}  ${String(mu).padStart(7)}  ${String(mk).padStart(7)}`);
}

// ---------- 类型分布 ----------
const typeCount = { word: 0, phrase: 0, sentence: 0 };
for (const r of need) {
  for (const t of r.types) if (t in typeCount) typeCount[t]++;
}
console.log(`\n缺失文本类型分布：word ${typeCount.word} / phrase ${typeCount.phrase} / sentence ${typeCount.sentence}`);

// ---------- 文本长度分布（影响 TTS 稳定性与体积） ----------
const lens = need.map((r) => r.text.length).sort((a, b) => a - b);
const pct = (p) => lens[Math.floor((lens.length - 1) * p)];
console.log(`文本长度：min ${lens[0]} / p25 ${pct(0.25)} / 中位 ${pct(0.5)} / p75 ${pct(0.75)} / p95 ${pct(0.95)} / max ${lens[lens.length - 1]}`);

// ---------- 写出任务清单 ----------
const out = {
  generatedAt: new Date().toISOString(),
  runtimeTexts: agg.size,
  needCount: need.length,
  tasks: need.map((r) => ({
    id: r.id,
    key: r.key,
    text: r.text,
    types: [...r.types],
    lines: [...r.lines],
    grades: [...r.grades].sort((a, b) => a - b),
    needUs: !haveUs.has(r.key),
    needUk: !haveUk.has(r.key),
  })),
};
writeFileSync(".workbuddy/tmp/audio-tasks.json", JSON.stringify(out, null, 2), "utf8");
console.log(`\n✅ 任务清单已写出：.workbuddy/tmp/audio-tasks.json（${need.length} 条）`);

// 前 20 条样本
console.log("\n样本（前 20 条）：");
for (const t of out.tasks.slice(0, 20)) {
  console.log(`  ${t.id}  [${t.types.join(",")}]  ${t.text}`);
}

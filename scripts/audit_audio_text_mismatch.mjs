/**
 * 音频 ⇄ 文本 一致性全量审计（6 条线 × 美音/英音）
 *
 * 核心思路：manifest 是 text → entryId 的映射，而 mp3 文件以 entryId 命名。
 * 因此「文件真正说的是什么」取决于【生成 mp3 那一刻】该 entryId 对应的 english。
 * 只要 entryId → english 的对应关系在生成之后发生过位移（词库重建/插入/删除），
 * 就会出现「manifest 映射自洽，但 mp3 内容是旧词」的错位 —— 这是本脚本要抓的目标。
 *
 * 检查项：
 *   A. 反向自洽：manifest[text] = id，则该 id 在【当前词库】里的 english 应等于 text
 *   B. 文件存在：{id}.mp3 / {id}-uk.mp3 是否存在
 *   C. 覆盖率：每条线每个词条的 english 是否能在 manifest 里查到
 *   D. 一线内同 id 不同词（id 复用/克隆导致）
 *
 * 用法: node scripts/audit_audio_text_mismatch.mjs [--json out.json]
 */
import { existsSync, writeFileSync, readdirSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const TMP = ".tmp-audio-audit-curriculum.mjs";
await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
process.on("exit", () => {
  try {
    require("node:fs").unlinkSync(TMP);
  } catch {}
});
const mod = await import(`../${TMP}`);
const CURRICULA = mod.CURRICULA;

const jsonIdx = process.argv.indexOf("--json");
const jsonOut = jsonIdx >= 0 ? process.argv[jsonIdx + 1] : null;

/* ---------- 收集 id → english（跨 6 线） ---------- */
const idToEnglish = new Map();   // id -> Set(english)
const idToWhere = new Map();     // id -> [line,...]
const lineEntries = {};          // line -> [{id, english, grade, unit}]

for (const [line, units] of Object.entries(CURRICULA)) {
  const arr = [];
  for (const u of units) {
    for (const e of u.entries) {
      arr.push({ id: e.id, english: e.english, grade: u.grade, unit: u.unit });
      if (!idToEnglish.has(e.id)) idToEnglish.set(e.id, new Set());
      idToEnglish.get(e.id).add(e.english.trim().toLowerCase());
      if (!idToWhere.has(e.id)) idToWhere.set(e.id, new Set());
      idToWhere.get(e.id).add(line);
    }
  }
  lineEntries[line] = arr;
}

/* ---------- 音频文件清单 ---------- */
const audioDir = "public/audio";
const files = new Set(readdirSync(audioDir));

/* ---------- 逐 variant 审计 ---------- */
const report = {};
for (const variant of ["us", "uk"]) {
  const file = variant === "uk" ? "manifest-uk.json" : "manifest.json";
  const m = JSON.parse(
    await (await import("node:fs/promises")).readFile(`${audioDir}/${file}`, "utf8")
  );
  const suf = variant === "uk" ? "-uk" : "";
  const res = {
    file,
    entries: Object.keys(m).length,
    roundTripMismatch: [],   // A：text→id→english 不相等
    missingFile: [],         // B：mp3 不存在
    idMultiWord: [],         // D：同一 id 在当前词库里对应多个不同 english
    perLine: {},             // C
  };

  for (const [text, id] of Object.entries(m)) {
    const engSet = idToEnglish.get(id);
    if (!engSet) {
      res.roundTripMismatch.push({ text, id, reason: "id 不存在于当前词库", actual: null });
      continue;
    }
    if (!engSet.has(text)) {
      res.roundTripMismatch.push({
        text, id,
        reason: "id 对应词条与文本不一致",
        actual: [...engSet].join("|"),
      });
    }
    if (engSet.size > 1) {
      res.idMultiWord.push({ id, words: [...engSet] });
    }
    const fn = `${id}${suf}.mp3`;
    if (!files.has(fn)) res.missingFile.push({ text, id, file: fn });
  }

  for (const [line, arr] of Object.entries(lineEntries)) {
    let hit = 0;
    const miss = [];
    for (const e of arr) {
      const k = e.english.trim().toLowerCase();
      if (m[k] !== undefined) hit++;
      else miss.push(e.english);
    }
    res.perLine[line] = { total: arr.length, hit, miss: miss.length, samples: miss.slice(0, 15) };
  }
  report[variant] = res;
}

/* ---------- 输出 ---------- */
let out = "";
const say = (s) => { out += s + "\n"; };
for (const [variant, r] of Object.entries(report)) {
  say(`\n${"=".repeat(70)}`);
  say(`[${variant.toUpperCase()}] ${r.file}  映射 ${r.entries} 条`);
  say(`${"=".repeat(70)}`);
  say(`A. text→id→english 不一致 : ${r.roundTripMismatch.length}`);
  for (const x of r.roundTripMismatch.slice(0, 40)) {
    say(`   "${x.text}" -> ${x.id}  实际="${x.actual}"  (${x.reason})`);
  }
  say(`B. mp3 文件缺失           : ${r.missingFile.length}`);
  for (const x of r.missingFile.slice(0, 20)) say(`   ${x.file}  (${x.text})`);
  say(`D. 同 id 多词             : ${r.idMultiWord.length}`);
  for (const x of r.idMultiWord.slice(0, 20)) say(`   ${x.id} -> ${x.words.join(" | ")}`);
  say(`C. 各线覆盖率:`);
  for (const [line, p] of Object.entries(r.perLine)) {
    say(`   ${line.padEnd(12)} ${p.hit}/${p.total}  缺 ${p.miss}` +
      (p.miss ? `  例: ${p.samples.join(", ")}` : ""));
  }
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 2), "utf8");
console.log(out);

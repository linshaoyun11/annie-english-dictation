/**
 * 导出「归一化文本 → 出现的教材线 / 词条 id」映射，供音频核查脚本按线统计。
 *
 * 为什么要运行时加载：renjiao3 / waiyanshe3 由 curriculum.ts 派生，
 * applyKebiaoTo() 在模块加载时 splice 课标单元，只有真跑一遍才是运行时真相。
 *
 * 输出：.workbuddy/tmp/texts-by-line.json
 *   { "name": { "lines": ["renjiao3","waiyanshe"], "ids": ["g3u1e8165","wy-g1u2e0020"] } }
 *
 * 用法: node scripts/dump_texts_by_line.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const TMP = ".tmp-texts-by-line.mjs";
process.on("exit", () => {
  try {
    require("node:fs").unlinkSync(TMP);
  } catch {}
});

await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
const mod = await import(`../${TMP}?v=${Date.now()}`);
const CURRICULA = mod.CURRICULA;

const out = {};
let entryCount = 0;
for (const [line, units] of Object.entries(CURRICULA)) {
  for (const u of units) {
    for (const e of u.entries) {
      entryCount++;
      const key = (e.english ?? "").trim().toLowerCase();
      if (!key) continue;
      if (!out[key]) out[key] = { raw: e.english.trim(), lines: new Set(), ids: new Set() };
      out[key].lines.add(line);
      out[key].ids.add(e.id);
    }
  }
}
const json = {};
for (const [k, v] of Object.entries(out)) json[k] = { raw: v.raw, lines: [...v.lines], ids: [...v.ids] };

mkdirSync(".workbuddy/tmp", { recursive: true });
writeFileSync(".workbuddy/tmp/texts-by-line.json", JSON.stringify(json, null, 1), "utf8");
console.log(`词条 ${entryCount} → 唯一文本 ${Object.keys(json).length}`);
console.log("已写出 .workbuddy/tmp/texts-by-line.json");
for (const line of Object.keys(CURRICULA)) {
  const n = Object.values(json).filter((v) => v.lines.includes(line)).length;
  console.log(`  ${line.padEnd(12)} 唯一文本 ${n}`);
}

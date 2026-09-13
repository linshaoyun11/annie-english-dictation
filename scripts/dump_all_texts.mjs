/**
 * 导出全部运行时文本（含类型），供豆包 TTS 重生成短语/句子音频。
 * 与 build_audio_tasks.mjs 同构，但不过滤缺失——导出全量。
 * 输出：.workbuddy/tmp/all-texts.json  [{key, text, types}]
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const TMP = ".tmp-all-texts.mjs";
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

const agg = new Map();
for (const [line, units] of Object.entries(CURRICULA)) {
  for (const u of units) {
    for (const e of u.entries) {
      const raw = (e.english ?? "").trim();
      const key = raw.toLowerCase();
      if (!key) continue;
      let rec = agg.get(key);
      if (!rec) {
        rec = { key, text: raw, types: new Set() };
        agg.set(key, rec);
      }
      rec.types.add(e.type);
    }
  }
}

const all = [...agg.values()].map((r) => ({
  key: r.key,
  text: r.text,
  types: [...r.types],
}));
const want = all.filter((r) => r.types.includes("phrase") || r.types.includes("sentence"));
const from = (t) => all.filter((r) => r.types.includes(t)).length;
console.log(`运行时去重文本总数: ${all.length}`);
console.log(`word ${from("word")} / phrase ${from("phrase")} / sentence ${from("sentence")}`);
console.log(`目标(含 phrase 或 sentence): ${want.length}`);

writeFileSync(".workbuddy/tmp/all-texts.json", JSON.stringify(want, null, 1), "utf8");
console.log("✅ .workbuddy/tmp/all-texts.json");

/**
 * 仁爱音频覆盖度真实盘点：
 * 沿用 App 端逻辑（manifest.get(text.toLowerCase()) → id → mp3），
 * 统计 2388 条仁爱词条里有多少**当前**能由 App 正常播到音频。
 *
 * 同时给出三种来源分布：
 *   ✅ manifest 直命中           （text → 某 id，文件存在）
 *   ⚠️ manifest 命中但文件缺失   （text → id，但 public/audio/{id}.mp3 不存在）
 *   ❌ manifest 未命中           （text 不在 manifest 里，App 必漏）
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";
import { existsSync as _e, unlinkSync } from "node:fs";

const AUDIO = "public/audio";
const MAX = 60_000, MIN = 1_000;
const TMP = ".tmp-curricula2.mjs";
await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
process.on("exit", () => { if (_e(TMP)) unlinkSync(TMP); });

const m = await import(`../${TMP}`);
const CURRICULA = m.CURRICULA;

const usMan = JSON.parse(readFileSync(AUDIO + "/manifest.json", "utf8"));
const ukMan = JSON.parse(readFileSync(AUDIO + "/manifest-uk.json", "utf8"));

const stat = (id) => {
  const f1 = AUDIO + "/" + id + ".mp3";
  const f2 = AUDIO + "/" + id + "-uk.mp3";
  const us = existsSync(f1) ? statSync(f1).size : null;
  const uk = existsSync(f2) ? statSync(f2).size : null;
  const usOk = us != null && us >= MIN && us <= MAX;
  const ukOk = uk != null && uk >= MIN && uk <= MAX;
  return { us, uk, usOk, ukOk };
};

const renai = CURRICULA.renai;
let total = 0, directUs = 0, directUk = 0, noUs = 0, noUk = 0, bothMissing = 0;
const usSrc = {}, ukSrc = {};     // text → 来源 id 前缀分布
const issues = { oversized: 0, undersized: 0, missing: 0 };
const missingSamples = [];

for (const unit of renai) {
  for (const e of unit.entries) {
    total++;
    const t = e.english.trim().toLowerCase();
    const usId = usMan[t], ukId = ukMan[t];
    const usStat = usId ? stat(usId) : { us: null, usOk: false };
    const ukStat = ukId ? stat(ukId) : { uk: null, ukOk: false };

    if (usId && usStat.usOk) {
      directUs++;
      const p = (usId.match(/^([a-z]{0,2})-/)?.[1] ?? "");
      usSrc[p] = (usSrc[p] || 0) + 1;
    } else if (usId) {
      issues.missing++;
      if (issues.missing < 8) missingSamples.push({ id: e.id, text: e.english, manId: usId, us: usStat.us });
    } else {
      noUs++;
    }
    if (ukId && ukStat.ukOk) {
      directUk++;
      const p = (ukId.match(/^([a-z]{0,2})-/)?.[1] ?? "");
      ukSrc[p] = (ukSrc[p] || 0) + 1;
    } else noUk++;
  }
}

console.log("=== 仁爱 2388 条音频覆盖度（App 端视角）===");
console.log("美音：manifest 直命中且文件健康:", directUs, `(${(directUs / total * 100).toFixed(1)}%)`);
console.log("英音：manifest 直命中且文件健康:", directUk, `(${(directUk / total * 100).toFixed(1)}%)`);
console.log("美音：manifest 未命中（App 必漏）: ", noUs);
console.log("英音：manifest 未命中（App 必漏）: ", noUk);
console.log("");
console.log("美音命中来源分布：", usSrc);
console.log("英音命中来源分布：", ukSrc);
console.log("");
console.log("manifest 命中但文件异常:", issues.missing);
for (const s of missingSamples) console.log("  例:", s);

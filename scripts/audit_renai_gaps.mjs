/**
 * 仁爱音频漏播清单：列出 App 端播放会失败的 10 个具体缺口
 * （US 未命中 + UK 未命中）。
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";
import { existsSync as _e, unlinkSync } from "node:fs";

const AUDIO = "public/audio";
const MAX = 60_000, MIN = 1_000;
const TMP = ".tmp-audit.mjs";
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

const stat = (id, suffix = "") => {
  const f = AUDIO + "/" + id + suffix + ".mp3";
  if (!existsSync(f)) return null;
  const s = statSync(f).size;
  return { size: s, ok: s >= MIN && s <= MAX };
};

const renai = CURRICULA.renai;
const noUs = [], noUk = [];
for (const unit of renai) {
  for (const e of unit.entries) {
    const t = e.english.trim().toLowerCase();
    const usId = usMan[t], ukId = ukMan[t];
    const usStat = usId ? stat(usId, "") : null;
    const ukStat = ukId ? stat(ukId, "-uk") : null;
    if (!usId || !usStat?.ok) noUs.push({ entry: e, manifestId: usId, fileSize: usStat?.size });
    if (!ukId || !ukStat?.ok) noUk.push({ entry: e, manifestId: ukId, fileSize: ukStat?.size });
  }
}

console.log("=== 美音漏播（manifest 未命中或文件异常） ===", noUs.length);
for (const x of noUs) {
  console.log(`  ${x.entry.id.padEnd(14)}  "${x.entry.english}"  manifest=${x.manifestId ?? "无"}  file=${x.fileSize ?? "缺失"}`);
}
console.log("\n=== 英音漏播 ===", noUk.length);
for (const x of noUk) {
  console.log(`  ${x.entry.id.padEnd(14)}  "${x.entry.english}"  manifest=${x.manifestId ?? "无"}  file=${x.fileSize ?? "缺失"}`);
}

console.log("\n=== 总结 ===");
console.log(`仁爱共 2388 条 → 美音漏播 ${noUs.length} / 英音漏播 ${noUk.length}`);
console.log("需要补的文件数（按 id 唯一）:",
  new Set([...noUs.map(x=>x.entry.id+".mp3"), ...noUk.map(x=>x.entry.id+"-uk.mp3")]).size);

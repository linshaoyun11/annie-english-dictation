/**
 * audit_all_playback.mjs — 全六条教材线 App 端播放路径审计
 *
 * 从每条线的每个 entry 出发，按 `manifest(text) → id → file` 三段路径检查是否 OK。
 * 输出：每条线的 ok / 漏播数 + 漏播样例。
 *
 * 用法：node scripts/audit_all_playback.mjs
 */
import { readFileSync, existsSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";

const MIN_BYTES = 1000;
const MAX_BYTES = 60000;
const ROOT = process.cwd();
const TMP = join(ROOT, ".tmp-audit.mjs");

await build({
  input: [join(ROOT, "src/data/curriculum.ts")],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
const m = await import(pathToFileURL(TMP).href);
unlinkSync(TMP);

const us = JSON.parse(readFileSync(join(ROOT, "public/audio/manifest.json"), "utf8"));
const uk = JSON.parse(readFileSync(join(ROOT, "public/audio/manifest-uk.json"), "utf8"));

const LABEL = {
  renjiao: "人教一起(renjiao)",
  renjiao3: "人教三起(renjiao3)",
  waiyanshe: "外研一起(waiyanshe)",
  waiyanshe3: "外研三起(waiyanshe3)",
  oxford: "牛津(oxford)",
  renai: "仁爱(renai)",
};

function checkUS(text) {
  // App 端 lookup：text.trim().toLowerCase()（src/lib/audio.ts:96）
  const t = text.trim().toLowerCase();
  const id = us[t];
  if (!id) return { reason: "no-manifest" };
  const f = join(ROOT, `public/audio/${id}.mp3`);
  if (!existsSync(f)) return { reason: "file-missing", id };
  const sz = statSync(f).size;
  if (sz < MIN_BYTES) return { reason: `tiny(${sz}B)`, id };
  if (sz > MAX_BYTES) return { reason: `huge(${sz}B)`, id };
  return { ok: true, id };
}

function checkUK(text) {
  // 英音 lookup 与美音完全一致：text.trim().toLowerCase()（保留撇号点号）
  // 早期 manifest-uk.json 用的是原小写 key（含标点），与 audio.ts 一致
  const t = text.trim().toLowerCase();
  const id = uk[t];
  if (!id) return { reason: "no-manifest" };
  const f = join(ROOT, `public/audio/${id}-uk.mp3`);
  if (!existsSync(f)) return { reason: "file-missing", id };
  const sz = statSync(f).size;
  if (sz < MIN_BYTES) return { reason: `tiny(${sz}B)`, id };
  if (sz > MAX_BYTES) return { reason: `huge(${sz}B)`, id };
  return { ok: true, id };
}

const totalEntries = { renjiao: 0, renjiao3: 0, waiyanshe: 0, waiyanshe3: 0, oxford: 0, renai: 0 };
const okUS = { ...totalEntries };
const okUK = { ...totalEntries };
const missUS = {};
const missUK = {};

for (const [k, units] of Object.entries(m.CURRICULA)) {
  missUS[k] = [];
  missUK[k] = [];
  for (const u of units) {
    for (const e of u.entries) {
      totalEntries[k]++;
      const rU = checkUS(e.english);
      if (rU.ok) okUS[k]++;
      else missUS[k].push({ id: e.id, text: e.english, ...rU });

      const rK = checkUK(e.english);
      if (rK.ok) okUK[k]++;
      else missUK[k].push({ id: e.id, text: e.english, ...rK });
    }
  }
}

console.log("===== 全教材线 App 端播放路径审计 =====\n");
console.log("线".padEnd(28) + "美音 ok".padStart(10) + "/总".padStart(6) + "  覆盖".padStart(8) +
  "   英音 ok".padStart(10) + "/总".padStart(6) + "  覆盖".padStart(8));
console.log("-".repeat(86));

for (const k of Object.keys(LABEL)) {
  const tot = totalEntries[k];
  const usOK = okUS[k], usTot = tot;
  const ukOK = okUK[k], ukTot = tot;
  const usPct = ((usOK / usTot) * 100).toFixed(1);
  const ukPct = ((ukOK / ukTot) * 100).toFixed(1);
  console.log(
    LABEL[k].padEnd(28) +
    (usOK + "").padStart(10) + ("/" + usTot).padStart(6) + "  " + (usPct + "%").padStart(7) + "   " +
    (ukOK + "").padStart(10) + ("/" + ukTot).padStart(6) + "  " + (ukPct + "%").padStart(7)
  );
}

console.log("\n===== 漏播统计（按线） =====");
for (const k of Object.keys(LABEL)) {
  const mu = missUS[k], mk = missUK[k];
  if (mu.length === 0 && mk.length === 0) {
    console.log(LABEL[k].padEnd(28) + " ✅ 全部 100% 覆盖");
    continue;
  }
  console.log(`${LABEL[k]} 美音漏 ${mu.length} / 英音漏 ${mk.length}`);
  const reasonU = {};
  for (const x of mu) reasonU[x.reason] = (reasonU[x.reason] || 0) + 1;
  const reasonK = {};
  for (const x of mk) reasonK[x.reason] = (reasonK[x.reason] || 0) + 1;
  if (Object.keys(reasonU).length) {
    console.log("  美音细分：");
    for (const [r, n] of Object.entries(reasonU).sort((a, b) => b[1] - a[1]))
      console.log(`    ${r.padEnd(25)} ${n}`);
  }
  if (Object.keys(reasonK).length) {
    console.log("  英音细分：");
    for (const [r, n] of Object.entries(reasonK).sort((a, b) => b[1] - a[1]))
      console.log(`    ${r.padEnd(25)} ${n}`);
  }
  if (mu.length) {
    console.log("  美音漏播样例（前 5）：");
    for (const x of mu.slice(0, 5)) console.log(`    ${x.id.padEnd(16)} «${x.text}»  ${x.reason}`);
  }
  if (mk.length) {
    console.log("  英音漏播样例（前 5）：");
    for (const x of mk.slice(0, 5)) console.log(`    ${x.id.padEnd(16)} «${x.text}»  ${x.reason}`);
  }
}

console.log("\n===== 待补总量（按 reason 汇总） =====");
const allReasonU = {}, allReasonK = {};
for (const k of Object.keys(LABEL)) {
  for (const x of missUS[k]) allReasonU[x.reason] = (allReasonU[x.reason] || 0) + 1;
  for (const x of missUK[k]) allReasonK[x.reason] = (allReasonK[x.reason] || 0) + 1;
}
console.log("美音：");
for (const [r, n] of Object.entries(allReasonU).sort((a, b) => b[1] - a[1]))
  console.log(`  ${r.padEnd(25)} ${n}`);
console.log("英音：");
for (const [r, n] of Object.entries(allReasonK).sort((a, b) => b[1] - a[1]))
  console.log(`  ${r.padEnd(25)} ${n}`);

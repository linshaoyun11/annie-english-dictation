/**
 * audit_waiyanshe_playback.mjs — 外研三起 G7-G9 **App 端播放路径**覆盖度
 *
 * 不看 entry、不看 first-id、不看 batch gap。
 * 直接按 G7-G9 **每个词条** 的实际播放路径审计：
 *   text → manifest.get(text) → id → public/audio/{id}.mp3 是否合格
 *
 * 只要路径完整就 OK；否则标记「App 端漏播」。
 *
 * 这是「App 端实际能否播放」的唯一真理指标。
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

const wy3 = m.CURRICULA.waiyanshe3.filter((u) => u.grade >= 7 && u.grade <= 9);

let okUS = 0,
  okUK = 0;
const missingUS = [],
  missingUK = [];

function check(text, variant) {
  // App 端 lookup key 约定：美音用原文小写，英音去非 a-z 空格字符
  const lookupKey =
    variant === "us" ? text : text.replace(/[^a-z ]/g, "").trim();
  const man = variant === "us" ? us : uk;
  const id = man[lookupKey];
  if (!id) return null;
  const f = join(ROOT, `public/audio/${id}${variant === "uk" ? "-uk" : ""}.mp3`);
  if (!existsSync(f)) return { id, reason: "file-missing" };
  const sz = statSync(f).size;
  if (sz < MIN_BYTES) return { id, reason: `tiny(${sz}B)` };
  if (sz > MAX_BYTES) return { id, reason: `huge(${sz}B)` };
  return { id, ok: true };
}

// === 美音 ===
for (const u of wy3)
  for (const e of u.entries) {
    const t = e.english.trim().toLowerCase();
    const r = check(t, "us");
    if (r?.ok) okUS++;
    else missingUS.push({ id: e.id, text: e.english, ...(r || { reason: "no-manifest-hit" }) });
  }

// === 英音 ===
for (const u of wy3)
  for (const e of u.entries) {
    const t = e.english.trim().toLowerCase();
    const r = check(t, "uk");
    if (r?.ok) okUK++;
    else missingUK.push({ id: e.id, text: e.english, ...(r || { reason: "no-manifest-hit" }) });
  }

const totalUS = wy3.reduce((s, u) => s + u.entries.length, 0);
const totalUK = wy3.reduce((s, u) => s + u.entries.length, 0);

console.log(`===== App 端播放路径审计（按 entry 维度，G7-G9 共 ${totalUS} 词条）=====\n`);
console.log(`美音：${okUS}/${totalUS} 合格 (${((okUS / totalUS) * 100).toFixed(1)}%)`);
const byReasonUS = {};
for (const m of missingUS) byReasonUS[m.reason] = (byReasonUS[m.reason] || 0) + 1;
for (const [k, v] of Object.entries(byReasonUS).sort((a, b) => b[1] - a[1]))
  console.log(`  ${k.padEnd(25)} ${v}`);

console.log(`\n英音：${okUK}/${totalUK} 合格 (${((okUK / totalUK) * 100).toFixed(1)}%)`);
const byReasonUK = {};
for (const m of missingUK) byReasonUK[m.reason] = (byReasonUK[m.reason] || 0) + 1;
for (const [k, v] of Object.entries(byReasonUK).sort((a, b) => b[1] - a[1]))
  console.log(`  ${k.padEnd(25)} ${v}`);

console.log(`\n===== 漏播样例 =====`);
console.log("美音前 15：");
for (const m of missingUS.slice(0, 15))
  console.log(`  ${m.id.padEnd(16)} «${m.text}»  ${m.reason}`);
console.log("英音前 15：");
for (const m of missingUK.slice(0, 15))
  console.log(`  ${m.id.padEnd(16)} «${m.text}»  ${m.reason}`);

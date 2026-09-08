import { readFileSync, statSync, unlinkSync, existsSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";
import path from "node:path";

const TMP = ".tmp-orphan.mjs";
process.on("exit", () => { try { unlinkSync(TMP); } catch {} });

await rolldownBuild({ input: ["src/data/curriculum.ts"], output: { file: TMP, format: "esm" }, logLevel: "silent" });
const { CURRICULA } = await import(`../${TMP}?v=${Date.now()}`);

const man = JSON.parse(readFileSync("public/audio/manifest.json", "utf8"));
const AUDIO = path.resolve("public/audio");

const all = new Set();
for (const units of Object.values(CURRICULA)) {
  for (const u of units) for (const e of u.entries) {
    const k = (e.english ?? "").trim().toLowerCase();
    if (k) all.add(k);
  }
}

// 台词库（祝贺页展示，不走 CURRICULA）
const mqSrc = readFileSync("src/data/movieQuotes.ts", "utf8");
const quotes = new Set();
const RE = /en:\s*"((?:[^"\\]|\\.)*)"/g;
let m;
while ((m = RE.exec(mqSrc)) !== null) quotes.add(m[1].trim().toLowerCase());

const orphan = Object.keys(man).filter((k) => !all.has(k));
const inQuotes = orphan.filter((k) => quotes.has(k));
const pure = orphan.filter((k) => !quotes.has(k));

let sz = 0;
for (const k of pure) {
  const id = man[k];
  for (const f of [`${id}.mp3`, `${id}-uk.mp3`]) {
    const p = path.join(AUDIO, f);
    if (existsSync(p)) sz += statSync(p).size;
  }
}

console.log(`孤儿键 ${orphan.length}`);
console.log(`  ├ 被台词库用到: ${inQuotes.length}  ← 保留`);
console.log(`  └ 完全无用:     ${pure.length}`);
console.log(`     占用（含英音）: ${(sz / 1024 / 1024).toFixed(1)} MB`);
console.log(`\n无用孤儿样例（前 25）:`);
for (const k of pure.slice(0, 25)) console.log("   " + JSON.stringify(k));
console.log(`\n台词库用到的孤儿（保留）:`);
for (const k of inQuotes.slice(0, 10)) console.log("   " + JSON.stringify(k));

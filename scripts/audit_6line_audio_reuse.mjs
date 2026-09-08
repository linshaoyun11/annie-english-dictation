// 6 线音频复用分析（纯运行时计算）
import fs from "node:fs";
import { performance } from "node:perf_hooks";

const us = JSON.parse(fs.readFileSync("public/audio/manifest.json", "utf8"));
const uk = JSON.parse(fs.readFileSync("public/audio/manifest-uk.json", "utf8"));

// 直接读 6 个源文件，正则提取 entries
const files = {
  renjiao: ["src/data/curriculum.ts", "src/data/renjiaoSL.ts", "src/data/kebiaoBank.ts"],
  renjiao3: ["src/data/curriculum.ts"],
  waiyanshe: ["src/data/curriculum.ts", "src/data/waiyanshe.ts", "src/data/waiyansheSL.ts", "src/data/kebiaoBank.ts"],
  waiyanshe3: ["src/data/curriculum.ts", "src/data/waiyanshe.ts"],
  oxford: ["src/data/curriculum.ts", "src/data/oxford.ts", "src/data/oxfordSL.ts"],
  renai: ["src/data/curriculum.ts", "src/data/renai.ts"],
};

// 真接 import 6 个 .ts 文件 + mk，先 tsc emit，然后 import .js
import { CURRICULA } from "../dist_audit/curriculum.js";

const lines = Object.keys(CURRICULA);
console.log("lines:", lines.join(", "));

const lineEntries = new Map();
const text2lines = new Map();

for (const line of lines) {
  const units = CURRICULA[line];
  const arr = [];
  for (const u of units) {
    for (const e of u.entries) {
      const t = (e.english || "").trim().toLowerCase();
      if (!t) continue;
      arr.push({ t, id: e.id });
      if (!text2lines.has(t)) text2lines.set(t, new Set());
      text2lines.get(t).add(line);
    }
  }
  lineEntries.set(line, arr);
}

console.log("\n=== 每条线 entries 与音频覆盖 ===");
console.log("line          | entries | 有 US | 有 UK");
for (const line of lines) {
  const arr = lineEntries.get(line);
  let usHit = 0, ukHit = 0;
  for (const { t } of arr) {
    if (us[t]) usHit++;
    if (uk[t]) ukHit++;
  }
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
  console.log(
    `${pad(line, 12)} | ${arr.length.toString().padStart(7)} | ${usHit.toString().padStart(5)} | ${ukHit.toString().padStart(5)}`
  );
}

console.log("\n=== 跨线文本复用度（出现于几条线）===");
const buckets = new Map();
for (const [, ls] of text2lines) {
  const k = ls.size;
  buckets.set(k, (buckets.get(k) || 0) + 1);
}
for (const [k, v] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`出现在 ${k} 条线: ${v} 个不同文本`);
}

console.log("\n=== 每条线的「独有文本」数（只在本线出现）===");
for (const line of lines) {
  const unique = [...text2lines.entries()].filter(
    ([, ls]) => ls.size === 1 && ls.has(line)
  ).length;
  console.log(`${line}: ${unique} 个独有文本`);
}

const usIds = new Set(Object.values(us));
const ukIds = new Set(Object.values(uk));
console.log("\n=== 实际 mp3 文件 ===");
console.log(`US 唯一 mp3 id: ${usIds.size}`);
console.log(`UK 唯一 mp3 id: ${ukIds.size}`);
let shared = 0;
for (const id of usIds) if (ukIds.has(id)) shared++;
console.log(`US ∩ UK（同 id 共一份）: ${shared}`);
console.log(`只供 US: ${usIds.size - shared}`);
console.log(`只供 UK: ${ukIds.size - shared}`);
console.log(`US ∪ UK = ${new Set([...usIds, ...ukIds]).size} 个 mp3 文件`);

console.log("\n=== 跨线 entry 共享 id 情况 ===");
// 看是否有多条线的同一文本指向同一个 mp3 id
const id2lines = new Map();
for (const [line, arr] of lineEntries) {
  for (const { t, id } of arr) {
    const usId = us[t] ?? null;
    const ukId = uk[t] ?? null;
    const key = usId || ukId;
    if (!key) continue;
    if (!id2lines.has(key)) id2lines.set(key, new Set());
    id2lines.get(key).add(line);
  }
}
// 统计以"每条线共用的内容"的粒度
const shareBuckets = new Map();
for (const [, ls] of id2lines) {
  const k = ls.size;
  shareBuckets.set(k, (shareBuckets.get(k) || 0) + 1);
}
console.log("按 mp3 id 看，被几条线用（参考）：");
for (const [k, v] of [...shareBuckets.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  被 ${k} 条线用: ${v} 个 mp3`);
}

console.log("\n=== 重复定义 entry（同 text 出现在多个文件）===");
// 同 text 但不同 id 检查
let sameTextDifferentIds = 0;
const examples = [];
for (const [t, linesForT] of text2lines) {
  const ids = new Set();
  for (const line of linesForT) {
    const arr = lineEntries.get(line);
    for (const e of arr) {
      if (e.t === t) ids.add(e.id);
    }
  }
  if (ids.size > 1) {
    sameTextDifferentIds++;
    if (examples.length < 5) examples.push({ t, ids: [...ids].join(", ") });
  }
}
console.log(`同名文本在不同 entry 用不同 id 的（冗余信号）: ${sameTextDifferentIds}`);
for (const e of examples) console.log(`  ${e.t} → ${e.ids}`);

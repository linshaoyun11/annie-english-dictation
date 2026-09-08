/**
 * 仁爱版入包核验：把 src/data/renai.ts 的单元标题与词条 english
 * 逐个拿到 dist 产物里比对，确认没有因为 tree-shaking / 构建异常丢数据。
 *
 * 用法：node scripts/verify_renai_bundle.mjs [bundle 路径]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist/assets";

// 未显式传参时，取 dist/assets 里最新改动的 index-*.js（--emptyOutDir=false
// 会在 dist 里留下历史产物，不能随便挑一个）。
let bundlePath = process.argv[2];
if (!bundlePath) {
  const files = readdirSync(DIST)
    .filter((f) => f.startsWith("index-") && f.endsWith(".js"))
    .map((f) => ({ f, t: statSync(join(DIST, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  bundlePath = join(DIST, files[0].f);
}

const src = readFileSync("src/data/renai.ts", "utf8");
const bundle = readFileSync(bundlePath, "utf8");

const TITLE_RE = /title:\s*"((?:[^"\\]|\\.)*)"/g;
const ENTRY_RE = /"(word|phrase|sentence)",\s*"((?:[^"\\]|\\.)*)"/g;

const titles = [...src.matchAll(TITLE_RE)].map((m) => m[1]);
const entries = [...src.matchAll(ENTRY_RE)].map((m) => m[2]);

const check = (label, list) => {
  const miss = list.filter((s) => !bundle.includes(s));
  const pct = ((list.length - miss.length) / list.length) * 100;
  console.log(
    `${label}: ${list.length - miss.length}/${list.length} (${pct.toFixed(1)}%)`
  );
  if (miss.length) {
    console.log(`  ❌ 缺失 ${miss.length} 项，样例：`, miss.slice(0, 8));
  }
  return miss.length;
};

console.log("产物文件:", bundlePath);
console.log("产物大小:", (bundle.length / 1024).toFixed(1), "KB\n");

let bad = 0;
bad += check("教材本体单元标题入包", titles);
bad += check("教材本体词条 english 入包", entries);

// 课标补全单元是 applyKebiaoTo 在运行时生成的，源码里没有字面量，
// 只能通过「课标词汇」标题前缀 + KEBIAO_BANK 的词在产物里间接验证。
const kbMark = (bundle.match(/课标词汇/g) ?? []).length;
kbMark > 0
  ? console.log(`课标补全单元标题前缀「课标词汇」命中: ${kbMark} 次 ✅`)
  : (console.log("课标补全单元标题前缀「课标词汇」: ❌ 未命中"), bad++);

// 抽查几个课标补全词（来自 KEBIAO_BANK，不在 renai.ts 字面量里）。
// ⚠️ 压缩后字符串字面量用的是**反引号**（rolldown 把 "x" 压成 `x`），
// 不是双引号也不是单引号 —— 三种引号都要试，只查 `"x"` 会全部误报缺失。
const QUOTES = ["`", '"', "'"];
const kbSample = ["ability", "abroad", "accept", "accident", "achieve"];
const kbHit = kbSample.filter((w) => QUOTES.some((q) => bundle.includes(`${q}${w}${q}`)));
kbHit.length === kbSample.length
  ? console.log(`课标补全词入包抽查: ${kbHit.length}/${kbSample.length} ✅`)
  : (console.log(
      `课标补全词入包抽查: ${kbHit.length}/${kbSample.length} ❌ 缺 ${kbSample.filter((w) => !kbHit.includes(w))}`
    ),
    bad++);

// 教材线注册：设置页标签 + CURRICULA 索引键
for (const s of ["仁爱版·初中", "Project English"]) {
  const ok = bundle.includes(s);
  console.log(`注册标记 "${s}": ${ok ? "✅" : "❌"}`);
  if (!ok) bad++;
}

console.log(bad === 0 ? "\n✅ 仁爱版已完整入包" : `\n❌ 有 ${bad} 项缺失`);
process.exit(bad === 0 ? 0 : 1);

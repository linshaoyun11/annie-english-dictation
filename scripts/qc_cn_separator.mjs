/**
 * 中文释义里「多词性分隔符」的约定体检。
 * 教材词表里一个词有多个词性时，需要分隔（n. … / v. … / adj. …）。
 * 本脚本统计当前用的是双空格还是单空格，找出不一致的条目。
 *
 * 用法：node scripts/qc_cn_separator.mjs [line]
 */
import { build as rolldownBuild } from "rolldown";
import { unlinkSync } from "node:fs";

const line = process.argv[2] ?? "renjiao3";
const TMP = ".tmp-cn-sep.mjs";
process.on("exit", () => { try { unlinkSync(TMP); } catch {} });

await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
const mod = await import(`../${TMP}?v=${Date.now()}`);
const CUR = mod.CURRICULA?.[line] ?? [];

const POS = "(?:n|v|adj|adv|prep|conj|pron|num|int|art|aux|vt|vi|abbr)";
const dblRe = new RegExp(`  (?=${POS}\\.)`);
const sglRe = new RegExp(`(^|[^ ]) (?=${POS}\\.)`);

const dbl = [];
const sgl = [];
let total = 0;

for (const u of CUR) {
  const tag = `G${u.grade}·U${u.unit} ${u.title}`;
  for (const e of u.entries) {
    total++;
    const cn = (e.chinese ?? "").trim();
    if (!cn) continue;
    if (dblRe.test(cn)) dbl.push([tag, e.english, cn]);
    else if (sglRe.test(cn)) sgl.push([tag, e.english, cn]);
  }
}

const bar = "=".repeat(70);
console.log(bar);
console.log(` 中文多词性分隔符体检 · ${line}   （${total} 词条）`);
console.log(bar);
console.log(`\n用【双空格】分隔的词条: ${dbl.length}`);
for (const r of dbl.slice(0, 8)) console.log(`   G${r[0]}  ${r[1]}\n      ${JSON.stringify(r[2].slice(0, 70))}`);
if (dbl.length > 8) console.log(`   … 另有 ${dbl.length - 8} 条`);

console.log(`\n用【单空格】分隔的词条: ${sgl.length}`);
for (const r of sgl.slice(0, 8)) console.log(`   G${r[0]}  ${r[1]}\n      ${JSON.stringify(r[2].slice(0, 70))}`);
if (sgl.length > 8) console.log(`   … 另有 ${sgl.length - 8} 条`);

console.log(`\n结论：${dbl.length > sgl.length ? "双空格" : "单空格"} 是多数约定（${Math.max(dbl.length, sgl.length)} vs ${Math.min(dbl.length, sgl.length)}）`);
if (dbl.length && sgl.length) {
  console.log(`⚠️  存在混用，建议统一为多数派（仅空白，无语义影响）。`);
}
console.log(bar);

/**
 * 文本卫生深度体检（打印校对前置）
 *
 * proofread_qc.mjs 只查 3 项（空中文 / 空音标 / 单元内重复）。
 * 本脚本补查肉眼在打印稿上几乎看不出来的问题：
 *
 *   1. 首尾空白 / 连续双空格（英文、中文、音标）
 *   2. 英文串里混入中文字符或全角标点
 *   3. 英文串里的奇怪字符（不可见字符、直弯引号混用、破折号变体）
 *   4. 音标格式不一致（是否用 / / 或 [ ] 包裹）
 *   5. 单词类首字母大写（英文词条除专有名词外应全小写）
 *   6. 超长英文（>70 字符，打印会折行难读）
 *   7. 单元内重复（同单元同文本）
 *   8. 跨单元重复（信息项，正常现象，只报 top）
 *
 * 用法：node scripts/text_hygiene_qc.mjs [line]
 */
import { build as rolldownBuild } from "rolldown";
import { unlinkSync } from "node:fs";

const line = process.argv[2] ?? "renjiao3";
const TMP = ".tmp-hygiene-qc.mjs";
process.on("exit", () => {
  try { unlinkSync(TMP); } catch {}
});

await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
const mod = await import(`../${TMP}?v=${Date.now()}`);
const CUR = mod.CURRICULA?.[line] ?? [];

// ── 判定用正则 ──
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const FULLWIDTH = /[\uff00-\uffef\u3000]/;
// 不可见 / 零宽 / 不换行空格 / 软连字符
const INVISIBLE = /[\u200b-\u200f\u00ad\u2060\ufeff\u00a0]/;
const ODD_DASH = /[\u2010-\u2015\u2212]/;
const CURLY_QUOTE = /[\u2018\u2019\u201c\u201d]/;

const issues = {
  whitespace: [],   // 首尾空白或双空格
  cjkInEn: [],      // 英文串含中文/全角
  invisible: [],    // 不可见字符
  dash: [],         // 破折号变体
  curly: [],        // 弯引号
  ipaFmt: [],       // 音标未包裹
  capWord: [],      // 单词类首字母大写
  tooLong: [],      // 超长
  dupInUnit: [],    // 单元内重复
};
const crossDup = new Map(); // text -> [tag,...]
const ipaStyles = { slash: 0, bracket: 0, bare: 0 };
let total = 0;

for (const u of CUR) {
  const tag = `G${u.grade}·U${u.unit} ${u.title}`;
  const seen = new Set();
  for (const e of u.entries) {
    total++;
    const en = e.english ?? "";
    const cn = e.chinese ?? "";
    const ph = e.phonetic ?? "";
    const t = e.type ?? "";

    for (const [label, v] of [["en", en], ["cn", cn], ["ph", ph]]) {
      if (v !== v.trim() || v.includes("  ")) {
        issues.whitespace.push([tag, label, JSON.stringify(v), en]);
      }
    }
    if (CJK.test(en) || FULLWIDTH.test(en)) issues.cjkInEn.push([tag, en, cn]);
    if (INVISIBLE.test(en + cn + ph)) issues.invisible.push([tag, JSON.stringify(en), JSON.stringify(ph)]);
    if (ODD_DASH.test(en + cn)) issues.dash.push([tag, en]);
    if (CURLY_QUOTE.test(en + cn)) issues.curly.push([tag, en]);

    if (ph.trim()) {
      const s = ph.trim();
      if (s.startsWith("/") && s.endsWith("/")) ipaStyles.slash++;
      else if (s.startsWith("[") && s.endsWith("]")) ipaStyles.bracket++;
      else { ipaStyles.bare++; issues.ipaFmt.push([tag, en, ph]); }
    }
    // 单词类（无空格）首字母大写，且整串不是全大写缩写
    if (t === "word" && !en.includes(" ") && /^[A-Z]/.test(en) && en !== en.toUpperCase()) {
      issues.capWord.push([tag, en, cn]);
    }
    if (en.length > 70) issues.tooLong.push([tag, en.length, en]);

    const k = en.trim().toLowerCase();
    if (k) {
      if (seen.has(k)) issues.dupInUnit.push([tag, en, cn]);
      seen.add(k);
      if (!crossDup.has(k)) crossDup.set(k, []);
      crossDup.get(k).push(tag);
    }
  }
}

const bar = "=".repeat(70);
console.log(bar);
console.log(` 文本卫生深度体检 · ${line}   （${CUR.length} 单元 / ${total} 词条）`);
console.log(bar);

const show = (name, rows, n = 12, note = "") => {
  console.log(`\n【${name}】 ${rows.length} 条 ${note}`);
  for (const r of rows.slice(0, n)) console.log("   " + r.join("  |  "));
  if (rows.length > n) console.log(`   … 另有 ${rows.length - n} 条`);
};

show("首尾空白 / 连续双空格", issues.whitespace);
show("英文串混入中文或全角标点", issues.cjkInEn);
show("不可见字符（零宽/不换行空格/软连字符）", issues.invisible);
show("破折号变体（– — ‒ 等）", issues.dash);
show("弯引号（' \" 等）", issues.curly);
show("音标未用 / / 或 [ ] 包裹", issues.ipaFmt);
show("单词类首字母大写", issues.capWord);
show("英文超长（>70 字符，打印会折行）", issues.tooLong);
show("单元内重复", issues.dupInUnit, 12, "（同单元同文本）");

console.log(`\n【音标包裹风格统计】 /…/ ${ipaStyles.slash}  [ ] ${ipaStyles.bracket}  裸写 ${ipaStyles.bare}`);

const cross = [...crossDup.entries()].filter(([, v]) => v.length > 1)
  .sort((a, b) => b[1].length - a[1].length);
console.log(`\n【跨单元重复】 共 ${cross.length} 个文本出现 >1 次（教材中复现属正常，仅列 top 10）`);
for (const [k, v] of cross.slice(0, 10)) {
  console.log(`   ${String(v.length).padStart(2)}×  ${k.slice(0, 44).padEnd(46)} ${v.slice(0, 2).join(", ")}`);
}

const bad = Object.values(issues).reduce((a, r) => a + r.length, 0);
console.log("\n" + bar);
console.log(bad === 0 ? " ✅ 未发现文本卫生问题" : ` 合计 ${bad} 条待确认问题`);
console.log(bar);

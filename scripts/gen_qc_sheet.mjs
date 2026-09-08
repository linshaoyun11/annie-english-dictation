/**
 * 生成「待补全清单」——可打印 A4，配合校对文档使用。
 *
 * 列出校对文档里发现的所有数据缺口，每条右侧留空供手写补充：
 *   1. 中文释义为空
 *   2. 单词/短语缺音标（句子无音标属正常，不计入）
 *   3. 多词性分隔符不一致（双空格 vs 主流 " / "）—— 需确认，不自动改
 *   4. 超长英文（打印会折行）—— 仅需留意
 *
 * 数据来源以用户截图为准，本脚本**不自动补全、不自动规范化**，只做清单。
 *
 * 用法：node scripts/gen_qc_sheet.mjs renjiao3
 */
import { writeFileSync, unlinkSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const line = process.argv[2] ?? "renjiao3";
const outFlag = process.argv.indexOf("--out");
const outPath =
  outFlag > -1
    ? process.argv[outFlag + 1]
    : `.workbuddy/proofread/待补全清单-${line}.html`;

const TMP = ".tmp-qc-sheet.mjs";
process.on("exit", () => { try { unlinkSync(TMP); } catch {} });

await rolldownBuild({ input: ["src/data/curriculum.ts"], output: { file: TMP, format: "esm" }, logLevel: "silent" });
const mod = await import(`../${TMP}?v=${Date.now()}`);
const CUR = mod.CURRICULA?.[line] ?? [];

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const TYPE_CN = { word: "单词", phrase: "短语", sentence: "句子" };

const noCn = [];
const noPh = [];
const sepDbl = [];
const tooLong = [];

// 多词性分隔符：主流用 " / "（如 v. / n. 微笑），少数用双空格
const POS = "(?:n|v|adj|adv|prep|conj|pron|num|int|art|aux|vt|vi|abbr)";
const dblRe = new RegExp(`  (?=${POS}\\.)`);

for (const u of CUR) {
  for (const e of u.entries) {
    const where = `G${u.grade}·U${u.unit} ${u.title}`;
    if (!(e.chinese ?? "").trim()) noCn.push({ where, en: e.english, ph: e.phonetic, type: e.type });
    else if (!(e.phonetic ?? "").trim() && e.type !== "sentence")
      noPh.push({ where, en: e.english, cn: e.chinese, type: e.type });
    else if (!(e.phonetic ?? "").trim() && e.type === "sentence") {
      /* 句子无音标属正常 */
    }
    if (dblRe.test((e.chinese ?? "").trim()))
      sepDbl.push({ where, en: e.english, cn: e.chinese, type: e.type });
    if ((e.english ?? "").length > 70)
      tooLong.push({ where, en: e.english, cn: e.chinese, type: e.type, len: e.english.length });
  }
}

function block(title, hint, rows, cols) {
  if (!rows.length) return `<h2>${title}</h2><p class="none">✅ 无</p>`;
  const trs = rows
    .map((r, i) => `<tr><td class="seq">${i + 1}</td>${cols(r)}</tr>`)
    .join("\n");
  return `<h2>${title}<span class="cnt">${rows.length} 条</span></h2>
  <p class="hint">${hint}</p>
  <table><thead><tr><th>#</th>${cols.header}</tr></thead>
  <tbody>
${trs}
  </tbody></table>`;
}

const cnCols = (r) =>
  `<td class="where">${esc(r.where)}</td><td class="en">${esc(r.en)}</td>` +
  `<td class="ph">${esc(r.ph) || "—"}</td><td>${esc(TYPE_CN[r.type] ?? r.type)}</td>` +
  `<td class="fill"></td>`;
cnCols.header = `<th>位置</th><th>English</th><th>音标</th><th>类型</th><th>请补中文释义</th>`;

const phCols = (r) =>
  `<td class="where">${esc(r.where)}</td><td class="en">${esc(r.en)}</td>` +
  `<td class="cn">${esc(r.cn)}</td><td>${esc(TYPE_CN[r.type] ?? r.type)}</td>` +
  `<td class="fill"></td>`;
phCols.header = `<th>位置</th><th>English</th><th>中文</th><th>类型</th><th>请补音标</th>`;

// 「确认类」条目：不要求补写，只提示核对（末列是说明而非留空）
const sepCols = (r) =>
  `<td class="where">${esc(r.where)}</td><td class="en">${esc(r.en)}</td>` +
  `<td class="cn">${esc(r.cn)}</td><td>${esc(TYPE_CN[r.type] ?? r.type)}</td>` +
  `<td class="note">统一？</td>`;
sepCols.header = `<th>位置</th><th>English</th><th>中文（双空格分隔）</th><th>类型</th><th>核对</th>`;

const longCols = (r) =>
  `<td class="where">${esc(r.where)}</td><td class="en">${esc(r.en)}</td>` +
  `<td class="seq">${r.len}</td><td>${esc(TYPE_CN[r.type] ?? r.type)}</td>` +
  `<td class="note">会折行</td>`;
longCols.header = `<th>位置</th><th>English</th><th>字符</th><th>类型</th><th>核对</th>`;

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>待补全清单 · ${line}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font: 10pt/1.6 "Segoe UI","Microsoft YaHei","PingFang SC",sans-serif; color:#111; margin:0; }
  h1 { font-size:16pt; margin:0 0 4px; padding-bottom:8px; border-bottom:2px solid #333; }
  .meta { font-size:9pt; color:#666; margin-bottom:14px; }
  h2 { font-size:12pt; margin:18px 0 4px; padding:4px 8px; background:#eef3fa;
       border-left:3px solid #4a6fa5; }
  h2 .cnt { float:right; font-size:9pt; font-weight:400; color:#666; }
  .hint { font-size:8.5pt; color:#888; margin:2px 0 8px; }
  .none { color:#059669; font-weight:600; }
  table { width:100%; border-collapse:collapse; }
  thead { display:table-header-group; }
  th { font-size:8.5pt; text-align:left; padding:3px 5px; border-bottom:1px solid #ccc;
       background:#fafafa; color:#555; }
  td { padding:3px 5px; border-bottom:1px solid #eee; vertical-align:top; }
  tr { break-inside:avoid; }
  .seq { width:30px; text-align:right; color:#999; font-size:8.5pt; }
  .where { width:26%; font-size:8.5pt; color:#666; }
  .en { width:22%; font-weight:600; }
  .ph { width:16%; font-size:9pt; color:#555; }
  .cn { width:22%; }
  .fill { border-bottom:1px solid #bbb; min-width:90px; }
  .note { font-size:8.5pt; color:#a15c07; white-space:nowrap; }
</style></head>
<body>
  <h1>待补全清单 · ${line}</h1>
  <div class="meta">
    生成时间 ${new Date().toISOString().slice(0, 10)} ｜
    共 ${CUR.reduce((s, u) => s + u.entries.length, 0)} 词条 ｜
    <b>待补中文 ${noCn.length}</b> ｜ <b>待补音标 ${noPh.length}</b> ｜
    <b>格式待确认 ${sepDbl.length + tooLong.length}</b>
    <br>本清单只列缺口、不自动补全 —— 数据一律以教材截图为准，请在右侧空栏手写后录入。
  </div>
${block("一、缺中文释义", "下列词条没有中文翻译，App 里会显示空白。多为 G7 预备单元的日常用语。", noCn, cnCols)}
${block("二、单词/短语缺音标", "句子本就没有音标（属正常，未列入）；下列是单词与短语，缺失会影响学习体验。", noPh, phCols)}
${block("三、多词性分隔符不一致（仅核对，勿自动改）", "主流写法是 <b>v. / n. 微笑；笑</b>（斜杠分隔）；下列 27 条用<b>双空格</b>分隔，来自 G7 截图原文。请翻教材确认后决定是否统一 —— 未确认前不要改数据。", sepDbl, sepCols)}
${block("四、超长英文（仅留意）", "下列英文超过 70 字符，A4 打印会折行，对照时按整句读即可，不是数据问题。", tooLong, longCols)}
</body></html>`;

writeFileSync(outPath, html, "utf8");
console.log(`✅ ${outPath}`);
console.log(`   待补中文 ${noCn.length} ／ 待补音标 ${noPh.length} ／ 格式待确认 ${sepDbl.length + tooLong.length}`);

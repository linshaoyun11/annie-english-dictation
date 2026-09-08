/**
 * 生成「词条校对文档」——可打印的 A4 HTML，供人工对照纸质教材逐条校对。
 *
 * 用法：
 *   node scripts/gen_proofread_doc.mjs renjiao3 3
 *   node scripts/gen_proofread_doc.mjs renjiao3 3,4,5 --out docs/proofread-renjiao3.html
 *   node scripts/gen_proofread_doc.mjs renjiao3 3 --no-kebiao   # 排除课标补全单元
 *
 * 排版：A4 纵向、按年级分页、每词条一行、右侧留手写批改栏。
 */
import { writeFileSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";

const line = process.argv[2] ?? "renjiao3";
const gradesArg = process.argv[3] ?? "";
const noKebiao = process.argv.includes("--no-kebiao");

const outFlagIdx = process.argv.indexOf("--out");
const outPath =
  outFlagIdx > -1
    ? process.argv[outFlagIdx + 1]
    : `.workbuddy/proofread/proofread-${line}${gradesArg ? "-g" + gradesArg.replace(/,/g, "") : ""}.html`;

const TMP = ".tmp-proofread.mjs";
await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
process.on("exit", () => {
  try {
    require("node:fs").unlinkSync(TMP);
  } catch {}
});

const mod = await import(`../${TMP}`);
const CUR = mod.CURRICULA?.[line];
if (!Array.isArray(CUR)) {
  console.error(`未找到教材线 "${line}"，可选：`, Object.keys(mod.CURRICULA ?? {}));
  process.exit(2);
}

const gradeFilter = gradesArg
  ? new Set(gradesArg.split(",").map((g) => Number(g.trim())))
  : null;

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 按年级聚合
const byGrade = new Map();
for (const u of CUR) {
  if (gradeFilter && !gradeFilter.has(u.grade)) continue;
  const isKebiao = /课标/.test(u.title ?? "");
  if (noKebiao && isKebiao) continue;
  if (!byGrade.has(u.grade)) byGrade.set(u.grade, []);
  byGrade.get(u.grade).push({ ...u, isKebiao });
}

let seq = 0;
let totalEntries = 0;
const gradeBlocks = [];

for (const [grade, units] of [...byGrade.entries()].sort((a, b) => a[0] - b[0])) {
  const unitBlocks = units
    .slice()
    .sort((a, b) => a.unit - b.unit)
    .map((u) => {
      const rows = u.entries
        .map((e) => {
          seq++;
          totalEntries++;
          // ⚠️ 字段名是 type，不是 kind（WordEntry 定义见 src/data/mk.ts）
          //    曾写成 e.kind 导致整列空白，校对时看不出词条类型
          const TYPE_CN = { word: "单词", phrase: "短语", sentence: "句子" };
          return `      <tr>
        <td class="seq">${seq}</td>
        <td class="en">${esc(e.english)}</td>
        <td class="ph">${esc(e.phonetic) || "—"}</td>
        <td class="cn">${esc(e.chinese)}</td>
        <td class="kind">${esc(TYPE_CN[e.type] ?? e.type ?? "")}</td>
        <td class="mark"></td>
      </tr>`;
        })
        .join("\n");
      return `    <div class="unit${u.isKebiao ? " kebiao" : ""}">
      <div class="unit-hd">
        <span class="unit-no">G${grade} · U${u.unit}</span>
        <span class="unit-title">${esc(u.title)}</span>
        <span class="unit-cnt">${u.entries.length} 条</span>
      </div>
      <table>
        <thead><tr><th>#</th><th>English</th><th>音标</th><th>中文</th><th>类型</th><th>校对</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>`;
    })
    .join("\n");

  gradeBlocks.push(`  <section class="grade">
    <h2 class="grade-hd">${grade} 年级<span class="grade-sub">${units.length} 单元</span></h2>
${unitBlocks}
  </section>`);
}

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>词条校对 · ${line}${gradesArg ? ` · G${gradesArg}` : ""}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 10pt; color: #111; margin: 0; padding: 0;
  }
  h1.doc-hd {
    font-size: 17pt; margin: 0 0 4px; padding-bottom: 8px;
    border-bottom: 2px solid #333;
  }
  .meta { font-size: 9pt; color: #666; margin-bottom: 16px; }
  .meta b { color: #111; }
  .grade { page-break-before: always; }
  .grade:first-of-type { page-break-before: auto; }
  .grade-hd {
    font-size: 14pt; margin: 0 0 10px; padding: 5px 0;
    border-bottom: 1px solid #999;
  }
  .grade-sub { font-size: 9pt; font-weight: normal; color: #888; margin-left: 10px; }
  .unit { margin-bottom: 14px; break-inside: auto; }
  .unit.kebiao .unit-hd { background: #f0f0f0; }
  .unit-hd {
    display: flex; align-items: baseline; gap: 10px;
    padding: 4px 7px; background: #eef3fa; border-left: 3px solid #4a6fa5;
    font-size: 10pt;
  }
  .unit-no { font-weight: 700; color: #2b4a7d; white-space: nowrap; }
  .unit-title { flex: 1; font-weight: 600; }
  .unit-cnt { font-size: 8.5pt; color: #777; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th {
    font-size: 8.5pt; font-weight: 600; color: #555; text-align: left;
    padding: 3px 5px; border-bottom: 1px solid #ccc; background: #fafafa;
  }
  td { padding: 2.5px 5px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr { break-inside: avoid; }
  .seq { width: 34px; color: #999; font-size: 8.5pt; text-align: right; }
  .en { width: 30%; font-weight: 600; }
  .ph { width: 20%; font-family: "Segoe UI", sans-serif; color: #555; font-size: 9pt; }
  .cn { width: 30%; }
  .kind { width: 42px; font-size: 8pt; color: #999; }
  .mark { width: 46px; border-bottom: 1px solid #ddd; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <h1 class="doc-hd">词条校对表 · ${line}</h1>
  <div class="meta">
    生成时间 ${new Date().toISOString().slice(0, 10)} ｜
    年级 <b>${gradesArg || "全部"}</b> ｜
    单元 <b>${[...byGrade.values()].reduce((s, u) => s + u.length, 0)}</b> ｜
    词条 <b>${totalEntries}</b>
    ${noKebiao ? "｜<b>已排除课标补全单元</b>" : "｜含课标补全单元（灰底）"}
  </div>
${gradeBlocks.join("\n")}
</body>
</html>
`;

writeFileSync(outPath, html, "utf8");
console.log(`✅ 已生成校对文档：${outPath}`);
console.log(`   年级 ${[...byGrade.keys()].sort((a, b) => a - b).join(", ")}`);
console.log(`   单元 ${[...byGrade.values()].reduce((s, u) => s + u.length, 0)} ／ 词条 ${totalEntries}`);

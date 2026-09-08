/**
 * 运行时核验：真实执行 renai.ts，检查
 *   1) 单元数 / 年级分布 / 词条数
 *   2) mkWithPrefix 生成的 id 是否与 scripts 生成音频时用的规则一致
 *   3) 每个词条的文本在 manifest 里都能查到，且指向的 mp3 真实存在
 *
 * 用法：node scripts/verify_renai_runtime.mjs
 *
 * 说明：renai.ts 是 TS，node 直接 import 不了，所以先用 rolldown 转成 ESM
 * 临时文件再动态 import，用完删除。
 * 用 rolldown 而非 esbuild / npx：rolldown 随 vite 8 一起装在本地，
 * 不联网；esbuild 不在 package.json 里（npx 会临时去 registry 拉）；
 * 且 Windows 下 execFileSync 直接调 npx 会 ENOENT（npx 本质是 .cmd）。
 */
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { build as rolldownBuild } from "rolldown";

const TMP = ".tmp-renai-runtime.mjs";
await rolldownBuild({
  input: ["src/data/renai.ts"],
  output: { file: TMP, format: "esm" },
  // rolldown 的 logLevel 只接受 debug|info|warn|silent，没有 "error"（传了会抛
  // "Unexpected log level"）。这里只想要静默，故用 silent。
  logLevel: "silent",
});
process.on("exit", () => {
  if (existsSync(TMP)) unlinkSync(TMP);
});

const { RENAI_CURRICULUM } = await import(`../${TMP}`);

const us = JSON.parse(readFileSync("public/audio/manifest.json", "utf8"));
const uk = JSON.parse(readFileSync("public/audio/manifest-uk.json", "utf8"));

const norm = (s) => s.trim().toLowerCase();

let bad = 0;
const fail = (msg) => {
  console.log("  ❌ " + msg);
  bad++;
};
const ok = (msg) => console.log("  ✅ " + msg);

// ---- 1. 结构 ----
const byGrade = {};
let total = 0;
for (const u of RENAI_CURRICULUM) {
  byGrade[u.grade] = (byGrade[u.grade] ?? 0) + 1;
  total += u.entries.length;
}
console.log("【结构】");
console.log("  单元数:", RENAI_CURRICULUM.length, "| 年级分布:", JSON.stringify(byGrade));
console.log("  词条数:", total);
console.log("  其中课标补全单元:", RENAI_CURRICULUM.filter((u) => u.title.startsWith("课标词汇")).length);

// 期望值说明（改动 renai.ts 的 applyKebiaoTo 参数后要同步改这里）：
//   教材本体 66 单元 = 7年级 24 + 8年级 24 + 9年级 18（九下只有 Unit 5、6）
//   课标补全 75 单元 = 小学 313 词→7年级 21 单元 + 初中 784 词→8/9年级各 27 单元
//   ⇒ 合计 141 单元，年级分布 7:45 / 8:51 / 9:45，词条 885 + 1097 = 1982
RENAI_CURRICULUM.length === 141
  ? ok("单元数 141（教材 66 + 课标 75）")
  : fail(`单元数 ${RENAI_CURRICULUM.length} != 141`);
byGrade[7] === 45 && byGrade[8] === 51 && byGrade[9] === 45
  ? ok("年级分布 7:45 / 8:51 / 9:45")
  : fail("年级分布不符");
total === 1982 ? ok("词条数 1982（885 + 1097 课标）") : fail(`词条数 ${total} != 1982`);

// ---- 2. id 规则 ----
const entries = RENAI_CURRICULUM.flatMap((u) => u.entries);
console.log("\n【id 规则】");
const ids = RENAI_CURRICULUM.flatMap((u) => u.entries.map((e) => e.id));
ids.every((id) => /^ra-g[789]u\d+e\d{4}$/.test(id))
  ? ok("全部 id 形如 ra-g{7,8,9}u{n}e{0001+}")
  : fail("存在不符合规则的 id: " + ids.find((i) => !/^ra-g[789]u\d+e\d{4}$/.test(i)));
new Set(ids).size === ids.length
  ? ok(`id 全局唯一 (${ids.length})`)
  : fail(`id 有重复，唯一 ${new Set(ids).size} / ${ids.length}`);

// ---- 2.5 单元编号连续性 + 重复文本 ----
console.log("\n【单元编号与重复】");
for (const g of [7, 8, 9]) {
  const nums = RENAI_CURRICULUM.filter((u) => u.grade === g).map((u) => u.unit);
  const expect = Array.from({ length: nums.length }, (_, i) => i + 1);
  const cont = nums.every((n, i) => n === expect[i]);
  // 连续性同时就是「撞号检测」：applyKebiaoTo 的 lastUnitOfGrade 是一次性
  // 预计算的，若 elemGrades 与 midGrades 含同一年级，两边会都从同一个号开始，
  // 这里就会因出现重复号而失败。
  cont ? ok(`年级${g} 单元编号 1..${nums.length} 连续（无撞号）`) : fail(`年级${g} 编号不连续: ${nums}`);
}

// 单元内重复是硬伤（同一单元出现两次同一个词）；跨单元重复可接受
// （教材本身会在不同 Topic 复现词汇），这里只统计、不判失败。
let dupInUnit = 0;
for (const u of RENAI_CURRICULUM) {
  const keys = u.entries.map((e) => norm(e.english));
  if (new Set(keys).size !== keys.length) {
    dupInUnit++;
    fail(`单元内重复 g${u.grade}u${u.unit}`);
  }
}
if (!dupInUnit) ok("单元内无重复文本");

const allKeys = entries.map((e) => norm(e.english));
const dupCross = allKeys.length - new Set(allKeys).size;
console.log(
  `  跨单元重复文本: ${dupCross} 条（教材复现，可接受）`
);

// ---- 3. 音频覆盖 ----
console.log("\n【音频覆盖】（按词条文本查 manifest，再看 mp3 是否存在）");
let missUs = 0,
  missUk = 0,
  missFileUs = 0,
  missFileUk = 0;
for (const e of entries) {
  const key = norm(e.english);
  const a = us[key];
  const b = uk[key];
  if (!a) missUs++;
  else if (!existsSync(join("public/audio", `${a}.mp3`))) missFileUs++;
  if (!b) missUk++;
  else if (!existsSync(join("public/audio", `${b}.mp3`))) missFileUk++;
}
console.log(`  美音: ${entries.length - missUs}/${entries.length} 命中 manifest`);
console.log(`  英音: ${entries.length - missUk}/${entries.length} 命中 manifest`);
missUs === 0 ? ok("美音全命中") : fail(`美音缺 ${missUs}`);
missUk === 0 ? ok("英音全命中") : fail(`英音缺 ${missUk}`);
missFileUs === 0 ? ok("美音 mp3 均存在") : fail(`美音 mp3 缺文件 ${missFileUs}`);
missFileUk === 0 ? ok("英音 mp3 均存在") : fail(`英音 mp3 缺文件 ${missFileUk}`);

// ---- 4. 抽查：任取 5 个词条打印其解析到的音频 id ----
console.log("\n【抽查】");
for (const e of [entries[0], entries[200], entries[400], entries[600], entries.at(-1)]) {
  const key = norm(e.english);
  console.log(
    `  ${e.id}  ${e.english.slice(0, 30).padEnd(32)} → us:${us[key] ?? "-"}  uk:${uk[key] ?? "-"}`
  );
}

console.log(bad === 0 ? "\n✅ 运行时核验全部通过" : `\n❌ ${bad} 项失败`);
process.exit(bad === 0 ? 0 : 1);

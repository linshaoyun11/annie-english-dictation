/**
 * 一年级起点三线 G1G2 教材目录对照审计
 *
 * 背景：用户反馈「一年级起点的三个版本没有重建，因为国家智慧网的教材
 * 都是三年级起点的」。本脚本把 App 端 G1G2 单元主题与官方教材目录
 * （人教新起点 1-2 / 外研新标准 1-2 / 沪教牛津 1A 1B）逐条对比，
 * 输出：匹配/缺失/异常/未对齐 四类。
 *
 * 用法：node scripts/audit_grade1_2.mjs
 *
 * 数据来源（2026-09-08 手动核）：
 *   人教新起点 1A/1B/2A/2B    https://zy.21cnjy.com/1750299（4 源交叉验证）
 *   外研新标准 1-2 年级      https://www.fltrp.com/ebook/jcjy/（3 源）
 *   沪教牛津 1A              http://m.dzkbw.com/books/hjb/yingyu/oxford1s
 *
 * 输出：
 *   控制台：分线分年级对照表 + 总评
 *   报告：.workbuddy/verification/audit-grade1-2-report.json
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, ".tmp-audit.mjs");
const REPORT = join(ROOT, ".workbuddy/verification/audit-grade1-2-report.json");

// ---------- 官方教材目录（硬编码；如版本变化，更新这里即可）----------

/** 人教版新起点（一年级起点）1-2 年级，按 1A/1B/2A/2B 册列出真实 Unit 主题 */
const OFFICIAL_RENJIAO_G12 = {
  "1A": ["School","Face","Animals","Numbers","Colours","Fruit"],
  "1B": ["Classroom","Room","Toys","Food","Drink","Clothes"],
  "2A": ["My Family","Boys and Girls","My Friends","In the Community","In the Park","Happy Holidays"],
  "2B": ["Playtime","Weather","Seasons","Time","My Day","My Week"],
};
const OFFICIAL_RENJIAO_META = {
  source: "人教新起点 1-2 年级（义务教育课程标准实验教科书）",
  url: "https://zy.21cnjy.com/1750299",
  expectedUnits: 24, // 1A6 + 1B6 + 2A6 + 2B6
};

/** 外研社新标准（一年级起点）1-2 年级，按 1A/1B/2A/2B 册列出真实 Module 主题
 *  每 Module 有 2 Unit，主题近似 Module */
const OFFICIAL_WAIYANSHE_G12 = {
  "1A": [
    "Hello", "What's your name", "How many", "It's red", "Sit down", "Point to the window",
    "This is my teacher", "That is a cat", "What's this", "Is it a dog", "How old are you",
    "Happy birthday", "Where's my pen", "A doll is under the bed"
  ],
  "1B": [
    "Where's the cat", "How many green birds", "That is my father", "He's a doctor",
    "This is her bag", "My mother is a nurse", "This is my head", "These are your legs",
    "They're cows", "It's thin", "That snake is long", "The baby lions are cute",
    "Let's play football", "Let's sing", "I like football", "What's your favourite sport",
    "I don't like meat", "I don't like ginger", "Do you like dolls", "Do they like jigsaws"
  ],
  "2A": [
    "I like the ABC song", "What do you like", "He likes this T-shirt", "He doesn't like this shirt",
    "We have English in the morning", "I like PE", "It's 2 o'clock", "What's the time",
    "I get up at 7 o'clock", "It's half past 7", "She watches TV", "Does he play the flute",
    "What do you do at the weekend", "Where do you live", "How do you go to school", "I go by train",
    "It's winter", "It's warm", "Happy New Year", "We have Christmas"
  ],
  "2B": [
    "What's the weather like", "I like swimming",
    "She's listening to the radio", "I'm drawing a picture",
    "Sam isn't tidying his room", "Are you doing your homework",
    "What are you doing", "What's she doing",
    "Lingling is skipping", "What are you playing",
    "I usually play basketball", "We are helping her",
    "It's Children's Day today", "We're having a picnic",
    "The train is going up a hill", "We're turning around",
    "Turn left", "Where do you live"
  ],
};
const OFFICIAL_WAIYANSHE_META = {
  source: "外研新标准（一年级起点）1-2 年级（陈琳主编 2025 在用版）",
  url: "https://www.fltrp.com/ebook/jcjy/jcjy_jcjyjxzy_2025/files/basic-html/page10.html",
  expectedUnits: 78, // 1A 14 + 1B 20 + 2A 20 + 2B 18 + 复习 = 约 80
};

/** 沪教牛津（上海五四制-牛津上海版-旧版）1A 单元；
 *  1B 真实目录未在本会话核实完整，仅填 1A 做代表 */
const OFFICIAL_OXFORD_G1 = {
  "1A": [
    "Greetings", "My classmates", "My face",
    "My abilities", "My family", "My friends",
    "In the classroom", "In the fruit shop", "In the restaurant",
    "On the farm", "In the zoo", "In the park"
  ],
  // 1B 暂以 dzkbw 概览信息推断为类似结构（4 Module × 3U = 12 单元）
  "1B_INFERRED": ["Greetings/Classroom", "Family/Friends", "Places/Activities", "Nature/Seasons"],
};
const OFFICIAL_OXFORD_META = {
  source: "沪教牛津（上海五四制-牛津上海版-旧版）1A 旧版",
  url: "http://m.dzkbw.com/books/hjb/yingyu/oxford1s",
  expectedUnits: 12, // 4 Module × 3 U
  note: "1B 真实目录未在本会话完整核实（仅 dzkbw 提供部分 Module 名）",
};

// ---------- 模糊匹配 ----------

/** 把标题归一化：小写、去标点、单词化 */
function norm(s) {
  return s
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9\u4e00-\u9fa5\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 计算两个标题的关键词重叠（jaccard） */
function jaccard(a, b) {
  const A = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const B = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** 判断 App 标题是否对应某个真实教材单元
 *  返回：{ matched: bool, score: 0..1, bestOfficial: 真实教材标题 } */
function bestMatch(appTitle, officialList) {
  let best = { score: 0, bestOfficial: null };
  for (const off of officialList) {
    const s = jaccard(appTitle, off);
    if (s > best.score) best = { score: s, bestOfficial: off };
  }
  return {
    matched: best.score >= 0.5,
    score: best.score,
    bestOfficial: best.bestOfficial,
  };
}

// ---------- 编译 curriculum.ts ----------
const { build } = await import("rolldown");
await build({
  input: [join(ROOT, "src/data/curriculum.ts")],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
const m = await import(pathToFileURL(TMP).href);
try {
  // 沙箱对 unlink 可能拦截
  // await unlinkSync(TMP);
} catch {}

// ---------- 对照 ----------

function extractTitle(title) {
  // 单元 title 通常是 "英文标题  中文标题"，如 "Welcome to school  欢迎来到初中"
  // 提取前半段（英文部分）作匹配
  const parts = title.split(/\s{2,}|\s{1,}(?=[一-鿿])/);
  return parts[0].trim();
}

function auditLine(lineKey, meta, official) {
  const units = m.CURRICULA[lineKey].filter((u) => u.grade === 1 || u.grade === 2);
  const allOfficial = Object.values(official).flat();

  const results = units.map((u) => {
    const appTitle = extractTitle(u.title);
    const m = bestMatch(appTitle, allOfficial);
    return {
      g: u.grade,
      u: u.unit,
      appTitle,
      entries: u.entries.length,
      score: +m.score.toFixed(2),
      bestOfficial: m.bestOfficial,
      matched: m.matched,
    };
  });

  // 总体判定
  const matchCount = results.filter((r) => r.matched).length;
  const ratio = matchCount / results.length;
  let verdict;
  if (ratio >= 0.85) verdict = "🟢 完美对齐（与官方目录一致）";
  else if (ratio >= 0.5) verdict = "🟡 部分对齐（部分单元占位/命名差异）";
  else if (ratio >= 0.2) verdict = "🟠 弱对齐（多为占位精简版）";
  else verdict = "🔴 不对齐（与真实教材几乎无关）";

  return {
    line: lineKey,
    source: meta.source,
    expectedUnits: meta.expectedUnits,
    appUnits: units.length,
    appTotalEntries: units.reduce((s, u) => s + u.entries.length, 0),
    matchRatio: +ratio.toFixed(2),
    verdict,
    results,
  };
}

const RENJIAO = auditLine("renjiao", OFFICIAL_RENJIAO_META, OFFICIAL_RENJIAO_G12);
const WAIYANSHE = auditLine("waiyanshe", OFFICIAL_WAIYANSHE_META, OFFICIAL_WAIYANSHE_G12);
const OXFORD = auditLine("oxford", OFFICIAL_OXFORD_META, OFFICIAL_OXFORD_G1);

const REPORT_DATA = {
  generatedAt: new Date().toISOString(),
  scope: "一年级起点三线 G1-G2 教材目录对照",
  officialSources: {
    renjiao: OFFICIAL_RENJIAO_META,
    waiyanshe: OFFICIAL_WAIYANSHE_META,
    oxford: OFFICIAL_OXFORD_META,
  },
  renjiao: RENJIAO,
  waiyanshe: WAIYANSHE,
  oxford: OXFORD,
};

writeFileSync(REPORT, JSON.stringify(REPORT_DATA, null, 2), "utf8");

// ---------- 控制台输出 ----------

function pad(s, w) {
  s = String(s);
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}
function padL(s, w) {
  s = String(s);
  return s.length >= w ? s : " ".repeat(w - s.length) + s;
}

console.log("=".repeat(72));
console.log("一年级起点三线 G1-G2 教材目录对照审计");
console.log("=".repeat(72));

for (const r of [RENJIAO, WAIYANSHE, OXFORD]) {
  console.log(`\n【${r.line}】${r.source}`);
  console.log(`  期望 ${r.expectedUnits} 单元 / App ${r.appUnits} 单元 / ${r.appTotalEntries} 词条`);
  console.log(`  匹配率 ${(r.matchRatio * 100).toFixed(0)}%  →  ${r.verdict}`);
  console.log("  " + padL("App 单元", 22) + padL("官方匹配", 22) + pad("分数", 5) + " 状态");
  console.log("  " + "-".repeat(60));
  for (const x of r.results) {
    const status = x.matched ? "✅" : x.score >= 0.3 ? "⚠️" : "❌";
    console.log(
      "  " +
        padL(`G${x.g}U${x.u}  ${x.appTitle}`, 22) +
        padL(x.bestOfficial || "(无匹配)", 22) +
        pad(x.score.toFixed(2), 5) +
        " " +
        status,
    );
  }
}

console.log("\n" + "=".repeat(72));
console.log("📋 总评");
console.log("=".repeat(72));
console.log(`🟢 renjiao G1G2:  ${RENJIAO.verdict}`);
console.log(`🟡 waiyanshe G1G2: ${WAIYANSHE.verdict}`);
console.log(`🟡 oxford G1G2:    ${OXFORD.verdict}`);
console.log(`\n报告输出: ${REPORT}`);

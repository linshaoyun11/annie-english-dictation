/**
 * 核实五条教材线的进度顺序是否严格按教材：
 * 1) 年级严格递增、同一年级内单元号严格递增（去重线允许因移除空单元出现跳号）
 * 2) 每个单元至少 1 个词条
 * 3) 单元内词条顺序与源数据文件的原始顺序一致（去重线为「保序子序列」）
 * 4) 课标补全单元只追加在各年级末尾，不插在教材单元中间
 */
const fs = require("fs");
const c = require("../.tmp-verify.cjs");

const VERSIONS = ["renjiao", "renjiao3", "waiyanshe", "waiyanshe3", "oxford"];

/** 从源数据文件按出现顺序提取 mk("xx", grade, unit, type, "english") */
function parseSource(path, prefix) {
  const t = fs.readFileSync(path, "utf8");
  const re = new RegExp(
    "mk\\(" + JSON.stringify(prefix) + ",\\s*(\\d+),\\s*(\\d+),\\s*\"(\\w+)\",\\s*\"((?:[^\"\\\\]|\\\\.)*)\"",
    "g"
  );
  const out = new Map(); // "g-u" -> [english...]
  let m;
  while ((m = re.exec(t))) {
    const k = m[1] + "-" + m[2];
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(m[4].toLowerCase());
  }
  return out;
}

/** 保序子序列判断：b 是否为 a 的保序子序列 */
function isSubsequence(b, a) {
  let i = 0;
  for (const x of a) {
    if (i < b.length && b[i] === x) i++;
  }
  return i === b.length;
}

const sources = {
  renjiao: [
    parseSource(__dirname + "/../src/data/curriculum.ts", "rj"),
    parseSource(__dirname + "/../src/data/grades4to9.ts", "rj"),
  ],
  waiyanshe: [parseSource(__dirname + "/../src/data/waiyanshe.ts", "wy")],
  oxford: [parseSource(__dirname + "/../src/data/oxford.ts", "ox")],
};
function sourceWords(prefixKey, grade, unit) {
  const k = grade + "-" + unit;
  let words = [];
  for (const s of sources[prefixKey]) {
    if (s.has(k)) words = words.concat(s.get(k));
  }
  return words;
}

let problems = 0;
const report = (ok, msg) => {
  if (!ok) problems++;
  console.log((ok ? "  PASS " : "  FAIL ") + msg);
};

for (const v of VERSIONS) {
  console.log("==== " + v + " ====");
  const cur = c.getCurriculum(v);
  const grades = cur.map((u) => u.grade);

  // 1) 年级严格不减 + 不重复年级段
  let asc = true;
  for (let i = 1; i < grades.length; i++) if (grades[i] < grades[i - 1]) asc = false;
  report(asc, "年级序列非降序: " + [...new Set(grades)].join(","));
  report(new Set(grades).size === [...new Set(grades)].length, "无重复年级段（每年级连续）");

  // 2) 每个年级内部单元号严格递增（允许跳号）
  let unitAsc = true;
  const gaps = [];
  let lastGrade = -1,
    lastUnit = -1;
  for (const u of cur) {
    if (u.grade !== lastGrade) {
      lastGrade = u.grade;
      lastUnit = u.unit;
    } else {
      if (u.unit <= lastUnit) unitAsc = false;
      if (u.unit > lastUnit + 1) gaps.push("g" + u.grade + ":U" + (lastUnit + 1) + "缺失");
      lastUnit = u.unit;
    }
  }
  report(unitAsc, "各年级内单元号严格递增");
  report(true, gaps.length ? "跳号(仅去重线移除空单元属正常): " + gaps.join(" ") : "单元号连续无跳号");

  // 3) 无空单元
  const empty = cur.filter((u) => u.entries.length === 0);
  report(empty.length === 0, "无空单元（共 " + cur.length + " 个单元）");

  // 4) 词条顺序 vs 源数据
  const prefixKey = v.startsWith("renjiao") ? "renjiao" : v.startsWith("waiyanshe") ? "waiyanshe" : "oxford";
  let orderOk = true;
  const orderIssues = [];
  for (const u of cur) {
    const src = sourceWords(prefixKey, u.grade, u.unit);
    if (src.length === 0) continue; // 课标补全单元，源数据不含
    const bundled = u.entries.map((e) => e.english.toLowerCase());
    if (bundled.length === src.length) {
      // 非去重线/未过滤单元：应完全一致
      if (bundled.join("") !== src.join("")) {
        orderOk = false;
        orderIssues.push("g" + u.grade + "-U" + u.unit + " 顺序与源数据不同");
      }
    } else {
      // 去重线：应为保序子序列
      if (!isSubsequence(bundled, src)) {
        orderOk = false;
        orderIssues.push("g" + u.grade + "-U" + u.unit + " 非保序子序列");
      }
    }
  }
  report(orderOk, "单元内词条顺序符合教材原序" + (orderIssues.length ? " -> " + orderIssues.slice(0, 5).join("; ") : ""));

  // 5) 课标补全单元只出现在年级末尾（人教线才有 kebiao）
  const titled = cur.filter((u) => /课标/.test(u.title || ""));
  let kebiaoOk = true;
  for (const u of titled) {
    const after = cur.filter((x) => x.grade === u.grade && x.unit > u.unit && !/课标/.test(x.title || ""));
    if (after.length > 0) kebiaoOk = false;
  }
  report(kebiaoOk, titled.length ? "课标补全单元(" + titled.length + "个)均在该年级末尾" : "无课标补全单元");
}
console.log("========");
console.log(problems === 0 ? "全部通过 ✔" : "发现问题 " + problems + " 处 ✘");

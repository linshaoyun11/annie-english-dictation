import { readFileSync, writeFileSync } from "node:fs";
const FILE = "src/data/grades4to9.ts";
let s = readFileSync(FILE, "utf8");

// 1. 删除 G6U6 起点之前错位的注释
const WRONG_MARK =
  '    ],\n  },\n  // ==================== 六年级下（PEP 六下 旧版，新版要 2027 春才启用） ====================\n  {\n    grade: 6,\n    unit: 6,\n    title: "Energy, nature and us';
const FIXED =
  '    ],\n  },\n  {\n    grade: 6,\n    unit: 6,\n    title: "Energy, nature and us';
const idx1 = s.indexOf(WRONG_MARK);
if (idx1 < 0) { console.error("WRONG_MARK not found"); process.exit(2); }
s = s.slice(0, idx1) + FIXED + s.slice(idx1 + WRONG_MARK.length);

// 2. 在 G6U6 闭合之后、G6U7 起点之前插入正确注释
const G6U6_END_MARK =
  '      mk(6, 6, "sentence", "We should use air conditioners less.", "", "我们应该少用空调。"),\n    ],\n  },\n\n  \n  {\n    grade: 6,\n    unit: 7,';
const G6U6_END_FIXED =
  '      mk(6, 6, "sentence", "We should use air conditioners less.", "", "我们应该少用空调。"),\n    ],\n  },\n  // ==================== 六年级下（PEP 六下 旧版，新版要 2027 春才启用） ====================\n  {\n    grade: 6,\n    unit: 7,';
const idx2 = s.indexOf(G6U6_END_MARK);
if (idx2 < 0) { console.error("G6U6_END_MARK not found"); process.exit(2); }
s = s.slice(0, idx2) + G6U6_END_FIXED + s.slice(idx2 + G6U6_END_MARK.length);

writeFileSync(FILE, s);
console.log("OK, file lines:", s.split("\n").length);

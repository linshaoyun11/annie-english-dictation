import { readFileSync, writeFileSync } from "node:fs";
const FILE = "src/data/grades4to9.ts";
const s = readFileSync(FILE, "utf8");
const MARK = '    ],\n  },\n  {\n    grade: 6,\n    unit: 6,\n    title: "Energy, nature and us';
const NEW = '    ],\n  },\n  // ==================== 六年级下（PEP 六下 旧版，新版要 2027 春才启用） ====================\n  {\n    grade: 6,\n    unit: 6,\n    title: "Energy, nature and us';
const idx = s.indexOf(MARK);
if (idx < 0) {
  console.error("MARK not found");
  process.exit(2);
}
writeFileSync(FILE, s.slice(0, idx) + NEW + s.slice(idx + MARK.length));
console.log("OK, file lines:", s.split("\n").length);

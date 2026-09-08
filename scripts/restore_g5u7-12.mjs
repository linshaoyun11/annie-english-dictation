/**
 * 恢复旧版 G5U7-12（PEP 五下 2013 旧版）到新版 G5U6 之后。
 *
 * 背景：2026 秋是新课标教材「全面落地收官之年」，四五六年级 + 九年级全面启用新教材。
 * 但**每个年级从「上册」开始换新**：五年级 2026 秋刚换五上（新版），
 * 五下的新版要等 **2027 春** 才启用 ⇒ 国家平台现在挂的五下仍是旧版。
 * 所以当前学生手里的五下 = 旧版，必须保留。
 *
 * 用法：node scripts/restore_g5u7-12.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/data/grades4to9.ts";
const OLD_BLOCK_FILE = ".workbuddy/tmp-g5u7-12-old.txt";

let s = readFileSync(FILE, "utf8");
const oldRaw = readFileSync(OLD_BLOCK_FILE, "utf8").split("\n");

// 取旧版 G5U7-12 块：从头（注释）到 G5U12 收尾 "  }," 为止（行 1-102，1-based）
// 形态：... "    ],\n  },\n" + "  // ==================== 六年级上..."（这行不取）
const g6Marker = oldRaw.findIndex((l) => l.includes("六年级上"));
if (g6Marker === -1) {
  console.error("[ERR] 临时文件里找不到六年级上标记");
  process.exit(2);
}
// g6Marker 那行是六上注释，取 [0, g6Marker)
let oldBlock = oldRaw.slice(0, g6Marker).join("\n");
// 去掉尾部多余空行，保证以 "\n" 结尾
oldBlock = oldBlock.replace(/\n+$/, "\n");
// 注释补上版本说明
oldBlock = oldBlock.replace(
  "// ==================== 五年级下（PEP 五下） ====================",
  "// ==================== 五年级下（PEP 五下 旧版，仍在使用） ====================\n  // ⚠️ 五下新版要 2027 春才启用（五年级从 2026 秋五上开始换新教材），\n  //   国家平台现在挂的仍是本旧版。等 2027 春新版出来后再替换。"
);

// 插入点：新版 G5U6 结束之后、六年级上注释之前
const anchor = "  // ==================== 六年级上（PEP 六上） ====================";
const idx = s.indexOf(anchor);
if (idx === -1) {
  console.error("[ERR] 找不到六年级上锚点");
  process.exit(2);
}
// 防重：若已存在 G5U7 则跳过
if (s.includes('mk(5, 7, "phrase", "do morning exercises"')) {
  console.error("[SKIP] 旧版 G5U7-12 已存在，不重复插入");
  process.exit(0);
}

const next = s.slice(0, idx) + oldBlock + s.slice(idx);
writeFileSync(FILE, next, "utf8");
console.log(`[OK] 已恢复旧版 G5U7-12（${oldBlock.split("\n").length} 行）`);

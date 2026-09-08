// 一次性替换 G5U1-13（PEP 五上新版 + 五下用户核实版）
// OLD_START_MARK = G5 注释起点
// OLD_END_MARK = G6 注释起点
// NEW_BLOCK 从 patch_g5u1-12.mjs（U1-6 新版）+ patch_g5u7-13.mjs（U7-13 用户版）拼接

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, "..", "src", "data", "grades4to9.ts");

// 从 patch_g5u1-12.mjs 提取 NEW_BLOCK（U1-6）
const src1 = readFileSync(resolve(__dirname, "patch_g5u1-12.mjs"), "utf8");
const m1 = src1.match(/const NEW_BLOCK = `([\s\S]*?)`;\s*\n\s*\/\/ 旧块定位/s);
if (!m1) {
  console.error("[ERR] patch_g5u1-12.mjs 的 NEW_BLOCK 提取失败");
  process.exit(2);
}
const NB1 = m1[1];

// 从 patch_g5u7-13.mjs 提取 NEW_BLOCK（U7-13）
const src2 = readFileSync(resolve(__dirname, "patch_g5u7-13.mjs"), "utf8");
const m2 = src2.match(/const NEW_BLOCK = `([\s\S]*?)`;/s);
if (!m2) {
  console.error("[ERR] patch_g5u7-13.mjs 的 NEW_BLOCK 提取失败");
  process.exit(2);
}
// patch_g5u7-13.mjs 的 NEW_BLOCK 开头是注释 + { ... U7-13 ... }, 末尾以 `},` 闭合 G5U13
// 截掉末尾的 `},`（让 NB1 末尾的 `},` 衔接）
let NB2 = m2[1];
const lastClose = NB2.lastIndexOf("},");
if (lastClose < 0) {
  console.error("[ERR] patch_g5u7-13.mjs NEW_BLOCK 末尾 `},` 找不到");
  process.exit(2);
}
// 保留 `},` 闭合（NB1 的 U6 闭合 + NB2 的 U7-13 拼起来）
const NEW_BLOCK = NB1 + "\n" + NB2;

// OLD 段：从 G5 起点注释到 G5U12 末句 + G5U12 闭合 `},` 之后（Windows CRLF）
const OLD_START_MARK = "// ==================== 五年级上（PEP 五上） ====================";
const OLD_END_MARK =
  'mk(5, 12, "sentence", "The children are reading quietly.", "", "孩子们在安静地读书。"),\r\n    ],\r\n  },';

const target = readFileSync(FILE, "utf8");
const startIdx = target.indexOf(OLD_START_MARK);
if (startIdx < 0) {
  console.error("[ERR] OLD_START_MARK 未找到");
  process.exit(2);
}
const endIdx = target.indexOf(OLD_END_MARK, startIdx);
if (endIdx < 0) {
  console.error("[ERR] OLD_END_MARK 未找到");
  process.exit(2);
}

const before = target.slice(0, startIdx);
const after = target.slice(endIdx + OLD_END_MARK.length);
const next = before + NEW_BLOCK + after;

writeFileSync(FILE, next, "utf8");
console.log(`[OK] G5U1-13 整段替换完成`);
console.log(`  旧段长度: ${endIdx - startIdx} 字符`);
console.log(`  新段长度: ${NEW_BLOCK.length} 字符`);
console.log(`  文件总行: ${target.split("\n").length} → ${next.split("\n").length}`);
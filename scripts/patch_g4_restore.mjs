/**
 * 恢复 renjiao3 G4 段（四上 U1-6 + 四下 U7-13）
 *
 * 背景：2026-09-04 用户拍了 PEP 四上 9 张 + 四下 9 张截图，按截图录入
 *       四上 151 词条 + 四下（含 Numbers 附录）175 词条，tsc/vite 均通过。
 *       但数据在后续操作中被回滚丢失，grades4to9.ts 里 G4 段回到了
 *       PEP 2012 旧版（12 单元 × 10 词 = 120 词条）。
 *
 * 本脚本从 scripts/patch_g4u1-6.mjs 与 scripts/patch_g4u7-12.mjs 中
 * 抽出当时按用户截图写入的 newBlock，合并后一次性替换 G4 整段。
 *
 * 数据来源 = 用户截图（2026-09-04），不用任何第三方/推测数据。
 *
 * 用法: node scripts/patch_g4_restore.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const TARGET = "src/data/grades4to9.ts";
const SRC_UP = "scripts/patch_g4u1-6.mjs"; // 四上 U1-6
const SRC_DOWN = "scripts/patch_g4u7-12.mjs"; // 四下 U7-13

// ---- 1. 从旧脚本抽出当时按截图录入的 newBlock ----
function extractBlock(file, varName) {
  const text = readFileSync(file, "utf8");
  const re = new RegExp("const " + varName + " = `([\\s\\S]*?)`;\\n");
  const m = text.match(re);
  if (!m) throw new Error(`无法从 ${file} 中提取 ${varName}`);
  return m[1];
}

const blockUp = extractBlock(SRC_UP, "newBlock");
const blockDown = extractBlock(SRC_DOWN, "NEW_BLOCK");

const cntUp = (blockUp.match(/^\s*mk\(4, [1-6],/gm) || []).length;
const cntDown = (blockDown.match(/^\s*mk\(4, (7|8|9|10|11|12|13),/gm) || []).length;
console.log(`四上 U1-6: ${cntUp} 词条（期望 151）`);
console.log(`四下 U7-13: ${cntDown} 词条（期望 175）`);
if (cntUp !== 151 || cntDown !== 175) {
  console.error("❌ 词条数与日志不符，停止执行");
  process.exit(1);
}

// ---- 2. 拼接成完整 G4 段 ----
// blockUp 末尾自带 `  },\n`；blockDown 以 `  // ======... 四年级下 ...` 开头
const NEW_G4 = blockUp + "\n" + blockDown;
// NEW_G4 需要以换行结尾，且不能带多余闭合
if (!NEW_G4.endsWith("\n")) throw new Error("NEW_G4 未以换行结尾");

// ---- 3. 定位并替换 G4 段 ----
const src = readFileSync(TARGET, "utf8");
const CRLF = src.includes("\r\n");
const NL = CRLF ? "\r\n" : "\n";

const START_MARK = "  // ==================== 四年级上（PEP 四上） ====================";
const END_MARK = "  // ==================== 五年级上（PEP 五上 2024 秋新版） ====================";

const startIdx = src.indexOf(START_MARK);
const endIdx = src.indexOf(END_MARK);
if (startIdx < 0) throw new Error("找不到 G4 段起点（四年级上 注释）");
if (endIdx < 0) throw new Error("找不到 G4 段终点（五年级上 注释）");
if (endIdx <= startIdx) throw new Error("G4 段起终点顺序异常");

// 统一行尾：src 若是 CRLF，先把抽出的 block 转成 CRLF 再写入，避免混用
const blockNorm = CRLF ? NEW_G4.replace(/\r?\n/g, "\r\n") : NEW_G4.replace(/\r\n/g, "\n");

const before = src.slice(0, startIdx);
const after = src.slice(endIdx);
const updated = before + blockNorm + after;

writeFileSync(TARGET, updated, "utf8");
console.log(`\n✅ G4 段已恢复：`);
console.log(`   旧段 ${endIdx - startIdx} 字符 → 新段 ${blockNorm.length} 字符`);
console.log(`   行尾: ${CRLF ? "CRLF" : "LF"}`);
console.log(`   单元数: 四上 6 + 四下 7（含 Numbers 附录）= 13`);
console.log(`   词条数: ${cntUp} + ${cntDown} = ${cntUp + cntDown}`);

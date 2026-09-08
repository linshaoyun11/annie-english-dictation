// patch_unit_template.mjs
// ====================================================================
// 通用教材 Unit 段 patch 脚本模板（renjiao3 重建专用）
//
// 适用场景：用新数据替换 grades4to9.ts 里某个 grade 的整个 Unit 段
// （如把旧版 Go for it 七上 12 Unit 整段替换为 PEP 2024 秋新版 10 Unit）
//
// 历史踩坑（务必遵守）：
//   1. 文件用 CRLF 但 git checkout 后可能变 LF，OLD_END_MARK 必须按文件实际行尾
//   2. patch 第 58 行必须是 target.slice(endIdx + OLD_END_MARK.length)，
//      否则 OLD_END_MARK 字符串本身会被重复拼接到结果里
//   3. ⚠️ OLD_END_MARK 设计原则（最常踩）：
//      - OLD_START_MARK = 「起点注释 + 第一段起始内容」（不含闭合括号）
//      - OLD_END_MARK   = 「**仅** 衔接处下段注释起点」（**不含** 闭合括号）
//      - NEW_BLOCK      = 「新内容 + 末尾闭合最后 unit 的 \\n  },\\n」
//      - 反例：OLD_END_MARK 起点写成「    ],\\n  },\\n  // =====」会导致
//        NEW_BLOCK 末尾 `},` + OLD_END_MARK 起点 `  },` 重复，TS 报错
//   4. mk() 字段必须用 JSON.stringify() 包裹（处理中文/特殊字符/单引号）
//   5. patch 完先跑 tsc 看语法错，再 dump 看语义
//
// 使用方法：
//   1. cp scripts/patch_unit_template.mjs scripts/patch_gN.mjs
//   2. 改 OLD_START_MARK / OLD_END_MARK（按当前 grades4to9.ts 实际边界）
//   3. 准备 NEW_BLOCK：先在编辑器里把数据写好，跑 gen_proofread_doc.mjs 看格式
//   4. node scripts/patch_gN.mjs → tsc → dump → build → commit
// ====================================================================

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const TARGET = path.resolve(__filename, '../../src/data/grades4to9.ts');
const text = fs.readFileSync(TARGET, 'utf8');

// ===== 1. 定义 OLD_START_MARK 与 OLD_END_MARK =====
// 大多数情形：OLD_END_MARK = 「下段注释起点」
const OLD_START_MARK = `  // ==================== 七年级上（...） ====================
  {
    grade: 7,
    unit: 1,
    title: "...",
`;
const OLD_END_MARK = `  // ==================== 八年级上（...） ====================
`;
// ⬆️ 注意：OLD_END_MARK 仅含「衔接处下段注释起点」，不含 `],\n  },\n`
//
// ⚠️ 特殊情形：当前段是「文件最后一段」，没有「下段注释起点」可锚定。
//   ⇒ 直接用 `\n];\n` 作 OLD_END_MARK（文件级唯一符号）。
//   例：G9 重做时 (patch_g9_full.mjs) 用的就是：
//     const OLD_END_MARK = `];\n`;
//   after 仍按 `text.slice(endIdx + OLD_END_MARK.length)` 计算，会得到空字符串。
//   这种情形下 NEW_BLOCK 末尾的 `},` 由最后一个 block() 自带，与 OLD_END_MARK `\n];\n` 衔接正好。

const startIdx = text.indexOf(OLD_START_MARK);
if (startIdx < 0) {
  console.error('❌ OLD_START_MARK 未找到');
  process.exit(1);
}
const endIdx = text.indexOf(OLD_END_MARK, startIdx);
if (endIdx < 0) {
  console.error('❌ OLD_END_MARK 未找到');
  process.exit(1);
}

// ===== 2. mk() 辅助函数（务必用 JSON.stringify 包裹字段）=====
const m = (g, u, type, en, ph, cn) =>
  `      mk(${g}, ${u}, ${JSON.stringify(type)}, ${JSON.stringify(en)}, ${JSON.stringify(ph)}, ${JSON.stringify(cn)}),`;

// ===== 3. 每个 Unit 的 entries =====
const U1 = [
  m(7, 1, 'word', 'unit', '/ˈjuːnɪt/', 'n. 单元'),
  m(7, 1, 'word', 'greet', '/ɡriːt/', 'v. 招呼；问候'),
  m(7, 1, 'sentence', 'Hello.', '', ''),
  // ...
].join('\n');

// ===== 4. block() 模板生成 unit 对象 =====
const block = (n, title, body) => `  {
    grade: 7,
    unit: ${n},
    title: ${JSON.stringify(title)},
    entries: [
${body}
    ],
  },
`;

// ===== 5. 拼装 NEW_BLOCK（每个 unit 末尾的 `},` 由 block 模板自带）=====
const HEAD = `  // ==================== 起点注释 ====================
  // 来源：用户 2026-MM-DD 拍 N 张截图
`;

const NEW_BLOCK = HEAD
  + block(1, 'Unit 1 标题 中文名', U1)
  + block(2, 'Unit 2 标题 中文名', U1 /* 替换为 U2 */)
  // ... 复制粘贴
  // 最后 unit 末尾的 `},` 必须由最后一个 block() 自带
  ;

// ===== 6. 拼接：before + NEW_BLOCK + OLD_END_MARK + after =====
// ⬆️ 注意：after 是 text.slice(endIdx + OLD_END_MARK.length)，
//   必须 + len，否则 OLD_END_MARK 字符串本身会被重复拼接到结果里（patch 第 58 行经典 bug）
const before = text.slice(0, startIdx);
const after  = text.slice(endIdx + OLD_END_MARK.length);

const next = before + NEW_BLOCK + OLD_END_MARK + after;

fs.writeFileSync(TARGET, next, 'utf8');
console.log('✅ patched');
console.log('  OLD len:', endIdx - startIdx + OLD_END_MARK.length);
console.log('  NEW_BLOCK len:', NEW_BLOCK.length);
console.log('  before/after unchanged');

// ===== 7. 跑完后必做 =====
// npx tsc -b --noEmit                                  // 查语法
// node scripts/dump_curriculum.mjs renjiao3 --grades N // 查数据
// npx vite build --emptyOutDir=false                   // 查构建
// node scripts/check_audio_coverage.mjs renjiao3 N    // 查音频
// git add -A && git commit -m "..."                    // 提交
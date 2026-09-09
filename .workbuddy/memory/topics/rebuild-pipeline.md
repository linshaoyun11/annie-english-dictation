# 教材录入流水线与 patch 陷阱

> 由 `MEMORY.md` 拆分。动教材数据文件前读本文件。
> 同主题 Skill：`~/.workbuddy/skills/annie-rebuild-curriculum/SKILL.md`（更细，含分步流程）

**Edit 工具对中英混排 / 全角括号匹配会失败 ⇒ 一律用 node 字节级 patch 脚本。**
模板 `scripts/patch_unit_template.mjs`。⚠️ **四个已踩过的坑**：

1. **锚点必须针对「patch 前」的实际文本**。（G4 事故：锚点写成 patch 后的样子 ⇒
   首次执行必然匹配失败，脚本成了"只能跑第二次"的死脚本，数据从未真正写入却被记为已完成。）
2. Windows 文件行尾：先 `src.includes("\r\n")` 检测，再决定 marker 用 `\n` 还是 `\r\n`。
3. `after = target.slice(endIdx + OLD_END_MARK.length)`，**漏 `+ len` 会让 END_MARK 自身残留**。
4. **OLD_END_MARK 只含下段注释起点、不含闭合括号**，NEW_BLOCK 末尾自带 `\n  },\n`
   （否则闭合括号重复 → 语法错）。**文件末尾段**的 OLD_END_MARK 用 `\n];\n`。

## 流水线

dump 对比 → patch → `npx tsc -b --noEmit` + `npx vite build --emptyOutDir=false`
+ dump 校验 → 存基线（`.workbuddy/baselines/`）→ 写 memory。
`vite build` 约 2 分钟，**用 run_in_background**，别前台等（会超时）。

**每册录入后建议跑全量体检**（`scripts/audit_renjiao3.mjs`），能抓出空字段 / 编号断号 /
词条数异常。G4 那次数据丢失就是靠它发现的（每单元只有 10 词，与邻年级差一个量级）。

## 常用脚本

- `scripts/dump_curriculum.mjs <line> --grades 3,4 --titles-only`
  （`renjiao3` / `waiyanshe3` **无独立 .ts**，由 `curriculum.ts` 派生
  ⇒ 必须真跑，❌ 别把代码注释当运行时代证）
- `scripts/audit_renjiao3.mjs` — 全量体检：编号连续性 / 空字段 / 重复 / 类型分布 / 词条数异常
- `scripts/check_audio_coverage.mjs renjiao3 3,4,5,6,7,8,9`
  （⚠️ 不是 verify_audio_coverage.mjs）
- `scripts/gen_proofread_doc.mjs renjiao3 4 --no-kebiao` — A4 HTML，按年级分页

## Windows 环境

Git Bash 下 `/tmp` 不可用 ⇒ 临时文件写 `.workbuddy/tmp/`。
heredoc 里带反引号 / `$` 会被 bash 展开 ⇒ 复杂脚本先用 Write 写文件再执行。

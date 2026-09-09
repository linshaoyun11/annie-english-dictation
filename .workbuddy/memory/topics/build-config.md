# 构建与发布配置（推送前必读）

> 由 `MEMORY.md` 拆分。推送 / 发版前读本文件。

- **本机 `npm run build` 必然失败于清空 dist**（沙箱 safe-delete 拦截，dist 下 5200+ 音频 >
  阈值 50）。**本地冒烟一律 `npx vite build --emptyOutDir=false`** ⇒ 是**增量**的，
  不等价于 CI 干净全量构建。
- **`tsconfig.node.json` 已纳入 `capacitor.config.ts`**。`cap sync` **静默忽略未知字段**，
  只有 tsc 能发现 ⇒ 改 Capacitor 配置后务必跑 `npx tsc -b --noEmit`。
- **`ios.webContentsDebuggingEnabled: true`** 已开。配 `ios-webkit-debug-proxy`
  可在 Windows 远程调试 iPad 真机。
- **⚠️ Codemagic 触发机制（2026-09-06 已纠正，此前记反了）**：
  仓库根目录有 `codemagic.yaml` 时，**网页端 App settings → Build triggers 的勾选项被
  完全忽略**，只认 yaml 的 `triggering` 段。官方原文（codemagic-yaml-cheatsheet）：
  「triggering: defines the events for automatic build triggering and watched branches.
  **If no events are defined, you can only start builds manually.**」
  ⇒ **没有 `triggering` 段 = 只能手动点**，不是"任何 push 都触发"。
  本项目 2026-09-06 前从未配过（20 个历史版本 triggering 行数均为 0）⇒ 一直手动点。
  现配置（`d07dece` 起）：`events: [push]` + `branch_patterns: main` +
  `cancel_previous_builds: true`。
  **⚠️ 但这套配置当前不生效**——GitHub 侧 webhook 未配置，2026-09-06 实测
  push 后无自动构建。用户已拍板「以后还是手动」。
  ⇒ **实际发版流程：Codemagic 网页点「Start new build」选 ios-release。**
  看到 yaml 有 `triggering` 别以为能自动，目前不能。将来想启用：去 Codemagic
  → App settings → Build triggers 勾「Trigger on push」保存（会自动建 webhook），
  或手动在 GitHub 仓库 Settings → Webhooks 添加。
- **推送后不要再单独 commit+push 文档补记**：`APP_BUILD` 没变 ⇒ 第二个包因 **build 号
  重复被 ASC 拒绝上传**。⇒ **memory 补记必须在推送前写完、与代码一起提交**。
- **本地 `vite build` 在沙箱会卡死**（2026-09-06）：卡在
  `transforming... 56 modules transformed.` 无限挂起（与"清空 dist 被 safe-delete
  拦截"是不同症状，那个秒失败）。**卡超 3 分钟就停掉直接推**，`tsc -b --noEmit` 过即可。
- **`git reset --soft HEAD~1` 在已推送时会把已推送内容一起撤掉**。恢复：
  `git reset --soft <已推送的 commit>`，再 `git restore --staged <文件>`。
- **CI 失败诊断**：Codemagic 报「don't consume any of your build minutes」= **平台级故障**。
  查三方状态页：GitHub `githubstatus.com/api/v2/components.json`（页面级 minor 可能只是
  Copilot，要看 components）；npm `status.npmjs.org/api/v2/status.json`；Apple
  `developer/system_status_en_US.js`（**curl 必须加 `--compressed`**，Windows 别写 `/tmp`）。
  **日志为空 = 实例没起来 ⇒ 点 Retry，不要 push**（并发则同号撞 duplicate）。

## 已知问题 · 暂不修复（有意为之）

均已定位根因、影响可控，用户决定暂缓。动手前先确认是否已改变主意。

1. **冷启动首次朗读保温无效**（build 48）：`start()` 里 `startAudioWarm()` 后紧跟
   `Promise.all(resolveAudio).then(...)`，命中缓存同步返回 → `playCurrent()` 立刻
   `stopAudioWarm()`，warmEl 的 `play()` 未出声就 pause。词间 3s 保温仍有效。
   位置 `src/hooks/useSpeechLoop.ts`。
2. **`fallbackTimer` 换题未清理**：`start()` 的 `.then` 里 `if (gen !== activeGen) return;`
   没清 timer。快速换题挂 4s pending，触发后安全退出、自动 delete，不无界累积。
3. **waiyanshe / oxford 音频 id 命名错配**：同词音频字节级相同，仅 id 命名不一致，无功能影响。
4. **音频去重可省约 5.6MB**（463 个孤儿文件）。攒到下次发版一起做。

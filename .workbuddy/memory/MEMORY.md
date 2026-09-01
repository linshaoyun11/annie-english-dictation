# 安妮英语听写（Annie English Dictation）项目长期记忆

iOS App，Capacitor + React + TypeScript + Vite。Windows 开发、Codemagic 云端 CI 构建、TestFlight 分发。
构建号在 `codemagic.yaml` 的 `APP_BUILD`。

## 已知问题 · 暂不修复（有意为之，非遗漏）

以下条目均已定位到根因、确认影响可控，用户决定暂缓。动手前先确认是否已改变主意。

### 1. 冷启动首次朗读的「通路保温」无效（build 48 引入）
- **现象**：进入学习页的第一题、以及 `replayNow()` 手动重播时，`startAudioWarm()` 起不到保温作用。
- **根因**：`start()` 里 `startAudioWarm()` 之后紧跟 `Promise.all(resolveAudio).then(...)`。
  `resolveAudio` 命中 `audioCache` 时同步返回 → `Promise.all` 在**微任务**里 resolve →
  `playCurrent()` 立刻 `stopAudioWarm()`。整条链在同一个事件循环 tick 内跑完，
  warmEl 的 `play()` 尚未真正出声就被 pause。
- **影响有限**：词间 3s 间隔的保温**仍然有效**（`scheduleNext` 保温后要等 3s 才 `playCurrent`），
  而用户反馈的「每个词第一遍音量偏小」正是词间场景，所以核心修复成立。
- **修法（未采纳）**：给 `stopAudioWarm()` 加最小保温时长保护（启动后 400ms 内不响应 stop）；
  或让 `playCurrent` 等 warmEl 的 `play()` Promise resolve 后再执行。
- 位置：`src/hooks/useSpeechLoop.ts` 的 `start()` / `stopAudioWarm()`。

### 2. `fallbackTimer` 在换题时未清理（早于 build 48 存在）
- `start()` 的 `.then` 里 `if (gen !== activeGen) return;` 提前返回，没调 `safeClearTimeout(fallbackTimer)`。
- 快速换题会挂一个 4s 的 pending entry；触发后因 `valid(gen)` 为 false 安全退出、
  pending 自动 delete，**不会无界累积**，影响可忽略。
- 修法：return 前补一行 `safeClearTimeout(fallbackTimer)`。

### 3. waiyanshe / oxford 词库音频 id 命名错配
- 同词不同教材的音频**字节级相同**，仅 id 命名不一致，无功能影响。

### 4. 音频去重（可省约 5.6MB）
- 删除 463 个孤儿文件 + 去重可省约 5.6MB。建议攒到下次发版一起做。

## 关键设计约定（改动前必读）

- **iOS 上 `HTMLMediaElement.volume` 只读、恒为 1** —— 不要再写 `el.volume = x`，是空操作。
- **`inputmode="latin"` 不是合法值**，浏览器直接忽略。系统键盘语言 Web 层不可控
  （`UIResponder.textInputMode` 对 WKWebView 无效），因此拼写输入改为**页内自绘 A–Z 键盘**。
- **媒体实例必须显式释放**：`releaseElement()`（pause + removeAttribute("src") + load()）。
  iOS WKWebView 仅解除 JS 引用不会回收底层解码器，长会话会线性累积导致卡顿（build 46 修的就是这个）。
  改音频相关代码时务必保持"元素数恒定"。
- **保温用 `loop=true` 持续播放静音**换取通路不冷，代价是功耗（占空比约 75%）。这是有意的取舍。
- `safeTimeout` / `src/lib/timer.ts` 维护全局 pending Map（iOS 后台定时器冻结的补发机制）。
  不需要心跳补发的定时器（如保温）应直接用原生 `setTimeout`，避免污染 pending。

## 视觉一致性优先（图标类改动必读）

- **图标样式不做 size 分档**。太阳/星星这类徽章图标，任何尺寸都画同一套形状、用同一套配色；
  宁可 14px 下细节略糊，也要保证形状与颜色在各处统一识别（2026-09-01 明确撤销了「小尺寸简化 + 压暗拉对比」方案）。
- 提「小尺寸简化」「换色拉开对比度」这类方案时**先问再做**，不要默认采纳。
- 现行图标规格（勿再改，除非用户明确要求）：
  - 星星 A：`fill #F5B800` / `stroke #D89A00` 1.2 / 高光 `#FFD75E`
  - 太阳 C：8 个**实心**尖三角 `#F59E0B` + 盘 `#FFA726`（r6.4，`stroke #E8890B` 1.2）+ 高光 `#FFCC66`
  - 合成基数：**2 星 = 1 太阳**，`MAX_ROUNDS = 10`（5 太阳满级）

## 用户协作偏好

- 动手前先复述对需求的理解并确认，再输出正式内容。
- 反馈精准到部件级/字段级，喜欢结构化表格、分步骤、定量核验。
- 要求列表完整不省略、保留英文原文。

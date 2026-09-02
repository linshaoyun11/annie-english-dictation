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
- **`createPortal` 只改变 DOM 层级，不改变 React 合成事件的冒泡路径**。
  自绘键盘 portal 到 `body`，DOM 上在 LearnPage 容器外，但触摸事件仍沿**组件树**
  冒泡到 LearnPage 根容器的 `onTouchStart/onTouchEnd`（上滑切题手势）。
  已用 `data-dictation-keyboard` 标记 + `e.target.closest(...)` 排除（2026-09-02 修）。
  新增任何 portal 浮层（弹窗/Toast/浮层键盘）时，同步确认上层手势是否需要排除它。

- **⚠️ 输入时机 = pointerdown 出字，会让「答对判定」发生在手指仍按下时**（2026-09-02）。
  字母键用 `onPointerDown` 出字（对齐 iOS 系统键盘手感），而 `pushLetter` 里的
  `onComplete()` 是**同步**调用的；pointerdown 属离散事件，React 18 会**同步刷新渲染**
  → 手指还压在屏幕上，键盘已卸载、答对页已出现。后果有两类：
  ① 同一次触摸的 `touchstart`/`touchend`/`click` 被重定向到**手指下方的新元素**，
     浏览器照常合成的那记 click 会砸到答对页的「下一题」（幽灵点击）；
  ② touchend 时词条已完成，LearnPage 上滑手势的 `processedNow` 为 true，
     多指错位算出虚假 `dy < -60` 就直接 `goNext()`。
  这就是 build 52 之后「答对页闪一下就跳下一题」的根因。
  **改动输入时机、或在答对/完成路径上增删任何东西前，先想清楚此刻手指是否还在屏幕上。**
  现有两道防线（都是有意为之，勿删）：
  - `LearningCard` 答对页按钮的 `onPointerDown` 置位 + `onClick` 校验 ref（拦幽灵点击，
    用布尔量不用时间窗）；
  - `LearnPage` 的 `answeredAtRef` / `touchStartAtRef` + `SETTLE_MS = 300` 反应窗口
    （拦手势尾巴）。
- **touch 手势起点必须用 `e.changedTouches[0]`，不能用 `e.touches[0]`**（后者是
  当前所有触点中的第一个，多指时与抬起的那根不是同一根）。并须检查
  `e.touches.length` 排除多指场景。

## 构建与配置（推送前必读）

- **本机 `npm run build` 必然失败于清空 dist**：沙箱 safe-delete 保护拦截
  （dist 下 5200+ 个音频文件 > 阈值 50，报 SAFE_DELETE_BULK_CONFIRM_REQUIRED）。
  **本地冒烟一律用 `npx vite build --emptyOutDir=false`**（不清空直接写入，约 3 分钟）。
  CI 上无此保护，正常 `npm run build` 即可。
- **`tsconfig.node.json` 已纳入 `capacitor.config.ts`**（2026-09-02 加）。
  之前只 include `vite.config.ts`，导致配置文件里的废弃字段长期无人发现：
  `ios.minVersion`（Capacitor 8 已移除）和 `bundledWebRuntime`（Cap 5 起移除）
  在项目里躺了很久——`cap sync` **静默忽略未知字段**，只有 tsc 能发现。
  改 Capacitor 配置后务必跑 `npx tsc -b --noEmit` 确认字段仍被支持。
- **`ios.webContentsDebuggingEnabled: true`** 已开启。Capacitor 4.8.0+ 默认 false，
  即 release/TestFlight 包默认**无法**被 Safari Web Inspector 连接。
  开启后配合 `ios-webkit-debug-proxy` 可在 Windows 上远程调试 iPad 真机。
  只影响可调试性，不改任何运行时行为。

## 自绘键盘几何（SpellingInput.tsx 改动前必读）

- **三行字母键列宽必须严格相等**，公式：(W − 9g)/10，g 是 row 的 gap（=6）。
  Q 列宽 = A 列宽 = Z 列宽。这是与 iOS 系统键盘一致的目标。
- **缩进只能用「行 padding」，不能用缩进 span**：span 会多占 1 个 gap，
  把份从 (W−9g)/10 压成 (W−10g)/10，letter 宽损失 g/10 = 0.6px。
  第 2 行（a-l）已改用 `paddingLeft/Right: calc((100% + 6px) / 20)`：
  数学上 letter 宽 = (W − 2p − 8g) / 9 = (W − 9g) / 10，与第 1 行严格一致。
  第 3 行左缩进仍是 span（`flex-[1]`）——它参与 sum=10 的份分配，不会额外
  产生 gap 误差，所以可以留着；只有"额外插入、不占份"的缩进才必须改 padding。
- **第 2 行（a-l）必须用行 padding 缩进，不用 span**：
  `paddingLeft/Right: calc((100% + 6px) / 20)`
  数学证明 letter 宽 = (W − 2p − 8g) / 9 = (W − 9g) / 10，与第 1 行严格一致。
- 第 1 行：10 letter（两端贴边，无缩进）
- 第 2 行：9 letter + 行 padding（左右各 (W+g)/20）
- 第 3 行：1.0 缩进 + 7 letter + 1.5 backspace + 0.5 缩进（sum=10）
- 第 4 行：2 + 5.5 + 2 = 9.5（user 暂接受"只有 space 键"的极简布局）
- 当前键高 42px / gap 6px / 圆角 9px 是 build 52 起的决策，**不要"向 iOS 系统
  看齐"主动降键高/缩间距/减小圆角**——这些是用户的有意为之。

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

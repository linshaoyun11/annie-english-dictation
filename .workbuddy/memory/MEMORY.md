# 安妮英语听写（Annie English Dictation）项目长期记忆

iOS App，Capacitor + React + TypeScript + Vite。Windows 开发、Codemagic 云端 CI 构建、TestFlight 分发。
构建号在 `codemagic.yaml` 的 `APP_BUILD`。

## 教材线（curriculum）· 多教材架构

`src/data/curriculum.ts` 是唯一入口：`CurriculumVersion` 联合类型 + `CURRICULA` 索引 +
`CURRICULUM_LABELS`。现有 6 条线：renjiao / renjiao3 / waiyanshe / waiyanshe3 / oxford /
**renai（仁爱版，2026-09-03 加）**。新增一条线只需改 3 处（import、类型+LABELS、CURRICULA）
+ `SettingsPage.tsx` 的 `CURRICULUM_DESC` 与 `VERSIONS` 各加一项；首页年级标签由
`cur.map(u => u.grade)` 动态推导，无需改 UI。

**id 规则（`src/data/mk.ts`）**：`mk()` 用全局 seq（人教专用，必须保持 id 稳定，
否则预生成的 1061 个按人教 id 命名的本地音频会失配）；`mkWithPrefix(prefix, ...)` 各前缀
独立计数（`wy-` / `ox-` / `ra-`）。

**`CURRICULUM_VERSION` 只在"既有教材的 id/顺序变化、旧进度会错位"时才升。**
新增教材线不动任何既有 id，**不升版本号**（当前 7，仁爱版加入时特意保持）。

**音频 manifest 是「文本 → id」映射**（不是「词条 id → 音频」），所以新教材复用同文本词时
音频**零成本复用**（仁爱版实测复用率 72.4%，welcome → `ox-g6u4e0540`）。
manifest 写出必须是单行紧凑（等价 `JSON.stringify`），用 `indent=0` 会让 git diff 爆炸。

**仁爱版专属事实**：一个 Topic = 一个单元；**九下只有 Unit 5、6 共 6 个 Topic**
⇒ 7:24 + 8:24 + 9:18 = **66 单元（不是 72）**。`title` 字段是教材 Topic 的原句标题
（如 `"When was it invented? ..."`），Unit 主题名（`"Amazing Science"`）只在源码注释里。

**课标补全（`kebiaoBank.ts`）**：各教材在文件末尾调
`applyKebiaoTo(CURRICULUM, makeXxxEntry, elemGrades, midGrades)`。
⚠️ 两个陷阱：① `if (elemGrades.length)` —— **elemGrades 传 `[]` 时 band=2 小学词被静默丢弃**；
② `lastUnitOfGrade` 是一次性预计算、`insertKebiaoUnits` 只 splice 不重编号 ⇒
**elemGrades 与 midGrades 的年级必须不相交**。1-9 年级教材用 `[3,4,5,6]`/`[7,8,9]`
天然安全；**仁爱版只有 7-9 年级，用 `[7]` / `[8,9]`**（小学词放七年级，初中词分八九年级）。
补课后仁爱版 = 141 单元 / 1982 词条 / 课标覆盖 100%。

**课标词条是运行时生成的，不是源码字面量** —— `applyKebiaoTo` 从已打包的
`KEBIAO_BANK` 现场造 entry，所以给某教材补课标**几乎不增加包体**（实测 +65 B），
只增加运行时对象数。估算"新增数据"的体积前先分清是字面量还是运行时生成。

**打包器是 rolldown（Vite 8），不是 esbuild**。差异点：
`esbuild` 不在 package.json（`npx esbuild` 会临时联网拉）；rolldown 的
`logLevel` 不接受 `"error"`（只收 debug|info|warn|silent）；
**压缩后字符串字面量用反引号**（`` `ability` ``），不是双引号也不是单引号。

**仁爱版课标覆盖率仅 32.2%（522/1619）**，其余教材 95-100%。补齐 1097 个缺失课标词
零音频成本（全部已有 mp3），但会从 885 条膨胀到约 1982 条。**用户未拍板，未实施。**

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
- **推送后不要再单独 commit+push 文档补记**（2026-09-03 踩到）。
  `codemagic.yaml` 无 `triggering`，**任何 push 都会触发一次构建**，而 `APP_BUILD`
  没变 → 第二个包因 **build 号重复被 App Store Connect 拒绝上传**，表现为一次
  红色构建失败，容易被误判成代码问题。
  ⇒ **memory 补记必须在推送前写完，与代码改动一起提交**；已推完才发现漏写的，
  留在工作区（未暂存）攒到下次代码改动一起推。
- **`git reset --soft HEAD~1` 在"该 commit 已推送"时会把已推送内容一起撤掉**
  （HEAD~1 指向远程已有的上一个 commit，本地瞬间落后远程一个 commit）。
  恢复：`git reset --soft <已推送的那个 commit>`，再用
  `git restore --staged <文件>` 把不想提交的文件撤出暂存区（内容仍留在工作区）。

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
- 键高 / 行距 / 圆角是**逐次累加的有意决策**，**不要"向 iOS 系统看齐"主动
  降键高 / 缩间距 / 减小圆角**。演进链：
  - build 51：键高 +5%
  - build 52：深色翻新，gap 4→6、行距 8→6、圆角 9
  - build 55：键高再 +5%（字母/删除 42→44、空格 46→48），行距 6→**12**（加倍）
  - build 55 后微调：键高 +2px（46/50）、字母字号 20→21、圆角 9→**7**（嫌圆角太大）
  ⇒ 现行值：**字母键/删除键 46px、空格键 50px、键间距 6px、行间距 12px、
  圆角 7px、字母字号 21px、上下留白 28px**，键盘条实测高约 280px。

## 视觉一致性优先（图标类改动必读）

- **图标样式不做 size 分档**。太阳/星星这类徽章图标，任何尺寸都画同一套形状、用同一套配色；
  宁可 14px 下细节略糊，也要保证形状与颜色在各处统一识别（2026-09-01 明确撤销了「小尺寸简化 + 压暗拉对比」方案）。
- 提「小尺寸简化」「换色拉开对比度」这类方案时**先问再做**，不要默认采纳。
- 现行图标规格（勿再改，除非用户明确要求）：
  - 星星 A：`fill #F5B800` / `stroke #D89A00` 1.2 / 高光 `#FFD75E`
  - 太阳 C：8 个**实心**尖三角 `#F59E0B` + 盘 `#FFA726`（r6.4，`stroke #E8890B` 1.2）+ 高光 `#FFCC66`
  - 合成基数：**2 星 = 1 太阳**，`MAX_ROUNDS = 10`（5 太阳满级）
  - 奖杯 `TrophyIcon`（`src/components/TrophyIcon.tsx`，祝贺页专用）：
    **抽象线条版**（v8，2026-09-03）。零渐变/零高光/零阴影，全部 stroke 圆头线条，
    描边宽度统一 2.8（杯口沿 3.4、底座下沿 3.4），round cap/linejoin。
    仅两色：紫 `#534AB7`（杯体 = App 主色）+ 金 `#F5B800`（蝴蝶结 + 星徽/星屑）。
    viewBox `0 0 64 58`，三个变体 A（最简 12 笔）/ B（+ 中央星）/ C（+ 3 星屑）。
    默认 size 120，等比缩放（width = size, height = size × 58/64）。

## 用户协作偏好

- 动手前先复述对需求的理解并确认，再输出正式内容。
- 反馈精准到部件级/字段级，喜欢结构化表格、分步骤、定量核验。
- 要求列表完整不省略、保留英文原文。

# UI 约定（键盘 / 图标改动前必读）

> 由 `MEMORY.md` 拆分。

## 自绘键盘几何（SpellingInput.tsx 改动前必读）

- **三行字母键列宽必须严格相等**，公式 (W − 9g)/10，g = row gap = 6（对齐 iOS 系统键盘）。
- **缩进只能用「行 padding」，不能用缩进 span**：span 多占 1 个 gap。第 2 行用
  `paddingLeft/Right: calc((100% + 6px) / 20)`。第 3 行左缩进仍是 span（`flex-[1]`）——
  参与 sum=10 的份分配，不额外产生 gap 误差。
- 行构成：1 行 10 letter（贴边）；2 行 9 letter + 行 padding；3 行 1.0 缩进 + 7 letter +
  1.5 backspace + 0.5 缩进（sum=10）；4 行 2 + 5.5 + 2 = 9.5。
- **键高 / 行距 / 圆角是逐次累加的有意决策**，**不要"向 iOS 系统看齐"主动降键高 / 缩间距 /
  减小圆角**。⇒ 现行：**字母/删除键 46px、空格键 50px、键间距 6px、行间距 12px、
  圆角 7px、字号 21px、上下留白 28px**，键盘条约 280px 高。

## 视觉一致性优先（图标类改动必读）

- **图标不做 size 分档**：任何尺寸同一套形状与配色（2026-09-01 撤销「小尺寸简化」方案）。
  提这类方案**先问再做**。
- **App 图标语言三要素**（样本 `StarIcon` / `SunIcon`，见 `RoundsStars.tsx`）：① 实心填充为主体
  ② 深色描边勾轮廓 ③ 左上打亮色高光。星星 `fill #F5B800` / `stroke #D89A00` 1.2 / 高光 `#FFD75E`；
  太阳 8 个**实心**尖三角 `#F59E0B` + 盘 `#FFA726`（r6.4，`stroke #E8890B` 1.2）+ 高光 `#FFCC66`；
  **2 星 = 1 太阳**，`MAX_ROUNDS = 10`。
- 奖杯 `TrophyIcon`（祝贺页专用）：**PNG 嵌入版**（2026-09-05 替换，**覆盖了 09-03
  App 风格版**）。资源 `src/assets/trophy-celebration-transparent.png`（1024×1024，
  来源：豆包 AI 生成的卡通 3D 奖杯 + 已裁掉「豆包 AI 生成」水印 +
  **米黄方形背景已抠图为透明**，67.4% 像素 alpha=0，alpha Blur 0.6 抗锯齿）。
  **用户拍板走「外部风格」**（确认了 3 个风格选项中的「完全照搬嵌入 PNG」），
  与紧邻的 SunIcon/StarIcon 风格不一致已明知；后续如需协调单独处理。
  接口：`size` 控制边长（正方形），`className` 等透传到 `<img>`。
  **文件名带 `-transparent` 后缀**是为强制清 iPad Safari 缓存（旧 `trophy-celebration.png`
  即使加 `?t=戳` 仍命中磁盘缓存，详见 `2026-09-06.md`）。
- **⚠️ 祝贺页奖杯正下方就是 `SunIcon/StarIcon size={56}`，两者同屏**
  ⇒ 改奖杯前先读 `RoundsStars.tsx`。

## 学习卡竖向空间分配（LearningCard/SpellingInput 改动前必读，build 80）

- **内容区禁止 `justify-center` + `overflow-*` 组合**：flex 不安全居中，内容超高时
  顶部裁掉、滚不到，底部「我不会」按钮只露一半。用外层 `overflow-y-auto` +
  内层 `m-auto` 安全居中（放得下视觉不变，放不下可滚到底）。
- **字母格档位由实测决定，不按字母数猜**（折行数受单词切分/视口宽/键盘高影响，
  390×844 下 40 字母句子在 compact 档仍溢出 12px）：LearningCard 持滚动容器，
  useLayoutEffect 量 `scrollHeight > clientHeight` 就降一档
  `normal→compact→xs→xxs`（绘制前完成无闪烁），ResizeObserver 兜底键盘
  `--dkb-h` 异步回写。档位表 `CELL_METRICS` 在 SpellingInput（导出 `CellTier`），
  SoundWave 用 `size: normal|xs|xxs` 联动，间距 `TIER_GAP` = mt-7/4/3/2。
- **≤18 字母单词/短句从不溢出 ⇒ 恒停 normal 档**，布局与历史版本逐像素一致
  （已实测按钮 top/bottom 完全相同）——改任何尺寸逻辑不得破坏这条。
- **⚠️ 长句必须强制 3 行（大字档），否则级联收敛到小字（2026-09-13 两次反馈的教训）**：
  均衡分行 `balancedLines()` 在 normal/compact 档对「贪心 ≥2 行」的长句强制
  `L = max(贪心行数, 3)` 再 DP 均衡；切不开时**逐级回退 L 重试 DP**（不许直接退贪心，
  贪心首行塞满、尾行零星）。xs/xxs 兜底档**不强制**（极矮视口多一行反而更挤）。
  根因：行数少 → 每档都塞得下 → 降档级联一路压到 xs/xxs 13px；强制 3 行后
  normal/compact 就放得下，字号保住 20px+。iPhone 14 实测截图句
  「What do you have in your schoolbag?」xs/13px/2行 → compact/20px+/3行均衡。
- 本地验证工作流（探针页 + 无头 Edge CDP + 269 条真实词条扫描）：
  技能 `~/.workbuddy/skills/annie-layout-probe/SKILL.md`，改布局后照跑一遍。
  另有纯数值级联模拟脚本 `.workbuddy/tmp/sim_lines.js`（node 直跑，秒级验证
  各机型 × 各档位的行数/行宽/内容总高，改折行逻辑先跑它再上真机）。

## ✅ 拼写输入对「大小写 / 撇号」的处理（2026-09-06 已核实，勿再改）

词库里有 **207 条首字母大写的专有名词**（`Miss` / `Mr` / `English` / `China` / `Canada` /
`Sydney` / `T-shirt` / 星期与月份…）和 **31 条含弯引号 `’`（U+2019）** 的词条
（`Mother’s Day`、`I didn’t use to be popular in school.`…）。曾担心自绘 A–Z 键盘
输不了这些字符，实测**都能正常工作**：

- `SpellingInput.tsx:64 parseTarget()`：先按空格切词，词内再把**非字母**当「后缀」切出去
  ⇒ 撇号、连字符、句号都**自动预填，不需用户输入**。只有 `allLetters` 需要敲。
- `SpellingInput.tsx:97 isLetter()` = `/^[a-zA-Z]$/`，**只接受 ASCII 字母**。
- `SpellingInput.tsx:171 / :190` 判定均用 `toLowerCase()` 比较 ⇒ **大小写不敏感**，
  用户输入 `china` 能判对 `China`。

⇒ 录入教材时**可以放心保留原文的大小写与弯引号**，不必改写成小写或直引号 `'`。
   ⚠️ 但要注意：改成直引号也不影响判定（都当后缀），**改了反而偏离教材原文**，别改。

## 静态 HTML 预览的高清截图（改 UI 出预览图用）
`~/.workbuddy/binaries/node/workspace/shot-page.mjs`，用法：
`node shot-page.mjs <html路径> <out.png> [宽] [高] [port] [scale]`

- **必须走裸 CDP**：playwright 的 `page.setViewportSize` / `page.screenshot` 会自己下发
  `Emulation.setDeviceMetricsOverride` 把 `deviceScaleFactor` 覆盖成 1，
  所以 `--force-device-scale-factor=2`、`newContext({deviceScaleFactor:2})` 全都无效。
  正确姿势：`ctx.newCDPSession(page)` → `Emulation.setDeviceMetricsOverride({deviceScaleFactor:2})`
  → `Page.getLayoutMetrics` 取 contentSize → `Page.captureScreenshot({captureBeyondViewport:true,
  clip:{x:0,y:0,width,height,scale:1}})`。**clip.scale 保持 1**，否则与 dsf 叠乘成 4x。
- 截图用的调试实例直接用 9222 那个（探针实例）即可，**不必另起**——dsf 由脚本自己下发；
  但**每个脚本跑完要 `page.close()`**，否则遗留页面会拖垮浏览器（探针那轮的教训）。
- 预览页放 `.workbuddy/preview/`，命名 `<页面>-redesign-vN.html` + 同名 png；
  多方案/备选一次画齐，便于用户一轮拍板。改版类需求**先出预览图确认再动代码**。
- ⚠️ `.workbuddy/preview/` 整个目录在 `.gitignore` 里：预览图是纯本地交付物，
  不要试图 `git add`（会静默失败）。
- 局部放大看小图标/小字：`shot-clip.mjs <url> <out.png> <x> <y> <w> <h> [scale=4] [port] [vw] [vh]`
  （同样裸 CDP，`clip.scale` 放大；小图标 6x、数据条 5x 足够看清有没有糊/偏心）。
- **滚动后截图**：`shot-scrolled.mjs <url> <out.png> <scrollTop> [x] [y] [w] [h] [dsf] [port] [vw] [vh]`
  —— 先在页面里找纵向滚动容器（`overflow-y:auto|scroll` 且内容溢出）并真的滚到指定位置，
  等 600ms（scroll 事件 + 200ms 阴影过渡）再截视口。**验证 sticky / fixed / 吸顶 / 滚动显隐
  这类「滚动才发生」的效果必须用它**，静态全页截图（shot-page）永远看不出差别。
  探针页约定：`?mode=old` + 首屏注入 `<style>[data-xxx]{position:relative!important}</style>`
  就能生成「改前」对照，**不必 git checkout 旧代码**（本仓页面的滚动容器统一是
  `<div className="h-full overflow-y-auto px-5 pb-10">`，探针外壳用
  `<div className="mx-auto h-[100dvh] w-full max-w-[430px] bg-bg">`）。

## 列表页统一用吸顶顶部栏（build 115）

`src/components/PageTopBar.tsx`：`sticky top-0 z-20 -mx-5 bg-bg px-5 pt-8`，内容即
「返回键 + 标题 + 右侧操作」，三页共用（设置 / 用户资料 / 重点记忆 = 全部带
`h-full overflow-y-auto` 的页）。**新增列表页照用，别手写普通 flex 行。**

- 组件内部向上找最近的 `overflow-y:auto|scroll` 祖先来监听滚动（**必须是滚动容器的子元素**）；
  `stuck` 只在跨 2px 阈值时 setState ⇒ 不随每帧滚动重渲染。
- 下沿分隔全用 `box-shadow`（`inset` 发丝线 + 外投影），**不占布局** ⇒ 显隐不顶动内容 1px；
  静止在顶部时没有这道线（首屏零变化）。
- `-mx-5 px-5` 是必需的：父容器带 `px-5`，不铺满横向背景的话，滚动内容会从两侧 20px 缝里露出。
- **底部 `pb-3 -mb-3`（12px 呼吸位，build 116 加，用户要求）**：返回键/头像是 36px 圆按钮，
  不加的话圆底正好压在发丝线上。**两者必须成对**：负 margin 抵消 padding 对流内占位的影响
  （相邻 margin 塌陷 `28 + (−12) = 16`，盒底 68→80，相加仍 96）⇒ 下方内容 y 坐标不变
  （实测 0 像素差异、`scrollHeight` 不变）。**别改成「只在 stuck 时加」**——顶栏盒高会在
  滚动瞬间长高 12px，底部 12px 内容突然被盖住 = 一次可见跳动。
  但**背景/呼吸位要常驻**（不随 stuck 变），只有「发丝线 + 投影」跟着 stuck 出现，
  这样状态切换只变色不改变几何。
- `z-20` < 「关于」弹窗 `z-50`。`data-topbar` 属性供探针/测试定位（同 `data-dictation-keyboard`）。
- ⚠️ 吸顶会把元素提升为独立图层，文字抗锯齿由次像素变灰度 ⇒ 像素比对时会在字形边缘
  出现 ~0.05% 的差异（区域平均色不变）。**这是正常的，不是位移**，别当回归。

## 数字密码键盘 `NumberPad.tsx`（build 119，RegisterPage）

**问题**：创建角色页原来用系统数字键盘（`inputMode="numeric"`），iOS WKWebView 把它当**浮层**，
不自动把 input 滚进可视区 ⇒ 密码框被整个盖住（用户截图证据）。旧实现在 `revealInput()` 里
用 `--kb-h`（Capacitor `keyboardWillShow` 写入）+ 两次 `scrollBy` 补偿，**实测仍然挡**。

**结论：要输入就自绘键盘。** 文本走 `SpellingInput` 的 A–Z 键盘，数字走 `NumberPad`。

### 页面结构（必须两段式，这是"不遮挡"的全部秘密）

```tsx
<div className="flex h-full flex-col">
  <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-6">…内容…</div>
  {field && <NumberPad onDigit={…} onBackspace={…} />}
</div>
```

键盘 `shrink-0`、在**文档流内** ⇒ 键盘占多高、内容区就少多高，**不需要任何高度计算**。
对比旧链路（`--kb-h` 事件是否到达 → 键盘升起动画期间量高度 → 两次 scroll 时机）三个环节
都可能失效。`min-h-0` 不能漏（否则 flex 子项不会收缩，内容区不会出现滚动条）。

- 输入框用 `readOnly` + `inputMode="none"` **两个一起**挡住系统键盘
  （只写 `readOnly` 在 iOS 上仍可能弹）。保留原生 `<input>` 是为可访问性（VoiceOver 能读）。
  **readOnly 的 input 不触发 onChange**，输入完全由自绘键盘 setState 驱动。
- 焦点只用来标记「当前写哪一格」：`onFocus={() => setField("pwd")}`。
  收起键盘时记得 `blur()`，否则 `:focus` 高亮一直亮着。
- 点内容区空白收起键盘，但**必须放行 `input,button`**（`e.target.closest("input,button")`），
  否则点头像/切换输入框/点提交按钮都会顺带收起。
- 键盘展开后要主动滚到底（`scrollTo({top: scrollHeight})`）：布局变更与 `scrollHeight` 更新
  不在同一帧，**必须套两层 `requestAnimationFrame`**，否则量到的还是旧高度。
- 交互：第一格满 4 位自动跳第二格；第二格满 4 位**自动收起**（把提交按钮让出来）；
  ⌫ 删空第二格退回第一格。
- 出字用 `pointerdown` + `preventDefault()`（与系统键盘同速）。本键盘**没有**答对判定，
  不存在 LearningCard 那类「手指还按着就判定」的问题。

### 几何规格（按用户 iOS 截图逐像素量取，390pt 屏）

| 项 | 值 | 项 | 值 |
|---|---|---|---|
| 面板底色 | `#403F44` | 键帽色 | `#5E5D62` |
| 面板顶部圆角 | 24px | 键帽圆角 | 10px |
| 面板上内边距 | 22px | 面板左右内边距 | 5px |
| 键帽高 | 47px | 键帽宽 | 等分（390 屏上 122.9px） |
| 行 / 列间距 | 5.7px | 数字 | 21px 纯白 |
| 小字母（ABC…） | 9.5px `#D4D3D8`，距数字 5px | 底部留白 | `env(safe-area-inset-bottom) + 38px` |
| 面板总高（390×844 屏） | ≈299px（系统键盘实测 298.6） | | |

- 第 4 行：左侧留空、`0` 与第 2 列对齐、**⌫ 没有键帽底**（图标直接画在面板上）——
  与截图一致；1 和 0 没有小字母标注。
- ⌫ 图标复用 `SpellingInput` 里那枚 iOS 删除键 path（22→24px），保持一致。

### 探针与验证

- 探针：`probe-register.html` / `src/probe/registerProbe.tsx`（untracked，不进构建）。
  `?step=pad` 聚焦第一个密码框（键盘展开）、`?step=full` 选头像 + 填满两格。**均需 Playwright
  真实点击来验证交互**（探针里同步连发 8 次 pointerdown 会被 React 批处理合并成一次，
  必须每次隔一帧）。
- 网页里 `env(safe-area-inset-bottom)` = 0，真机是 34px ⇒ 探针注入
  `<style>[data-number-pad]{padding-bottom:72px!important}</style>` 才能与真机截图严格可比。
- 量法脚本：`.workbuddy/tmp/numpad_compare.py`（把两张不同缩放的截图都换算成 pt 再逐项比）。
  ⚠️ **两个判据坑**：① 取色要用整块区域的**中位数**，按边缘单点采样会偏（我因此把面板色
  误判成 `#3A3C49`，偏蓝 15 个色阶）；② 键帽列宽要**按列取并集**（整行 y 范围内该列曾是
  键帽色即算），只看一条水平线会被数字的白色笔画切断，而笔画像素宽度随截图缩放变化
  ⇒ 固定像素的「合并相邻段」阈值必然在某个缩放上失效。

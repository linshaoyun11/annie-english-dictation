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
- 本地验证工作流（探针页 + 无头 Edge CDP + 269 条真实词条扫描）：
  技能 `~/.workbuddy/skills/annie-layout-probe/SKILL.md`，改布局后照跑一遍。

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

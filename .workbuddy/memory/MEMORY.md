# 安妮英语听写（Annie English Dictation）项目长期记忆

iOS App，Capacitor + React + TS + Vite（**打包器是 rolldown，不是 esbuild**）。
Windows 开发、Codemagic 云端 CI、TestFlight 分发。构建号在 `codemagic.yaml` 的 `APP_BUILD`。

## 📚 记忆文件索引（本文件已拆分，按需读取）

本文件只放**高频核心**。以下专题文件**不会自动注入**，干活时主动 Read：

| 文件 | 内容 | 什么时候读 |
|---|---|---|
| `topics/curriculum-data.md` | 教材线结构 / id 与音频映射 / 课标级联效应 / renjiao3 现状 / 各线判定 | 动教材数据前 |
| `topics/official-sources.md` | CIP 反查 / 人教社官网 / 第三方 / 新教材推进时间表 | 核单元标题、判版次前 |
| `topics/rebuild-pipeline.md` | patch 四坑 / 流水线 / 常用脚本 | 录入教材前 |
| `topics/build-config.md` | 构建与发布配置 / 4 个暂不修复的已知问题 | 推送发版前 |
| `topics/ui-conventions.md` | 自绘键盘几何 / 图标三要素 / TrophyIcon | 改键盘或图标前 |
| `topics/audio-pipeline.md` | **有道 TTS 已死** / Edge·谷歌·百度实测 / 码率 / 代理 / 生成脚本 | 生成音频前 |

日志：`.workbuddy/memory/YYYY-MM-DD.md`（append-only，按天）。
重建计划：`docs/textbook-rebuild-plan.md`；拍照清单：`.workbuddy/preview/screenshot-checklist.html`。
Skill：`~/.workbuddy/skills/annie-rebuild-curriculum/SKILL.md`（重建教材线）、
`~/.workbuddy/skills/annie-audio-repair/SKILL.md`（**音频异常排查修复：判据选择、pre-108 快照、
大小写敏感、响度归一、A/B 试听页** —— 用户报「音频不对」时先读它）。

⚠️ **维护规则**：本文件控制在 8KB 以内。新增长内容一律写进 `topics/` 对应文件，
只在这里加一行索引。超过 8KB 会在注入时被截断 ⇒ 又会出现"记忆丢失"的假象。

## 关键设计约定（改动前必读）

- **iOS 上 `HTMLMediaElement.volume` 只读、恒为 1**，写 `el.volume = x` 是空操作。
  ⇒ 拼写输入用页内自绘 A–Z 键盘（`inputmode="latin"` 不是合法值，浏览器忽略）。
- **媒体实例必须显式释放** `releaseElement()`（pause + removeAttribute("src") + load()）。
  iOS WKWebView 仅解除 JS 引用不回收解码器，长会话线性累积导致卡顿（build 46 修的）。
  改音频代码务必保持"元素数恒定"。
- **保温用 `loop=true` 持续播放静音**，代价是功耗（占空比约 75%）。有意取舍。
- `safeTimeout` / `src/lib/timer.ts` 维护全局 pending Map（iOS 后台定时器冻结补发）。
  不需补发的定时器（如保温）用原生 `setTimeout`。
- **`createPortal` 只改 DOM 层级，不改 React 合成事件冒泡路径**。自绘键盘 portal 到 body，
  DOM 在 LearnPage 外，但触摸事件仍沿**组件树**冒泡到 LearnPage 根容器。
  已用 `data-dictation-keyboard` + `e.target.closest(...)` 排除。**新增 portal 浮层时同步确认。**
- **⚠️ 输入时机 = pointerdown 出字 ⇒「答对判定」发生在手指仍按下时**（2026-09-02）。
  后果：① 同次触摸合成的 click 砸到答对页「下一题」（幽灵点击）；② touchend 多指错位算出
  虚假 `dy < -60` 直接 `goNext()`。这是 build 52 后「答对页闪一下就跳下一题」的根因。
  **改输入时机或答对/完成路径前，先想清楚此刻手指是否还在屏幕上。**
  两道防线（勿删）：`LearningCard` 答对页按钮 `onPointerDown` 置位 + `onClick` 校验 ref；
  `LearnPage` 的 `answeredAtRef` / `touchStartAtRef` + `SETTLE_MS = 300`。
- **touch 手势起点用 `e.changedTouches[0]`，不能用 `e.touches[0]`**（多指时后者不是抬起的那根），
  并检查 `e.touches.length` 排除多指。
- **列表页顶部栏一律用 `<PageTopBar>`（build 115 起）**：`src/components/PageTopBar.tsx`，
  吸顶、自带「滚动后才出现的发丝线+投影」。**不要**再手写
  `<div className="flex items-center gap-3 pt-8">`（那是改前的写法）。
  滚动容器固定是 `<div className="h-full overflow-y-auto px-5 pb-10">`。详见 topics/ui-conventions.md。
- **⚠️ 音频查表区分大小写（build 114 起）**：`manifest.get(raw) ?? manifest.get(小写)`。
  `IT`/`it`、`US`/`us`、`AM`/`am`、`WHO`/`who` 是四个**读音不同的词对**，大字有独立键与文件
  ⇒ 改音频链路时三处必须同步：`audio.ts` 缓存键、`regen_audio_by_text.py` 的 `fname()`、
  `dump_all_texts.mjs` 去重键（**都必须是原样文本，不 lower**）。详见 annie-audio-repair 技能。

## 构建与配置（推送前必读，详见 topics/build-config.md）

- **本机 `npm run build` 必然失败于清空 dist**（沙箱 safe-delete 拦截）。
  **本地冒烟一律 `npx vite build --emptyOutDir=false`**（增量，不等价 CI 全量）。
- **⚠️ Codemagic 触发（2026-09-06 已纠正，此前记反了）**：
  有 `codemagic.yaml` 时，**网页端 App settings → Build triggers 的勾选项会被完全忽略**，
  只认 yaml 的 `triggering` 段。官方原文：「If no events are defined, you can only
  start builds manually」⇒ **没有 `triggering` 段 = 只能手动点「Start new build」**，
  不是"任何 push 都触发"。本项目 2026-09-06 前从未配过（查全部 20 个历史版本均为 0 行），
  所以一直是手动点。
  **⚠️ 2026-09-15 复核（此前这行记反了，已纠正）**：yaml 里现在**只有
  `triggering.branch_patterns: main`，没有 `events`** ⇒ 按官方规则仍然是
  **只能手动点「Start new build」**，自动触发是**用户主动关掉的**（控制构建次数）。
  **不要"顺手"把 `events` 加回去。** 详见 topics/build-config.md。
- **推送后不要再单独 commit+push 文档补记**：`APP_BUILD` 没变 ⇒ 第二个包因 **build 号
  重复被 ASC 拒绝上传**。⇒ **memory 补记必须在推送前写完、与代码一起提交**。
  （注：自动触发是关的、手工点构建，所以"多跑一个包"其实不会发生；
  但攒着一起推仍然是对的——省构建时长、避免手动点漏看。）
- **本地 `vite build` 在沙箱会卡死**（2026-09-06 新踩坑）：卡在
  `transforming... 56 modules transformed.` 无限挂起（与上面"清空 dist 被拦截"是不同
  症状，那个秒失败）。**卡超 3 分钟就停掉直接推**，别当推送门禁，`tsc -b --noEmit` 过即可。
- **`vite build` 约 2 分钟，用 run_in_background**，前台会超时。
- 改 Capacitor 配置后务必跑 `npx tsc -b --noEmit`（`cap sync` 静默忽略未知字段）。
- **`CURRICULUM_VERSION` 当前 = 29**（build 99 起，2026-09-13 六线专有词条清理）。
  每次删/动词条（id 全局递增）都必须升版触发 `freshProgress` 重置（积分保留、
  生词本按 `validIds` 自动过滤失效 id）。**再动 id 体系就要再升版。**

## 用户协作偏好

- 动手前先复述对需求的理解并确认，再输出正式内容。
- 反馈精准到部件级 / 字段级，喜欢结构化表格、分步骤、定量核验。
- 要求列表完整不省略、保留英文原文。
- **教材数据以用户提供截图为唯一准绳**；第三方来源只用于查漏，**有出入时不改数据**
  （2026-09-05 再次强调：G4 不要找官方目录，按拍的来）。
- 逐册拍截图推进，一次一册；每册 4 组页（CONTENTS + Vocabulary in Each Unit +
  Vocabulary A-Z + Useful Expressions）约 22-25 张。
- **用户 2026-09-06 起明确要求「所有任务不用询问，自行执行」**。
  含此前挂起的拍板项（版本号、优化取舍）也一并自行判断执行，只在回复里说明依据。

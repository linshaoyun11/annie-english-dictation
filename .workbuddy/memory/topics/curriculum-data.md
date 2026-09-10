# 教材线（curriculum）数据

> 由 `MEMORY.md` 拆分。改动教材数据前读本文件。

## 结构与 id

`src/data/curriculum.ts` 唯一入口：`CurriculumVersion` + `CURRICULA` + `CURRICULUM_LABELS`。
6 条线：renjiao / renjiao3 / waiyanshe / waiyanshe3 / oxford / renai。
数据文件：`curriculum.ts`（G1–G3）+ `grades4to9.ts`（G4–G9）+ `waiyanshe.ts` / `oxford.ts` /
`renai.ts` / `kebiaoBank.ts`（课标）。

- **id（`src/data/mk.ts`）**：`mk()` 全局 seq；`mkWithPrefix(prefix,...)` 前缀独立计数。
  ✅ **改 id 不会让音频失配**：`src/lib/audio.ts:96` = `manifest.get(text.toLowerCase())`
  ⇒ **音频只按「文本」查，不碰 entry.id**。改词库只需关心"新文本在不在 manifest 里"。
- **`CURRICULUM_VERSION`** 只在"既有 id/顺序变化、旧进度会错位"时升；新增教材线不升。
  当前 **= 8**（v8 是 G3 重建时升的）。⚠️ **G4-G9 后续重建已让 id 再次全偏移，
  推送前应升 9**（会重置用户进度，积分保留）— 待用户拍板。
- **manifest 是「文本→id」映射**，同文本词跨教材零成本复用。写出必须单行紧凑
  （等价 `JSON.stringify`），`indent=0` 会让 git diff 爆炸。
- **课标补全（`kebiaoBank.ts`）**：各教材文件末尾
  `applyKebiaoTo(CURRICULUM, makeXxxEntry, elemGrades, midGrades)`。⚠️ 两陷阱：
  ① `if (elemGrades.length)` —— **传 `[]` 时 band=2 小学词被静默丢弃**；
  ② `lastUnitOfGrade` 一次性预计算、`insertKebiaoUnits` 只 splice 不重编号 ⇒
  **elemGrades 与 midGrades 必须不相交**。1-9 年级用 `[3,4,5,6]`/`[7,8,9]`；renai（7-9）用 `[7]`/`[8,9]`。
- 课标词条**运行时生成** ⇒ 几乎不增包体。估算体积前先分清字面量还是运行时生成。
- 🔁 **级联效应（5 次验证）**：课标补全是**全局池子**，**重建任何年级都会让其他年级
  课标单元数收缩**。G9 重建 -1；G4 恢复后课标 23→19（G3/G5/G6 各 -1）。

## ⛔ 三年级起点版本的强约束（2026-09-08 用户拍板）

> 「这次修改不能动所有三年级起点的版本，因为那个版本我们是严格按照拍摄的教材重建的。」

`renjiao3` / `waiyanshe3` / `renai` 三条线 = **真实教材数据**（按用户逐册截图录入），
**任何修复方案不得以任何方式触碰这三条线的数组**，包括但不限于：
- 不得把三起线数组作为「一起线」G3+ 数据源（哪怕只是引用同一份对象）
- 不得修改三起线共享的基线常量（`WAIYANSHE_CURRICULUM` / `RENJIAO_G3_START` 等）
- 不得为「一起线」拆 / 改三起线的 dedupe / withKebiao 路径
- 不得为了「一起线 G3+ 真教材化」借道三起线

**当前代码隐藏冲突**（`src/data/curriculum.ts`）：
- `curriculum.ts:1029-1046`：`renjiao` 一线 G3+ 通过 `withKebiao(RENGIAO_G3_START, ...)` 派生，
  `RENGIAO_G3_START` 与 `renjiao3` 是同一数组（共享引用）。
- `curriculum.ts:990`：`WAIYANSHE_G1_START` 从 `WAIYANSHE_CURRICULUM` 派生，
  `WAIYANSHE_CURRICULUM` G3+ 段与 `waiyanshe3` 是同一份基线数组。
- `curriculum.ts:16-17` 注释明文：「renjiao 的 G3-6 与 renjiao3 共享此段，跟着变」——**已存在的违规**。

将来要做「一起线 G3+ 真教材化」，**必须先把引用拆开（深拷贝一层变成独立数组），
再装入新数据**，让两个版本的 G3+ 在内存中也互不影响。
详见 `.workbuddy/verification/grade-1-2-audit-2026-09-08.md`。

## renjiao3 现状（2026-09-05 全量核对后）

**116 单元 = 教材 97 + 课标 19 = 4,181 词条**。年级分布 **3:14 4:15 5:15 6:12 7:22 8:20 9:18**。
轨迹：141U/2846 → 127U/3098 → 121U/3515 → 119U/4033 → **116U/4181**。

| 年级 | U（教材+课标） | 教材词条 | 版本 | 状态 |
|---|---|---|---|---|
| G3 | 14（12+2） | 317 | 2024 秋三上/三下新版 | ⚠️ 4 处标题与官网不符，按截图保留（已用 CIP 验证三上无误） |
| G4 | 15（13+2） | 326 | 2024/2025 四上/四下新版 | ✅ 09-05 恢复（曾丢失，见下） |
| G5 | 15（13+2） | 347 | 五上新版 + 五下旧版 + Proverbs | ✅ |
| G6 | 12（11+1） | 337 | 六上新版 + 六下旧版 + Proverbs | ✅ |
| G7 | 22（18+4） | 774 | 七上/七下 2024-2025 新版 | ✅ 与官网一致 |
| G8 | 20（16+4） | 1,158 | 八上/八下 2025-2026 新版 | ✅ 与官网一致 |
| G9 | 18（14+4） | 712 | **2014 旧版全一册** | ✅ 按用户截图保留（覆盖 > 新版 8 U） |

- ⚠️ **替换某年级上册前必须先确认下册版本**。五下/六下**旧版是当前学生用书**
  （新版 2027 春才启用），不要"顺手更新"。九上同理保留旧版。
- 🔴 **G4 曾整段丢失**（2026-09-05 核对发现）：09-04 已按用户四上/四下 18 张截图录入
  151+175=326 词条并过 tsc/vite，但数据被后续 patch 回滚；而 `patch_g4u1-6.mjs` /
  `patch_g4u7-12.mjs` 的 **startMarker 写的是「patch 后文本」** ⇒ 对回滚后的文件无法匹配，
  脚本虽在却再没跑成功，进度表却记了 ✅。⇒ **patch 锚点必须针对「patch 前」的实际文本**。
  修复脚本 `scripts/patch_g4_restore.mjs`。
- 📊 **音频缺口 1,592 条（去重）**，覆盖 54.7%；美音英音各 1,592 ⇒ **约 3,184 个文件**待生成。
  **权威分年级表**（运行时口径：含课标、跨年级去重，和 = 1,592）——
  报数字给必须用这套，与 `check_audio_coverage.mjs renjiao3` 一致：

  | 年级 | 词条总数 | 缺口 | 覆盖率 |
  |---|---|---|---|
  | G3 | 331 | 95 | 71.3% |
  | G4 | 309 | 91 | 70.6% |
  | G5 | 310 | 107 | 65.5% |
  | G6 | 313 | 169 | 46.0% |
  | G7 | 667 | 279 | 58.2% |
  | G8 | 1,129 | **567** | 49.8% |
  | G9 | 458 | 284 | 38.0% |
  | 合计 | 3,517 | 1,592 | 54.7% |

  ⚠️ **两套口径容易混**：`analyze_audio_gap.mjs` 前 3 节是「字面量口径」（只扫源文件的
  `mk(...)`，不含课标、年级内不去重）⇒ 分年级和 = 1,699；第 4 节起改为运行时口径 ⇒ 1,592。
  **巧合的是两者总缺口都是 1,592**（课标词全是常见词，课标贡献缺口 = 0），
  但**分年级数字不同**（G9 字面量 347 vs 运行时 284），别混用。
  G9 覆盖率 38% 是口径造成（跨年级去重后只剩 G9 独有词），非数据问题。
  G8 缺主力：U28 医疗全词 / U30 地理专名（Angel Falls、Mariana Trench…）/ U31 灾害术语 /
  U32 国家名 / U33 30 部文学名著 / U34 救援术语。G9 主力：U13 环保术语 / U14 毕业短语。

  **🔑 缺口成因已实证（2026-09-05，`scripts/analyze_audio_gap.mjs`）**：
  对比 `git 80a5b59`（09-03 重建前）——
  | 分组 | 条数 | 缺音频 |
  |---|---|---|
  | 保留的旧词条 | 539 | **0** |
  | 重建新增文本 | 2,768 | **1,592** |
  | 被删旧词条 | 249 | （原本都有，现成孤儿） |

  ⇒ **不是"历史漏生成"，是"词库变大了"**。保留的旧词条一条都不缺，
  说明音频生成流程本身可靠。新增文本里 1,176 条（42.5%）复用已有音频，
  57.5% 才需新生成。另有 **338 个孤儿音频键**可回收。
  - 教材字面量词条 **788 → 3,307（×4.2）**，每单元 **9.6 → 34.1** 词
    （旧数据是约 10 词/单元的占位精简版，重建后按用户截图完整录入）
  - 课标单元 **79 → 19（−60）** ⇒ 教材完整后的级联效应，数据质量提升的标志
  - 包体：现有 **106.6 MB / 5,683 文件**；补齐后 **165.3 MB / 8,867 文件**
  - ⚠️ **现有音频码率偏高**：实测采样 30 个 = 平均 **68 kbps / 2.11 秒 / 15.4 KB**。
    TTS 人声用 **48 kbps 单声道** 足够 ⇒ 新增部分用 48 kbps 可省 17 MB（无损收益）。
    Apple 蜂窝下载门槛 200 MB，但 iOS 13+ 已非硬阻断（弹窗询问，可设置始终允许）；
    App Store 绝对上限 4 GB，完全不触碰。
  - 分析脚本（可复用）：`analyze_audio_gap.mjs`（成因拆解，支持 `OLD_COMMIT=xxx`）/
    `analyze_missing_types.mjs`（类型分布 + TTS 成本）/ `estimate_audio_size.mjs`
    （按文本长度分桶回归估算包体，**比线性外推准**，MP3 有固定开销非线性）
  - 报告：`.workbuddy/proofread/audio-gap-analysis.html`
- 小瑕疵（未改）：14 条空中文释义（G7 Starter 句型）；102 条 word/phrase 无音标
  （G5U7–U12 五下旧版短语）；G8U21 `Same or Different?` 比官网多一个问号；
  G8 单元编号 19–34（沿用 G7 连续编号，不影响功能）。

## 各线判定（用户 2026-09-04 决策）

6 条线全保留。`renai`+`waiyanshe3` 待用户拍照后重建；其余维持原样。

| 线 | 年级 | 判定 |
|---|---|---|
| waiyanshe3 | G3–9 | 教材 **76U/760**（+课标 79 ⇒ 155U/1885）。标题是主题词（错，真实是 Module→Unit 句式标题）；词条基本可用但 10 词/单元属精简版 |
| renai | G7–9 共 66 U（141 U 含课标） | 🔴 **整线精简版**：每 U 仅 12-14 词（885 字面量词条）。**且是 2012 旧版 Topic 粒度（G7 有 24 个单元）**，与 2024 新版 Unit 粒度（约 6 U/册）不可对齐 ⇒ 必须重建骨架 |
| renjiao（一起《新起点》） | G1–9 | ✅ **结构正确**（2026-09-05 更正，见下）。G1-G2 24U/240 词是真实低年级量；G3+ 共享 renjiao3 |
| waiyanshe | G1–2 | 教材 **20U/200**，独立数据（前缀 `wy`）。维持原样 |
| oxford | **G1–9** | 🔴 **整线精简版**：教材 96U/960，主题词式标题（与新版"问句式"差异大）⇒ 维持原样 |

> 🔴 **2026-09-06 重大更正（第 4 次纠正历史误判）**：
> 旧记「waiyanshe / waiyanshe3 完全镜像 renjiao / renjiao3」是**错的**——
> 根因是 `scripts/audit_all_curricula.mjs` 的 `LINE_CONFIG` 把外研两条线
> 错配成读 `curriculum.ts + grades4to9.ts`（**人教**的文件），
> 于是报出与 renjiao3 一模一样的 97U/3971，看起来像"镜像"。
> 外研真实文件是 **`src/data/waiyanshe.ts`（前缀 `wy`，G1–G9）**，已修正配置。
> 教训：**体检数字异常整齐（与另一条线完全相同）时，先怀疑脚本配置，别急着下结论。**

**📊 2026-09-06 全 6 线体检结果（修正 LINE_CONFIG 后，字面量口径）**：

| 线 | 字面量 U | 词条 | 平均/U | 判定 |
|---|---|---|---|---|
| renjiao3 | 97 | 3,971 | **40.9** | ✅ 真正重建完毕 |
| renjiao | 24 | 240 | 10.0 | ✅ G1-G2 真实低年级量（非精简） |
| waiyanshe3 | **76** | **760** | 10.0 | ⚠️ 主题词标题 + 精简版，待重建 |
| waiyanshe | **20** | **200** | 10.0 | 维持原样 |
| oxford | **96** | **960** | 10.0 | 🔴 整线精简版（旧版误报 60U/600，漏了 G7-G9） |
| renai | 66 | 885 | 13.4 | 🔴 整线精简版 + 旧版 Topic 结构 |

⚠️ 两口径别混用：`audit_all_curricula.mjs` 是**字面量**（只数源文件 `mk(...)`）；
`dump_curriculum.mjs` 是**运行时**（含 `applyKebiaoTo` 生成的课标单元）。
例：waiyanshe3 字面量 76U/760，运行时 155U/1885。引用时注明是哪个。

体检脚本：`node scripts/audit_all_curricula.mjs`（与 audit_renjiao3.mjs 同 7 项检查：编号连续性 / 词条数异常 / 字段完整性 / 单元内重复 / 跨年级重复 / 类型分布 / 年级合计）。

**✅ renjiao 一起线结构澄清（2026-09-05，第 3 次纠正历史误判）**：
MEMORY 旧记「renjiao G1–G2 由三起 `dedupeEarlyGrades` 推导、结构错」——**这个判断是错的**。
实际 `src/data/curriculum.ts:983` 的逻辑是：
`renjiao` = 人教**《新起点》**G1–G2（**独立录入的真实教材**，curriculum.ts 第 70-280 行，
一年级起点教材本就是另一套书）+ PEP G3–G6（共享 renjiao3）+ Go for it G7–G9。
`dedupeEarlyGrades` 只做**剔除 G3+ 中与 G1–G2 重复的词**（如 G4U13 Numbers 28→10，
数字在一年级 U4 已学过），**不是从三起派生 G1–G2**。
G1–G2 每单元 9–10 词是低年级真实词量（非精简版：G1U12 Clothes 十个衣服词齐整，
G1U1 School 含 hello/hi/good morning 等口语）。
⇒ **数据可用；后续若动 renjiao 线，别再拿"结构错"当前提。**

仁爱 / 沪教牛津完整目录见 `docs/textbook-rebuild-plan.md` 第二、三节。
拍照清单：`.workbuddy/preview/screenshot-checklist.html`。

---

## ⚠️ 教材词表分栏读法（2026-09-06 外研 G3 上踩坑，录入分栏词表前必读）

教材 `Words and expressions` 词表**分左右两栏**排版。正确读法：
**先左栏从上到下 → 再右栏从上到下 → 再续下一页**，然后**按单元标题分割**。

**典型坑**：把右栏的词全并进左栏所属单元 ⇒ 该单元虚高、下一单元被掏空。
实例（外研 G3 上）：
- ✅ 正确：Welcome = 31 条（`welcome`→`write`）；U1 = 39 条
  （右栏 `friend`→`know` 34 + 下一页 `let's`/our/everybody/with/me 5）
- ❌ 错误：把右栏 34 条并入 Welcome ⇒ Welcome 虚高 65、U1 只剩 5

**自检判据（两条并用，第 2 条更可靠）**：
1. 相邻单元词条数是否悬殊——错误态 65 vs 5（差 13 倍）
2. **主题自洽性**：单元内词条主题是否与单元标题匹配
   - `Welcome to school` = 学校/课堂（welcome, school, stand up, sit down,
     open, book, close, point, say, read, listen, write）
   - `Let's be friends!` = 交友（friend, meet, you, play, happy, together,
     help, thank, everyone, let's, our, everybody, with, me）

**读用户标注的规则**：用户用红框/蓝框标注截图时，**框的颜色 = 单元归属**。
「两个蓝框都是 U1」= 两个框都属于 U1，**不要**按左右栏拆成两个单元；
「下一页的前几个是 U1」= 跨页续接，仍归同一单元。

**本次另确认**：人教版（renjiao）G3–G9 无此类问题。正式单元极差比均 ≤ 2.2；
G5/G6/G7 的"悬殊"来自附录 Proverbs（4–6 条）与 Starter Unit（9–28 条），
属教材正常设计。判据要用**正式单元之间**比，别拿附录去比。

---

## 外研社 G3 下册（孙有中 2022 课标新版，2026-09-06 录入）

unit 编号 8-13，接 G3 上（unit 1-7）。6 单元 200 条。

| Unit | 标题 | 条数 | 首 → 尾 |
|---|---|---|---|
| 8 | Animal friends | 34 | animal → shoe |
| 9 | Know your body | 37 | body → face |
| 10 | Yummy food | 47 | yummy → cake |
| 11 | What's your hobby? | 29 | hobby → garden |
| 12 | What time is it? | 19 | tick-tock → call |
| 13 | A great week | 34 | Monday → music |

- Appendices 全部不录（与 G3 上同策略）
- 8 个 phrase：what about.../very much/afternoon tea/hot dog/a lot/tai chi/grow up/half past
- "half past" 原文 "half past one / two..." → 取核心模式避免 4 组输入
- 无跨单元重复，主题自洽

**G3 全年合计**：13 单元 408 条（上 208 + 下 200）。

⚠️ G3 下插入后 G4-G9 词条 id 后移 ⇒ 推送时必须升 CURRICULUM_VERSION。

---

## 🎯 课标自动补全范围（2026-09-07 用户**澄清版**，长期约定 · 以此为准）

**用户原话：「我说的不要添加课标是说我们重新构建的词库，我们重新构建的是：人教版三年级起点、
外研社三年级起点、仁爱七年级起点，其他的重新构建之前的那些一年级起点的课标需要保留。」**

⇒ 判据是**「这条教材线是否本轮重建」**，不是「哪个出版社」：

| 线 | 是否重建 | 课标 |
|---|---|---|
| `renjiao3` 人教版**三年级起点** | ✅ 重建 | ❌ 不补 |
| `waiyanshe3` 外研社**三年级起点** | ✅ 重建 | ❌ 不补 |
| `renai` 仁爱**七年级起点** | ✅ 重建 | ❌ 不补（renai.ts 无 applyKebiaoTo） |
| `renjiao` 人教版**一年级起点** | ❌ 旧版 | ✅ 保留 `[3,4,5,6] [7,8,9]` |
| `waiyanshe` 外研社**一年级起点** | ❌ 旧版 | ✅ 保留 `[3,4,5,6] [7,8,9]` |
| `oxford` 牛津上海版 | ❌ 旧版 | ✅ 保留 `[3,4,5,6] [7,8,9]` |

> ⚠️ 曾于 2026-09-07 误读为「三家出版社全关」，把三处调用都置空；同日按上表纠正。

### 🔧 实现要点（别再踩）
- `CURRICULUM`（人教）与 `WAIYANSHE_CURRICULUM`（外研）是**两条线共享的基线数组**
  （一起线 = 全量 + 跨线去重；三起线 = `filter(grade >= 3)`）。
  **直接对基线 `applyKebiaoTo` 会把课标同时灌进重建的三起线** ⇒ 不可行。
- 解法：基线保持纯净，派生时新增 `withKebiao(units, make, elem, mid)`（在
  `curriculum.ts`），**只对一起线的副本**追加课标。一起线随后还要过
  `dedupeEarlyGrades` + 早期词过滤，课标单元（3-9 年级）不受影响。
- id 稳定性：基线字面量先求值、课标后追加 ⇒ 三起线 id 不受课标影响。
- 核验脚本：`node scripts/verify_kebiao_scope.mjs`（重建线课标=0、其余>0、线内 id 不重复）。

### 当前家底（2026-09-07 运行时口径，`verify_kebiao_scope.mjs` 输出）

| 线 | 单元 | 词条 | 其中课标单元/词条 |
|---|---|---|---|
| renjiao（一起） | 140 | 4157 | 19 / 210 |
| renjiao3（三起） | 97 | 3971 | 0 / 0 |
| waiyanshe（一起） | 110 | 2705 | 16 / 201 |
| waiyanshe3（三起） | 74 | 2348 | 0 / 0 |
| oxford | 169 | 2010 | 73 / 1050 |
| renai | 38 | 2388 | 0 / 0 |

**🔴 占位数据（重要，影响后续优先级）**
- **外研 G7 上 / 下 / G8 全年 / G9 全一册**：已按 2022 课标新版重建
  （Starter+U1-U6=298 条；U7-U12=288 条；G8 上 U1-U6=342 条；G8 下 U7-U12=198 条；
  G9 全一册 U1-U6=237 条）。
- **外研三起初中段已重建完成**，无占位。
- **🟢 外研两线 App 端音频 100% 覆盖（2026-09-08 a9a2fbc）**
  - waiyanshe 2656/2656（美）+ 2656/2656（英）
  - waiyanshe3 2348/2348（美）+ 2348/2348（英）
  - 5 个最后缺失短句（fold / lift sb's spirits / clear sb's throat / feather-covered /
    great-aunt）已补齐。
- **牛津 G1-G9**：全学段 **10-12 单元 × 10 条/年级**，同样是占位（课标补了 73 单元才撑到 2010 条）。
⇒ 牛津仍待重建；判据：**每单元词条数恒为 10** = 占位数据的指纹，一眼可辨。

### CURRICULUM_VERSION
- 课标归属调整 + 三起线重建 ⇒ id 体系整体重排 ⇒ **12**。
- 外研 G7 上 ⇒ **13**；G7 下 ⇒ **14**；G8 上 ⇒ **15**；G8 下 ⇒ **16**；G9 全一册 ⇒ **17**。
- 5 短句补齐 **不动 id 体系**（只是新文本加键 + 旧文本补已有文件）⇒ CURRICULUM_VERSION 仍是 **17**。

### 🛡️ 5 短句补齐脚本范式（用户偏好：自行执行、不询问）
新写 `scripts/fill_waiyanshe_5.mjs`：
- 一次性小批量补漏 → 有道 dictvoice type=2/type=1 → 失败/超 60KB → Edge 兜底
- **同时写两份 manifest**（manifest.json + manifest-uk.json，独立字典）
- 写前魔数校验（拒收 WAV 伪装），写后体积校验对齐 audit 真理（1KB–60KB）
- 这个模式可复用：将来任何「少量 unique 短句补录」直接复制改 ENTRIES

---

## v23 (2026-09-09): 「3 年级起去重 1-2 年级已学词」机制废弃

### 改了什么
- `src/data/curriculum.ts` 删除 `rjEarlyWords` Set + `RENJIAO_G1_START` 中 `u.grade > 2` 的 filter 分支
- 同样删除 `wyEarlyWords` Set + `WAIYANSHE_G1_START` 中对应分支
- 设置页副标题「三年级起自动跳过已学词」→「按新起点 SL 真实教材 / 按外研新标准真实教材」
- `CURRICULUM_VERSION` 22 → 23
- `APP_BUILD` 70 → 71

### 触发数据变化
| 线 | v22 | v23 | Δ |
|---|---:|---:|---:|
| renjiao  | 2303 | 2410 | +107 |
| waiyanshe | 2602 | 2822 | +220 |
| 其它四条 | 不变 | 不变 | 0 |

旧过滤错删的 G3+ 课标必学词（my/your/name/class/grade/age/weather/subject/family/around 等）
在 v23 重回词表。

### 长期约束
- **别再引入类似「跨年级硬过滤」逻辑**，除非基线来自不同教材（一线课标已被 SL/新版教材吸收）
- 设置页副标题里**「自动跳过」「去重」是过时表述**，如要标记也是「按 XX 教材原样」
- 升版触发 freshProgress：积分保留、生词本按 validIds 自动过滤失效 id
- 推送前必须先 tsc，再 git commit，再 --force push

## v24：一线 SL 数据的 grade = 册序号（2026-09-10 修复年级错乱）
- `waiyansheSL.ts` / `oxfordSL.ts` 的 grade 字段是**册序号**：1A=1、1B=2、2A=3 … 9B=18。
  两套教材都是 1A-9B 18 册（沪教牛津 = 上海版 1-9 年级每学年 2 册；外研一线同构）。
  文件头注释自证：「G3 二年级上册 (2A)」「G5 三年级上册 (3A)」。
- UI gradeLabel：≤6→"小学N"、>6→"初中(N-6)" ⇒ 册 10-18 渲染成"初中4~12年级"（用户报告的 BUG）。
- **修复在组装层**（curriculum.ts）：`mergeBooksToGrades()` 归并 G=⌈册/2⌉、
  下册 unit 续接上册、entry 的 grade/unit/id 重写（seq 保留）、先按册号稳定排序
  （oxfordSL 里 3A/3B 排在 2A/2B 前）。**不要再把册号当年级写进数据文件**。
- 归并后：waiyanshe G1-G9 = 20/40/42/42/42/42/40/40/40 单元（2810 词条）；
  oxford = 20/12/24/24/24/8/12/12/12（1557 词条）。
- ⚠️ 连带坑（第 2 次）：dedupeEarlyGrades 的 seen 跨年级累计，归并后把 2A 中
  复现 1A/1B 核心词的整单元错删。已加 perGrade 参数（年级内去重），waiyanshe
  传 true，renjiao 保持旧行为。**任何"跨年级过滤/去重"对独立重建的教材段都是错删**。
- CURRICULUM_VERSION 24（两条线 id 全变，进度重置）。音频 0 影响（文本哈希命名）。
- oxford G6-G9 内容仍是占位级数据（标题"Module 1 "为空），等用户拍初中教材再补。

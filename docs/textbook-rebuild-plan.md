# 教材数据重建计划 · 2026-09-04

> 目标：① 仁爱版重做 **2024 新版**；② 沪教牛津用 **六三制一起 2024**；
> ③ 核实能否不买实体书拿到权威数据。
>
> 原则：**只依据出版社官方渠道（电子课本）或教育部平台（国家中小学智慧教育平台）**，
> 不采信教辅/文库/网盘的民间整理稿。

---

## 一、结论：不需要买实体书

### 国家中小学智慧教育平台有全套电子教材（免费）

| 项 | 结论 |
|---|---|
| 入口 | `basic.smartedu.cn` → 顶部【教材】→ 学段 / 学科 / 版本 / 册次 |
| 费用 | 免费 |
| 是否需要登录 | **需要**（注册账号即可，无特殊身份要求） |
| 在线阅读 | ✅ 可 |
| 导出 PDF | ⚠️ 平台本身无下载按钮，需浏览器插件（如 Edge 扩展「小源教材下载助手」），导出的是高清 PDF |

> 依据：沈阳市教育局官方推介《教育数字化 | 国家中小学智慧教育平台暑期应用推介(六)》
> 明确写「该应用提供小学、初中、高中和特殊教育的多版本电子教材」。

### 但有两个硬限制（决定了必须靠你人工操作）

1. **程序化抓取拿不到**：`basic.smartedu.cn/tchMaterial/detail?...` 实测只返回页面标题，
   教材正文是 JS 阅读器动态渲染 + 需登录态。我这边抓不到任何内容。
2. **词表页是图片，不是文本**：即使拿到 PDF，
   `Words in Each Unit` / `Vocabulary` 这些页在电子版里是**扫描图/版面图**，
   OCR 是唯一出路（人工校对代价可接受，见下）。

### 工作量估算（很小）

**每册只需 2–4 页，不是整本书。** 以仁爱七上为例，权威页只有这几页：

| 页 | 内容 | 用途 |
|---|---|---|
| 目录页（II/III） | Scope and Sequence | Unit 标题 + Function + 语法 |
| **P125–141** | **Words in Each Unit** | **分单元词条（核心）** |
| P142–155 | Vocabulary | 全册词表（A–Z） |
| P156–158 | 单元短语表 | 短语类词条 |
| P159–160 | Attached Word List | 补充词 |

也就是说：**导出整本 PDF 后，只需截图/导出这 4 组页给我**（或直接把 PDF 给我，我自己翻页识别）。

---

## 二、仁爱版 2024 新版 · 已核实目录

**结构定论**：6 册 × **6 Unit/册 = 36 单元**（不是旧版的 66，也不是我上一轮估的 72）。
每 Unit 4 个板块：`Preparing for the Topic` / `Exploring the Topic` /
`Developing the Topic` / `Wrapping up the Topic`。
Unit 编号跨册连续（七上 U1-6 → 七下 U7-12 → 八上 U1-6 → 八下 U7-12 → 九上 U1-6 → 九下 U7-12）。

| 册 | 版本标识 | Unit 标题（官方原文） | 来源可信度 |
|---|---|---|---|
| **七上** | 2024 秋版 | U1 Let's Be Friends!<br>U2 Meet My Family!<br>U3 Our Colorful School Life<br>U4 Fun in the Sun!<br>U5 Love Mother Nature!<br>U6 Celebrating the Big Days | ✅ **高**（4 源一致 + 与你提供的实物照片完全吻合） |
| **七下** | 2026 春版 | U7 Being a Smart Shopper<br>U8 Our Blue Planet<br>U9 From Here to There<br>U10 Lending a Helping Hand<br>U11 Rules Matter!<br>U12 Better Together | ✅ 高（dzkbw.org 官方目录） |
| **八上** | 2025 秋版（即原 A 套） | U1 My Dream Job<br>U2 The World of Art<br>U3 Sound Body, Sound Mind<br>U4 Changing and Growing<br>U5 Amazing Places<br>U6 Earth and Beyond | ✅ **用户 2026-09-04 二次核实确认 = A 套**（国家平台截图 U1 标 "Different jobs / Longing for future jobs"） |
| **八下** | 2026 春版 | U7 Be a Better Learner!<br>U8 Every Coin Counts!<br>U9 Forces of Nature<br>U10 World in the Cloud<br>U11 Fantastic Chinese Culture<br>U12 The Wonderland of Literature | ✅ 高（dzkbw 八下目录页） |
| **九上** | 2026 秋版 | U1 A Changing World<br>U2 Brilliant Thoughts<br>U3 A Green Earth, a Better Home<br>U4 A Colorful World of Words<br>U5 A Path Toward a Better World<br>U6 A Rising Self | ✅ **高**（dzkbw 目录 + Scope and Sequence 详表佐证） |
| **九下** | **2014 版**（沿用旧版） | 见九下小节 | ✅ **用户 2026-09-04 二次核实 = 2014 版**（"看上去很旧"） |

### ✅ 八上冲突已解（2026-09-04 二次核实）

用户用国家平台初中段目录截图确认：**八上 = A 套**。
U1 标题"My Dream Job"，对应 Function = "Different jobs" / "Longing for future jobs"，
Pronunciation = "Sonorization & Incomplete plosion"。
⇒ 我上一轮推断的"B 是 2026 秋正式版"被推翻：**A 才是当前真实目录**。

### 九下 = 2014 版（即老本子，2025.12 仍在重印）

用户给出的实物：

| 项 | 内容 |
|---|---|
| 封面 | 仁爱 logo + "英语 Project English · 九年级 · 下册" + 教育部审定 2013 |
| 扉页 | 主编 王德春 + Jim Greenlaw(加拿大) + 杨晓红；编著 Robert White(加拿大) 等共 9 人 |
| 出版社 | 科学普及出版社（北京） |
| ISBN | 978-7-110-08774-9（旧）/ 978-7-110-08774-9/G·3720（新版编码） |
| CIP 数据 | **2014.10** (2025.12 重印) — 即 2014 年第 1 版 |
| 印刷记录 | 2014 年 11 月第 1 版，**2025 年 12 月第 21 次印刷** |
| 编写单位 | 北京市仁爱教育研究所（北京市海淀区西四环北路 68 号） |

**判定：**
- 九下**当前仍用 2014 版**（2025.12 还在重印 ⇒ 该版本仍合法且在用）
- 用户口述「似乎很旧了」= 偏旧的主观感受，不是错误
- 国家平台九下若仍是 2014 版 ⇒ 整条仁爱 2024 新版仅覆盖七上—九上，**九下沿用旧本**
- ⇒ 重建时 renai 的 G9 下册仍照 2014 版词条录入（与落地数据的 2012 旧本略有出入
  但同源同套，体系一致）
- **不要**为九下强行套 2024 新版目录（无 2024 版可套）

---

## 三、沪教牛津（六三制一起 2024）· 已核实目录

出版社：**上海教育出版社（广深用）**。
课时结构：`Ready? Go!` / `Story` / `Practice` / `Communicate` / `Extend` / `Letters`。

| 册 | Unit 数 | Unit 标题（官方原文） | 状态 |
|---|---|---|---|
| 一上 | 8（推测） | U1 What is your family like?<br>U2 How are you today?<br>U3 What do you take to school?<br>U4 What can you do?<br>U5–U8 待补 | ⚠️ 部分 |
| 二上 | ? | 待补 | ❌ |
| **三上** | **8** | U1 How do we feel?<br>U2 What's interesting about families?<br>U3 What do we look like?<br>U4 How do we have fun?<br>U5 What do we eat?<br>U6 What do we like about small animals?<br>U7 What do we know about weather?<br>U8 Why do we like birthdays? | ✅ 高 |
| **四上** | **8**（新教材） | U1 Where do people live?<br>U2 Where do animals live?<br>U3 How do we use numbers?<br>U4 What do we buy?<br>U5 How are the seasons different?<br>U6 What's amazing about plants?<br>U7 How do we keep safe on the road?<br>U8 What do our grandparents do? | ✅ 高（51jiaoxi 新教材专辑 2026-08） |

| **五上** | **8**（新教材） | U1 What do we do at the weekend?<br>U2 How do we stay healthy?<br>U3–U8 待补 | ⚠️ 部分（51jiaoxi 新教材专辑 2026-08） |

> 📌 **2024 新版进度**：已出版至**五年级上册**（一上/一下/二上/二下/三上/三下/四上/四下/五上）。
> 五下、六上、六下仍是**旧版**（Module 制 12 Unit）。

### ⚠️ 四上、五上各有两套并存（新旧教材 tab）

**四上**

- **旧版（Module 制，12 Unit）**：M1 Getting to know you → U1 Meeting new people / U2 Can you swim / U3 Are you happy；M2 → U4 Do you have any cousins / U5 My friends / U6 My parents；M3 → U7 At school / U8 At the shop / U9 At home；M4 → U10 Around my home / U11 Shapes / U12 Weather
- **2024 新版（8 Unit）**：见上表

**五上**

- **旧版（Module 制，12 Unit）**：M1 Getting to know each other → My birthday / My way to school / My future；M2 Relationships → Grandparents / Friends / Moving home；M3 Out and about → Around the city / Buying new clothes / Seeing the doctor；M4 The natural world → Water / Wind / Fire
- **2024 新版（8 Unit）**：U1 What do we do at the weekend? / U2 How do we stay healthy? / …

**🔄 更正上一轮的判断**：我上一轮写「百度百科把 Unit 1 Meeting new people 标给 2026 秋四上，疑为串版」
——**这个判断错了**。`Meeting new people` 就是**四上旧版**的真实 Unit 1（深圳用沪教牛津四上），
不是从人教 PEP 串过来的。百度百科的问题是**把新旧两套目录混排**，不是串版。
判断依据：51jiaoxi 在四上/五上都有明确的「新教材 / 旧教材」两个 tab，
旧教材 tab 下就是 Module 制 12 Unit，与百度百科完全吻合。

**⇒ 结论：以 51jiaoxi 标注「新教材」的专辑为准；百度百科的新旧混排不可信。**

---

## 四、关键约束：国家平台只有三年级起点（政策根因）

用户实测：**国家中小学智慧教育平台里，所有版本的英语教材都从三年级开始。**
这不是平台遗漏，是有政策依据的结构性事实。

### 根因

| 层级 | 事实 | 出处 |
|---|---|---|
| 国家课程 | 《义务教育课程方案（2022年版）》：**小学英语国家课程标准起始开设年级为三年级** | 泸县教体局、安庆大观区教体局、蒙阴县教体局公开答复（2026） |
| 一、二年级 | **不作统一开课要求**；有条件的地区可开「英语预备类课程」，**教材由省级审定**，不得读写/纸笔考试 | 同上 |
| 平台收录范围 | 国家平台只收录《**国家课程教学用书目录**》内的教材 | 实证：dzkbw.com 一年级英语上册（五四制·牛津上海版）页面明确标注「**该书不在《2025年国家课程教学用书目录》，不是现行版本**」 |
| 征订体系 | 地方政府公开目录里，一二年级是「义教英语（**一年级起点**）」、三年级起是「义教英语（**三年级起点**）」——两套并行 | 青岛即墨/平度、德州齐河/庆云、烟台海阳 2025–2026 教科书选用目录 |

**⇒ 国家平台拿不到任何「一年级起点」教材。这是硬边界，不是努力问题。**

### 对各条教材线的影响

| 线 | 学段 | 国家平台 | 状态 |
|---|---|---|---|
| `renai` **仁爱科普版**（科学普及出版社） | G7–9 | ✅ **可得** | 初中英语属国家课程正式教材，在国家目录内 |
| `renjiao3` 人教 PEP 三起 | G3–9 | ✅ 可得 | — |
| `waiyanshe3` 外研三起 | G3–6 / **G8–9（无 G7）** | ✅ 可得 | ⚠️ G7 **整段无源**（外研三起无 7 年级教材） |
| `renjiao` 人教一起 | G1–6 | ❌ 不在国家目录 | 需走人教社官网 |
| `waiyanshe` 外研一起 | G1–6 | ❌ 不在国家目录 | 需走外研社 / 教习网 |
| `oxford` 沪教牛津一起（广深用） | G1–6 | ❌ 地方用书 | 需走教习网等教辅站 |

### ✅ 仁爱版不受影响 —— 它是国家课程正式教材

多处地方政府官方文件实证：

| 出处 | 内容 |
|---|---|
| 重庆奉节县 2026 秋教材版本一览表 | 初中 英语 七至九年级 **仁爱版 / 科学普及出版社** |
| 重庆潼南区 2026 教材版本一览表 | 同上 |
| 湖南省教育厅 2023 秋–2024 春教科书目录 | 英语八年级上、下册（**仁爱版**）**科学普及出版社** |
| 河南三门峡市实验中学 2025–2026 目录 | 英语 **科学普及版 / 科学普及出版社** |

**⇒ 你在国家平台要切到「初中」学段去找，小学段当然只有三年级起点。**
（另注：仁爱版出版社是**科学普及出版社**，不是我记忆里写的「北京市仁爱教育研究所」——
后者是编写单位，前者是出版单位。教习网也标注为「仁爱科普版(2024) 出版社：科学普及出版社」。）

---

## 五、现有落地数据逐线判定（2026-09-04 词条级抽查后）

### 用户决策（2026-09-04）

1. **6 条线全部保留**：`renjiao` / `waiyanshe` / `oxford` 三条一年级起点
   **维持原样不动**（数据错但不在国家平台取证范围，本轮不投入）。
2. **`renai` + `renjiao3` + `waiyanshe3` 由用户提供截图**后重建。
3. **仁爱八上两套冲突**：用户登录国家平台时顺手查真实目录再定。

### 词条级抽查结论（关键：省掉大量截图）

**`renjiao3` 小学 G3–G6 = 100% 真实，无需任何素材。**
标题逐条对应人教版 PEP 三上/三下真实目录，词条也逐条对应真实词表：

| 落地 | 真实教材 | 词条抽查 |
|---|---|---|
| u1 Hello! | PEP 三上 U1 Hello! | ruler / pencil / eraser / crayon / pen / book ✅ |
| u2 Colours | PEP 三上 U2 Colours | red / green / yellow / blue / black / brown ✅ |
| u3 Look at me! | PEP 三上 U3 Look at me! | face / ear / eye / nose / mouth / arm ✅ |
| u4 We love animals | PEP 三上 U4 We love animals | duck / pig / cat / bear / dog / elephant ✅ |
| u5 Let's eat! | PEP 三上 U5 Let's eat! | bread / water / juice / cake / egg / fish ✅ |
| u6 Happy birthday! | PEP 三上 U6 Happy birthday! | one / two / three / four / five / six ✅ |
| u7 Welcome back to school! | PEP 三下 U1 | China / Canada / USA / UK / teacher / student ✅ |
| u8 My family | PEP 三下 U2 My family | dad / mum / man / woman / grandma ✅ |
| u9 At the zoo | PEP 三下 U3 At the zoo | thin / fat / tall / short / long / small ✅ |
| u10 Where is my car? | PEP 三下 U4 | on / in / under / chair / desk / cap ✅ |
| u11 Do you like pears? | PEP 三下 U5 | pear / apple / banana / watermelon / strawberry ✅ |
| u12 How many? | PEP 三下 U6 How many? | eleven / twelve / thirteen … ✅ |

**`renjiao3` 初中 G7–G9 = 标题真实（人教版 Go for it!），但残缺。**

- ✅ 标题逐条对应：My name's Gina. / This is my sister. / Is this your pencil? /
  Where's my schoolbag? / Do you have a soccer ball? / Do you like bananas?
- ✅ 词条基本对：U3 pencil/dictionary/eraser/notebook/watch/ring；
  U5 soccer/basketball/volleyball/tennis/baseball
- ⚠️ **缺 17 个单元**（七下只落 3/12、八下只落 2/10）
- ⚠️ G7U1 混入了 **Starter Unit** 的词（morning/afternoon/evening 属预备篇，非 U1）

**`waiyanshe3` = 标题是主题词（错），词条基本可用。**

- ❌ 标题：落地为「Greetings and names / Classroom and colours / Numbers / School …」，
  外研新标准真实结构是 **Module → Unit 句式标题**（如 M1 Unit 1 I'm Sam. / Unit 2 How are you?）
- ✅ 词条：hello / goodbye / fine / thank / name / what / your / please —— 与三上 M1 吻合
- ⇒ **只需补目录页换标题，词条大概率可留**

### 处置总表（2026-09-06 刷新，替代 09-04 版）

> ⚠️ 09-04 版已失效：renjiao3 已全部重建完成，waiyanshe3 的结构也变了。以本表为准。

| 线 | 现状（2026-09-06 实测） | 标题 | 词条 | 处置 | 需素材 |
|---|---|---|---|---|---|
| `renjiao3` | **教材 97U / 3971**（+课标 19 ⇒ 116U / 4181） | ✅ 真实 | ✅ 真实 | ✅ **已完成** | 无 |
| `waiyanshe3` | 教材 **76U / 760**（+课标 79 ⇒ 155U / 1885） | ❌ 主题词（Greetings and names / Classroom and colours …），外研真实结构是 **Module → Unit 句式标题** | ⚠️ 基本可用，但 10 词/单元属精简版 | **换标题 + 补词条** | 小学 8 册 + 初中 2 册目录 |
| `renai` | 教材 **66U / 885**（+课标 75 ⇒ 141U / 1982） | ❌ 2012 旧版，且按 **Topic** 粒度建单元（G7 有 24 个） | ❌ 精简版 13–14 词/单元 | **整线重写**（先换结构再填词） | 6 册目录 + 词表 |
| `renjiao` 一起 | 24U / 240（仅 G1–G2） | ❌ 结构错 | ❌ | **维持原样**（用户 09-04 决定） | 无 |
| `waiyanshe` 一起 | 教材 **20U / 200**（G1–G2） | ❌ 主题词 | ❌ | **维持原样** | 无 |
| `oxford` 一起 | 教材 **96U / 960**（+课标 73 ⇒ 169U / 2010） | ❌ 通用主题词占位（Greetings / My body / Colours …） | ❌ 10 词/单元 | **维持原样** | 无 |

> 📌 数字均为 `scripts/audit_all_curricula.mjs` 的**字面量口径**（只数源文件里的 `mk(...)`，
> 不含运行时生成的课标单元）。括号里的「+课标」是 `dump_curriculum.mjs` 的**运行时口径**。
> 两个口径差一截是正常的，引用时注明是哪个。

**⚠️ renai 的关键认知（2026-09-06 新增）**：重建不只是"补词条"。
现有数据按旧版** Topic** 粒度建单元（如 G7 有 U1 Welcome to China! / U2 Where are you from? /
U3 How old are you? … 共 24 个），而 **2024 新版是 Unit 粒度（约 6 个/册，如七上
U1 Let's Be Friends! / U2 Meet My Family! …）**。两者结构不可对齐，
必须**先按新版 Unit 重建骨架，再逐册填词**，不能沿用现有单元壳。

---

## 六、需要你提供的素材（最小化清单 · 共约 38–44 张）

### 📊 进度（2026-09-05 更新）

| 批次 | 状态 | 说明 |
|---|---|---|
| **PEP 三起小学 G3–G6** | ✅ **已完成**（⚠️ 见下方 G4 事故） | 用户逐册拍 60+ 张（三上/三下/四上/四下/五上/五下/六上 + **六下 9 张 2026-09-04 补拍**），按 2024 秋新版重做完毕；五下/六下经核实为旧版且已按用户截图**完整**录入（含 Appendix 5 Proverbs） |
| **PEP 三起 G7 上（初一上）** | ✅ **已完成 2026-09-05** | 用户拍 11 张（CONTENTS + Section A/B + Vocab in Each Unit P106-112），按 2024 秋新版录入 10 Unit（3 Starter + 7 正式 Unit），337 词条 |
| **PEP 三起 G7 下（初一下）** | ✅ **已完成 2026-09-05** | 用户拍 13 张（CONTENTS II-V + Vocab in Each Unit P97-105），按 2024 秋新版录入 8 Unit（Animal Friends / No Rules / Keep Fit / Eat Well / Here and Now / Rain or Shine / A Day to Remember / Once upon a Time），419 词条 |
| **PEP 三起 G8 上（初二上）** | ✅ **已完成 2026-09-05** | 用户拍 16 张（CONTENTS II-V + Vocab in Each Unit P111-122），按 2024 秋新版录入 8 Unit（Happy Holiday / Home Sweet Home / Same or Different? / Amazing Plants and Animals / What a Delicious Meal! / Plan for Yourself / When Tomorrow Comes / Let's Communicate!），558 词条 |
| **PEP 三起 G8 下（初二下）** | ✅ **已完成 2026-09-05** | 用户拍 15 张（CONTENTS II-V + Vocab in Each Unit P113-124），按 2024 秋新版 2026 春启用版录入 8 Unit（Time to Relax / Stay Healthy / Growing Up / The Wonders of Nature / Nature's Temper / Crossing Cultures / A Good Read / Making a Difference），603 词条 |
| PEP 三起 **九全一册** | ✅ **已完成 2026-09-05** | 用户拍 **25 张**（旧版 Go for it! 全一册 14 Unit 完整版 + 目录），按 2014 旧版完整录入 14 Unit + 课标 4 ⇒ **18 U / 760 词**（详见 .workbuddy/baselines/baseline-renjiao3-g9-new.txt）。注意：旧版覆盖更全 ⇒ 保留旧版而非新版 8 Unit |
| **音频（全 6 线 × 美英双语）** | ✅ **已完成 2026-09-06** | Edge TTS 生成 3184 个缺失音频（3184/3184 零失败）+ 修复 305 个 WAV 伪装文件 + 存量统一 48 kbps。全库 8867 个 / **82.7 MB**（起点 106.6 MB，多装 3184 个反而净减 23.9 MB），覆盖率 **100%** |
| 仁爱 2024 新版 6 册 | ⏸ 待拍 | 批次 1（**结构需从 Topic 换成 Unit**，见上方处置总表） |
| 外研三起 10 册 | ⏸ 待拍 | 批次 2（现状：教材 76U/760，主题词标题 + 10 词/单元精简版，需换标题并补词） |

### 📌 renjiao3 现状（2026-09-05 全量核对后）

**116 单元 = 教材 97 + 课标 19 = 4,181 词条**；年级分布 **3:14 4:15 5:15 6:12 7:22 8:20 9:18**。
轨迹：141U/2846 → 127U/3098 → 121U/3515 → 119U/4033 → **116U/4181**。

完整核对报告：`.workbuddy/proofread/audit-renjiao3-report.html`
完整校对文档：`.workbuddy/proofread/proofread-renjiao3-g3456789.html`（97 单元 / 3,971 词条）

#### 🔴 G4 数据丢失事故（2026-09-05 核对发现并修复）

2026-09-04 已按用户四上 9 张 + 四下 9 张截图完整录入 151 + 175 = **326 词条**并通过
tsc/vite，但**数据在后续 patch 中被回滚**；而 `patch_g4u1-6.mjs` / `patch_g4u7-12.mjs`
的**锚点写成了「patch 后」的文本**，对回滚后的旧版文件无法匹配 ⇒ 脚本虽在却再没跑成功过，
进度表却记了「✅」。直到 2026-09-05 全量核对才发现 G4 一直是旧版 12 单元 × 10 词精简版。

**修复**：`scripts/patch_g4_restore.mjs` 用正则从两个原始脚本抽出**按用户截图写入的 newBlock**
合并回填（不使用任何第三方/推测数据），结果与当日日志逐单元吻合。

> 💡 **教训（已沉淀进 skill）**：① patch 锚点必须针对「patch 前」的实际文本；
> ② 脚本执行后**必须立刻 dump 验证词条数**，不能只看脚本没报错；
> ③ 每册录完必跑 `node scripts/audit_renjiao3.mjs`——**某年级每单元都恰好 10 词 = 未重建**。

#### ✅ G3 四处标题已用 CIP 验证（2026-09-05 重大更正）

用户 2026-09-05 发了三上版权页（ISBN 978-7-107-38250-5）。用 ISBN 反查 CIP 平台
（`book.cppinfo.cn`）得到**首次出版的定稿目录**：

```
Unit 1 Making friends
Unit 2 Different families
Unit 3 Our animal friends     ← CIP 目录确认 ✅ 与用户截图一致！
Unit 4 Plants around us
Unit 5 The colourful world
Unit 6 Useful numbers
```

**关键发现**：CIP 登记的是首次出版（2024-07 版次 1）的目录，**不随重印改变**。
人教社官网 `pep.com.cn/zslth/yyptzy/xypep/3s` 显示的 `Amazing animals` 是 **2025 重印时的
内容修订**（不是版次变化）。用户书版权页绿章「国家教材委员会 2024 审查通过」也印证
2024-07 首次印刷版。

**结论**：用户的截图 = **CIP 登记的权威版本**，**无需任何修改**。
其他 3 处差异（G3U8/U9/U11 在三下）等用户提供三下 ISBN 后用同样方法验证。

**🔑 推断（高置信度）**：G3 上下册通常同时出版，三上是 2024-07 首次印刷版 ⇒ **三下极大概率
也是 2024 首次印刷版**（同一审查批次同时发行）。官网 `xypep/3x` 显示的 Expressing yourself /
Learning better / Old toys 极可能也是 2025 重印的标题修订，**用户的 My words and actions /
Tools and senses for learning / Old things 是原版定稿**。
⇒ **强烈倾向于：用户数据正确，无需修改**。要 100% 确认只需拍三下版权页 ISBN 给 CIP 查一下。

**经验沉淀**：版本核定的权威顺序
1. 🥇 **CIP（`book.cppinfo.cn`）** — 首次出版定稿目录，不随重印改变
2. 🥈 **用户实体书版权页**（ISBN + 绿章年份 = 版次审查年）
3. 🥉 **人教社官网** — ⚠️ 会随重印更新内容（版次信息不动）

#### 🔗 官方直读渠道（2026-09-05 补充了小学部分）

- **小学 PEP 三起**：`pep.com.cn/zslth/yyptzy/xypep/{3s,3x,4s,4x,5s,5x,6s,6x}` ← **新发现**
- **初中**：`pep.com.cn/zslth/yyptzy/czyy/{7s,7x,8s,8x,9s}`（`9x` 无页面）
- 新版路径 `yyptzy` / 旧版 `yyptypzj`；`xypep`=小学 PEP、`xyjt`=一起。curl 需 `--compressed`。
- ⚠️ 官网 "Words in each unit" **全是 mp3 无文本** ⇒ 词表只能人工录入/OCR。
- **用途：拍素材前先来这确认目录，不用麻烦用户先拍目录页。**


**✅ 五下已交叉验证**：与 3 个第三方教辅站词表比对，U7/U8/U10/U11/U12 逐条一致；
U9 有出入，**以用户截图为准**。详见 `.workbuddy/memory/2026-09-04.md` 第十四轮。
**✅ 六下已按用户 2026-09-04 补拍 9 张完整录入**：4 个教材单元每单元 20+ 词 + 完整 Useful expressions
（不是只录到目录页）+ Appendix 5 Proverbs（4 句谚语）。旧版六下之前从 git HEAD 恢复的是 10 词/单元
的精简版，本次按截图补齐。详见 `.workbuddy/memory/2026-09-04.md` 第十六轮。

### ⚠️ 批次 3 更正：初中「只拍目录页」不够

原计划写初中"只需目录页"——那是基于"只核对单元数和标题"的假设。**但词库要的是词条**，
所以初中每册需要的是**册末词条页**，目录页只作辅助：

- `Words and Expressions in Each Unit`（分单元词表，最重要）
- `Vocabulary Index`（A–Z 总表，兜底查漏）
- 目录页（1 张，核对单元标题）
- `Useful Expressions` / 不规则动词表（若有）

**人教七上新版参照页码**（`haoduoyun.cc/book/rjb/yingyu/xa7s.shtml`）：
Vocabulary in Each Unit **P109** / A–Z **P116**。其余 5 册页码待翻。

### 批次 1 · 仁爱科普版（6 册，跨 2024/2014 两套）— 拍照时按"4 组页 + 附录"，学 PEP G9 经验

**每册 ~22-25 张**（CONTENTS 1-2 张 + Vocabulary in Each Unit 多页 + Vocabulary A-Z 多页 + Useful Expressions / 短语 / Attached Word List 等附录）。

| 册 | 版本 | 已知目录 | 拍什么 / 已知页码 |
|---|---|---|---|
| 七上 | 2024 秋 | Let's Be Friends! / Meet My Family! / Our Colorful School Life / Fun in the Sun! / Love Mother Nature! / Celebrating the Big Days | 目录 II-V；**Vocabulary in Each Unit** P128-141；**Vocabulary A-Z** P142；**短语** P156；**Attached Word List** P159 |
| 七下 | 2026 春（推测） | Being a Smart Shopper / Our Blue Planet / From Here to There / Lending a Helping Hand / Rules Matter! / Better Together | 拍附录组全部页（页码你翻到册末确认） |
| 八上 A 套 | 2025 秋 ✅ | My Dream Job / The World of Art / Sound Body, Sound Mind / Changing and Growing / Amazing Places / Earth and Beyond | 同上模式；目录+册末词表 4 组页 |
| 八下 | 2026 春（推测） | Be a Better Learner! / Every Coin Counts! / Forces of Nature / World in the Cloud / Fantastic Chinese Culture / The Wonderland of Literature | 同上 |
| 九上 | 2026 秋（推测） | A Changing World / Brilliant Thoughts / A Green Earth, a Better Home / A Colorful World of Words / A Path Toward a Better World / A Rising Self | 同上 |
| 九下 | ✅ **2014 版沿用** | （2012 审定老版本目录，2025.12 第 21 次重印仍合法；**无 2024/2026 新版替代**，沿用 2014） | **拍实物**！目录+册末词表 4 组页 |

**🙏 建议先拍：七上 + 九下（你手上肯定有的两本）。** 这两本就能启动批次 1。
**拍完确认顺序：先目录（1-2 张）+ 再翻到册末词表页 → Vocabulary in Each Unit → Vocabulary A-Z → 附录短语/Attached Word List。**

### 批次 2 · 外研三起（**10 册 = 小学 8 + 初中 4**）— 拍目录 + 册末词表 4 组页

**外研三起官方目录页码已核实**：每册结构为 Module → Unit 句式标题（如 M1 Unit 1 I'm Sam.）。

| 学段 | 册 | 版本 | 状态 |
|---|---|---|---|
| 小学 | 三上/三下/四上/四下/五上/五下/六上/六下 | 1-2 年级用一起版，3 年级起走三起 → 当前 data 仅 G3-G6 4 册 | 拍 4 本：3/4/5/6 年级上下册各 1 本 |
| 初中 | 八上/八下/九上/九下 | 三起初中版（**没有 G7**） | 拍 4 本：八/九年级上下册 |

**当前落地数据问题**（决定拍哪些）：
- 小学 G3-G6 = 标题是主题词（错），词条基本可用 ⇒ **只需目录页（1 张）+ 册末词表**；约 8 张
- 小学 G1-G2 = 用的是三起数据，不属于本教材线 ⇒ **保持现状不动**
- 初中 G8-G9 = 8 单元 × 4 册 = 32 单元，需要按截图补齐缺失单元 + 词条 ⇒ 4 册 × 20 张 ≈ 80 张
- 初中 G7 = **12 单元整段无源**，重建时**整段删除**（不是重建，是降为 N/A 状态）

**拍法**：每册 4 组页 = **① 目录 1 张 ② Vocabulary in Each Unit 多页 ③ Vocabulary A-Z 多页 ④ Useful Phrases / 附录 1-2 张**。
**🙏 建议先拍：小学 8 册的 G3/G4（最容易拿到实物的两本）。** 拍完这两本就能推进外研三起小学整段重做。

### 批次 3 · 人教 PEP 三起初中 — ✅ **已完成 2026-09-05**（含小学 G3-G6 + G7-G9 初中全套）

**renjiao3 全部 14 册均按 2024 秋新版（小学）/ 2025-2026 新版（初中七上-八下）/ 2014 旧版全一册（九）完整录入**：

| 册 | 版本 | 单元数 | 状态 | 拍法 / 已知页码 |
|---|---|---|---|---|
| 三上/三下 | 2024 秋 | 7+5=12 + 3 课标 | ✅ 已录 | 11 张/册 |
| 四上/四下 | 2024 秋 | 6+6=12 + 2 课标 + Numbers 附录 | ✅ 已录 | 11-13 张/册 |
| 五上/五下 | 2024 秋（五上）/ 旧版（五下） | 6+6=12 + 1 Proverb | ✅ 已录 | 9-13 张/册 |
| 六上/六下 | 2024 秋（六上）/ 旧版（六下） | 6+4=10 + 1 Proverb | ✅ 已录 | 9-13 张/册 |
| 七上 | 2024 秋 | 3 Starter + 7 | ✅ 已录 | 11 张 |
| 七下 | 2025 春 | 8 | ✅ 已录 | 13 张（词表 P97-105） |
| 八上 | 2025 秋 | 8 | ✅ 已录 | 16 张（词表 P111-122） |
| 八下 | 2026 春 | **8** | ✅ 已录 | 15 张（词表 P113-124） |
| 九全一册 | **2014 旧版沿用**（新版只有 8 U） | **14** 完整版 | ✅ **已录 2026-09-05** | **25 张**（旧版全一册 14 U + 目录） |

**净收益**：教材 96 + 课标 23 = **119 单元 / 4033 词条**（轨迹：141U/2846 → 127U/3098 → 119U/4033）

**✅ 官方渠道可直接确认单元标题**（不用麻烦用户先拍目录页）：
`pep.com.cn/zslth/yyptzy/czyy/{7s,7x,8s,8x,9s}` —— 新教材路径 `yyptzy`（旧版是 `yyptypzj`）。
⚠️ 该页 Vocabulary 条目**全是 mp3，没有文本** ⇒ 标题可官方查，词条仍只能人工录入（见下）。

**已批量确认（人教社官网 `czyy/8x` `czyy/9s`）**：见批次 3 表 / .workbuddy/memory 历轮日志
The Changing World / Inspiring People / Smart Learning / Our Memory / Power of Ideas /
Beyond Earth / Feel the Rhythm / More than a Game

- 目的：补齐旧版缺的 17 个单元 + 拿准确标题 + **录入全部词条**
- 小学 8 册**不用再拍**（G3–G6 已按 2024 秋新版重做完毕）
- ⚠️ 七上新版有 **3 个 Starter Unit**（Hello! / Keep Tidy! / Welcome!），
  若 Starter 有独立词汇请一并拍（或口头说明"Starter 无独立词表"）

### 顺手帮我确认（在国家平台初中段）

1. ~~**仁爱八上**是「My Dream Job」还是「Healthy Mind and Body」那套~~ → ✅ **已确认 = A 套（My Dream Job）**
2. ~~**仁爱九下**有没有 2026 版~~ → ✅ **已确认 = 2014 版沿用**（2025.12 仍第 21 次重印）
3. ~~**外研三起初中**是否在平台内~~ → ✅ **已确认 = 只有 G8/G9（八上/八下/九上/九下），无 G7**

### 交付方式（任选）

- **最优**：国家平台导出 PDF → 直接给我文件（我逐页识别）
- **次优**：截图（拍照/截图均可，我 OCR + 人工校对）
- **兜底**：你手头已有的仁爱七上实物照片（就是这次这 4 张），补拍 P128–160

> 💡 **不用一次交付**：先给批次 1（仁爱七上 + 七下），我边做边等，
> 避免你一次性拍 40 张结果方向不对白拍。

---

## 七、核实渠道记录（供复现）

| 渠道 | 可获取性 | 说明 |
|---|---|---|
| `basic.smartedu.cn`（国家平台） | ❌ 程序不可抓 | 需登录 + JS 渲染；**但人可导出 PDF** |
| `jc.pep.com.cn`（人教社） | ✅ 免登录可直读 | 有完整 Unit 目录；⚠️ 新旧两版同时挂着（`yyptypzj`=旧 / `yyptzy`=新） |
| `pep.com.cn/zslth/`（人教配套资源） | ✅ 可直读 | 含 `Words in Unit X` **音频条目**（不是文本词表） |
| `51jiaoxi.com`（教习网） | ✅ **目录最全，强烈推荐** | 覆盖几乎所有版本册别；**明确标注出版社**（如「上海教育出版社(广深用)」「科学普及出版社」）；有**新教材/旧教材两个 tab**；单元目录含 Project / Letters / Word list 等附录。本次沪教牛津一起 1–5 年级目录全部由此核实 |
| `dzkbw.com` / `dzkbw.org`（电子课本网） | ⚠️ 目录页可抓，正文为图 | 第三方站，非官方；**目录数据可用**（多源交叉验证过），词表抓不到 |
| `haoduoyun.cc` | ⚠️ 目录+页码可抓，正文为图 | 同上；**页码信息很有价值**（七上 Words in Each Unit = P125，与你实物照片吻合） |
| `unischool.cn`（外研在线） | ❌ 无分级目录 | 只有课堂实录列表 |
| 科普出版社（仁爱） | ❌ 无独立官网 | 编写方为北京市仁爱教育研究所，**出版方为科学普及出版社** |

> ⚠️ **重要**：`dzkbw.com` 目录页有明显的防抓取（返回随机古诗文），
> 且同一册次不同页面会给出**互相矛盾的目录**（八上 `001.htm` vs `005.htm`）。
> 这些第三方站只能当**线索**，最终必须以国家平台电子课本或实物为准。

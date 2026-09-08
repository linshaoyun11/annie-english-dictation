# 教材数据官方核查报告

日期：2026-09-04
范围：App 内 6 条教材线（renjiao / renjiao3 / waiyanshe / waiyanshe3 / oxford / renai）
检索渠道：仅出版社官方站点 + 教育部官方平台（详见第一节可获取性实测）

---

## 一、官方渠道可获取性实测

| 渠道 | 程序化可获取 | 实测结果 |
|---|---|---|
| **人教社电子教材** `jc.pep.com.cn` | ✅ 可直读 | 页面正常渲染，按学段/学科/年级筛选，有"在线阅读"入口 |
| **人教社配套音频资源** `pep.com.cn/zslth/` | ✅ 可直读 | 完整 Unit 目录 + `Words in Unit X` 条目（**只有音频，无文本词表**） |
| **国家中小学智慧教育平台** `basic.smartedu.cn/tchMaterial/detail?...` | ❌ 返回空 | 只返回页面标题，需登录 + JS 渲染，程序抓取不可行 |
| **外研社 Unischool** `unischool.cn` | ⚠️ 部分 | 仅课堂实录列表，无完整分级目录 |
| **外研社数字教材** `ebook.nse.cn` | ❌ 未验证成功 | — |
| **上海智慧教育平台** `sh.smartedu.cn` | ❌ 未验证成功 | — |
| **仁爱版（科学普及出版社）** | ❌ 无官方公开目录 | 该版本无独立官网，只能靠国家平台电子课本 |

### 关键结论

1. **单元目录（Unit 设置）可以合法、完整地获取** —— 人教社官网直读即可，其余版本可通过官方电子课本目录页交叉验证。
2. **分单元词条（Words in Each Unit）无法从官方渠道程序化获取** —— 与预期一致：国家平台需登录且为阅读器外壳，出版社无公开 Excel/Word。词条只能人工从电子课本末尾词表页录入。
3. **⚠️ 新旧版本并行是人教社官网的实际状态** —— 同一册 PEP 五年级上册同时挂着两个目录：
   - 旧版 `pep.com.cn/zslth/yyptypzj/xypep/5s` → Unit 1 What's he like? / My week / ...
   - 2026 新版 `pep.com.cn/zslth/yyptzy/xypep/5s/` → Unit 1 Different friends / My feelings / ...
   这是本次核查最大的陷阱来源。

---

## 二、各版本官方最新目录（已核实）

### 2.1 人教 PEP（三年级起点）· 小学

新版按"逐年滚动"启用，2026 秋推进到五年级上册。

| 册次 | 启用时间 | 官方最新 Unit 目录 |
|---|---|---|
| 三上 | 2024 秋 | Making friends / Different families / Amazing animals / Plants around us / The colourful world / Useful numbers |
| 三下 | 2025 春 | Meeting new people / Expressing yourself / Learning better / Healthy food / Old toys / Numbers in life |
| 四上 | 2025 秋 | Helping at home / My friends / Places we live in / Helping in the community / The weather and us / Changing for the seasons |
| 四下 | 2026 春 | Class rules / Family rules / Time for school / Going shopping / Farms and US / On the farm |
| 五上 | 2026 秋 | Different friends / My feelings / Work and play / Healthy habits / Food we eat / Nature and us |
| **六上** | **2026 秋** | **新版已启用**（用户 2026-09-04 在国家平台核实）→ 目录待补 |
| 五下 / 六下 | 未启用（2027 春） | 仍为旧版（见下） |

> ⚠️ **2026-09-04 更正**：原表把「六上」也列为"未启用/旧版"是**错的**。
> **2026 秋 = 新课标教材全面落地收官之年**，四五六年级 + 九年级**全面启用新教材**
> （安徽舒城县教育局 2026-07-07 官方培训通稿、网易/头条教育、济南天桥区 2026 秋
> 教科书目录同时列"英语PEP(四上)(五上)(六上)(三年级起点)"）。
> **关键机制：每个年级从「上册」开始换新** —— 所以上册（四上/五上/六上）都是新版，
> 下册（五下/六下）要等 2027 春。四下已换新是因为四年级 2025 秋就开始了。
> ⇒ **"下册是旧版" = 还没轮到，不是没有新版**。

**旧版目录**（人教社官网 `yyptypzj` 路径，与 App 落地数据一致）：
- 四上：My classroom / My schoolbag / My friends / My home / Dinner's ready / Meet my family!
- 四下：My school / What time is it? / Weather / At the farm / My clothes / Shopping
- 五上：What's he like? / My week / What would you like? / What can you do? / There is a big bed / In a nature park
- 五下：My day / My favourite season / My school calendar / When is Easter? / Whose dog is it? / Work quietly!
- 六上：How can I get there? / Ways to go to school / My weekend plan / I have a pen pal / What does he do? / How do you feel?
- 六下：How tall are you? / Last weekend / Where did you go? / Then and now（**只有 4 个 Unit**）

### 2.2 人教版初中英语（Go for it! → 2024 新版）

| 册次 | 启用时间 | 官方最新 Unit 目录 |
|---|---|---|
| 七上 | 2024 秋 | Starter 1 Hello! / Starter 2 Keep Tidy! / Starter 3 Welcome! + U1 You and Me / U2 We're Family! / U3 My School / U4 My Favourite Subject / U5 Fun Clubs / U6 A Day in the Life / U7 Happy Birthday! |
| 七下 | 2025 春 | U1 Animal Friends / U2 No Rules, No Order / U3 Keep Fit / U4 Eat Well / U5 Here and Now / U6 Rain or Shine / U7 A Day to Remember / U8 Once upon a Time |
| 八上 | 2025 秋 | U1 Happy Holiday / U2 Home Sweet Home / U3 Same or Different? / U4 Amazing Plants and Animals / U5 What a Delicious Meal! / U6 Plan for Yourself / U7 When Tomorrow Comes / U8 Let's Communicate! |
| 八下 | 2026 春 | U1 Time to Relax / U2 Stay Healthy / U3 Growing Up / U4 The Wonders of Nature / U5 Nature's Temper / U6 Crossing Cultures / U7 A Good Read / U8 Making a Difference |
| 九上 / 九下 | 2026 秋 / 2027 春 | 新版尚未启用，在用的仍是旧版 |

**旧版（Go for it! 2012/2013 审定）**：七上 U1 My name's Gina. / U2 This is my sister. / U3 Is this your pencil? / U4 Where's my schoolbag? / U5 Do you have a soccer ball? / U6 Do you like bananas? / U7 How much are these socks? / U8 When is your birthday? / U9 My favorite subject is science.（七下 12 Unit、八上 10 Unit、八下 10 Unit、九年级全一册 12 Unit）

### 2.3 人教版（一年级起点）

人教社官网 `pep.com.cn/zslth/yyptzy/xyjt/` 路径下的实例：

- 四上：Unit 1 Sports / Unit 2 Hobbies / Unit 3 Weather + Revision 1 + Unit 4 Fun activities / Unit 5 Animals / Unit 6 My day + Revision 2
- 四下：Unit 1 Transport / Unit 2 School subjects / Unit 3 After-school activities + Revision 1 + Unit 4 Weekend activities / Unit 5 Special days / Unit 6 Asking for directions + Revision 2

**结构：6 Unit + 2 Revision / 册，每学年 2 册 = 12 Unit / 年级。**
这是与 PEP 三起**完全不同的一套教材**，不能用 PEP 三起的数据顶替。

### 2.4 外研版（新标准）

**小学**（一起 / 三起）：Module 1–10，每 Module 2 个 Unit = **20 Unit / 册，40 Unit / 年级**

- 一起 一上：M1 Hello! / How are you?　M2 What's your name? / I'm a boy.　M3 Sit down! / Point to the window!　M4 It's red! / It's a red dog.　M5 This is our teacher. / That is a yellow cat.　M6 What's this? / It's my ruler.　M7 Is it a dog? / It's a yellow cat.　M8 How many? / How many pink balls?　M9 How old are you? / Happy birthday!　M10 That is my father. / That is his car.
- 三起 三上：M1 I'm Sam. / How are you?　M2 I'm Ms Smart. / What's your name?　M3 Point to door. / Point to desk.　M4 It's red! / It's a black dog.　M5 How many? / Nine girls?　M6 Happy birthday! / How old are you?　M7 What's this? / What's that?　M8 Is it a monster? / Where's the cat?　M9 This is my mother. / He's a doctor.　M10 This is his head. / Point to her nose

**初中 2024 新版 七上**：Starter Welcome to junior high! + U1 A new start / U2 More than fun / U3 Family ties / U4 Time to celebrate / U5 Fantastic friends / U6 The power of plants
> ⚠️ 两个来源对 U5/U6 顺序给出相反结果（`Fantastic friends` 在前 vs `The power of plants` 在前），需实物确认。

### 2.5 沪教牛津（上海教育出版社）

**⚠️ 至少三套并行版本，必须先选定：**

| 版本 | 一上 Unit 1–3 | 备注 |
|---|---|---|
| 牛津上海版（试用本）· 旧版 | Greetings / My classmates / My face | 上海本地旧版 |
| 沪教牛津版（六三制一起）**2024 新版** | Hello / My classmates / My face | 全国六三制 |
| 牛津上海版（深圳用）2024 新版 | Hello / My classmates / My face | 深圳，与上者内容同 |

**沪教牛津 2024 新版 一上（六三制一起）完整目录**：
- M1 Getting to know you：U1 Hello / U2 My classmates / U3 My face + Revision 1
- M2 My family, my friends and me：U4 I can sing / U5 My family / U6 My friends + Revision 2
- M3 Places and activities：U7 Let's count / U8 Apples, please / U9 May I have a pie? + Revision 3
- M4 The world around us：U10 On the farm / U11 In the zoo / U12 In the park + Revision 4

**旧版（试用本）一上**：M1 Greetings / My classmates / My face　M2 My abilities / My family / My friends　M3 In the classroom / In the fruit shop / In the restaurant　M4 On the farm / In the zoo / In the park

→ **结构：4 Module × 3 Unit = 12 Unit / 册，24 Unit / 年级**

**初中 2024 新版存在两套**（必须区分）：
- **沪教牛津版 七上（2024 秋）**：Starter（1 English is fun / 2 English worldwide / 3 English matters / 4 English learning styles）+ U1 Trying new things / U2 Strong mind / U3 Jobs / U4 Smart home / U5 Films / U6 Mountains and rivers
- **沪教版（广深用书）七上（2024）**：U1 Friendship / U2 School life / U3 The seasons / U4 The Earth / U5 Off to space / U6 Travelling around Asia / U7 Fun after school / U8 Collecting as a hobby

### 2.6 仁爱科普版（科学普及出版社）

**2024 新版**（每学年 12 个 Unit，每册 6 个）：

| 册次 | Unit 目录 |
|---|---|
| 七上 | U1 Let's Be Friends! / U2 Meet My Family! / U3 Our Colorful School Life / U4 Fun in the Sun! / U5 Love Mother Nature! / U6 Celebrating the Big Days |
| 七下 | U7 Being a Smart Shopper / U8 Our Blue Planet / U9 From Here to There / U10 Lending a Helping Hand / U11 Rules Matter! / U12 Better Together |
| 八上 | U1 My Dream Job / U2 The World of Art / U3 Sound Body, Sound Mind / U4 Changing and Growing / U5 Amazing Places / U6 Earth and Beyond |
| 八下 | U7 Be a Better Learner! / U8 Every Coin Counts! / U9 Forces of Nature / U10 World in the Cloud / U11 Fantastic Chinese Culture / U12 The Wonderland of Literature |
| 九上 / 九下 | **新版未启用**，在用的仍是 2012 审定版 |

**2012 审定版（旧版，即 App 当前落地数据）**：
- 七上：U1 Making New Friends（T1 Welcome to China! / T2 Where are you from? / T3 What class are you in?）｜U2 Looking Different（T1 I have a small nose. / T2 What does she look like? / T3 Whose jacket is this?）｜U3 Getting Together｜U4 Having Fun
- 九上：U1 The Changing World（T1 Our country has developed rapidly. / T2 The population in developing countries is growing faster. / T3 The world has changed for the better.）｜U2 Saving the Earth｜U3 English Around the World｜U4 Amazing Science
- 九下：U5 China and the World / U6 Entertainment and Friendship（**九下只有 6 个 Topic**）

---

## 三、App 落地数据 vs 官方：逐线判定

### 3.1 renjiao3（人教版·三年级起点）

| 段 | 落地 | 判定 |
|---|---|---|
| 小学 3–6 年级（34 Unit） | My classroom / My schoolbag / My friends / My home / Dinner's ready / Meet my family / My school / ... / Then and now | ✅ **标题 100% 真实**，精确对应 PEP 旧版（含六下只有 4 个 Unit 这个细节） |
| 初中 七上（9 Unit） | My name's Gina / This is my sister / ... / My favorite subject is science | ✅ 真实（缺 Starter Units 1–3） |
| 初中 七下（**3** Unit） | Can you play the guitar / What time do you go to school / How do you get to school | ❌ **官方 12 个 Unit，只落了 3 个**，缺 9 个 |
| 初中 八上（10 Unit） | Where did you go on vacation / How often do you exercise / ... | ✅ 真实完整 |
| 初中 八下（**2** Unit） | What's the matter / I'll help to clean up the city parks | ❌ **官方 10 个 Unit，只落了 2 个**，缺 8 个 |
| 初中 九（12 Unit） | How can we become good learners / ... / Life is full of the unexpected | ✅ 真实完整（九年级全一册 12 Unit） |

**性质：基于真实旧版，但初中有 17 个单元缺失。**

### 3.2 renjiao（人教版·一年级起点）

❌ **结构性错误**。`curriculum.ts` 里 `RENJIAO_G1_START = dedupeEarlyGrades(...)`，即一年级起点线是**从 PEP 三起的数据推出来的**，而人教一年级起点是另一套教材（6 Unit + 2 Revision / 册，四上是 Sports / Hobbies / Weather...）。这两套教材的单元名、词条、进度都不通用。

### 3.3 waiyanshe / waiyanshe3（外研版）

落地分布：1–6 年级各 **10** Unit，7–9 年级各 **12** Unit，共 96。

- 小学部分（60 Unit）：标题为 Greetings / Classroom / Colours / Numbers / School / Toys / Food / My body / Weather and seasons / Activities / ... → ❌ **与官方 Module/Unit 标题 0 命中**。官方是 "M1 Unit 1 Hello!" 这类句子式标题，20 Unit/册。落地用的是主题词，且 10 Unit/年级这个数量在任何一版外研教材里都不存在。
- 初中部分（36 Unit）：My classmates / My family / My school / Healthy food / My school day / A trip to the zoo / Lost and found / Abilities / Making plans / Life in the future / Around town / Story time / How to learn English / My home town / Sports / Transport / Theatre and culture / Animals in danger / Accidents / Population and weather / Way of life / Feelings / Space and experiences / Health and help / Wonders of the world / Great books / Heroes / Home alone and problems / Museums / Sports life / Great inventions / Australia / Photos and memories / Save our world / English learning / Friendship and farewell → ⚠️ **风格与外研版初中 Module 主题名吻合（如七上 M1–M6 正是 My classmates / My family / My school / Healthy food / My school day / A trip to the zoo）**，但未经官方渠道逐册核对，需实物确认。

### 3.4 oxford（沪教牛津）

落地分布同为 1–6 年级各 10 Unit、7–9 年级各 12 Unit，共 96。

- 小学部分：Greetings / My body / Colours / Numbers / Animals / Fruit / My family / Toys / Food / Classroom / My school / My friends / My day / The weather / The seasons / At the park / Shopping / Festivals / ...
  对比官方一上（Hello / My classmates / My face / I can sing / My family / My friends / Let's count / Apples, please / May I have a pie? / On the farm / In the zoo / In the park）→ 仅 **Greetings / My family / My friends** 等 3–4 个命中，其余为主题词 ❌
- 初中部分：Meeting people / Neighbours / Friends from other countries / The natural world / Choosing a job / ... / Final revision → ⚠️ 待实物确认
- 数量 10 Unit/年级在沪教牛津任何一版里都不存在（官方为 24 Unit/年级）

### 3.5 renai（仁爱版）

⚠️ **版本过期，不是捏造**。

2012 审定版官方 Scope and Sequence 与落地数据逐条比对：

| 2012 版官方 | App 落地 | |
|---|---|---|
| U1 T1 Welcome to China! (P1) | Welcome to China! 欢迎来到中国 | ✅ |
| U1 T2 Where are you from? (P9) | Where are you from? 你来自哪里？ | ✅ |
| U2 T1 I have a small nose. (P27) | I have a small nose. 我有一个小鼻子 | ✅ |
| U2 T2 What does she look like? (P35) | What does she look like? 她长什么样？ | ✅ |
| U2 T3 Whose jacket is this? (P43) | Whose cap is it? 这是谁的帽子？ | ⚠️ 偏差 |
| U1 T3 What class are you in? (P17) | How old are you? 你多大了？ | ❌ 偏差 |

结论：**落地的是 2012 审定旧版（真实），与用户手上的 2024 新版（36 Unit 结构）不是同一套教材。**

---

## 四、汇总判定表

| 教材线 | 落地 | 官方结构 | 判定 | 优先级 |
|---|---|---|---|---|
| **renjiao3** 人教三起·小学 | 34 Unit | 旧版一致 | ✅ 真实 | 低（可保留，标注版次） |
| **renjiao3** 人教·初中 | 36 Unit | 缺 17 个 Unit | ⚠️ 残缺 | 中 |
| **renjiao** 人教一起 | 由三起数据推导 | 独立教材（12 Unit/年级） | ❌ 结构性错误 | **高** |
| **waiyanshe(3)** 小学 | 60 Unit | 20 Unit/册、40 Unit/年级 | ❌ 全错 | **高** |
| **waiyanshe(3)** 初中 | 36 Unit | 待确认 | ⚠️ 待核对 | 中 |
| **oxford** 小学 | 60 Unit | 12 Unit/册、24 Unit/年级 | ❌ 大部分错 | **高** |
| **oxford** 初中 | 36 Unit | 待确认 | ⚠️ 待核对 | 中 |
| **renai** 仁爱 | 66 Unit | 2024 新版 12 Unit/年级 | ⚠️ 版本过期 | **高**（已上线） |

---

## 五、词条获取的硬性限制

按你的渠道清单核实后的结论：

1. **国家中小学智慧教育平台** —— 程序化抓取只返回页面标题，需登录且是阅读器外壳。**无法自动取词。**
2. **人教社官网** —— 有 `Words in Unit X` 条目，但那是**音频资源**，不是文本词表。
3. **教育部课标词汇表**（2022 版附录 3）—— 只有总表（小学 500 + 初中累计 1600），**不含分单元划分**。
4. **出版社配套词表** —— 面向教师专区 / 需登录，无公开下载。

**⇒ 分单元词条无法从任何官方渠道程序化获取。可行路径只有一条：以电子课本末尾的 `Words in Each Unit` / `Word List` 页为权威定稿人工录入（拍照 → OCR → 校对）。**

---

## 六、待办与建议

### 立即
1. **决定仁爱版跟哪一版**：2012 旧版（现有数据，需补全九下只有 6 Topic 的说明）还是 2024 新版（36 Unit，需重做 + 重新配音频）。
2. **App 内标注版次**：每条教材线标明"对应 XXXX 年审定版"，避免用户按新版课本对照时误判。

### 需重做（3 条）
3. **renjiao（人教一起）** —— 需要人教社一年级起点独立教材目录（12 Unit/年级 × 6 年级）
4. **waiyanshe(3) 小学** —— 需要外研版一起/三起 1–6 年级全部 12 册的 Module/Unit 目录
5. **oxford 小学** —— 需先**选定版本**（试用本 / 六三制一起 2024 / 深圳用 2024），再取 12 册目录

### 词条
6. 无论哪条线，词条都必须来自电子课本末尾词表页。建议按"每册 2 张图"的方式提供（目录页 + 词表页），OCR 后人工校对。

### 已知缺口（本次未获取到）
- 人教 PEP 五下 / 六上 / 六下新版（尚未启用，无新版目录）
- 人教初中 九上 / 九下新版（2026 秋起启用，尚无公开目录）
- 外研版小学 2024 新版是否改版（未确认）
- 仁爱版 九上 / 九下 2024 新版（未启用）
- 外研版初中 七上 U5/U6 顺序（两个来源冲突）

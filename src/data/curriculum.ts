import { mk } from "./mk";
import { GRADES_4_TO_9 } from "./grades4to9";
import { RENJIAO_SL_CURRICULUM } from "./renjiaoSL";
import { WAIYANSHE_SL_CURRICULUM } from "./waiyansheSL";
import { WAIYANSHE_CURRICULUM } from "./waiyanshe";
import { OXFORD_SL_CURRICULUM } from "./oxfordSL";
import { OXFORD_CURRICULUM } from "./oxford";
import { RENAI_CURRICULUM } from "./renai";
import { applyKebiaoTo, makeRenjiaoEntry, makeWaiyansheEntry } from "./kebiaoBank";

export type EntryType = "word" | "phrase" | "sentence";

/**
 * 词库版本号：词库结构/内容变更时 +1，旧学习进度将自动重置（积分保留）
 * v8：PEP 三起线 → 2024 秋新版。G3 单元数 6×2=12（结构与旧版相同，
 *   但内容全部替换为 2024 秋人教 PEP 三上/三下）；entries 数 317，
 *   课标补全 4 Unit → 3 Unit（新版教材本身覆盖了更多课标词）；
 *   导致 G4-G9 全部 entry id 错位；旧学习进度失效（积分保留）。
 *   所有用户跨教材线重置。连带影响：renjiao 的 G3-6 与 renjiao3
 *   共享此段，跟着变。
 *
 * v7：课标 1600 词补全——按 2022 版义务教育英语课标词汇表，为人教/外研社/
 *  沪教牛津三个教材各自补齐缺失的课标词，按年级分配到「课标词汇」单元，
 *  含英式音标与中文释义；全部词条美音+英音本地化（generate_audio_kebiao.mjs）。
 * v6：多教材版本支持——
 *  人教（默认）：1-2 年级一年级起点 + 3-6 PEP + 7-9 Go for it
 *  外研社：1-2 一年级起点 + 3-6 三年级起点 + 7-9 初中新标准
 *  沪教牛津：1-6 一年级起始 + 7-9 初中
 *  每个用户的教材/口音配置独立（user.config）
 *
 * 注：v8 = PEP 三起重建为 2024 秋新版（G3 单元数 12→6）。其他教材线不变。
 * 注：v9 = PEP 三起 G4–G9 全部按实体教材重建（教材单元 97 个 / 3971 词条，
 *     每单元平均 10 → 41）。G4 起 entry id 全部重新编号，老进度必然错位，
 *     故升版触发 freshProgress 重置（积分保留，生词本按 id 自动过滤）。
 * 注：新增一条教材线（如仁爱版 v7 时期）不动既有 id ⇒ 不升版本号；
 *      新教材对老用户而言是"从未学过的"，切过去自动走 freshProgress。
 *
 * v13：外研社 G7 上 2022 课标新版（Starter + U1-U6）按实体教材重建，
 *   替换旧版 12 个占位单元。G7 及后续 G8/G9 id 全部重排，老进度失效。
 *
 * v14：外研社 G7 下 2022 课标新版（U7-U12）按实体教材重建，
 *   替换 G7 下 6 个占位单元。G8/G9 id 再次重排，老进度失效。
 * v15：外研社 G8 上 2022 课标新版（U1-U6）按实体教材重建，
 *   替换 G8 上 6 个占位单元。G8/G9 id 再次重排，老进度失效。
 * v16：外研社 G8 下 2022 课标新版（U7-U12）按实体教材重建，
 *   替换 G8 下 6 个占位单元。G9 id 重排，老进度失效。
 * v17：外研社 G9 2022 课标新版全一册（U1-U6）按实体教材重建，
 *   替换旧版 U1-U12 占位单元。G9 由 12 单元减为 6 单元，老进度失效。
 * v18：一年级起点三条线（renjiao G3+、waiyanshe G1-G6、oxford G1-G2）按真实教材
 *   核实重建。oxford G1+G2 由占位精简数据替换为沪教牛津 1A+1B 真实 Module+Unit
 *   数据（12 Unit × 12 Module = 24 个 entry block）。waiyanshe G1G2 同步重建。
 *   三起线（renjiao3/waiyanshe3/renai）保持原状不动。
 * v19：oxford G1+G2 补完 23 个 missing 音频 (rubber / Give me a rubber, please.
 *   / Touch your mouth. 等带标点短语)，补后 6 条线全部 100% 覆盖。
 * v20：renjiao (人教版一线) G3+ 按"新起点 SL 一年级起点版"真实教材独立重建，
 *   不再误用 PEP 三起数据。新增 src/data/renjiaoSL.ts 收纳 SL G3+ 数据。
 *   renjiao3 (三起) 完全不受影响，继续走 PEP。
 * v22：在 v21 三条一线全部真实教材重建的基础上，做教材结构精度对齐：
 *   - oxford (沪教牛津一线) G7-G10：从「每个 module 1 unit」聚合的 4 Unit/grade
 *     拆为真实教材的 12 Unit/grade（4 Module × 3 Unit，Module 标题同步真实人教版）。
 *   - waiyanshe (外研新标准一线) G3-G12：从「每个 module 1 unit」的 10 Unit/grade
 *     拆为真实教材的 20 Unit/grade（10 Module × 2 Unit，Unit 标题同步真实外研版）。
 *   三个一线 entry id 体系沿用 SL（v21 起）；新 Unit/Split 是同 prefix 内的连续计数，
 *   不会改已有 entry id（参与 id 的 entry 内容不变，id 仍有效；新增 entry 走 prefix seq 续号）。
 *   既有用户进度继续生效（不受本版本影响）。
 * v23：废弃「3 年级起去重 1-2 年级已学词」机制（renjiao/waiyanshe 一线）。
 *   旧逻辑假定 G3+ 是 G1G2 的同源扩展；但 v21/v22 起 G3+ 走独立 SL 教材，
 *   按 G1G2 词表过滤会把新起点本应学的高频词错删。
 *   影响：同一线（renjiao / waiyanshe）内，v22 之前「被 filter 过的 entries」
 *   重新出现，entry id 体系不变（去的是 result 阶段的副本），故进度不需要重置，
 *   但保守触发 freshProgress 让错删过的指标（如果存在）回到干净基线。
 *   ‑ G1G2 带内去重（dedupeEarlyGrades）保留：仍是 dedupeEarlyGrades 承担。
 * v24：修复 waiyanshe / oxford 两条一线的「年级错乱」（用户 2026-09-10 报告，
 *   初中显示到"初中12年级"）。
 *   根因：waiyansheSL.ts / oxfordSL.ts 按教材「册」编号 grade（1A=1、1B=2、
 *   2A=3 … 9B=18，共 18 册），而 UI 只支持 1-9 年级且把 grade>6 渲染为
 *   「初中N年级」（N=grade-6）⇒ 册 10-18 显示成初中4~12年级。
 *   renjiao 线正常是因为 renjiaoSL 本就按真实年级 3-9 编写。
 *   修复：组装层新增 mergeBooksToGrades() 把 18 册归并为 9 个年级
 *   （G=⌈册/2⌉，同年级内下册 unit 续接上册），entry 的 grade/unit/id 同步重写
 *   （id 保留原 seq 段，只改 g/u 段；前缀 wy-/ox- 与无前缀两种格式都处理）。
 *   连带：waiyanshe 课标补全 midGrades 从 [7..18] 改回 [7,8,9]。
 *   影响：两条线全部 entry id 变化 ⇒ CURRICULUM_VERSION 23→24 触发 freshProgress
 *   （积分保留、生词本按 validIds 过滤）。音频文件名是文本哈希与 id 无关 ⇒ 0 影响。
 */
export const CURRICULUM_VERSION = 24;

export type CurriculumVersion =
  | "renjiao"
  | "renjiao3"
  | "waiyanshe"
  | "waiyanshe3"
  | "oxford"
  | "renai";

export const CURRICULUM_LABELS: Record<CurriculumVersion, string> = {
  renjiao: "人教版",
  renjiao3: "人教版",
  waiyanshe: "外研社",
  waiyanshe3: "外研社",
  oxford: "沪教牛津",
  renai: "科普仁爱版",
};

export interface WordEntry {
  id: string;
  grade: number;
  unit: number;
  type: EntryType;
  english: string;
  phonetic: string;
  chinese: string;
}

export interface UnitInfo {
  grade: number;
  unit: number;
  title: string;
  entries: WordEntry[];
}


export const CURRICULUM: UnitInfo[] = [
  // ==================== 一年级（人教版一年级起点 一上） ====================
  {
    grade: 1,
    unit: 1,
    title: "School 学校",
    entries: [
      mk(1, 1, "word", "book", "/bʊk/", "n. 书 v. 预订"),
      mk(1, 1, "word", "ruler", "/ˈruːlə(r)/", "n. 尺子"),
      mk(1, 1, "word", "pencil", "/ˈpensl/", "n. 铅笔"),
      mk(1, 1, "word", "schoolbag", "/ˈskuːlbæɡ/", "n. 书包"),
      mk(1, 1, "word", "teacher", "/ˈtiːtʃə(r)/", "n. 老师"),
      mk(1, 1, "word", "hello", "/həˈləʊ/", "int. 喂；你好"),
      mk(1, 1, "word", "hi", "/haɪ/", "int. 喂；你好"),
      mk(1, 1, "word", "bye", "/baɪ/", "int. 再见"),
      mk(1, 1, "phrase", "good morning", "/ˌɡʊd ˈmɔːnɪŋ/", "早上好"),
      mk(1, 1, "phrase", "good afternoon", "/ˌɡʊd ˌɑːftəˈnuːn/", "下午好"),
    ],
  },
  {
    grade: 1,
    unit: 2,
    title: "Face 脸",
    entries: [
      mk(1, 2, "word", "face", "/feɪs/", "n. 脸 v. 面对"),
      mk(1, 2, "word", "ear", "/ɪə(r)/", "n. 耳朵"),
      mk(1, 2, "word", "eye", "/aɪ/", "n. 眼睛"),
      mk(1, 2, "word", "nose", "/nəʊz/", "n. 鼻子"),
      mk(1, 2, "word", "mouth", "/maʊθ/", "n. 嘴巴"),
      mk(1, 2, "word", "touch", "/tʌtʃ/", "v. 触摸 n. 触摸"),
      mk(1, 2, "word", "this", "/ðɪs/", "pron. 这；这个"),
      mk(1, 2, "word", "is", "/ɪz/", "v. 是"),
      mk(1, 2, "word", "my", "/maɪ/", "adj. 我的"),
      mk(1, 2, "word", "body", "/ˈbɒdi/", "n. 身体；主体"),
    ],
  },
  {
    grade: 1,
    unit: 3,
    title: "Animals 动物",
    entries: [
      mk(1, 3, "word", "dog", "/dɒɡ/", "n. 狗"),
      mk(1, 3, "word", "bird", "/bɜːd/", "n. 鸟"),
      mk(1, 3, "word", "tiger", "/ˈtaɪɡə(r)/", "n. 老虎"),
      mk(1, 3, "word", "monkey", "/ˈmʌŋki/", "n. 猴子"),
      mk(1, 3, "word", "cat", "/kæt/", "n. 猫"),
      mk(1, 3, "word", "duck", "/dʌk/", "n. 鸭子"),
      mk(1, 3, "word", "what", "/wɒt/", "pron. 什么"),
      mk(1, 3, "word", "it", "/ɪt/", "pron. 它"),
      mk(1, 3, "word", "see", "/siː/", "v. 看见；明白；会见"),
      mk(1, 3, "word", "look", "/lʊk/", "v. 看；看起来"),
    ],
  },
  {
    grade: 1,
    unit: 4,
    title: "Numbers 数字",
    entries: [
      mk(1, 4, "word", "one", "/wʌn/", "num. 一 pron. 一个"),
      mk(1, 4, "word", "two", "/tuː/", "num. 二"),
      mk(1, 4, "word", "three", "/θriː/", "num. 三"),
      mk(1, 4, "word", "four", "/fɔː(r)/", "num. 四"),
      mk(1, 4, "word", "five", "/faɪv/", "num. 五"),
      mk(1, 4, "word", "six", "/sɪks/", "num. 六"),
      mk(1, 4, "word", "seven", "/ˈsevn/", "num. 七"),
      mk(1, 4, "word", "eight", "/eɪt/", "num. 八"),
      mk(1, 4, "word", "nine", "/naɪn/", "num. 九"),
      mk(1, 4, "word", "ten", "/ten/", "num. 十"),
    ],
  },
  {
    grade: 1,
    unit: 5,
    title: "Colours 颜色",
    entries: [
      mk(1, 5, "word", "black", "/blæk/", "adj. 黑色的 n. 黑色"),
      mk(1, 5, "word", "yellow", "/ˈjeləʊ/", "adj. 黄色的"),
      mk(1, 5, "word", "blue", "/bluː/", "adj. 蓝色的；忧郁的 n. 蓝色"),
      mk(1, 5, "word", "red", "/red/", "adj. 红色的"),
      mk(1, 5, "word", "green", "/ɡriːn/", "adj. 绿色的 n. 绿色"),
      mk(1, 5, "word", "colour", "/ˈkʌlə(r)/", "n. 颜色 v. 涂色"),
      mk(1, 5, "word", "white", "/waɪt/", "adj. 白色的 n. 白色"),
      mk(1, 5, "word", "brown", "/braʊn/", "adj. 棕色的"),
      mk(1, 5, "word", "show", "/ʃəʊ/", "v. 展示；给……看"),
      mk(1, 5, "word", "big", "/bɪɡ/", "adj. 大的"),
    ],
  },
  {
    grade: 1,
    unit: 6,
    title: "Fruit 水果",
    entries: [
      mk(1, 6, "word", "apple", "/ˈæpl/", "n. 苹果"),
      mk(1, 6, "word", "pear", "/peə(r)/", "n. 梨"),
      mk(1, 6, "word", "banana", "/bəˈnɑːnə/", "n. 香蕉"),
      mk(1, 6, "word", "orange", "/ˈɒrɪndʒ/", "n. 橙子；橙色"),
      mk(1, 6, "word", "do", "/duː/", "v. 做 aux. （构成疑问句和否定句的助动词）"),
      mk(1, 6, "word", "you", "/juː/", "pron. 你；你们"),
      mk(1, 6, "word", "like", "/laɪk/", "v. 喜欢；prep. 像"),
      mk(1, 6, "word", "yes", "/jes/", "adv. 是的"),
      mk(1, 6, "word", "no", "/nəʊ/", "adv. 不"),
      mk(1, 6, "word", "fruit", "/fruːt/", "n. 水果"),
    ],
  },
  // ==================== 一年级（人教版一年级起点 一下） ====================
  {
    grade: 1,
    unit: 7,
    title: "Classroom 教室",
    entries: [
      mk(1, 7, "word", "chair", "/tʃeə(r)/", "n. 椅子"),
      mk(1, 7, "word", "desk", "/desk/", "n. 书桌"),
      mk(1, 7, "word", "blackboard", "/ˈblækbɔːd/", "n. 黑板"),
      mk(1, 7, "word", "on", "/ɒn/", "prep. 在……上面"),
      mk(1, 7, "word", "under", "/ˈʌndə(r)/", "prep. 在……下面"),
      mk(1, 7, "word", "in", "/ɪn/", "prep. 在……里 adv. 进入；在家"),
      mk(1, 7, "word", "where", "/weə(r)/", "adv. 在哪里"),
      mk(1, 7, "word", "the", "/ðə/", "art. 这；那"),
      mk(1, 7, "word", "open", "/ˈəʊpən/", "v. 打开 adj. 开着的"),
      mk(1, 7, "word", "close", "/kləʊz/", "v. 关闭；adj. 近的"),
    ],
  },
  {
    grade: 1,
    unit: 8,
    title: "Room 房间",
    entries: [
      mk(1, 8, "word", "light", "/laɪt/", "adj. 轻的；明亮的"),
      mk(1, 8, "word", "bed", "/bed/", "n. 床"),
      mk(1, 8, "word", "door", "/dɔː(r)/", "n. 门"),
      mk(1, 8, "word", "box", "/bɒks/", "n. 盒子"),
      mk(1, 8, "word", "near", "/nɪə(r)/", "adj. 近的 prep. 靠近 adv. 附近"),
      mk(1, 8, "word", "behind", "/bɪˈhaɪnd/", "prep. 在……后面"),
      mk(1, 8, "word", "room", "/ruːm/", "n. 房间；空间"),
      mk(1, 8, "word", "put", "/pʊt/", "v. 放"),
      mk(1, 8, "word", "your", "/jɔː(r)/", "adj. 你的"),
      mk(1, 8, "word", "table", "/ˈteɪbl/", "n. 桌子"),
    ],
  },
  {
    grade: 1,
    unit: 9,
    title: "Toys 玩具",
    entries: [
      mk(1, 9, "word", "plane", "/pleɪn/", "n. 飞机"),
      mk(1, 9, "word", "ball", "/bɔːl/", "n. 球；舞会"),
      mk(1, 9, "word", "doll", "/dɒl/", "n. 玩偶；娃娃"),
      mk(1, 9, "word", "train", "/treɪn/", "n. 火车 v. 训练"),
      mk(1, 9, "word", "car", "/kɑː(r)/", "n. 小汽车"),
      mk(1, 9, "word", "bear", "/beə(r)/", "n. 玩具熊；熊"),
      mk(1, 9, "word", "can", "/kæn/", "aux. 可以；能够"),
      mk(1, 9, "word", "sure", "/ʃʊə(r)/", "adj. 确信的 adv. 当然"),
      mk(1, 9, "word", "sorry", "/ˈsɒri/", "adj. 对不起的"),
      mk(1, 9, "word", "play", "/pleɪ/", "v. 玩；踢（球）"),
    ],
  },
  {
    grade: 1,
    unit: 10,
    title: "Food 食物",
    entries: [
      mk(1, 10, "word", "rice", "/raɪs/", "n. 米饭"),
      mk(1, 10, "word", "noodles", "/ˈnuːdlz/", "n. 面条"),
      mk(1, 10, "word", "vegetable", "/ˈvedʒtəbl/", "n. 蔬菜"),
      mk(1, 10, "word", "fish", "/fɪʃ/", "n. 鱼 v. 钓鱼"),
      mk(1, 10, "word", "chicken", "/ˈtʃɪkɪn/", "n. 鸡；鸡肉"),
      mk(1, 10, "word", "egg", "/eɡ/", "n. 鸡蛋"),
      mk(1, 10, "word", "hungry", "/ˈhʌŋɡri/", "adj. 饥饿的"),
      mk(1, 10, "word", "want", "/wɒnt/", "v. 想要"),
      mk(1, 10, "word", "and", "/ənd/", "conj. 和"),
      mk(1, 10, "word", "eat", "/iːt/", "v. 吃"),
    ],
  },
  {
    grade: 1,
    unit: 11,
    title: "Drink 饮品",
    entries: [
      mk(1, 11, "word", "juice", "/dʒuːs/", "n. 果汁"),
      mk(1, 11, "word", "tea", "/tiː/", "n. 茶"),
      mk(1, 11, "word", "milk", "/mɪlk/", "n. 牛奶 v. 挤奶"),
      mk(1, 11, "word", "water", "/ˈwɔːtə(r)/", "n. 水 v. 浇水"),
      mk(1, 11, "word", "thirsty", "/ˈθɜːsti/", "adj. 口渴的"),
      mk(1, 11, "word", "thanks", "/θæŋks/", "int. 谢谢"),
      mk(1, 11, "word", "drink", "/drɪŋk/", "v. 喝；饮"),
      mk(1, 11, "word", "please", "/pliːz/", "adv. 请 v. 使高兴"),
      mk(1, 11, "word", "some", "/sʌm/", "adj. 一些"),
      mk(1, 11, "word", "soup", "/suːp/", "n. 汤"),
    ],
  },
  {
    grade: 1,
    unit: 12,
    title: "Clothes 衣服",
    entries: [
      mk(1, 12, "word", "shirt", "/ʃɜːt/", "n. 衬衫"),
      mk(1, 12, "word", "T-shirt", "/ˈtiː ʃɜːt/", "n. T恤衫"),
      mk(1, 12, "word", "skirt", "/skɜːt/", "n. 短裙"),
      mk(1, 12, "word", "dress", "/dres/", "n. 连衣裙 v. 穿衣"),
      mk(1, 12, "word", "socks", "/sɒks/", "n. 短袜"),
      mk(1, 12, "word", "shorts", "/ʃɔːts/", "n. 短裤"),
      mk(1, 12, "word", "hat", "/hæt/", "n. 帽子"),
      mk(1, 12, "word", "coat", "/kəʊt/", "n. 外套；涂层"),
      mk(1, 12, "word", "shoes", "/ʃuːz/", "n. 鞋子"),
      mk(1, 12, "word", "jeans", "/dʒiːnz/", "n. 牛仔裤"),
    ],
  },
  // ==================== 二年级（人教版一年级起点 二上） ====================
  {
    grade: 2,
    unit: 1,
    title: "My family 我的家庭",
    entries: [
      mk(2, 1, "word", "father", "/ˈfɑːðə(r)/", "n. 爸爸"),
      mk(2, 1, "word", "mother", "/ˈmʌðə(r)/", "n. 妈妈"),
      mk(2, 1, "word", "brother", "/ˈbrʌðə(r)/", "n. 哥哥；弟弟"),
      mk(2, 1, "word", "sister", "/ˈsɪstə(r)/", "n. 姐姐；妹妹"),
      mk(2, 1, "word", "grandmother", "/ˈɡrænmʌðə(r)/", "n. （外）祖母"),
      mk(2, 1, "word", "grandfather", "/ˈɡrænfɑːðə(r)/", "n. （外）祖父"),
      mk(2, 1, "word", "who", "/huː/", "pron. 谁"),
      mk(2, 1, "word", "he", "/hiː/", "pron. 他"),
      mk(2, 1, "word", "she", "/ʃiː/", "pron. 她"),
      mk(2, 1, "word", "family", "/ˈfæməli/", "n. 家庭"),
    ],
  },
  {
    grade: 2,
    unit: 2,
    title: "Boys and girls 男孩和女孩",
    entries: [
      mk(2, 2, "word", "classmate", "/ˈklɑːsmeɪt/", "n. 同班同学"),
      mk(2, 2, "word", "friend", "/frend/", "n. 朋友"),
      mk(2, 2, "word", "woman", "/ˈwʊmən/", "n. 女人"),
      mk(2, 2, "word", "girl", "/ɡɜːl/", "n. 女孩"),
      mk(2, 2, "word", "man", "/mæn/", "n. 男人"),
      mk(2, 2, "word", "boy", "/bɔɪ/", "n. 男孩"),
      mk(2, 2, "word", "look", "/lʊk/", "v. 看；看起来"),
      mk(2, 2, "word", "name", "/neɪm/", "n. 名字 v. 命名"),
      mk(2, 2, "word", "his", "/hɪz/", "adj. 他的"),
      mk(2, 2, "word", "her", "/hɜː(r)/", "adj. 她的"),
    ],
  },
  {
    grade: 2,
    unit: 3,
    title: "My friends 我的朋友",
    entries: [
      mk(2, 3, "word", "big", "/bɪɡ/", "adj. 大的"),
      mk(2, 3, "word", "tall", "/tɔːl/", "adj. 高的"),
      mk(2, 3, "word", "pretty", "/ˈprɪti/", "adj. 漂亮的 adv. 相当"),
      mk(2, 3, "word", "thin", "/θɪn/", "adj. 瘦的；薄的"),
      mk(2, 3, "word", "short", "/ʃɔːt/", "adj. 矮的；短的"),
      mk(2, 3, "word", "handsome", "/ˈhænsəm/", "adj. 英俊的"),
      mk(2, 3, "word", "new", "/njuː/", "adj. 新的"),
      mk(2, 3, "word", "does", "/dʌz/", "aux. （助动词）"),
      mk(2, 3, "word", "small", "/smɔːl/", "adj. 小的"),
      mk(2, 3, "word", "long", "/lɒŋ/", "adj. 长的 adv. 长期地"),
    ],
  },
  {
    grade: 2,
    unit: 4,
    title: "In the community 社区",
    entries: [
      mk(2, 4, "word", "bookshop", "/ˈbʊkʃɒp/", "n. 书店"),
      mk(2, 4, "word", "zoo", "/zuː/", "n. 动物园"),
      mk(2, 4, "word", "school", "/skuːl/", "n. 学校"),
      mk(2, 4, "word", "supermarket", "/ˈsuːpəmɑːkɪt/", "n. 超市"),
      mk(2, 4, "word", "park", "/pɑːk/", "n. 公园 v. 停车"),
      mk(2, 4, "word", "hospital", "/ˈhɒspɪtl/", "n. 医院"),
      mk(2, 4, "word", "go", "/ɡəʊ/", "v. 去；变得；进行"),
      mk(2, 4, "word", "to", "/tuː/", "prep. 到；向"),
      mk(2, 4, "word", "shop", "/ʃɒp/", "n. 商店 v. 购物"),
      mk(2, 4, "word", "farm", "/fɑːm/", "n. 农场 v. 务农"),
    ],
  },
  {
    grade: 2,
    unit: 5,
    title: "In the park 在公园",
    entries: [
      mk(2, 5, "word", "grass", "/ɡrɑːs/", "n. 草"),
      mk(2, 5, "word", "tree", "/triː/", "n. 树"),
      mk(2, 5, "word", "flower", "/ˈflaʊə(r)/", "n. 花"),
      mk(2, 5, "word", "boat", "/bəʊt/", "n. 小船"),
      mk(2, 5, "word", "lake", "/leɪk/", "n. 湖"),
      mk(2, 5, "word", "hill", "/hɪl/", "n. 小山"),
      mk(2, 5, "word", "sun", "/sʌn/", "n. 太阳"),
      mk(2, 5, "word", "sky", "/skaɪ/", "n. 天空"),
      mk(2, 5, "word", "garden", "/ˈɡɑːdn/", "n. 花园"),
      mk(2, 5, "word", "bird", "/bɜːd/", "n. 鸟"),
    ],
  },
  {
    grade: 2,
    unit: 6,
    title: "Happy holidays 快乐节日",
    entries: [
      mk(2, 6, "word", "Christmas", "/ˈkrɪsməs/", "n. 圣诞节"),
      mk(2, 6, "word", "card", "/kɑːd/", "n. 卡片；纸牌"),
      mk(2, 6, "word", "present", "/ˈpreznt/", "n. 礼物；adj. 目前的"),
      mk(2, 6, "word", "merry", "/ˈmeri/", "adj. 愉快的"),
      mk(2, 6, "word", "happy", "/ˈhæpi/", "adj. 高兴的"),
      mk(2, 6, "word", "thank", "/θæŋk/", "v. 感谢 n. 感谢"),
      mk(2, 6, "word", "too", "/tuː/", "adv. 也；太"),
      mk(2, 6, "phrase", "Father Christmas", "/ˌfɑːðə ˈkrɪsməs/", "圣诞老人"),
      mk(2, 6, "phrase", "Christmas tree", "/ˌkrɪsməs ˈtriː/", "圣诞树"),
      mk(2, 6, "phrase", "New Year", "/ˌnjuː ˈjɪə(r)/", "新年"),
    ],
  },
  // ==================== 二年级（人教版一年级起点 二下） ====================
  {
    grade: 2,
    unit: 7,
    title: "Playtime 娱乐时间",
    entries: [
      mk(2, 7, "word", "football", "/ˈfʊtbɔːl/", "n. 足球"),
      mk(2, 7, "word", "kite", "/kaɪt/", "n. 风筝"),
      mk(2, 7, "word", "fly", "/flaɪ/", "v. 飞；放（风筝）"),
      mk(2, 7, "word", "ride", "/raɪd/", "v. 骑；乘"),
      mk(2, 7, "word", "swim", "/swɪm/", "v. 游泳 n. 游泳"),
      mk(2, 7, "word", "play", "/pleɪ/", "v. 玩；踢（球）"),
      mk(2, 7, "phrase", "play football", "/ˌpleɪ ˈfʊtbɔːl/", "踢足球"),
      mk(2, 7, "phrase", "fly a kite", "/ˌflaɪ ə ˈkaɪt/", "放风筝"),
      mk(2, 7, "phrase", "ride a bike", "/ˌraɪd ə ˈbaɪk/", "骑自行车"),
      mk(2, 7, "phrase", "make a snowman", "/ˌmeɪk ə ˈsnəʊmæn/", "堆雪人"),
    ],
  },
  {
    grade: 2,
    unit: 8,
    title: "Weather 天气",
    entries: [
      mk(2, 8, "word", "sunny", "/ˈsʌni/", "adj. 晴朗的"),
      mk(2, 8, "word", "cloudy", "/ˈklaʊdi/", "adj. 多云的"),
      mk(2, 8, "word", "rainy", "/ˈreɪni/", "adj. 下雨的"),
      mk(2, 8, "word", "windy", "/ˈwɪndi/", "adj. 刮风的"),
      mk(2, 8, "word", "snowy", "/ˈsnəʊi/", "adj. 下雪的"),
      mk(2, 8, "word", "weather", "/ˈweðə(r)/", "n. 天气"),
      mk(2, 8, "word", "umbrella", "/ʌmˈbrelə/", "n. 雨伞"),
      mk(2, 8, "word", "hot", "/hɒt/", "adj. 炎热的；辣的"),
      mk(2, 8, "word", "cold", "/kəʊld/", "adj. 冷的；n. 感冒"),
      mk(2, 8, "word", "warm", "/wɔːm/", "adj. 暖和的 v. 加热"),
    ],
  },
  {
    grade: 2,
    unit: 9,
    title: "Seasons 四季",
    entries: [
      mk(2, 9, "word", "spring", "/sprɪŋ/", "n. 春天；泉水"),
      mk(2, 9, "word", "summer", "/ˈsʌmə(r)/", "n. 夏天"),
      mk(2, 9, "word", "autumn", "/ˈɔːtəm/", "n. 秋天"),
      mk(2, 9, "word", "winter", "/ˈwɪntə(r)/", "n. 冬天"),
      mk(2, 9, "word", "season", "/ˈsiːzn/", "n. 季节"),
      mk(2, 9, "word", "favourite", "/ˈfeɪvərɪt/", "adj. 最喜欢的"),
      mk(2, 9, "word", "cool", "/kuːl/", "adj. 凉的；酷的"),
      mk(2, 9, "word", "pick", "/pɪk/", "v. 挑选；采摘"),
      mk(2, 9, "word", "leaf", "/liːf/", "n. 树叶"),
      mk(2, 9, "word", "snow", "/snəʊ/", "n. 雪 v. 下雪"),
    ],
  },
  {
    grade: 2,
    unit: 10,
    title: "Time 时间",
    entries: [
      mk(2, 10, "word", "time", "/taɪm/", "n. 时间；次数；时代"),
      mk(2, 10, "word", "playtime", "/ˈpleɪtaɪm/", "n. 游戏时间"),
      mk(2, 10, "word", "eleven", "/ɪˈlevn/", "num. 十一"),
      mk(2, 10, "word", "twelve", "/twelv/", "num. 十二"),
      mk(2, 10, "word", "thirteen", "/ˌθɜːˈtiːn/", "num. 十三"),
      mk(2, 10, "word", "fourteen", "/ˌfɔːˈtiːn/", "num. 十四"),
      mk(2, 10, "word", "fifteen", "/ˌfɪfˈtiːn/", "num. 十五"),
      mk(2, 10, "word", "twenty", "/ˈtwenti/", "num. 二十"),
      mk(2, 10, "word", "thirty", "/ˈθɜːti/", "num. 三十"),
      mk(2, 10, "word", "forty", "/ˈfɔːti/", "num. 四十"),
    ],
  },
  {
    grade: 2,
    unit: 11,
    title: "My day 我的一天",
    entries: [
      mk(2, 11, "phrase", "get up", "/ˌɡet ˈʌp/", "起床"),
      mk(2, 11, "phrase", "go to school", "/ˌɡəʊ tə ˈskuːl/", "去上学"),
      mk(2, 11, "phrase", "go home", "/ˌɡəʊ ˈhəʊm/", "回家"),
      mk(2, 11, "phrase", "go to bed", "/ˌɡəʊ tə ˈbed/", "上床睡觉"),
      mk(2, 11, "phrase", "eat breakfast", "/ˌiːt ˈbrekfəst/", "吃早饭"),
      mk(2, 11, "phrase", "eat dinner", "/ˌiːt ˈdɪnə(r)/", "吃晚饭"),
      mk(2, 11, "word", "when", "/wen/", "adv. 什么时候"),
      mk(2, 11, "word", "home", "/həʊm/", "n. 家；adv. 在家"),
      mk(2, 11, "word", "get", "/ɡet/", "v. 得到；到达；变得"),
      mk(2, 11, "word", "up", "/ʌp/", "adv. 向上 prep. 向上"),
    ],
  },
  {
    grade: 2,
    unit: 12,
    title: "My week 我的星期",
    entries: [
      mk(2, 12, "word", "Monday", "/ˈmʌndeɪ/", "n. 星期一"),
      mk(2, 12, "word", "Tuesday", "/ˈtjuːzdeɪ/", "n. 星期二"),
      mk(2, 12, "word", "Wednesday", "/ˈwenzdeɪ/", "n. 星期三"),
      mk(2, 12, "word", "Thursday", "/ˈθɜːzdeɪ/", "n. 星期四"),
      mk(2, 12, "word", "Friday", "/ˈfraɪdeɪ/", "n. 星期五"),
      mk(2, 12, "word", "Saturday", "/ˈsætədeɪ/", "n. 星期六"),
      mk(2, 12, "word", "Sunday", "/ˈsʌndeɪ/", "n. 星期日"),
      mk(2, 12, "word", "today", "/təˈdeɪ/", "adv. 今天；n. 今天"),
      mk(2, 12, "word", "week", "/wiːk/", "n. 星期；周"),
      mk(2, 12, "word", "day", "/deɪ/", "n. 天；日"),
    ],
  },
  // ==================== 三年级（PEP 三上 2024 秋新版） ====================
  // 重构说明（2026-09-04 起逐步重建 PEP 三起线 → 2024 秋新版）：
  //   旧版（PEP 2012/2013）：三上 6 Unit + 三下 6 Unit = 12 Unit
  //   新版（PEP 2024 秋）：三上 6 Unit + 三下 6 Unit（待补）
  //   ⇒ G3 单元数变化（旧 12 → 新 6，词条 120 → 162），seq 偏移 42，
  //     G4-G9 全部 entry id 错位 ⇒ CURRICULUM_VERSION 升 7 → 8
  //   ⇒ 所有教材线用户旧进度失效（积分保留）；renjiao 的 G3-6 也共享此段，跟着变
  //   ⇒ 三下 U7-U12 待用户提供新版截图后补齐（暂留旧版作过渡）
  {
    grade: 3,
    unit: 1,
    title: "Making friends",
    entries: [
      mk(3, 1, "word", "name", "/neɪm/", "n. 名字"),
      mk(3, 1, "word", "nice", "/naɪs/", "adj. 令人愉快的；友好的"),
      mk(3, 1, "word", "ear", "/ɪə(r)/", "n. 耳朵"),
      mk(3, 1, "word", "hand", "/hænd/", "n. 手"),
      mk(3, 1, "word", "eye", "/aɪ/", "n. 眼睛"),
      mk(3, 1, "word", "mouth", "/maʊθ/", "n. 嘴"),
      mk(3, 1, "word", "arm", "/ɑːm/", "n. 胳膊"),
      mk(3, 1, "word", "can", "/kən, kæn/", "v. 可以"),
      mk(3, 1, "word", "share", "/ʃeə(r)/", "v. 分享"),
      mk(3, 1, "word", "smile", "/smaɪl/", "v. / n. 微笑；笑"),
      mk(3, 1, "word", "listen", "/ˈlɪsn/", "v. 听；倾听"),
      mk(3, 1, "word", "help", "/help/", "v. / n. 帮助"),
      mk(3, 1, "word", "say", "/seɪ/", "v. 说；讲"),
      mk(3, 1, "word", "friend", "/frend/", "n. 朋友"),
      mk(3, 1, "word", "good", "/ɡʊd/", "adj. 好的"),
      // Useful expressions (Appendix 5)
      mk(3, 1, "sentence", "Hello! I'm Mike Black.", "", "你好！我是迈克·布莱克。"),
      mk(3, 1, "sentence", "Hi! My name is Wu Binbin.", "", "嗨！我叫吴斌斌。"),
      mk(3, 1, "sentence", "Nice to meet you.", "", "见到你很高兴。"),
      mk(3, 1, "sentence", "Nice to meet you too.", "", "见到你（我）也很高兴。"),
      mk(3, 1, "sentence", "Oh no!", "", "噢，不！"),
      mk(3, 1, "sentence", "It's OK, Chen Jie.", "", "没关系，陈杰。"),
      mk(3, 1, "sentence", "Hey, Sarah! We can share.", "", "嘿，萨拉！我们分享。"),
      mk(3, 1, "sentence", "Thanks, Sarah.", "", "谢谢，萨拉。"),
      mk(3, 1, "sentence", "Thank you, Chen Jie.", "", "谢谢你，陈杰。"),
      mk(3, 1, "sentence", "I am nice to my friends.", "", "我对我的朋友们很好。"),
      mk(3, 1, "sentence", "Yes, it is.", "", "对，是的。"),
      mk(3, 1, "sentence", "They love each other.", "", "他们相互关爱。"),
    ],
  },
  {
    grade: 3,
    unit: 2,
    title: "Different families",
    entries: [
      mk(3, 2, "word", "mum", "/mʌm/", "n. （口语）妈妈"),
      mk(3, 2, "word", "dad", "/dæd/", "n. （口语）爸爸；爹爹"),
      mk(3, 2, "word", "grandma", "/ˈɡrænmɑː/", "n. 奶奶；姥姥"),
      mk(3, 2, "word", "grandpa", "/ˈɡrænpɑː/", "n. 爷爷；姥爷"),
      mk(3, 2, "word", "grandfather", "/ˈɡrænfɑːðə(r)/", "n. （外）祖父；爷爷；姥爷；外公"),
      mk(3, 2, "word", "grandmother", "/ˈɡrænmʌðə(r)/", "n. （外）祖母；奶奶；姥姥；外婆"),
      mk(3, 2, "word", "mother", "/ˈmʌðə(r)/", "n. 母亲；妈妈"),
      mk(3, 2, "word", "father", "/ˈfɑːðə(r)/", "n. 父亲；爸爸"),
      mk(3, 2, "word", "me", "/miː/", "pron. 我"),
      mk(3, 2, "word", "sister", "/ˈsɪstə(r)/", "n. 姐；妹"),
      mk(3, 2, "word", "family", "/ˈfæməli/", "n. 家；家庭"),
      mk(3, 2, "word", "have", "/hæv/", "v. 有"),
      mk(3, 2, "word", "big", "/bɪɡ/", "adj. 大的"),
      mk(3, 2, "word", "cousin", "/ˈkʌzn/", "n. 堂（表）兄弟；堂（表）姐妹"),
      mk(3, 2, "word", "brother", "/ˈbrʌðə(r)/", "n. 哥；弟"),
      mk(3, 2, "word", "baby", "/ˈbeɪbi/", "n. 婴儿"),
      mk(3, 2, "word", "uncle", "/ˈʌŋkl/", "n. 伯父；叔父；舅父；姑父；姨父"),
      mk(3, 2, "word", "aunt", "/ɑːnt/", "n. 伯母；婶母；舅母；姑母；姨母"),
      mk(3, 2, "word", "small", "/smɔːl/", "adj. 小的"),
      // Useful expressions
      mk(3, 2, "sentence", "This is my grandma.", "", "这是我的奶奶。"),
      mk(3, 2, "sentence", "Look! This is my family.", "", "看！这是我的家庭。"),
      mk(3, 2, "sentence", "Is that your brother?", "", "那是你弟弟吗？"),
    ],
  },
  {
    grade: 3,
    unit: 3,
    title: "Our animal friends",
    entries: [
      mk(3, 3, "word", "like", "/laɪk/", "v. 喜欢"),
      mk(3, 3, "word", "dog", "/dɒɡ/", "n. 狗"),
      mk(3, 3, "word", "pet", "/pet/", "n. 宠物"),
      mk(3, 3, "word", "cat", "/kæt/", "n. 猫"),
      mk(3, 3, "word", "fish", "/fɪʃ/", "n. 鱼；鱼肉"),
      mk(3, 3, "word", "bird", "/bɜːd/", "n. 鸟"),
      mk(3, 3, "word", "rabbit", "/ˈræbɪt/", "n. 兔"),
      mk(3, 3, "word", "go", "/ɡəʊ/", "v. 去；走"),
      mk(3, 3, "word", "zoo", "/zuː/", "n. 动物园"),
      mk(3, 3, "word", "fox", "/fɒks/", "n. 狐狸"),
      mk(3, 3, "word", "Miss", "/mɪs/", "n. （学生对女教师的称呼）老师；女士"),
      mk(3, 3, "word", "panda", "/ˈpændə/", "n. 大熊猫"),
      mk(3, 3, "word", "cute", "/kjuːt/", "adj. 可爱的"),
      mk(3, 3, "word", "monkey", "/ˈmʌŋki/", "n. 猴子"),
      mk(3, 3, "word", "tiger", "/ˈtaɪɡə(r)/", "n. 老虎"),
      mk(3, 3, "word", "elephant", "/ˈelɪfənt/", "n. 大象"),
      mk(3, 3, "word", "lion", "/ˈlaɪən/", "n. 狮；狮子"),
      mk(3, 3, "word", "animal", "/ˈænɪml/", "n. 动物"),
      mk(3, 3, "word", "giraffe", "/dʒəˈrɑːf/", "n. 长颈鹿"),
      mk(3, 3, "word", "tall", "/tɔːl/", "adj. 高的"),
      mk(3, 3, "word", "fast", "/fɑːst/", "adj. 快的"),
      // Useful expressions
      mk(3, 3, "sentence", "Good morning, Mike!", "", "早上好，迈克！"),
      mk(3, 3, "sentence", "Good morning! Come in.", "", "早上好！进来吧。"),
      mk(3, 3, "sentence", "Do you have a pet?", "", "你有宠物吗？"),
      mk(3, 3, "sentence", "No, I don't.", "", "不，我没有。"),
      mk(3, 3, "sentence", "Yes, I do. I have a cat.", "", "是的，我有。我有一只猫。"),
      mk(3, 3, "sentence", "Let's go to the zoo!", "", "我们一起去动物园吧！"),
      mk(3, 3, "sentence", "Great!", "", "太好了！"),
      mk(3, 3, "sentence", "What's this?", "", "这是什么？"),
      mk(3, 3, "sentence", "It's a fox.", "", "是只狐狸。"),
      mk(3, 3, "sentence", "Miss White, what's that?", "", "怀特老师，那是什么？"),
      mk(3, 3, "sentence", "It's a red panda.", "", "是只小熊猫。"),
    ],
  },
  {
    grade: 3,
    unit: 4,
    title: "Plants around us",
    entries: [
      mk(3, 4, "word", "apple", "/ˈæpl/", "n. 苹果"),
      mk(3, 4, "word", "banana", "/bəˈnɑːnə/", "n. 香蕉"),
      mk(3, 4, "word", "farm", "/fɑːm/", "n. 农场"),
      mk(3, 4, "word", "air", "/eə(r)/", "n. 空气"),
      mk(3, 4, "word", "orange", "/ˈɒrɪndʒ/", "n. 橙子；柑橘"),
      mk(3, 4, "word", "grape", "/ɡreɪp/", "n. 葡萄"),
      mk(3, 4, "word", "school", "/skuːl/", "n. 学校"),
      mk(3, 4, "word", "garden", "/ˈɡɑːdn/", "n. 花园"),
      mk(3, 4, "word", "need", "/niːd/", "v. 需要"),
      mk(3, 4, "word", "water", "/ˈwɔːtə(r)/", "v. / n. 给……浇水；水"),
      mk(3, 4, "word", "flower", "/ˈflaʊə(r)/", "n. 花；花朵"),
      mk(3, 4, "word", "grass", "/ɡrɑːs/", "n. 草；草地"),
      mk(3, 4, "word", "plant", "/plɑːnt/", "v. / n. 种植；植物"),
      mk(3, 4, "word", "new", "/njuː/", "adj. 新的"),
      mk(3, 4, "word", "tree", "/triː/", "n. 树"),
      mk(3, 4, "word", "sun", "/sʌn/", "n. 阳光；太阳"),
      mk(3, 4, "word", "give", "/ɡɪv/", "v. 给"),
      mk(3, 4, "word", "us", "/ʌs/", "pron. 我们"),
      mk(3, 4, "word", "them", "/ðəm, ðem/", "pron. 它们；他们；她们"),
      // Useful expressions
      mk(3, 4, "sentence", "Mike, do you like apples?", "", "迈克，你喜欢苹果吗？"),
      mk(3, 4, "sentence", "Yes, I do. And you?", "", "是的，我喜欢。你呢？"),
      mk(3, 4, "sentence", "No, I don't.", "", "不，我不喜欢。"),
      mk(3, 4, "sentence", "Do you like the farm?", "", "你们喜欢农场吗？"),
      mk(3, 4, "sentence", "I like the fresh air.", "", "我喜欢新鲜的空气。"),
      mk(3, 4, "sentence", "We can plant new trees.", "", "我们可以种新树。"),
      mk(3, 4, "sentence", "Plants can give us many things.", "", "植物能为我们提供很多东西。"),
    ],
  },
  {
    grade: 3,
    unit: 5,
    title: "The colourful world",
    entries: [
      mk(3, 5, "word", "colour", "/ˈkʌlə(r)/", "n. 颜色"),
      mk(3, 5, "word", "orange", "/ˈɒrɪndʒ/", "n. / adj. 橙红色；橙红色的"),
      mk(3, 5, "word", "green", "/ɡriːn/", "n. / adj. 绿色；绿色的"),
      mk(3, 5, "word", "red", "/red/", "n. / adj. 红色；红色的"),
      mk(3, 5, "word", "blue", "/bluː/", "n. / adj. 蓝色；蓝色的"),
      mk(3, 5, "word", "make", "/meɪk/", "v. 使出现；做"),
      mk(3, 5, "word", "purple", "/ˈpɜːpl/", "n. / adj. 紫色；紫色的"),
      mk(3, 5, "word", "brown", "/braʊn/", "n. / adj. 棕色；棕色的"),
      mk(3, 5, "word", "bear", "/beə(r)/", "n. 熊"),
      mk(3, 5, "word", "yellow", "/ˈjeləʊ/", "n. / adj. 黄色；黄色的"),
      mk(3, 5, "word", "duck", "/dʌk/", "n. 鸭"),
      mk(3, 5, "word", "sea", "/siː/", "n. 海；海洋"),
      mk(3, 5, "word", "some", "/sʌm, səm/", "pron. 一些"),
      mk(3, 5, "word", "pink", "/pɪŋk/", "n. / adj. 粉色；粉色的"),
      mk(3, 5, "word", "draw", "/drɔː/", "v. 画"),
      mk(3, 5, "word", "white", "/waɪt/", "n. / adj. 白色；白色的"),
      mk(3, 5, "word", "black", "/blæk/", "n. / adj. 黑色；黑色的"),
      // Useful expressions
      mk(3, 5, "sentence", "What colour is it?", "", "它是什么颜色？"),
      mk(3, 5, "sentence", "It's orange.", "", "它是橙红色。"),
      mk(3, 5, "sentence", "Red and blue make purple.", "", "红色加蓝色是紫色。"),
      mk(3, 5, "sentence", "What colours do you like?", "", "你喜欢什么颜色？"),
      mk(3, 5, "sentence", "I like red and pink.", "", "我喜欢红色和粉色。"),
      mk(3, 5, "sentence", "Let's draw some purple and brown birds.", "", "我们一起画一些紫色和棕色的鸟吧。"),
      mk(3, 5, "sentence", "Use again!", "", "再次利用！"),
      mk(3, 5, "sentence", "Be careful!", "", "小心！"),
    ],
  },
  {
    grade: 3,
    unit: 6,
    title: "Useful numbers",
    entries: [
      mk(3, 6, "word", "old", "/əʊld/", "adj. （多少）岁；年纪；旧的"),
      mk(3, 6, "word", "five", "/faɪv/", "num. 五"),
      mk(3, 6, "word", "year", "/jɪə(r)/", "n. 年纪；年"),
      mk(3, 6, "word", "one", "/wʌn/", "num. 一"),
      mk(3, 6, "word", "two", "/tuː/", "num. 二"),
      mk(3, 6, "word", "three", "/θriː/", "num. 三"),
      mk(3, 6, "word", "four", "/fɔː(r)/", "num. 四"),
      mk(3, 6, "word", "ten", "/ten/", "num. 十"),
      mk(3, 6, "word", "six", "/sɪks/", "num. 六"),
      mk(3, 6, "word", "seven", "/ˈsevn/", "num. 七"),
      mk(3, 6, "word", "eight", "/eɪt/", "num. 八"),
      mk(3, 6, "word", "nine", "/naɪn/", "num. 九"),
      mk(3, 6, "word", "o'clock", "/əˈklɒk/", "n. （表示整点）……点钟"),
      mk(3, 6, "word", "cut", "/kʌt/", "v. 切块"),
      mk(3, 6, "word", "eat", "/iːt/", "v. 吃"),
      mk(3, 6, "word", "cake", "/keɪk/", "n. 蛋糕"),
      // Useful expressions
      mk(3, 6, "sentence", "How old are you?", "", "你几岁了？"),
      mk(3, 6, "sentence", "I'm five years old.", "", "我五岁了。"),
      mk(3, 6, "sentence", "Me too.", "", "我也是。"),
      mk(3, 6, "sentence", "How many apples?", "", "几个苹果？"),
      mk(3, 6, "sentence", "Two.", "", "两个。"),
      mk(3, 6, "sentence", "Great! Let's go to the shop!", "", "好极了！我们一起去商店吧！"),
      mk(3, 6, "sentence", "That's ten yuan, please.", "", "（共）十元，谢谢。"),
      mk(3, 6, "sentence", "Here you are.", "", "给您。"),
      mk(3, 6, "sentence", "It's seven o'clock. Hurry!", "", "七点了。快点！"),
      mk(3, 6, "sentence", "Happy birthday!", "", "生日快乐！"),
      mk(3, 6, "sentence", "Oh, one more cut for the dog.", "", "噢，再切一块给小狗。"),
    ],
  },
  // ==================== 三年级（PEP 三下 2024 秋新版） ====================
  {
    grade: 3,
    unit: 7,
    title: "Meeting new people",
    entries: [
      mk(3, 7, "word", "where", "/weə(r)/", "在哪里；到哪里"),
      mk(3, 7, "word", "from", "/frɒm/", "（表示来源）来自；从……来"),
      mk(3, 7, "word", "about", "/əˈbaʊt/", "关于；大约"),
      mk(3, 7, "word", "today", "/təˈdeɪ/", "今天"),
      mk(3, 7, "word", "teacher", "/ˈtiːtʃə(r)/", "教师"),
      mk(3, 7, "word", "student", "/ˈstjuːdnt/", "学生"),
      mk(3, 7, "word", "after", "/ˈɑːftə(r)/", "在……后面"),
      mk(3, 7, "word", "who", "/huː/", "谁；什么人"),
      mk(3, 7, "word", "girl", "/ɡɜːl/", "女孩"),
      mk(3, 7, "word", "neighbour", "/ˈneɪbə(r)/", "邻居"),
      mk(3, 7, "word", "boy", "/bɔɪ/", "男孩"),
      mk(3, 7, "word", "woman", "/ˈwʊmən/", "成年女子；妇女"),
      mk(3, 7, "word", "man", "/mæn/", "成年男子；男人"),
      mk(3, 7, "word", "Mr", "/ˈmɪstə(r)/", "（用于男子的姓氏或姓名前）先生"),
      mk(3, 7, "word", "classmate", "/ˈklɑːsmeɪt/", "同班同学"),
      mk(3, 7, "word", "he", "/hiː/", "他"),
      mk(3, 7, "word", "also", "/ˈɔːlsəʊ/", "也"),
      mk(3, 7, "word", "English", "/ˈɪŋɡlɪʃ/", "英语的；英语"),
      mk(3, 7, "word", "she", "/ʃiː/", "她"),
      mk(3, 7, "word", "very", "/ˈveri/", "很；非常；十分"),
      mk(3, 7, "word", "UK", "/ˌjuː ˈkeɪ/", "英国"),
      mk(3, 7, "word", "China", "/ˈtʃaɪnə/", "中国"),
      mk(3, 7, "word", "Canada", "/ˈkænədə/", "加拿大"),
      mk(3, 7, "word", "USA", "/ˌjuː es ˈeɪ/", "美国"),
      mk(3, 7, "sentence", "What's your name?", "", "你叫什么名字？"),
      mk(3, 7, "sentence", "My name's Amy Green.", "", "我叫埃米·格林。"),
      mk(3, 7, "sentence", "Where are you from?", "", "你是哪里人？"),
      mk(3, 7, "sentence", "I'm from the UK.", "", "我是英国人。"),
      mk(3, 7, "sentence", "Let me help.", "", "我来帮忙。"),
      mk(3, 7, "sentence", "After you!", "", "您先请！"),
      mk(3, 7, "sentence", "You're welcome.", "", "别客气。"),
      mk(3, 7, "sentence", "Who's that girl?", "", "那个女孩是谁？"),
      mk(3, 7, "sentence", "That's our new neighbour, Amy.", "", "是我们的新邻居埃米。"),
      mk(3, 7, "sentence", "Do you often say that to your mum?", "", "你经常对妈妈那么说吗？"),
      mk(3, 7, "sentence", "Yes, I do.", "", "是的。"),
      mk(3, 7, "sentence", "I often make her gifts.", "", "我经常给她做礼物。"),
      mk(3, 7, "sentence", "We express ourselves in many ways.", "", "我们用很多种方式表达自己。"),
    ],
  },
  {
    grade: 3,
    unit: 8,
    title: "My words and actions",
    entries: [
      mk(3, 8, "word", "has", "/hæz/", "（have 的第三人称单数形式）具有（某种外表、特性或特征）"),
      mk(3, 8, "word", "long", "/lɒŋ/", "（长度或距离）长的"),
      mk(3, 8, "word", "body", "/ˈbɒdi/", "身体"),
      mk(3, 8, "word", "short", "/ʃɔːt/", "短的；个子矮的"),
      mk(3, 8, "word", "leg", "/leɡ/", "腿"),
      mk(3, 8, "word", "right", "/raɪt/", "（意见或判断）准确，确切，恰当"),
      mk(3, 8, "word", "fat", "/fæt/", "肥的；肥胖的"),
      mk(3, 8, "word", "thin", "/θɪn/", "瘦的"),
      mk(3, 8, "word", "slow", "/sləʊ/", "缓慢的；慢的"),
      mk(3, 8, "word", "love", "/lʌv/", "喜爱；爱"),
      mk(3, 8, "word", "tail", "/teɪl/", "尾；尾巴"),
      mk(3, 8, "word", "her", "/hɜː(r)/", "她的"),
      mk(3, 8, "word", "gift", "/ɡɪft/", "礼物"),
      mk(3, 8, "word", "picture", "/ˈpɪktʃə(r)/", "图画；绘画"),
      mk(3, 8, "word", "card", "/kɑːd/", "贺卡；慰问卡；卡片"),
      mk(3, 8, "word", "sing", "/sɪŋ/", "唱（歌）；演唱"),
      mk(3, 8, "word", "dance", "/dɑːns/", "跳舞"),
      mk(3, 8, "word", "talk", "/tɔːk/", "说话；讲话；谈话"),
      mk(3, 8, "word", "face", "/feɪs/", "脸；面孔"),
      mk(3, 8, "word", "all", "/ɔːl/", "所有；全部"),
      mk(3, 8, "word", "song", "/sɒŋ/", "歌；歌曲"),
      mk(3, 8, "word", "or", "/ɔː(r)/", "或；或者；还是"),
      mk(3, 8, "word", "so", "/səʊ/", "（表示大小或数量）这么，那么"),
      mk(3, 8, "word", "much", "/mʌtʃ/", "许多；大量"),
      mk(3, 8, "sentence", "It has a long body and short legs.", "", "它有长长的身体和短短的腿。"),
      mk(3, 8, "sentence", "Dogs are friendly.", "", "狗是友善的。"),
    ],
  },
  {
    grade: 3,
    unit: 9,
    title: "Tools and senses for learning",
    entries: [
      mk(3, 9, "word", "eraser", "/ɪˈreɪzə(r)/", "橡皮"),
      mk(3, 9, "word", "find", "/faɪnd/", "找到；找回"),
      mk(3, 9, "word", "ruler", "/ˈruːlə(r)/", "直尺"),
      mk(3, 9, "word", "pen", "/pen/", "钢笔"),
      mk(3, 9, "word", "pencil", "/ˈpensl/", "铅笔"),
      mk(3, 9, "word", "book", "/bʊk/", "书；书籍"),
      mk(3, 9, "word", "bag", "/bæɡ/", "包；袋"),
      mk(3, 9, "word", "paper", "/ˈpeɪpə(r)/", "纸"),
      mk(3, 9, "word", "these", "/ðiːz/", "这些"),
      mk(3, 9, "word", "see", "/siː/", "看见"),
      mk(3, 9, "word", "smell", "/smel/", "闻（气味）"),
      mk(3, 9, "word", "taste", "/teɪst/", "尝（味道）"),
      mk(3, 9, "word", "hear", "/hɪə(r)/", "听见；听到"),
      mk(3, 9, "word", "touch", "/tʌtʃ/", "触摸；碰"),
      mk(3, 9, "word", "nose", "/nəʊz/", "鼻；鼻子"),
      mk(3, 9, "word", "tongue", "/tʌŋ/", "舌；舌头"),
      mk(3, 9, "word", "class", "/klɑːs/", "课；班级"),
      mk(3, 9, "phrase", "in class", "/ɪn klɑːs/", "在课堂上"),
      mk(3, 9, "word", "computer", "/kəmˈpjuːtə(r)/", "计算机；电脑"),
      mk(3, 9, "word", "learn", "/lɜːn/", "学；学习"),
      mk(3, 9, "sentence", "Excuse me.", "", "劳驾。"),
      mk(3, 9, "sentence", "Can I use your eraser, please?", "", "我能用一下你的橡皮吗？"),
      mk(3, 9, "sentence", "Sure. Here you are.", "", "当然。给你。"),
      mk(3, 9, "sentence", "No problem.", "", "没问题。"),
      mk(3, 9, "sentence", "What are these?", "", "这些是什么？"),
      mk(3, 9, "sentence", "They're grapes.", "", "是葡萄。"),
      mk(3, 9, "sentence", "What about this?", "", "这个呢？"),
    ],
  },
  {
    grade: 3,
    unit: 10,
    title: "Healthy food",
    entries: [
      mk(3, 10, "word", "breakfast", "/ˈbrekfəst/", "早餐；早饭"),
      mk(3, 10, "word", "time", "/taɪm/", "时间"),
      mk(3, 10, "word", "bread", "/bred/", "面包"),
      mk(3, 10, "word", "egg", "/eɡ/", "（作食用的）蛋；鸡蛋"),
      mk(3, 10, "word", "milk", "/mɪlk/", "（牛或羊等的）奶"),
      mk(3, 10, "word", "noodle", "/ˈnuːdl/", "（常用复数）面条"),
      mk(3, 10, "word", "juice", "/dʒuːs/", "果汁"),
      mk(3, 10, "word", "rice", "/raɪs/", "大米"),
      mk(3, 10, "word", "meat", "/miːt/", "肉"),
      mk(3, 10, "word", "vegetable", "/ˈvedʒtəbl/", "蔬菜"),
      mk(3, 10, "word", "healthy", "/ˈhelθi/", "健康的"),
      mk(3, 10, "word", "plate", "/pleɪt/", "盘子"),
      mk(3, 10, "word", "soup", "/suːp/", "汤"),
      mk(3, 10, "word", "fruit", "/fruːt/", "水果"),
      mk(3, 10, "word", "colourful", "/ˈkʌləfl/", "五彩缤纷的"),
      mk(3, 10, "word", "candy", "/ˈkændi/", "糖果"),
      mk(3, 10, "word", "yummy", "/ˈjʌmi/", "很好吃的"),
      mk(3, 10, "sentence", "I'd like some bread and eggs, please.", "", "我想吃点儿面包和鸡蛋。"),
      mk(3, 10, "sentence", "Have some milk too.", "", "也喝点儿牛奶吧。"),
      mk(3, 10, "sentence", "Would you like some rice and meat?", "", "要吃点儿米饭和肉吗？"),
      mk(3, 10, "sentence", "Yes, please.", "", "好的，谢谢。"),
      mk(3, 10, "sentence", "Eat some every day!", "", "每天吃一些吧！"),
    ],
  },
  {
    grade: 3,
    unit: 11,
    title: "Old things",
    entries: [
      mk(3, 11, "word", "boat", "/bəʊt/", "小船；舟"),
      mk(3, 11, "word", "cool", "/kuːl/", "（因时髦、漂亮且与众不同）酷的，绝妙的"),
      mk(3, 11, "word", "keep", "/kiːp/", "保有；留着"),
      mk(3, 11, "word", "at", "/æt/", "在（某处）"),
      mk(3, 11, "word", "home", "/həʊm/", "家；住所"),
      mk(3, 11, "word", "ball", "/bɔːl/", "球"),
      mk(3, 11, "word", "doll", "/dɒl/", "玩偶；玩具娃娃"),
      mk(3, 11, "word", "car", "/kɑː(r)/", "小汽车；轿车"),
      mk(3, 11, "word", "on", "/ɒn/", "（覆盖、附着）在……上"),
      mk(3, 11, "word", "shelf", "/ʃelf/", "（复数 shelves /ʃelvz/）架子"),
      mk(3, 11, "word", "in", "/ɪn/", "在……内；在……中"),
      mk(3, 11, "word", "box", "/bɒks/", "盒子"),
      mk(3, 11, "word", "cap", "/kæp/", "帽子"),
      mk(3, 11, "word", "map", "/mæp/", "地图"),
      mk(3, 11, "word", "under", "/ˈʌndə(r)/", "在（或到、通过）……下面"),
      mk(3, 11, "word", "still", "/stɪl/", "还是；仍然"),
      mk(3, 11, "word", "put", "/pʊt/", "放；安置"),
      mk(3, 11, "sentence", "Do you have old things?", "", "你有旧东西吗？"),
      mk(3, 11, "sentence", "Yes, I do. I have some old books.", "", "是的。我有一些旧书。"),
      mk(3, 11, "sentence", "This boat is cool.", "", "这只船很酷。"),
      mk(3, 11, "sentence", "You can keep it.", "", "你可以留着它。"),
      mk(3, 11, "sentence", "Mum, where is my animal book?", "", "妈妈，我的动物书在哪儿？"),
      mk(3, 11, "sentence", "Is it on the shelf?", "", "在架子上吗？"),
      mk(3, 11, "sentence", "No, it isn't.", "", "不，不在。"),
      mk(3, 11, "sentence", "It's in the box.", "", "它在盒子里。"),
    ],
  },
  {
    grade: 3,
    unit: 12,
    title: "Numbers in life",
    entries: [
      mk(3, 12, "word", "fifteen", "/ˈfɪfˈtiːn/", "十五"),
      mk(3, 12, "word", "twelve", "/twelv/", "十二"),
      mk(3, 12, "word", "fourteen", "/fɔːˈtiːn/", "十四"),
      mk(3, 12, "word", "thirteen", "/ˌθɜːˈtiːn/", "十三"),
      mk(3, 12, "word", "eleven", "/ɪˈlevn/", "十一"),
      mk(3, 12, "word", "twenty", "/ˈtwenti/", "二十"),
      mk(3, 12, "word", "seventeen", "/ˌsevnˈtiːn/", "十七"),
      mk(3, 12, "word", "sixteen", "/ˌsɪksˈtiːn/", "十六"),
      mk(3, 12, "word", "eighteen", "/ˌeɪˈtiːn/", "十八"),
      mk(3, 12, "word", "nineteen", "/ˌnaɪnˈtiːn/", "十九"),
      mk(3, 12, "phrase", "piggy bank", "/ˈpɪɡi bæŋk/", "猪形储钱罐"),
      mk(3, 12, "word", "pay", "/peɪ/", "付费"),
      mk(3, 12, "word", "back", "/bæk/", "回到原处"),
      mk(3, 12, "sentence", "How many books do we have?", "", "我们有多少本书？"),
      mk(3, 12, "sentence", "We have fifteen books.", "", "我们有十五本书。"),
      mk(3, 12, "sentence", "How many boxes do we need?", "", "我们需要多少个箱子？"),
      mk(3, 12, "sentence", "We need three boxes.", "", "我们需要三个箱子。"),
      mk(3, 12, "sentence", "How much is this bag?", "", "这个包多少钱？"),
      mk(3, 12, "sentence", "It's twenty yuan.", "", "二十元。"),
      mk(3, 12, "sentence", "Six yuan, or three for seventeen yuan.", "", "六元，或者十七元三本。"),
      mk(3, 12, "sentence", "How about three for sixteen yuan?", "", "十六元三本行吗？"),
    ],
  },
  ...GRADES_4_TO_9,
];

// 课标词汇补全策略（2026-09-07 用户澄清版）：
//
// 只有**重新构建的词库**才不追加课标，重建的三条线是：
//   · renjiao3    人教版三年级起点   ← CURRICULUM 的 grade>=3
//   · waiyanshe3  外研社三年级起点   ← WAIYANSHE_CURRICULUM 的 grade>=3
//   · renai       仁爱七年级起点     ← RENAI_CURRICULUM（renai.ts 内已无 applyKebiaoTo）
// 其余非重建线（renjiao / waiyanshe 一年级起点、oxford）**保留课标补全**。
//
// ⚠️ 关键坑：CURRICULUM 与 WAIYANSHE_CURRICULUM 是两条线共享的基线数组，
// 直接对它 applyKebiaoTo 会把课标单元同时灌进重建的三起线。
// ⇒ 基线保持纯净，只有派生「一起线」时对**副本**追加课标（见 withKebiao）。

/**
 * 复制单元数组（新建数组与单元壳，词条对象仍共享）并追加课标单元。
 * 用于让「一起线」带课标、同时不污染共享基线与「三起线」。
 * 必须在基线数组字面量求值完成之后调用，以保证 mk / mkWithPrefix 序号顺序稳定。
 */
function withKebiao(
  units: UnitInfo[],
  make: Parameters<typeof applyKebiaoTo>[1],
  elemGrades: number[],
  midGrades: number[]
): UnitInfo[] {
  const copy: UnitInfo[] = units.map((u) => ({ ...u, entries: [...u.entries] }));
  applyKebiaoTo(copy, make, elemGrades, midGrades);
  return copy;
}

/**
 * 外研社两条教材线派生。
 *
 * 2026-09-08（v22 起）：WAIYANSHE_CURRICULUM 仍保留 G1G2 一线起点词；
 * waiyanshe 一线 G3+ 改用独立重建的 src/data/waiyansheSL.ts（一线版本）。
 * 拼接策略：waiyanshe = WAIYANSHE_CURRICULUM G1G2（已一线版）+ SL G3-G18（一线版）。
 * 这样 WAIYANSHE_SL_CURRICULUM 只在 waiyanshe 路径出现，不会再回流到 waiyanshe3。
 *
 * ⚠️ v22 已废弃「3 年级起去重 1-2 年级已学词」的过滤：SL G3+ 词表与 G1G2
 * 本就是不同源（一线版教材），再去重反会丢失新起点词表增加的高频词；
 * 真去重要等 G1G2 与 G3+ 同源时才有效。当前代码不再调用 wyEarlyWords.filter。
 *
 * - waiyanshe（一年级起点）：1-9 年级真实教材，按课标补完（3-9 年级末尾）。
 *   ✅ **带课标补全**。
 * - waiyanshe3（三年级起点）：3-9 年级，按三年级起点教材原样；
 *   ❌ **不补课标**（本次按用户逐册拍照重建的线，词表以教材为准）。
 */
/**
 * 一年级起点线的带内去重：maxGrade（默认 2）及以下的单元里，
 * 后面单元中与前面单元重复的词条（按英文小写比较）一律移除，
 * 保留序列中首次出现的位置。词条 id 保持不变（去重发生在构建层，
 * 不动数据文件），被移除词条的历史进度引用由 loadProgress 统一清理。
 * 例如外研社 spring/summer/autumn/winter 在一年级 U9 首次出现，
 * 二年级 U5 的重复项会被移除。
 */
function dedupeEarlyGrades(
  units: UnitInfo[],
  maxGrade = 2,
  perGrade = false
): UnitInfo[] {
  let seen = new Set<string>();
  let prevGrade = 0;
  return units
    .map((u) => {
      if (u.grade > maxGrade) return u;
      // perGrade=true：seen 只在同一年级内累计（上册→下册），跨年级重置。
      // v24：waiyanshe 册归并后 G2=2A+2B 是独立教材年，若沿用跨年累计，
      // 2A 中复现 1A/1B 核心词的整单元（如 M3U1 mother/father…）会被错删，
      // 与 v23 废弃跨 G2→G3 过滤同理。
      if (perGrade && u.grade !== prevGrade) {
        seen = new Set();
        prevGrade = u.grade;
      }
      const kept = u.entries.filter((e) => {
        const k = e.english.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return kept.length === u.entries.length ? u : { ...u, entries: kept };
    })
    .filter((u) => u.entries.length > 0);
}

// 一起线带课标（非重建线，保留旧行为）；三起线用纯净基线，不补课标
// 2026-09-08: waiyanshe 一线 G3+ 改为按"外研新标准**一年级起点**版"真实教材独立重建，
/**
 * 「册」归并为「年级」（v24，仅用于 waiyanshe / oxford 两条一线）。
 *
 * waiyansheSL / oxfordSL 按教材册序号编 grade：1A=1、1B=2、2A=3 … 9B=18（18 册）。
 * UI 只支持 1-9 年级 ⇒ 归并规则：G = ⌈册/2⌉（1A+1B→G1 … 9A+9B→G9），
 * 同一年级内下册的 unit 续接上册（上册 1..N，下册 N+1..）。
 *
 * entry 的 grade/unit/id 三者同步重写：
 *   - id 只改 g/u 段，seq 段保留（`wy-g1u1e0001` / `g3u1e4882` 两种格式都处理），
 *     seq 不变 ⇒ 与其他线共用全局 seq 空间仍唯一。
 * - 输入数组允许册序乱序（oxfordSL 中 3A/3B 排在 2A/2B 前面），先按册号稳定排序。
 * - 必须在 withKebiao（课标补全）**之前**调用，让补全单元用新 grade/unit 编号。
 */
function mergeBooksToGrades(units: UnitInfo[]): UnitInfo[] {
  const sorted = [...units].sort((a, b) => a.grade - b.grade);
  const out: UnitInfo[] = [];
  let curGrade = 0;
  let curBook = 0;
  let offset = 0;
  let maxUnit = 0;
  for (const u of sorted) {
    const g = Math.ceil(u.grade / 2);
    if (g !== curGrade) {
      curGrade = g;
      curBook = u.grade;
      offset = 0;
      maxUnit = 0;
    } else if (u.grade !== curBook) {
      // 同年级内换册（上→下）：下册 unit 续接上册
      curBook = u.grade;
      offset = maxUnit;
    }
    const nu = u.unit + offset;
    maxUnit = Math.max(maxUnit, nu);
    out.push({
      ...u,
      grade: g,
      unit: nu,
      entries: u.entries.map((e) => {
        const m = /^([a-z]+-)?g\d+u\d+(e\d+)$/.exec(e.id);
        const id = m
          ? `${m[1] ?? ""}g${g}u${nu}${m[2]}`
          : e.id.replace(/^g\d+u\d+/, `g${g}u${nu}`);
        return { ...e, id, grade: g, unit: nu };
      }),
    });
  }
  return out;
}

// 2026-09-08: waiyanshe 一线 G3+ 改为按"外研新标准一线"独立重建，
// 不再复用 WAIYANSHE_CURRICULUM 的三起 G3+ 段。一线 SL G3+ 现放在 src/data/waiyansheSL.ts。
// 拼接策略：waiyanshe = WAIYANSHE_CURRICULUM G1G2（已 SL 化）+ SL G3-G18（已是新标准一线版）
// 这样 WAIYANSHE_SL_CURRICULUM 只在 waiyanshe 路径出现，不会再回流到 waiyanshe3。
// 2026-09-09 (v23)：去掉「跨 G2→G3 用 G1G2 词过滤」的逻辑，因 SL G3+ 是另一套
// 真实教材词表而非 G1G2 同源扩展，过滤会错删。带内 G1G2 去重由 dedupeEarlyGrades 承担。
// 2026-09-10 (v24)：G1G2 与 SL 全段按「册」编号（1A=1 … 9B=18），经 mergeBooksToGrades
// 归并为真实年级 1-9；课标补全的 midGrades 相应从 [7..18] 改回 [7,8,9]。
const WAIYANSHE_LINE_BASE: UnitInfo[] = mergeBooksToGrades([
  ...WAIYANSHE_CURRICULUM.filter((u) => u.grade <= 2), // waiyanshe G1G2（已 SL 化，册 1A/1B）
  ...WAIYANSHE_SL_CURRICULUM, // waiyanshe SL（一线版，册 2A-9B ⇒ grade 3-18）
]);
const WAIYANSHE_G1_START: UnitInfo[] = dedupeEarlyGrades(
  withKebiao(WAIYANSHE_LINE_BASE, makeWaiyansheEntry, [3, 4, 5, 6], [7, 8, 9]),
  2,
  true
);
// 2026-09-08 用户约束：不许动三起线。深一层拷贝让 WAIYANSHE_G3_START
// 与 WAIYANSHE_CURRICULUM G3+ 段不再共享 unit/entry 对象引用。
// filter() 仅新建数组，元素对象仍是基线同一份；map 浅拷贝一层让
// waiyanshe3（CURRICULA 引用本数组）的修改不会反向影响 WAIYANSHE_CURRICULUM。
const WAIYANSHE_G3_START: UnitInfo[] = WAIYANSHE_CURRICULUM.filter(
  (u) => u.grade >= 3
).map((u) => ({ ...u, entries: [...u.entries] }));

/**
 * 人教版两条教材线派生。
 *
 * 2026-09-08（v22 起）：renjiao 一线 G3+ 改用独立重建的 src/data/renjiaoSL.ts（SL 一线版）。
 * CURRICULUM 顶数组 G1G2 已是 SL 一线版词表，G3+ 改走 SL。
 * 拼接策略：renjiao = CURRICULUM G1G2（已 SL 化）+ SL G3-G9。
 * 这样 RENJIAO_SL_CURRICULUM 只在 renjiao 路径出现，不会再回流到 renjiao3。
 *
 * ⚠️ v22 已废弃「3 年级起去重 1-2 年级已学词」的过滤：renjiaoSL G3+ 是新起点
 * 一线版教材的独立词表，与 G1G2 不是同源扩展，过滤会错删。带内 G1G2 去重
 * 由 dedupeEarlyGrades 承担。
 *
 * - renjiao（一年级起点）：1-9 年级真实教材，按课标补完（3-9 年级末尾）。
 *   ✅ **带课标补全**。
 * - renjiao3（三年级起点）：3-9 年级，按 PEP + Go for it 原样。
 *   ❌ **不补课标**（本次按用户逐册拍照重建的线，词表以教材为准）。
 */
// 2026-09-08: renjiao 一线 G3+ 改为按"新起点 SL"独立重建，不再复用 CURRICULUM
// 的 PEP G3+ 段。SL G3+ 现放在 src/data/renjiaoSL.ts。
// 拼接策略：renjiao = CURRICULUM G1G2（已 SL 化） + SL G3-G9（已是新起点）
// 这样 RENJIAO_SL_CURRICULUM 只在 renjiao 路径出现，不会再回流到 renjiao3。
// 2026-09-09 (v23)：去掉「跨 G2→G3 用 G1G2 词过滤」的逻辑，理由同 waiyanshe 注释。
const RENJIAO_LINE_BASE: UnitInfo[] = [
  ...CURRICULUM.filter((u) => u.grade <= 2),       // renjiao G1G2（已 SL）
  ...RENJIAO_SL_CURRICULUM,                          // renjiao SL G3-G9
];
// 一起线带课标（非重建线，保留旧行为）；三起线用纯净基线，不补课标
const RENJIAO_G1_START: UnitInfo[] = dedupeEarlyGrades(
  withKebiao(RENJIAO_LINE_BASE, makeRenjiaoEntry, [3, 4, 5, 6], [7, 8, 9])
);
// 2026-09-08 用户约束：不许动三起线。深一层拷贝让 RENJIAO_G3_START
// 与 CURRICULUM G3+ 段不再共享 unit/entry 对象引用。三起继续走 PEP。
const RENJIAO_G3_START: UnitInfo[] = CURRICULUM.filter((u) => u.grade >= 3).map(
  (u) => ({ ...u, entries: [...u.entries] })
);

// 2026-09-08: oxford (沪教牛津 一线) G3+ 改为按"沪教牛津上海版"真实教材独立重建。
// OXFORD_CURRICULUM G1G2 已是真实 SL 版，G3+ 现放在 src/data/oxfordSL.ts。
// 2026-09-10 (v24)：G1G2 + SL 全段按「册」编号（1A=1 … 9B=18，上海版 1-9 年级
// 每学年 2 册），经 mergeBooksToGrades 归并为真实年级 1-9。
const OXFORD_LINE_BASE: UnitInfo[] = mergeBooksToGrades([
  ...OXFORD_CURRICULUM.filter((u) => u.grade <= 2), // oxford G1G2 (已 SL，册 1A/1B)
  ...OXFORD_SL_CURRICULUM, // oxford SL（上海版，册 2A-9B ⇒ grade 3-18）
]);
// 深拷贝防止外部修改
const OXFORD_DEEPCOPY: UnitInfo[] = OXFORD_LINE_BASE.map((u) => ({
  ...u,
  entries: [...u.entries],
}));

/** 全部教材版本索引（人教为默认） */
export const CURRICULA: Record<CurriculumVersion, UnitInfo[]> = {
  renjiao: RENJIAO_G1_START,
  renjiao3: RENJIAO_G3_START,
  waiyanshe: WAIYANSHE_G1_START,
  waiyanshe3: WAIYANSHE_G3_START,
  renai: RENAI_CURRICULUM,
  oxford: OXFORD_DEEPCOPY,
};

export function getCurriculum(v: CurriculumVersion = "renjiao"): UnitInfo[] {
  return CURRICULA[v];
}

export function getAllEntries(v: CurriculumVersion = "renjiao"): WordEntry[] {
  return getCurriculum(v).flatMap((u) => u.entries);
}

export function findUnit(
  version: CurriculumVersion,
  grade: number,
  unit: number
): UnitInfo | undefined {
  return getCurriculum(version).find(
    (u) => u.grade === grade && u.unit === unit
  );
}

export function gradeLabel(grade: number): string {
  if (grade <= 6) return `小学${grade}年级`;
  return `初中${grade - 6}年级`;
}

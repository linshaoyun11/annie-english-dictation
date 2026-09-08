// 一次性替换 G6U7-10 + 新增 G6U11（PEP 六下旧版词条完整版）
//
// 数据来源：用户 2026-09-04 拍 PEP 六下 9 张截图
//   ① 目录页          ② Words in each unit P54-56
//   ③ Vocabulary P57-59  ④ Useful expressions P60-61
//   ⑤ Appendix 5 Proverbs P61
//
// 替换范围：src/data/grades4to9.ts 行 930-998（注释起点 → G6U10 闭合 `},` 之后）
// OLD_START_MARK：六下注释起点
// OLD_END_MARK：七上注释起点（保留，不动）

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, "..", "src", "data", "grades4to9.ts");

const OLD_START_MARK =
  "// ==================== 六年级下（PEP 六下 旧版，新版要 2027 春才启用） ====================";
const OLD_END_MARK =
  "  // ==================== 七年级上（Go for it 七上全册） ====================";

const NEW_BLOCK = `// ⚠️ 六下新版要 2027 春才启用（六年级从 2026 秋六上开始换新教材），
  //   国家平台现在挂的仍是本旧版。等 2027 春新版出来后再替换。
  //   2026-09-04 用户按官方教材逐词录入（每 Unit 20+ 词条 + 完整 Useful expressions，
  //   比此前精简版 10 条/单元 更完整）：
  //     U7-10 = How tall are you? / Last weekend / Where did you go? / Then and now
  //     U11   = Appendix 5 Proverbs（谚语，旧版六下独有）
  {
    grade: 6,
    unit: 7,
    title: "How tall are you? 你有多高",
    entries: [
      mk(6, 7, "word", "younger", "/ˈjʌŋɡər/", "adj. 更年轻的"),
      mk(6, 7, "word", "older", "/ˈoʊldər/", "adj. 更年长的"),
      mk(6, 7, "word", "taller", "/ˈtɔːlər/", "adj. 更高的"),
      mk(6, 7, "word", "shorter", "/ˈʃɔːrtər/", "adj. 更矮的；更短的"),
      mk(6, 7, "word", "longer", "/ˈlɔːŋɡər/", "adj. 更长的"),
      mk(6, 7, "word", "thinner", "/ˈθɪnər/", "adj. 更瘦的"),
      mk(6, 7, "word", "heavier", "/ˈheviər/", "adj. 更重的"),
      mk(6, 7, "word", "bigger", "/ˈbɪɡər/", "adj. 更大的"),
      mk(6, 7, "word", "smaller", "/ˈsmɔːlər/", "adj. 更小的"),
      mk(6, 7, "word", "stronger", "/ˈstrɔːŋɡər/", "adj. 更强壮的"),
      mk(6, 7, "word", "dinosaur", "/ˈdaɪnəsɔːr/", "n. 恐龙"),
      mk(6, 7, "word", "hall", "/hɔːl/", "n. 大厅"),
      mk(6, 7, "word", "metre", "/ˈmiːtər/", "n. 米（英式英语）"),
      mk(6, 7, "word", "meter", "/ˈmiːtər/", "n. 米（美式英语）"),
      mk(6, 7, "word", "than", "/ðæn/；/ðən/", "prep. 比"),
      mk(6, 7, "word", "both", "/bəʊθ/", "adj. 两个都"),
      mk(6, 7, "word", "kilogram", "/ˈkɪləɡræm/", "n. 千克；公斤"),
      mk(6, 7, "word", "countryside", "/ˈkʌntrisaɪd/", "n. 乡村"),
      mk(6, 7, "word", "lower", "/ˈloʊər/", "adj. 更低的"),
      mk(6, 7, "word", "shadow", "/ˈʃædoʊ/", "n. 阴影；影子"),
      mk(6, 7, "word", "smarter", "/ˈsmɑːrtər/", "adj. 更聪明的"),
      mk(6, 7, "word", "become", "/bɪˈkʌm/", "v. 开始变得；变成"),
      mk(6, 7, "sentence", "That's the tallest dinosaur in this hall.", "", "那是这个厅里最高的恐龙。"),
      mk(6, 7, "sentence", "It's taller than both of us together.", "", "它比我俩加起来还高。"),
      mk(6, 7, "sentence", "How tall are you?", "", "你有多高？"),
      mk(6, 7, "sentence", "I'm 1.65 metres.", "", "我身高 1.65 米。"),
      mk(6, 7, "sentence", "What size are your shoes, Mike?", "", "迈克，你穿多大号的鞋？"),
      mk(6, 7, "sentence", "Your feet are bigger than mine. My shoes are size 37.", "", "你的脚比我的大。我穿 37 号的鞋。"),
      mk(6, 7, "sentence", "How heavy are you?", "", "你体重多少？"),
      mk(6, 7, "sentence", "I'm 48 kilograms.", "", "我体重 48 公斤。"),
    ],
  },
  {
    grade: 6,
    unit: 8,
    title: "Last weekend 上周末",
    entries: [
      mk(6, 8, "word", "cleaned", "/kliːnd/", "v. 打扫（clean 的过去式）"),
      mk(6, 8, "word", "stayed", "/steɪd/", "v. 停留；待（stay 的过去式）"),
      mk(6, 8, "word", "washed", "/wɑːʃt/", "v. 洗（wash 的过去式）"),
      mk(6, 8, "word", "watched", "/wɑːtʃt/", "v. 看（watch 的过去式）"),
      mk(6, 8, "word", "had", "/hæd/", "v. 患病；得病（have 的过去式）"),
      mk(6, 8, "phrase", "had a cold", "", "感冒"),
      mk(6, 8, "word", "slept", "/slept/", "v. 睡觉（sleep 的过去式）"),
      mk(6, 8, "word", "read", "/red/", "v. 读（read 的过去式）"),
      mk(6, 8, "word", "saw", "/sɔː/", "v. 看见（see 的过去式）"),
      mk(6, 8, "word", "last", "/læst/", "adv. 最近的；上一个的"),
      mk(6, 8, "word", "yesterday", "/ˈjestərdeɪ/", "adv. / n. 昨天"),
      mk(6, 8, "word", "before", "/bɪˈfɔːr/", "prep. 在……之前"),
      mk(6, 8, "word", "drank", "/dræŋk/", "v. 喝（drink 的过去式）"),
      mk(6, 8, "word", "show", "/ʃoʊ/", "n. 演出"),
      mk(6, 8, "word", "magazine", "/ˌmæɡəˈziːn/", "n. 杂志"),
      mk(6, 8, "word", "better", "/ˈbetər/", "adj. 更好的（well 的比较级）"),
      mk(6, 8, "word", "faster", "/ˈfæstər/", "adj. 更快的（fast 的比较级）"),
      mk(6, 8, "word", "hotel", "/hoʊˈtel/", "n. 旅馆"),
      mk(6, 8, "word", "fixed", "/fɪkst/", "v. 修理（fix 的过去式）"),
      mk(6, 8, "word", "broken", "/ˈbroʊkən/", "adj. 破损的"),
      mk(6, 8, "word", "lamp", "/læmp/", "n. 台灯"),
      mk(6, 8, "word", "loud", "/laʊd/", "adj. 喧闹的；大声的"),
      mk(6, 8, "word", "enjoy", "/ɪnˈdʒɔɪ/", "v. 享受……乐趣；喜爱"),
      mk(6, 8, "word", "stay", "/steɪ/", "v. 暂住；逗留"),
      mk(6, 8, "sentence", "How was your weekend?", "", "你周末过得怎么样？"),
      mk(6, 8, "sentence", "It was good, thank you.", "", "很好，谢谢。"),
      mk(6, 8, "sentence", "What did you do?", "", "你（周末）干什么了？"),
      mk(6, 8, "sentence", "I stayed at home with your grandma. We drank tea in the afternoon and watched TV.", "", "我和你外婆待在家里。我们喝了下午茶，还看了电视。"),
      mk(6, 8, "sentence", "Did you do anything else?", "", "你还做了其他什么事吗？"),
      mk(6, 8, "sentence", "Yes, I cleaned my room and washed my clothes.", "", "是的，我打扫了房间，还洗了衣服。"),
      mk(6, 8, "sentence", "I want to buy the new film magazine.", "", "我想买新的电影杂志。"),
      mk(6, 8, "sentence", "What did you do last weekend? Did you see a film?", "", "你上周末干什么了？你看电影了吗？"),
      mk(6, 8, "sentence", "No, I had a cold. I stayed at home all weekend and slept.", "", "没有，我感冒了。整个周末都待在家里睡觉。"),
    ],
  },
  {
    grade: 6,
    unit: 9,
    title: "Where did you go? 你去哪了",
    entries: [
      mk(6, 9, "word", "went", "/went/", "v. 去（go 的过去式）"),
      mk(6, 9, "word", "camp", "/kæmp/", "n. / v. 野营"),
      mk(6, 9, "phrase", "went camping", "", "去野营"),
      mk(6, 9, "word", "fish", "/fɪʃ/", "v. 钓鱼；捕鱼"),
      mk(6, 9, "phrase", "went fishing", "", "去钓鱼"),
      mk(6, 9, "word", "rode", "/roʊd/", "v. 骑（ride 的过去式）"),
      mk(6, 9, "word", "hurt", "/hɜːrt/", "v. （使）受伤"),
      mk(6, 9, "word", "ate", "/eɪt/", "v. 吃（eat 的过去式）"),
      mk(6, 9, "word", "took", "/tʊk/", "v. 拍照；拍摄（take 的过去式）"),
      mk(6, 9, "phrase", "took pictures", "", "照相"),
      mk(6, 9, "word", "bought", "/bɔːt/", "v. 买（buy 的过去式）"),
      mk(6, 9, "word", "gift", "/ɡɪft/", "n. 礼物"),
      mk(6, 9, "word", "fell", "/fel/", "v. 摔倒（fall 的过去式）"),
      mk(6, 9, "word", "off", "/ɔːf/", "prep. 从（某处）落下"),
      mk(6, 9, "word", "mule", "/mjuːl/", "n. 骡子"),
      mk(6, 9, "word", "Turpan", "/ˈtʊrpæn/", "n. 吐鲁番"),
      mk(6, 9, "word", "could", "/kʊd/", "v. 能（can 的过去式）"),
      mk(6, 9, "word", "till", "/tɪl/", "prep. 直到"),
      mk(6, 9, "word", "beach", "/biːtʃ/", "n. 海滩；沙滩"),
      mk(6, 9, "word", "basket", "/ˈbæskɪt/", "n. 篮；筐"),
      mk(6, 9, "word", "part", "/pɑːrt/", "n. 角色"),
      mk(6, 9, "word", "licked", "/lɪkt/", "v. 舔（lick 的过去式）"),
      mk(6, 9, "word", "laughed", "/læft/", "v. 笑（laugh 的过去式）"),
      mk(6, 9, "sentence", "What happened?", "", "怎么了？"),
      mk(6, 9, "sentence", "Are you all right?", "", "你还好吧？"),
      mk(6, 9, "sentence", "I'm OK now.", "", "我现在没事了。"),
      mk(6, 9, "sentence", "Where did you go?", "", "你去哪儿了？"),
      mk(6, 9, "sentence", "It looks like a mule!", "", "它看起来像头骡子！"),
      mk(6, 9, "sentence", "Did you go to Turpan?", "", "你们去吐鲁番了吗？"),
      mk(6, 9, "sentence", "Yes, we did.", "", "是的，去了。"),
      mk(6, 9, "sentence", "How did you go there?", "", "你们怎么去的？"),
      mk(6, 9, "sentence", "We went there by plane.", "", "我们坐飞机去的。"),
      mk(6, 9, "sentence", "Sounds great!", "", "听上去不错！"),
    ],
  },
  {
    grade: 6,
    unit: 10,
    title: "Then and now 那时和现在",
    entries: [
      mk(6, 10, "word", "dining hall", "/ˈdaɪnɪŋ hɔːl/", "n. 餐厅"),
      mk(6, 10, "word", "grass", "/ɡræs/", "n. 草；草坪"),
      mk(6, 10, "word", "gym", "/dʒɪm/", "n. 体育馆；健身房"),
      mk(6, 10, "word", "ago", "/əˈɡoʊ/", "adv. 以前"),
      mk(6, 10, "word", "cycling", "/ˈsaɪklɪŋ/", "n. / v. 骑自行车运动（或活动）"),
      mk(6, 10, "phrase", "go cycling", "", "去骑自行车"),
      mk(6, 10, "word", "ice-skate", "/ˈaɪsskeɪt/", "v. 滑冰"),
      mk(6, 10, "word", "badminton", "/ˈbædmɪntən/", "n. 羽毛球运动"),
      mk(6, 10, "word", "star", "/stɑːr/", "n. 星"),
      mk(6, 10, "word", "easy", "/ˈiːzi/", "adj. 容易的"),
      mk(6, 10, "phrase", "look up", "", "（在词典中或通过电脑）查阅"),
      mk(6, 10, "word", "Internet", "/ˈɪntərnet/", "n. 互联网"),
      mk(6, 10, "word", "different", "/ˈdɪfrənt/", "adj. 不同的"),
      mk(6, 10, "word", "active", "/ˈæktɪv/", "adj. 积极的；活跃的"),
      mk(6, 10, "word", "race", "/reɪs/", "n. / v. 赛跑"),
      mk(6, 10, "word", "nothing", "/ˈnʌθɪŋ/", "pron. 没有什么"),
      mk(6, 10, "word", "thought", "/θɔːt/", "v. 想（think 的过去式）"),
      mk(6, 10, "word", "felt", "/felt/", "v. 感觉（feel 的过去式）"),
      mk(6, 10, "word", "cheetah", "/ˈtʃiːtə/", "n. 猎豹"),
      mk(6, 10, "word", "trip", "/trɪp/", "v. 绊倒"),
      mk(6, 10, "word", "woke", "/woʊk/", "v. 醒（wake 的过去式）"),
      mk(6, 10, "word", "dream", "/driːm/", "n. / v. 梦"),
      mk(6, 10, "sentence", "There was no library in my old school.", "", "我以前的学校里没有图书馆。"),
      mk(6, 10, "sentence", "Tell us about your school, please.", "", "请给我们讲讲您的学校吧。"),
      mk(6, 10, "sentence", "How do you know that?", "", "你怎么知道的？"),
      mk(6, 10, "sentence", "There were no computers or Internet in my time.", "", "我那时候没有电脑也没有网络。"),
      mk(6, 10, "sentence", "Before, I was quiet. Now, I'm very active in class.", "", "以前我很安静。现在我在课堂上很活跃。"),
      mk(6, 10, "sentence", "I was short, so I couldn't ride my bike well. Now, I go cycling every day.", "", "我以前个子小，自行车骑得不好。现在我天天骑车。"),
    ],
  },
  // ==================== Appendix 5: Proverbs（教材附录谚语，2026-09-04 用户提供截图） ====================
  {
    grade: 6,
    unit: 11,
    title: "Proverbs 谚语（Appendix 5）",
    entries: [
      mk(6, 11, "sentence", "Less is more.", "", "少即是多。"),
      mk(6, 11, "sentence", "All work and no play makes Jack a dull boy.", "", "只工作不玩耍，聪明杰克也变傻。"),
      mk(6, 11, "sentence", "All's well that ends well.", "", "结局好，一切都好。"),
      mk(6, 11, "sentence", "Life is what you make it.", "", "生活是自己创造出来的。"),
    ],
  },
`;

const target = readFileSync(FILE, "utf8");
const startIdx = target.indexOf(OLD_START_MARK);
if (startIdx < 0) {
  console.error("[ERR] OLD_START_MARK 未找到");
  process.exit(2);
}
const endIdx = target.indexOf(OLD_END_MARK, startIdx);
if (endIdx < 0) {
  console.error("[ERR] OLD_END_MARK 未找到");
  process.exit(2);
}

const before = target.slice(0, startIdx);
const after = target.slice(endIdx + OLD_END_MARK.length);
const next = before + NEW_BLOCK + OLD_END_MARK + after;

writeFileSync(FILE, next, "utf8");
console.log(`[OK] G6U7-10 重做 + G6U11 新增 完成`);
console.log(`  旧段长度: ${endIdx - startIdx} 字符`);
console.log(`  新段长度: ${NEW_BLOCK.length} 字符`);
/**
 * 一次性 patch G4U7-12（PEP 四下 2024 秋新版）+ 新增 G4U13 Numbers
 * 用法：node scripts/patch_g4u7-12.mjs
 *
 * 旧版 G4U7-12 是 PEP 2012 旧版（My school/What time is it/Weather/At the farm/My clothes/Shopping）；
 * 新版是 Unit 7-12 = Class rules / Family rules / Time for school / Going shopping /
 *                      Farms and us / From farm to table。
 * 另新增 G4U13 = Numbers 数词 28 个（one-hundred），Vocabulary 里未列，附录单独成 unit。
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/data/grades4to9.ts";
let s = readFileSync(FILE, "utf8");

// ===== 新版 G4U7-12 + G4U13 =====
const NEW_BLOCK = `  // ==================== 四年级下（PEP 四下 2024 秋新版） ====================
  {
    grade: 4,
    unit: 7,
    title: "Class rules 班级规则",
    entries: [
      mk(4, 7, "word", "sorry", "/ˈsɒri/", "对不起；抱歉"),
      mk(4, 7, "word", "hurry", "/ˈhʌri/", "赶快；匆忙"),
      mk(4, 7, "word", "late", "/leɪt/", "迟到；迟到的"),
      mk(4, 7, "word", "class", "/klɑːs/", "班级；课"),
      mk(4, 7, "word", "ready", "/ˈredi/", "准备好的"),
      mk(4, 7, "word", "rule", "/ruːl/", "规则；规章"),
      mk(4, 7, "word", "classroom", "/ˈklɑːsruːm/", "教室"),
      mk(4, 7, "word", "light", "/laɪt/", "灯"),
      mk(4, 7, "word", "blackboard", "/ˈblækbɔːd/", "黑板"),
      mk(4, 7, "word", "desk", "/desk/", "书桌"),
      mk(4, 7, "word", "chair", "/tʃeə(r)/", "椅子"),
      mk(4, 7, "word", "tidy", "/ˈtaɪdi/", "整洁的；整齐的"),
      mk(4, 7, "word", "music", "/ˈmjuːzɪk/", "音乐"),
      mk(4, 7, "word", "door", "/dɔː(r)/", "门"),
      mk(4, 7, "word", "window", "/ˈwɪndəʊ/", "窗"),
      mk(4, 7, "word", "fan", "/fæn/", "风扇"),
      mk(4, 7, "word", "when", "/wen/", "当……时；什么时候"),
      mk(4, 7, "word", "understand", "/ˌʌndəˈstænd/", "理解；懂"),
      mk(4, 7, "word", "wall", "/wɔːl/", "墙"),
      mk(4, 7, "word", "newspaper", "/ˈnjuːzpeɪpə(r)/", "报纸"),
      mk(4, 7, "word", "workbook", "/ˈwɜːkbʊk/", "练习册；作业本"),
      mk(4, 7, "phrase", "turn off", "/ˌtɜːn ˈɒf/", "关掉"),
      mk(4, 7, "phrase", "hand out", "/ˌhænd ˈaʊt/", "分发"),
      // Useful expressions U7（10 句）
      mk(4, 7, "sentence", "Hurry up! Don't be late for class!", "", "快点！上课别迟到！"),
      mk(4, 7, "sentence", "I'm ready. Let's go!", "", "我准备好了。我们走吧！"),
      mk(4, 7, "sentence", "Who's on duty today?", "", "今天谁值日？"),
      mk(4, 7, "sentence", "I can put back the desks and chairs.", "", "我可以把桌椅放回原位。"),
      mk(4, 7, "sentence", "Excuse me?", "", "对不起，请再说一次可以吗？"),
      mk(4, 7, "sentence", "It's 5 o'clock.", "", "现在五点了。"),
      mk(4, 7, "sentence", "Time to go home, kids.", "", "孩子们，该回家了。"),
      mk(4, 7, "sentence", "It's time for dinner.", "", "该吃晚饭了。"),
      mk(4, 7, "sentence", "It's time to get up.", "", "该起床了。"),
      mk(4, 7, "sentence", "Have a nice day!", "", "祝你一天愉快！"),
    ],
  },
  {
    grade: 4,
    unit: 8,
    title: "Family rules 家庭规则",
    entries: [
      mk(4, 8, "word", "watch", "/wɒtʃ/", "看；观看"),
      mk(4, 8, "word", "TV", "/ˌtiː ˈviː/", "电视"),
      mk(4, 8, "word", "homework", "/ˈhəʊmwɜːk/", "家庭作业"),
      mk(4, 8, "word", "first", "/fɜːst/", "首先；第一"),
      mk(4, 8, "word", "wet", "/wet/", "湿的；未干的"),
      mk(4, 8, "word", "run", "/rʌn/", "跑"),
      mk(4, 8, "word", "living room", "/ˈlɪvɪŋ ruːm/", "客厅；起居室"),
      mk(4, 8, "word", "safe", "/seɪf/", "安全的"),
      mk(4, 8, "word", "word", "/wɜːd/", "单词；言语"),
      mk(4, 8, "word", "wash", "/wɒʃ/", "洗"),
      mk(4, 8, "word", "helpful", "/ˈhelpfl/", "有帮助的；有用的"),
      mk(4, 8, "word", "loud", "/laʊd/", "大声的；吵闹的"),
      mk(4, 8, "word", "sleep", "/sliːp/", "睡觉"),
      mk(4, 8, "word", "bedroom", "/ˈbedruːm/", "卧室"),
      mk(4, 8, "word", "kitchen", "/ˈkɪtʃɪn/", "厨房"),
      mk(4, 8, "word", "study", "/ˈstʌdi/", "书房；学习"),
      mk(4, 8, "word", "bathroom", "/ˈbɑːθruːm/", "浴室；洗手间"),
      mk(4, 8, "word", "think", "/θɪŋk/", "想；思考"),
      mk(4, 8, "word", "work", "/wɜːk/", "做（某事）；工作"),
      mk(4, 8, "word", "hard", "/hɑːd/", "努力地"),
      mk(4, 8, "word", "follow", "/ˈfɒləʊ/", "遵循；听从"),
      mk(4, 8, "word", "feel", "/fiːl/", "觉得；感到"),
      // Useful expressions U8（4 句）
      mk(4, 8, "sentence", "Mum, can I watch TV?", "", "妈妈，我能看电视吗？"),
      mk(4, 8, "sentence", "No. You have to do your homework first.", "", "不行。你得先做作业。"),
      mk(4, 8, "sentence", "Shh. Don't be so loud!", "", "嘘。别这么大声！"),
      mk(4, 8, "sentence", "Be careful, Jack. Don't touch hot things.", "", "杰克，要小心，别碰烫的东西。"),
    ],
  },
  {
    grade: 4,
    unit: 9,
    title: "Time for school 上学时间",
    entries: [
      mk(4, 9, "word", "over", "/ˈəʊvə(r)/", "结束（的）"),
      mk(4, 9, "word", "kid", "/kɪd/", "小孩"),
      mk(4, 9, "word", "dinner", "/ˈdɪnə(r)/", "（中午或晚上吃的）正餐"),
      mk(4, 9, "word", "art", "/ɑːt/", "美术；艺术"),
      mk(4, 9, "word", "lunch", "/lʌntʃ/", "午餐"),
      mk(4, 9, "word", "maths", "/mæθs/", "数学"),
      mk(4, 9, "word", "want", "/wɒnt/", "想要"),
      mk(4, 9, "word", "clock", "/klɒk/", "时钟"),
      mk(4, 9, "word", "just", "/dʒʌst/", "只是；仅仅；正要"),
      mk(4, 9, "word", "minute", "/ˈmɪnɪt/", "分钟"),
      mk(4, 9, "phrase", "get up", "/ˌɡet ˈʌp/", "起床"),
      mk(4, 9, "phrase", "go to school", "/ˌɡəʊ tə ˈskuːl/", "上学"),
      mk(4, 9, "phrase", "go home", "/ˌɡəʊ ˈhəʊm/", "回家"),
      mk(4, 9, "phrase", "go to bed", "/ˌɡəʊ tə ˈbed/", "上床睡觉"),
      // Useful expressions U9（6 句）
      mk(4, 9, "sentence", "What time is it?", "", "几点了？"),
      mk(4, 9, "sentence", "It's 5 o'clock.", "", "现在五点了。"),
      mk(4, 9, "sentence", "Time to go home, kids.", "", "孩子们，该回家了。"),
      mk(4, 9, "sentence", "It's time for dinner.", "", "该吃晚饭了。"),
      mk(4, 9, "sentence", "It's time to get up.", "", "该起床了。"),
      mk(4, 9, "sentence", "Have a nice day!", "", "祝你一天愉快！"),
    ],
  },
  {
    grade: 4,
    unit: 10,
    title: "Going shopping 购物",
    entries: [
      mk(4, 10, "word", "trousers", "/ˈtraʊzəz/", "裤子"),
      mk(4, 10, "word", "pair", "/peə(r)/", "（由连在一起的相似两部分构成的）一条；一副"),
      mk(4, 10, "word", "clothes", "/kləʊðz/", "衣服；服装"),
      mk(4, 10, "word", "those", "/ðəʊz/", "那些"),
      mk(4, 10, "word", "shorts", "/ʃɔːts/", "短裤"),
      mk(4, 10, "word", "jacket", "/ˈdʒækɪt/", "夹克衫；短上衣"),
      mk(4, 10, "word", "skirt", "/skɜːt/", "裙子"),
      mk(4, 10, "word", "dear", "/dɪə(r)/", "亲爱的"),
      mk(4, 10, "word", "expensive", "/ɪkˈspensɪv/", "昂贵的；价格高的"),
      mk(4, 10, "word", "take", "/teɪk/", "买下；拿；取"),
      mk(4, 10, "word", "cheap", "/tʃiːp/", "便宜的"),
      mk(4, 10, "word", "shoe", "/ʃuː/", "鞋"),
      mk(4, 10, "word", "beautiful", "/ˈbjuːtɪfl/", "美丽的"),
      mk(4, 10, "word", "hat", "/hæt/", "帽子"),
      mk(4, 10, "word", "sunglasses", "/ˈsʌŋlɑːsɪz/", "太阳镜；墨镜"),
      mk(4, 10, "word", "free", "/friː/", "免费的"),
      mk(4, 10, "word", "large", "/lɑːdʒ/", "（服装、食物、日用品等）大型号的"),
      mk(4, 10, "word", "size", "/saɪz/", "尺码；号"),
      mk(4, 10, "word", "list", "/lɪst/", "清单；目录"),
      mk(4, 10, "word", "any", "/ˈeni/", "任何的；任一的"),
      mk(4, 10, "phrase", "try on", "/ˌtraɪ ˈɒn/", "试穿"),
      // Useful expressions U10（6 句）
      mk(4, 10, "sentence", "Can I buy a new pair?", "", "我能买条新的（裤子）吗？"),
      mk(4, 10, "sentence", "Sure. Let's go to the clothes shop.", "", "当然。我们去服装店吧。"),
      mk(4, 10, "sentence", "You already have too many shorts. Let's buy trousers.", "", "你已经有短裤了，我们买长裤吧。"),
      mk(4, 10, "sentence", "Can I help you?", "", "要帮忙吗？"),
      mk(4, 10, "sentence", "Yes. I like this pink dress.", "", "嗯。我喜欢这件粉色的长裙。"),
      mk(4, 10, "sentence", "Let's take it.", "", "我们买下它吧。"),
    ],
  },
  {
    grade: 4,
    unit: 11,
    title: "Farms and us 农场与我们",
    entries: [
      mk(4, 11, "word", "cow", "/kaʊ/", "奶牛"),
      mk(4, 11, "word", "horse", "/hɔːs/", "马"),
      mk(4, 11, "word", "sheep", "/ʃiːp/", "羊；绵羊"),
      mk(4, 11, "word", "pig", "/pɪg/", "猪"),
      mk(4, 11, "word", "chicken", "/ˈtʃɪkɪn/", "鸡；鸡肉"),
      mk(4, 11, "word", "tomato", "/təˈmɑːtəʊ/", "西红柿"),
      mk(4, 11, "word", "bee", "/biː/", "蜜蜂"),
      mk(4, 11, "word", "mouse", "/maʊs/", "老鼠（复数 mice /maɪs/）"),
      mk(4, 11, "word", "carrot", "/ˈkærət/", "胡萝卜"),
      mk(4, 11, "word", "potato", "/pəˈteɪtəʊ/", "土豆"),
      mk(4, 11, "word", "green bean", "/ˌɡriːn ˈbiːn/", "青刀豆；四季豆"),
      mk(4, 11, "word", "can", "/kæn/", "（盛食品或饮料的）金属罐"),
      mk(4, 11, "phrase", "a box of", "/ə ˌbɒks ˈɒv/", "一盒；一箱（东西）"),
      // Useful expressions U11（5 句）
      mk(4, 11, "sentence", "What animals do you have on the farm?", "", "您的农场养了哪些动物？"),
      mk(4, 11, "sentence", "I have a lot of animals.", "", "我养了很多动物。"),
      mk(4, 11, "sentence", "What are these?", "", "这些是什么？"),
      mk(4, 11, "sentence", "They're tomatoes.", "", "这些是西红柿。"),
      mk(4, 11, "sentence", "How fresh!", "", "真新鲜啊！"),
    ],
  },
  {
    grade: 4,
    unit: 12,
    title: "From farm to table 从农场到餐桌",
    entries: [
      mk(4, 12, "word", "feed", "/fiːd/", "给（人或动物）食物；饲养"),
      mk(4, 12, "word", "pass", "/pɑːs/", "给；递"),
      mk(4, 12, "word", "pick", "/pɪk/", "采；摘"),
      mk(4, 12, "word", "milk", "/mɪlk/", "挤奶；牛奶"),
      mk(4, 12, "word", "knife", "/naɪf/", "刀"),
      mk(4, 12, "word", "fork", "/fɔːk/", "餐叉"),
      mk(4, 12, "word", "chopstick", "/ˈtʃɒpstɪk/", "（常用复数）筷子"),
      mk(4, 12, "word", "waste", "/weɪst/", "浪费；废品"),
      mk(4, 12, "word", "food", "/fuːd/", "菜肴；食物"),
      mk(4, 12, "word", "delicious", "/dɪˈlɪʃəs/", "美味的；可口的"),
      mk(4, 12, "word", "bowl", "/bəʊl/", "碗"),
      mk(4, 12, "word", "spoon", "/spuːn/", "勺；匙"),
      mk(4, 12, "word", "supermarket", "/ˈsuːpəmɑːkɪt/", "超市"),
      mk(4, 12, "word", "herself", "/hɜːˈself/", "（用作女性的反身代词）她自己"),
      mk(4, 12, "word", "week", "/wiːk/", "周；星期"),
      mk(4, 12, "word", "salad", "/ˈsæləd/", "蔬菜沙拉"),
      mk(4, 12, "phrase", "clear the table", "/ˌklɪə ðə ˈteɪbl/", "收拾餐桌"),
      mk(4, 12, "phrase", "set the table", "/ˌset ðə ˈteɪbl/", "摆放餐具"),
      // Useful expressions U12（5 句）
      mk(4, 12, "sentence", "Let's feed the chickens.", "", "我们喂鸡吧。"),
      mk(4, 12, "sentence", "Can you please pass me the vegetables?", "", "能否请你把蔬菜递给我？"),
      mk(4, 12, "sentence", "Mike, Amy, would you like a knife and fork?", "", "迈克、埃米，你们需要餐刀和叉吗？"),
      mk(4, 12, "sentence", "No, thank you, Mr Wang. I can use chopsticks.", "", "不用，谢谢您，王先生。我会用筷子。"),
      mk(4, 12, "sentence", "Don't waste food, please.", "", "请不要浪费食物。"),
    ],
  },
  {
    grade: 4,
    unit: 13,
    title: "Numbers 数词（附录）",
    entries: [
      mk(4, 13, "word", "one", "/wʌn/", "一"),
      mk(4, 13, "word", "two", "/tuː/", "二"),
      mk(4, 13, "word", "three", "/θriː/", "三"),
      mk(4, 13, "word", "four", "/fɔː(r)/", "四"),
      mk(4, 13, "word", "five", "/faɪv/", "五"),
      mk(4, 13, "word", "six", "/sɪks/", "六"),
      mk(4, 13, "word", "seven", "/ˈsevn/", "七"),
      mk(4, 13, "word", "eight", "/eɪt/", "八"),
      mk(4, 13, "word", "nine", "/naɪn/", "九"),
      mk(4, 13, "word", "ten", "/ten/", "十"),
      mk(4, 13, "word", "eleven", "/ɪˈlevn/", "十一"),
      mk(4, 13, "word", "twelve", "/twelv/", "十二"),
      mk(4, 13, "word", "thirteen", "/ˌθɜːˈtiːn/", "十三"),
      mk(4, 13, "word", "fourteen", "/ˌfɔːˈtiːn/", "十四"),
      mk(4, 13, "word", "fifteen", "/ˌfɪfˈtiːn/", "十五"),
      mk(4, 13, "word", "sixteen", "/ˌsɪksˈtiːn/", "十六"),
      mk(4, 13, "word", "seventeen", "/ˌsevnˈtiːn/", "十七"),
      mk(4, 13, "word", "eighteen", "/ˌeɪˈtiːn/", "十八"),
      mk(4, 13, "word", "nineteen", "/ˌnaɪnˈtiːn/", "十九"),
      mk(4, 13, "word", "twenty", "/ˈtwenti/", "二十"),
      mk(4, 13, "word", "thirty", "/ˈθɜːti/", "三十"),
      mk(4, 13, "word", "forty", "/ˈfɔːti/", "四十"),
      mk(4, 13, "word", "fifty", "/ˈfɪfti/", "五十"),
      mk(4, 13, "word", "sixty", "/ˈsɪksti/", "六十"),
      mk(4, 13, "word", "seventy", "/ˈsevnti/", "七十"),
      mk(4, 13, "word", "eighty", "/ˈeɪti/", "八十"),
      mk(4, 13, "word", "ninety", "/ˈnaɪnti/", "九十"),
      mk(4, 13, "word", "hundred", "/ˈhʌndrəd/", "百"),
    ],
  },
`;

// 旧块定位
const OLD_START = "  // ==================== 四年级下（PEP 四下） ====================";
const OLD_END_MARK = 'mk(4, 12, "sentence", "How much is this dress?", "", "这条连衣裙多少钱？"),';
const idxStart = s.indexOf(OLD_START);
if (idxStart === -1) {
  console.error("[ERR] G4U7 注释起点未找到");
  process.exit(2);
}
// 找 OLD_END_MARK 之后的 "    ],\n  },\n  // ====================
// 实际上 OLD_END_MARK 后面是 "    ],\n  },\n  // 下一段注释"
// 直接到 G4U12 "}" 后面紧跟 "  // ==================== 5"
const idxEndMarker = s.indexOf(OLD_END_MARK, idxStart);
if (idxEndMarker === -1) {
  console.error("[ERR] G4U12 结束标记未找到");
  process.exit(2);
}
// 从 OLD_END_MARK 开始向后数到 "  },\n" 对应的位置
// 形态: mk(...)      \n    ],\n  },\n  // ==================== 5
const afterOldEnd = idxEndMarker + OLD_END_MARK.length;
const closeUnit = s.indexOf("\n  },", afterOldEnd);
if (closeUnit === -1) {
  console.error("[ERR] G4U12 收尾 '},' 未找到");
  process.exit(2);
}
const cutEnd = closeUnit + "\n  },".length;

const before = s.slice(0, idxStart);
const after = s.slice(cutEnd);
const next = before + NEW_BLOCK + after;
writeFileSync(FILE, next, "utf8");
console.log(`[OK] G4U7-13 已替换（${NEW_BLOCK.length} chars），旧段 ${idxEndMarker - idxStart + 1}-${cutEnd} 行已被新版覆盖`);

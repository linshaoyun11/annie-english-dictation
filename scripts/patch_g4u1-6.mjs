/**
 * 把 grades4to9.ts 的 G4U1-6（行 16-117）整体替换为 PEP 四上 2024 秋新版。
 * 用 node 脚本处理避免 Edit 工具对中英混排字符串的转义困难。
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = "src/data/grades4to9.ts";
let src = readFileSync(path, "utf8");

// 锚点：行 117 = "// ==================== 四年级下" 这一行（UTF-8）
const startMarker = "  // ==================== 四年级上（PEP 四上 2024 秋新版） ====================\n  {\n    grade: 4,\n    unit: 1,\n    title: \"Helping at home\",";
const endMarker = "      mk(4, 6, \"sentence\", \"Then spring comes again.\", \"\", \"接着春天又来了。\"),\n    ],\n  },";

const newBlock = `  // ==================== 四年级上（PEP 四上 2024 秋新版） ====================
  {
    grade: 4,
    unit: 1,
    title: "Helping at home",
    entries: [
      mk(4, 1, "word", "PE", "/ˌpiː ˈiː/", "体育（课）"),
      mk(4, 1, "word", "job", "/dʒəb/", "工作；职业"),
      mk(4, 1, "word", "doctor", "/ˈdɒktə(r)/", "医生"),
      mk(4, 1, "word", "farmer", "/ˈfɑːmə(r)/", "农场主；农民"),
      mk(4, 1, "word", "nurse", "/nɜːs/", "护士"),
      mk(4, 1, "phrase", "office worker", "/ˈɒfɪs ˌwɜːkə(r)/", "公司职员"),
      mk(4, 1, "phrase", "factory worker", "/ˈfæktri ˌwɜːkə(r)/", "工厂工人"),
      mk(4, 1, "word", "busy", "/ˈbɪzi/", "忙碌的"),
      mk(4, 1, "word", "tired", "/ˈtaɪəd/", "疲倦的"),
      mk(4, 1, "word", "chore", "/tʃɔː(r)/", "家庭杂务"),
      mk(4, 1, "word", "cook", "/kʊk/", "烹饪；煮"),
      mk(4, 1, "word", "clean", "/kliːn/", "打扫；干净的"),
      mk(4, 1, "word", "room", "/ruːm/", "房间"),
      mk(4, 1, "phrase", "look after", "/lʊk ˈɑːftə(r)/", "照顾"),
      mk(4, 1, "word", "sweep", "/swiːp/", "扫"),
      mk(4, 1, "word", "floor", "/flɔː(r)/", "地板；地面"),
      mk(4, 1, "word", "together", "/təˈɡeðə(r)/", "在一起；共同"),
      mk(4, 1, "word", "people", "/ˈpiːpl/", "人；人们"),
      mk(4, 1, "word", "child", "/tʃaɪld/", "（复数 children /ˈtʃɪldrən/）儿童；小孩"),
      mk(4, 1, "sentence", "What's your mother's job?", "", "你妈妈做什么工作？"),
      mk(4, 1, "sentence", "She's a doctor.", "", "她是医生。"),
      mk(4, 1, "sentence", "Mum and Dad are busy and tired.", "", "爸爸妈妈又忙又累。"),
      mk(4, 1, "sentence", "What can we do for them?", "", "我们能为他们做些什么？"),
      mk(4, 1, "sentence", "We can do some chores.", "", "我们可以做一些家务活。"),
    ],
  },
  {
    grade: 4,
    unit: 2,
    title: "My friends",
    entries: [
      mk(4, 2, "word", "his", "/hɪz/", "他的"),
      mk(4, 2, "word", "strong", "/strɒŋ/", "强壮的"),
      mk(4, 2, "word", "hair", "/heə(r)/", "头发"),
      mk(4, 2, "word", "kind", "/kaɪnd/", "友好的"),
      mk(4, 2, "word", "quiet", "/ˈkwaɪət/", "安静的"),
      mk(4, 2, "word", "best", "/best/", "最好的"),
      mk(4, 2, "word", "read", "/riːd/", "阅读"),
      mk(4, 2, "word", "Chinese", "/ˌtʃaɪˈniːz/", "中文；中国人；中国的"),
      mk(4, 2, "word", "play", "/pleɪ/", "玩耍"),
      mk(4, 2, "word", "game", "/ɡeɪm/", "游戏"),
      mk(4, 2, "word", "football", "/ˈfʊtbɔːl/", "足球运动"),
      mk(4, 2, "word", "basketball", "/ˈbɑːskɪtbɔːl/", "篮球运动"),
      mk(4, 2, "word", "always", "/ˈɔːlweɪz/", "总是"),
      mk(4, 2, "sentence", "What's your friend's name?", "", "你的朋友叫什么名字？"),
      mk(4, 2, "sentence", "His name is Zhang Peng.", "", "他叫张鹏。"),
      mk(4, 2, "sentence", "He's tall and strong.", "", "他又高又壮。"),
      mk(4, 2, "sentence", "He's also kind. He often helps me.", "", "他也很友善。他经常帮助我。"),
      mk(4, 2, "sentence", "Who's your best friend?", "", "谁是你最好的朋友？"),
      mk(4, 2, "sentence", "Chen Jie. She's funny. She often makes me smile.", "", "陈杰。她很有趣。她经常让我开心。"),
    ],
  },
  {
    grade: 4,
    unit: 3,
    title: "Places we live in",
    entries: [
      mk(4, 3, "word", "afternoon", "/ˌɑːftəˈnuːn/", "下午"),
      mk(4, 3, "word", "there", "/ðeə(r)/", "（表示存在或发生）；在那里"),
      mk(4, 3, "word", "playground", "/ˈpleɪɡraʊnd/", "游乐场；操场"),
      mk(4, 3, "word", "park", "/pɑːk/", "公园"),
      mk(4, 3, "word", "over", "/ˈəʊvə(r)/", "在……的远端（或对面）"),
      mk(4, 3, "word", "hospital", "/ˈhɒspɪtl/", "医院"),
      mk(4, 3, "word", "shop", "/ʃɒp/", "商店"),
      mk(4, 3, "word", "toilet", "/ˈtɔɪlət/", "厕所；卫生间"),
      mk(4, 3, "phrase", "bus stop", "/ˈbʌs stɒp/", "公共汽车站"),
      mk(4, 3, "word", "library", "/ˈlaɪbrəri/", "图书馆"),
      mk(4, 3, "word", "sport", "/spɔːt/", "体育运动"),
      mk(4, 3, "word", "walk", "/wɔːk/", "散步；行走"),
      mk(4, 3, "word", "community", "/kəˈmjuːnəti/", "社区"),
      mk(4, 3, "word", "favourite", "/ˈfeɪvərɪt/", "最喜欢的"),
      mk(4, 3, "word", "place", "/pleɪs/", "地方；场所"),
      mk(4, 3, "word", "photo", "/ˈfəʊtəʊ/", "照片"),
      mk(4, 3, "word", "story", "/ˈstɔːri/", "故事"),
      mk(4, 3, "word", "buy", "/baɪ/", "购买"),
      mk(4, 3, "sentence", "There is a playground. We often play there.", "", "那里有个游乐场。我们经常在那里玩儿。"),
      mk(4, 3, "sentence", "There is a taijiquan club.", "", "这里有一个太极拳俱乐部。"),
      mk(4, 3, "sentence", "There are many people.", "", "这里有好多人。"),
      mk(4, 3, "sentence", "There is a gym too.", "", "这里还有一个体育馆。"),
      mk(4, 3, "sentence", "Great! Let's do some sports.", "", "太棒了！我们一起做运动吧。"),
      mk(4, 3, "sentence", "My favourite place is the museum.", "", "我最喜欢的地方是博物馆。"),
    ],
  },
  {
    grade: 4,
    unit: 4,
    title: "Helping in the community",
    entries: [
      mk(4, 4, "word", "firefighter", "/ˈfaɪəfaɪtə(r)/", "消防队员"),
      mk(4, 4, "word", "why", "/waɪ/", "为什么"),
      mk(4, 4, "word", "driver", "/ˈdraɪvə(r)/", "司机"),
      mk(4, 4, "word", "important", "/ɪmˈpɔːtnt/", "重要的"),
      mk(4, 4, "word", "cleaner", "/ˈkliːnə(r)/", "清洁工"),
      mk(4, 4, "word", "cook", "/kʊk/", "厨师"),
      mk(4, 4, "phrase", "delivery worker", "/dɪˈlɪvəri ˌwɜːkə(r)/", "快递员"),
      mk(4, 4, "phrase", "police officer", "/pəˈliːs ˌɒfɪsə(r)/", "警察；警员"),
      mk(4, 4, "phrase", "a lot of", "/ə lɒt əv/", "大量；许多"),
      mk(4, 4, "word", "now", "/naʊ/", "现在"),
      mk(4, 4, "phrase", "make the bed", "/meɪk ðə bed/", "铺床"),
      mk(4, 4, "word", "old", "/əʊld/", "过去的；年纪大的；老的"),
      mk(4, 4, "word", "tell", "/tel/", "讲述；告诉"),
      mk(4, 4, "word", "everyone", "/ˈevriwʌn/", "每人"),
      mk(4, 4, "word", "Ms", "/mɪz/", "（用于女子的姓氏或姓名前，不指明婚否）女士"),
      mk(4, 4, "sentence", "Our neighbour is a firefighter. He often helps people.", "", "我们的邻居是消防员。他经常帮助别人。"),
      mk(4, 4, "sentence", "He's a school bus driver. He takes us to school every day.", "", "他是校车司机。他每天送我们去学校。"),
      mk(4, 4, "sentence", "That's an important job too!", "", "那个工作也很重要！"),
      mk(4, 4, "sentence", "Chen Jie is making the bed.", "", "陈杰正在铺床。"),
      mk(4, 4, "sentence", "In the kindergarten, John and Class One are singing songs together.", "", "在幼儿园，约翰和一班（的小朋友们）在一起唱歌。"),
    ],
  },
  {
    grade: 4,
    unit: 5,
    title: "The weather and us",
    entries: [
      mk(4, 5, "word", "speak", "/spiːk/", "说话；发言"),
      mk(4, 5, "word", "weather", "/ˈweðə(r)/", "天气"),
      mk(4, 5, "word", "sunny", "/ˈsʌni/", "阳光充足的"),
      mk(4, 5, "word", "hot", "/hɒt/", "热的"),
      mk(4, 5, "word", "bad", "/bæd/", "令人不快的；坏的"),
      mk(4, 5, "word", "cold", "/kəʊld/", "冷的"),
      mk(4, 5, "word", "windy", "/ˈwɪndi/", "多风的"),
      mk(4, 5, "word", "cloudy", "/ˈklaʊdi/", "多云的"),
      mk(4, 5, "word", "rainy", "/ˈreɪni/", "阴雨的"),
      mk(4, 5, "word", "snowy", "/ˈsnəʊi/", "多雪的"),
      mk(4, 5, "word", "cool", "/kuːl/", "凉爽的"),
      mk(4, 5, "word", "warm", "/wɔːm/", "温暖的"),
      mk(4, 5, "word", "tomorrow", "/təˈmɒrəʊ/", "在明天"),
      mk(4, 5, "word", "rain", "/reɪn/", "下雨；雨"),
      mk(4, 5, "word", "closed", "/kləʊzd/", "关闭的"),
      mk(4, 5, "word", "film", "/fɪlm/", "电影"),
      mk(4, 5, "word", "idea", "/aɪˈdɪə/", "想法；主意"),
      mk(4, 5, "word", "fly", "/flaɪ/", "操纵（飞行器等）；飞"),
      mk(4, 5, "word", "kite", "/kaɪt/", "风筝"),
      mk(4, 5, "word", "snowman", "/ˈsnəʊmæn/", "雪人"),
      mk(4, 5, "word", "fun", "/fʌn/", "享乐；乐趣"),
      mk(4, 5, "word", "their", "/ðeə(r)/", "他们的；她们的；它们的"),
      mk(4, 5, "word", "swim", "/swɪm/", "游泳"),
      mk(4, 5, "word", "Sydney", "/ˈsɪdni/", "悉尼"),
      mk(4, 5, "sentence", "Hello! Mark speaking.", "", "你好！我是马克。"),
      mk(4, 5, "sentence", "Hi, Mark! This is John. What's the weather like in Sydney?", "", "嗨，马克！我是约翰。悉尼的天气怎么样？"),
      mk(4, 5, "sentence", "Well, it's sunny today.", "", "噢，今天是晴天。"),
      mk(4, 5, "sentence", "It's only two degrees in Beijing.", "", "北京只有两度。"),
      mk(4, 5, "sentence", "It's raining now.", "", "现在下雨了。"),
      mk(4, 5, "sentence", "We can't play basketball in the park.", "", "我们不能在公园打篮球了。"),
      mk(4, 5, "sentence", "It's OK. We can go to the library.", "", "没关系。我们可以去图书馆。"),
      mk(4, 5, "sentence", "It's hot and sunny here.", "", "这里很热，是个大晴天。"),
      mk(4, 5, "sentence", "Their children swim in the pool.", "", "他们的孩子在泳池里游泳。"),
    ],
  },
  {
    grade: 4,
    unit: 6,
    title: "Changing for the seasons",
    entries: [
      mk(4, 6, "word", "whose", "/huːz/", "谁的"),
      mk(4, 6, "word", "sweater", "/ˈswetə(r)/", "毛衣"),
      mk(4, 6, "word", "sock", "/sɒk/", "短袜"),
      mk(4, 6, "word", "mine", "/maɪn/", "我的"),
      mk(4, 6, "word", "wear", "/weə(r)/", "穿；戴"),
      mk(4, 6, "word", "shirt", "/ʃɜːt/", "衬衫"),
      mk(4, 6, "word", "coat", "/kəʊt/", "大衣；外套"),
      mk(4, 6, "word", "dress", "/dres/", "连衣裙"),
      mk(4, 6, "word", "which", "/wɪtʃ/", "哪一个；哪一些"),
      mk(4, 6, "word", "season", "/ˈsiːzn/", "季节"),
      mk(4, 6, "word", "winter", "/ˈwɪntə(r)/", "冬天"),
      mk(4, 6, "word", "snow", "/snəʊ/", "下雪；雪"),
      mk(4, 6, "phrase", "get together", "/ɡet təˈɡeðə(r)/", "聚会"),
      mk(4, 6, "word", "spring", "/sprɪŋ/", "春天"),
      mk(4, 6, "word", "summer", "/ˈsʌmə(r)/", "夏天"),
      mk(4, 6, "word", "autumn", "/ˈɔːtəm/", "秋天"),
      mk(4, 6, "word", "T-shirt", "/ˈtiːʃɜːt/", "T恤衫"),
      mk(4, 6, "word", "fall", "/fɔːl/", "落下"),
      mk(4, 6, "word", "leaf", "/liːf/", "（复数 leaves /liːvz/）叶"),
      mk(4, 6, "word", "glove", "/ɡlʌv/", "手套"),
      mk(4, 6, "word", "then", "/ðen/", "然后；那时"),
      mk(4, 6, "sentence", "Whose sweater is this, Mum?", "", "这是谁的毛衣，妈妈？"),
      mk(4, 6, "sentence", "It's your dad's.", "", "是你爸爸的。"),
      mk(4, 6, "sentence", "Can I wear this new shirt today?", "", "我今天可以穿这件新衬衫吗？"),
      mk(4, 6, "sentence", "Yes, but wear a coat too. It's cold and windy outside.", "", "可以，但是再穿一件外套吧。外面有风，很冷。"),
      mk(4, 6, "sentence", "Which season do you like?", "", "你喜欢哪个季节？"),
      mk(4, 6, "sentence", "Winter. It snows a lot.", "", "冬天。冬天经常下雪。"),
      mk(4, 6, "sentence", "I like winter too. There are many festivals.", "", "我也喜欢冬天。（在冬天）有很多节日。"),
      mk(4, 6, "sentence", "It's full of life.", "", "（春天）充满生机。"),
      mk(4, 6, "sentence", "And enjoy mooncakes.", "", "还品尝月饼。"),
      mk(4, 6, "sentence", "Then spring comes again.", "", "接着春天又来了。"),
    ],
  },`;

const startIdx = src.indexOf("  // ==================== 四年级上（PEP 四上 2024 秋新版） ====================");
const endIdx = src.indexOf("  // ==================== 四年级下", startIdx + 1);

if (startIdx < 0) {
  console.error("未找到开始标记（注释行）");
  process.exit(2);
}
if (endIdx < 0) {
  console.error("未找到结束标记（四年级下注释）");
  process.exit(2);
}

const before = src.slice(0, startIdx);
const after = src.slice(endIdx);
const updated = before + newBlock + "\n" + after;

writeFileSync(path, updated, "utf8");
console.log(`✅ 已替换 G4U1-6（${endIdx - startIdx} → ${newBlock.length} 字节）`);
console.log(`   起始字符偏移: ${startIdx}`);
console.log(`   结束字符偏移: ${endIdx}`);
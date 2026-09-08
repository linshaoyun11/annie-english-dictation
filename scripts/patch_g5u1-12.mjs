/**
 * 一次性 patch G5U1-12（PEP 五上 2024 秋新版）
 * 用法：node scripts/patch_g5u1-12.mjs
 *
 * 旧版 G5U1-12 是 PEP 2012 旧版（What's he like?/My week?/What's your favourite food?/
 * What can you do?/My new teachers/There is a big bed/In a nature park/…/Work quietly）；
 * 新版是 U1-6 = Different friends / My feelings / Work and play / Healthy habits /
 *                 Food we eat / Nature and us。新版只有 6 Unit + Useful expressions。
 * 没有独立 Numbers section。
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/data/grades4to9.ts";
let s = readFileSync(FILE, "utf8");

// ===== 新版 G5U1-12 =====
const NEW_BLOCK = `  // ==================== 五年级上（PEP 五上 2024 秋新版） ====================
  {
    grade: 5,
    unit: 1,
    title: "Different friends 不同的朋友",
    entries: [
      mk(5, 1, "word", "team", "/tiːm/", "（游戏或运动的）队；（一起工作的）组，班"),
      mk(5, 1, "word", "player", "/ˈpleɪə(r)/", "运动员；参赛选手"),
      mk(5, 1, "word", "him", "/hɪm/", "他"),
      mk(5, 1, "word", "lovely", "/ˈlʌvli/", "美丽的；优美的"),
      mk(5, 1, "word", "clever", "/ˈklevə(r)/", "聪明的；聪颖的"),
      mk(5, 1, "word", "young", "/jʌŋ/", "幼小的；年轻的"),
      mk(5, 1, "word", "hard-working", "/ˌhɑːd ˈwɜːkɪŋ/", "工作努力的；辛勤的"),
      mk(5, 1, "word", "science", "/ˈsaɪəns/", "科学；自然科学"),
      mk(5, 1, "word", "robot", "/ˈrəʊbɒt/", "机器人"),
      mk(5, 1, "word", "jump", "/dʒʌmp/", "跳；跃"),
      mk(5, 1, "word", "rope", "/rəʊp/", "绳；粗绳"),
      mk(5, 1, "word", "piano", "/pɪˈænəʊ/", "钢琴"),
      mk(5, 1, "word", "chess", "/tʃes/", "国际象棋"),
      mk(5, 1, "word", "front", "/frʌnt/", "前部"),
      mk(5, 1, "word", "easy", "/ˈiːzi/", "容易的；轻易的"),
      mk(5, 1, "word", "star", "/stɑː(r)/", "歌唱（或表演）明星"),
      mk(5, 1, "word", "wonderful", "/ˈwʌndəfl/", "令人赞叹的；精彩的；绝妙的"),
      mk(5, 1, "word", "Australia", "/ɒˈstreɪliə/", "澳大利亚"),
      // Useful expressions U1（11 句）
      mk(5, 1, "sentence", "What's he like?", "", "他什么样？"),
      mk(5, 1, "sentence", "He's tall and strong.", "", "他又高又壮。"),
      mk(5, 1, "sentence", "Is he good at football?", "", "他擅长踢足球吗？"),
      mk(5, 1, "sentence", "Yes, I think he is.", "", "是的，我想他擅长。"),
      mk(5, 1, "sentence", "What can you do for the festival?", "", "你能为科学艺术节做什么？"),
      mk(5, 1, "sentence", "I can make a robot.", "", "我能制作机器人。"),
      mk(5, 1, "sentence", "Can you make robots, Sarah?", "", "萨拉，你能制作机器人吗？"),
      mk(5, 1, "sentence", "No, I can't.", "", "不，我不能。"),
      mk(5, 1, "sentence", "Why not do both?", "", "为什么两个活动都做呢？"),
      mk(5, 1, "sentence", "It's important to listen to each other.", "", "听取彼此的想法很重要。"),
      mk(5, 1, "sentence", "Yes, Miss White. I need to talk to Mike.", "", "是的，怀特老师。我需要和迈克谈谈。"),
    ],
  },
  {
    grade: 5,
    unit: 2,
    title: "My feelings 我的感受",
    entries: [
      mk(5, 2, "word", "sad", "/sæd/", "悲哀的；难过的"),
      mk(5, 2, "word", "matter", "/ˈmætə(r)/", "事情；问题"),
      mk(5, 2, "word", "project", "/ˈprɒdʒekt/", "项目；方案"),
      mk(5, 2, "word", "centre", "/ˈsentə(r)/", "中心"),
      mk(5, 2, "word", "agree", "/əˈɡriː/", "同意；赞成"),
      mk(5, 2, "word", "finish", "/ˈfɪnɪʃ/", "完成；做好"),
      mk(5, 2, "word", "worried", "/ˈwʌrid/", "担心的；担忧的"),
      mk(5, 2, "word", "both", "/bəʊθ/", "两者"),
      mk(5, 2, "word", "excited", "/ɪkˈsaɪtɪd/", "激动的；兴奋的"),
      mk(5, 2, "word", "wrong", "/rɒŋ/", "错误的"),
      mk(5, 2, "word", "angry", "/ˈæŋɡri/", "愤怒的；生气的"),
      mk(5, 2, "word", "afraid", "/əˈfreɪd/", "担心；害怕"),
      mk(5, 2, "word", "parent", "/ˈpeərənt/", "父亲；母亲"),
      mk(5, 2, "word", "ask", "/ɑːsk/", "问；询问"),
      mk(5, 2, "word", "laugh", "/lɑːf/", "笑"),
      mk(5, 2, "word", "move", "/muːv/", "搬家；移动"),
      mk(5, 2, "word", "yours", "/jɔːz/", "您的（用于书信结尾的签名前）"),
      // Useful expressions U2（4 句）
      mk(5, 2, "sentence", "Hi, Mike. You look sad. What's the matter?", "", "嗨，迈克。你看起来不开心。怎么回事？"),
      mk(5, 2, "sentence", "It's about our school project.", "", "关于我们学校的项目。"),
      mk(5, 2, "sentence", "And we have to finish our project by Monday.", "", "并且我们得在星期一之前完成项目。"),
      mk(5, 2, "sentence", "So you don't agree with each other?", "", "所以你俩意见不一致？"),
    ],
  },
  {
    grade: 5,
    unit: 3,
    title: "Work and play 工作与玩耍",
    entries: [
      mk(5, 3, "word", "Wednesday", "/ˈwenzdeɪ/", "星期三"),
      mk(5, 3, "word", "subject", "/ˈsʌbdʒɪkt/", "科目；学科"),
      mk(5, 3, "word", "Tuesday", "/ˈtjuːzdeɪ/", "星期二"),
      mk(5, 3, "word", "Friday", "/ˈfraɪdeɪ/", "星期五"),
      mk(5, 3, "word", "because", "/bɪˈkɒz/", "因为"),
      mk(5, 3, "word", "Monday", "/ˈmʌndeɪ/", "星期一"),
      mk(5, 3, "word", "Thursday", "/ˈθɜːzdeɪ/", "星期四"),
      mk(5, 3, "word", "start", "/stɑːt/", "开始"),
      mk(5, 3, "word", "usually", "/ˈjuːʒuəli/", "通常地；经常地"),
      mk(5, 3, "word", "weekend", "/ˌwiːkˈend/", "周末"),
      mk(5, 3, "word", "sometimes", "/ˈsʌmtaɪmz/", "有时；间或"),
      mk(5, 3, "word", "Saturday", "/ˈsætədeɪ/", "星期六"),
      mk(5, 3, "word", "Sunday", "/ˈsʌndeɪ/", "星期日"),
      mk(5, 3, "word", "lesson", "/ˈlesn/", "课；一节课"),
      mk(5, 3, "word", "evening", "/ˈiːvnɪŋ/", "晚上；傍晚"),
      mk(5, 3, "word", "answer", "/ˈɑːnsə(r)/", "答复；回答"),
      mk(5, 3, "word", "ping-pong", "/ˈpɪŋ pɒŋ/", "乒乓球"),
      mk(5, 3, "word", "night", "/naɪt/", "夜；夜晚"),
      mk(5, 3, "word", "visit", "/ˈvɪzɪt/", "看望；拜访；参观"),
      mk(5, 3, "word", "grandparent", "/ˈɡrænpeərənt/", "祖父；祖母；外祖父；外祖母"),
      // Useful expressions U3（7 句）
      mk(5, 3, "sentence", "What's your favourite day at school, John?", "", "你在学校最喜欢哪一天，约翰？"),
      mk(5, 3, "sentence", "What do you have on Wednesdays?", "", "星期三你有什么课？"),
      mk(5, 3, "sentence", "I have Chinese, maths, music and PE.", "", "我有语文课、数学课、音乐课和体育课。"),
      mk(5, 3, "sentence", "What do you usually do at the weekend, children?", "", "孩子们，周末你们通常做什么？"),
      mk(5, 3, "sentence", "I often play football. Sometimes I play Chinese chess with my father.", "", "我经常踢足球。有时我和爸爸下象棋。"),
      mk(5, 3, "sentence", "Does your mother work on both Saturdays and Sundays?", "", "你妈妈周六周日都工作吗？"),
      mk(5, 3, "sentence", "Yes, she does.", "", "是的，她（周末两天）都工作。"),
    ],
  },
  {
    grade: 5,
    unit: 4,
    title: "Healthy habits 健康的习惯",
    entries: [
      mk(5, 4, "word", "stay", "/steɪ/", "待；保持；继续是"),
      mk(5, 4, "word", "should", "/ʃʊd/", "（提出或征询建议）该；可以"),
      mk(5, 4, "word", "flu", "/fluː/", "流行性感冒；流感"),
      mk(5, 4, "word", "else", "/els/", "其他的；别的"),
      mk(5, 4, "word", "exercise", "/ˈeksəsaɪz/", "锻炼；训练；操练"),
      mk(5, 4, "word", "enough", "/ɪˈnʌf/", "足够的；充分的；充足的"),
      mk(5, 4, "word", "if", "/ɪf/", "如果；假若；倘若"),
      mk(5, 4, "word", "habit", "/ˈhæbɪt/", "习惯"),
      mk(5, 4, "word", "house", "/haʊs/", "房子"),
      mk(5, 4, "word", "show", "/ʃəʊ/", "（电视或广播）节目"),
      mk(5, 4, "word", "phone", "/fəʊn/", "电话；电话机"),
      mk(5, 4, "word", "then", "/ðen/", "那么；因此；既然如此"),
      mk(5, 4, "word", "rest", "/rest/", "休息；放松"),
      mk(5, 4, "word", "check", "/tʃek/", "查看；查明"),
      mk(5, 4, "word", "less", "/les/", "（与不可数名词连用）较少的，更少的"),
      mk(5, 4, "word", "brush", "/brʌʃ/", "（用刷子）刷等，刷亮，刷平顺"),
      mk(5, 4, "word", "tooth", "/tuːθ/", "（复数 teeth /tiːθ/）牙；齿"),
      mk(5, 4, "word", "twice", "/twaɪs/", "两次；两遍"),
      mk(5, 4, "word", "hour", "/ˈaʊə(r)/", "小时"),
      mk(5, 4, "word", "free", "/friː/", "没有安排活动的；空闲的"),
      mk(5, 4, "phrase", "take care of", "/ˌteɪk ˈkeər əv/", "爱护；照顾"),
      // Useful expressions U4（4 句）
      mk(5, 4, "sentence", "How can we all stay healthy?", "", "我们怎样才能保持健康？"),
      mk(5, 4, "sentence", "We should eat healthy food.", "", "我们应该吃健康的食物。"),
      mk(5, 4, "sentence", "Can I play on Mum's phone?", "", "我可以玩玩妈妈的手机吗？"),
      mk(5, 4, "sentence", "No. You shouldn't play on a phone so often.", "", "不行。你不应总是玩手机。"),
    ],
  },
  {
    grade: 5,
    unit: 5,
    title: "Food we eat 我们吃的食物",
    entries: [
      mk(5, 5, "word", "hungry", "/ˈhʌŋɡri/", "感到饿的"),
      mk(5, 5, "word", "beef", "/biːf/", "牛肉"),
      mk(5, 5, "word", "ice cream", "/ˌaɪs ˈkriːm/", "（一份）冰激凌"),
      mk(5, 5, "word", "little", "/ˈlɪtl/", "少许；一点"),
      mk(5, 5, "word", "dumpling", "/ˈdʌmplɪn/", "饺子；汤圆"),
      mk(5, 5, "word", "tea", "/tiː/", "茶叶；茶；茶水"),
      mk(5, 5, "word", "hamburger", "/ˈhæmbɜːɡə(r)/", "汉堡包；汉堡牛肉饼"),
      mk(5, 5, "word", "Mrs", "/ˈmɪsɪz/", "（用于女子的姓氏或姓名前）太太，夫人"),
      mk(5, 5, "word", "coconut", "/ˈkəʊkənʌt/", "椰子"),
      mk(5, 5, "word", "interesting", "/ˈɪntrəstɪŋ/", "有趣的；有吸引力的"),
      mk(5, 5, "word", "seed", "/siːd/", "种子；籽"),
      mk(5, 5, "word", "pull", "/pʊl/", "拔出；抽出"),
      mk(5, 5, "word", "stem", "/stem/", "（花草的）茎；（花或叶的）梗，柄"),
      mk(5, 5, "word", "root", "/ruːt/", "根；根茎"),
      mk(5, 5, "word", "lotus", "/ˈləʊtəs/", "莲属植物"),
      mk(5, 5, "word", "lake", "/leɪk/", "湖；湖泊"),
      mk(5, 5, "word", "world", "/wɜːld/", "世界；地球；天下"),
      mk(5, 5, "word", "round", "/raʊnd/", "圆形的；环形的；球形的"),
      mk(5, 5, "word", "different", "/ˈdɪfrənt/", "不同的；有区别的；有差异的"),
      mk(5, 5, "word", "way", "/weɪ/", "方法；手段；途径；方式"),
      // Useful expressions U5（6 句）
      mk(5, 5, "sentence", "What would you like to eat?", "", "你想吃些什么？"),
      mk(5, 5, "sentence", "I'd like beef and rice.", "", "我想吃牛肉和米饭。"),
      mk(5, 5, "sentence", "Would you like some chicken soup too?", "", "你还想喝鸡汤吗？"),
      mk(5, 5, "sentence", "Yes, please.", "", "是的，请（给我鸡汤）。"),
      mk(5, 5, "sentence", "Where does your coconut come from?", "", "你的椰子是那里的？"),
      mk(5, 5, "sentence", "Hainan!", "", "海南！"),
    ],
  },
  {
    grade: 5,
    unit: 6,
    title: "Nature and us 自然与我们",
    entries: [
      mk(5, 6, "word", "river", "/ˈrɪvə(r)/", "河；江"),
      mk(5, 6, "word", "nature", "/ˈneɪtʃə(r)/", "自然景；大自然"),
      mk(5, 6, "word", "waterfall", "/ˈwɔːtəfɔːl/", "瀑布"),
      mk(5, 6, "word", "forest", "/ˈfɒrɪst/", "森林；林区"),
      mk(5, 6, "word", "famous", "/ˈfeɪməs/", "著名的；出名的"),
      mk(5, 6, "word", "mountain", "/ˈmaʊntɪn/", "高山；山岳"),
      mk(5, 6, "word", "wind", "/wɪnd/", "风；气流"),
      mk(5, 6, "word", "trip", "/trɪp/", "（尤指短程往返的）旅行，旅游，出行"),
      mk(5, 6, "word", "dangerous", "/ˈdeɪndʒərəs/", "有危险的；不安全的"),
      mk(5, 6, "word", "heavy", "/ˈhevi/", "程度大的；严重的"),
      mk(5, 6, "word", "hotel", "/həʊˈtel/", "旅馆；旅社"),
      mk(5, 6, "word", "close", "/kləʊz/", "关；关闭；闭上"),
      mk(5, 6, "word", "umbrella", "/ʌmˈbrelə/", "伞；雨伞"),
      mk(5, 6, "word", "raincoat", "/ˈreɪnkəʊt/", "雨衣"),
      mk(5, 6, "word", "worry", "/ˈwʌri/", "担心；担忧；发愁"),
      mk(5, 6, "word", "fine", "/faɪn/", "晴朗的"),
      mk(5, 6, "word", "fog", "/fɒɡ/", "雾"),
      mk(5, 6, "word", "flood", "/flʌd/", "洪水；水灾"),
      mk(5, 6, "word", "fire", "/ˈfaɪə(r)/", "火；火灾"),
      mk(5, 6, "word", "know", "/nəʊ/", "知道；了解"),
      mk(5, 6, "word", "before", "/bɪˈfɔː(r)/", "在……之前"),
      mk(5, 6, "word", "bring", "/brɪŋ/", "带……到来处；带来；取来"),
      mk(5, 6, "phrase", "go hiking", "/ˌɡəʊ ˈhaɪkɪŋ/", "徒步旅行"),
      // Useful expressions U6（6 句）
      mk(5, 6, "sentence", "There are also many rivers in the nature park.", "", "这个自然公园还有许多河流。"),
      mk(5, 6, "sentence", "Is there a waterfall in the forest?", "", "森林里有瀑布吗？"),
      mk(5, 6, "sentence", "Yes, there is.", "", "是的，这里有。"),
      mk(5, 6, "sentence", "Are there any famous mountains in the nature park?", "", "自然公园有山吗？"),
      mk(5, 6, "sentence", "Yes, there are.", "", "是的，这里有。"),
      mk(5, 6, "sentence", "There will be heavy rain in the afternoon too.", "", "今天下午还将有大雨。"),
    ],
  },
`;

// 旧块定位：G5 起点
const OLD_START = "  // ==================== 五年级上（PEP 五上） ====================";
const OLD_END_MARK = 'mk(5, 12, "sentence", "The children are reading quietly.", "", "孩子们在安静地读书。"),';
const idxStart = s.indexOf(OLD_START);
if (idxStart === -1) {
  console.error("[ERR] G5 注释起点未找到");
  process.exit(2);
}
const idxEndMarker = s.indexOf(OLD_END_MARK, idxStart);
if (idxEndMarker === -1) {
  console.error("[ERR] G5U12 结束标记未找到");
  process.exit(2);
}
const afterOldEnd = idxEndMarker + OLD_END_MARK.length;
const closeUnit = s.indexOf("\n  },", afterOldEnd);
if (closeUnit === -1) {
  console.error("[ERR] G5U12 收尾 '},' 未找到");
  process.exit(2);
}
const cutEnd = closeUnit + "\n  },".length;

const before = s.slice(0, idxStart);
const after = s.slice(cutEnd);
const next = before + NEW_BLOCK + after;
writeFileSync(FILE, next, "utf8");
console.log(`[OK] G5U1-6 已替换（${NEW_BLOCK.length} chars），旧段被新版覆盖`);
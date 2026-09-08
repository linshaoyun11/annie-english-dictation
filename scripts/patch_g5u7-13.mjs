// PEP 五下（旧版 2024 秋 = 学生当前用书）G5U7-12 重写 + 新增 G5U13 Proverbs
//
// 数据来源：用户 2026-09-04 拍 PEP 五下 10 张截图（目录 + Words in each unit p72-74
//   + Vocabulary p75-78 + Useful expressions p79-80 + Appendix 5 Proverbs p80）
//
// 替换范围：src/data/grades4to9.ts 行 649-752（注释起点 → G5U12 闭合 `},`）
// OLD_START_MARK：// ⚠️ 五下新版要 2027 春才启用
// OLD_END_MARK：G5U12 最后一行 sentence（The children are reading quietly.）

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, "..", "src", "data", "grades4to9.ts");

const OLD_START_MARK = "// ==================== 五年级下（PEP 五下） ====================";
const OLD_END_MARK = "// ==================== 六年级上（PEP 六上） ====================";

const NEW_BLOCK = `// ⚠️ 五下新版要 2027 春才启用（五年级从 2026 秋五上开始换新教材），
  //   国家平台现在挂的仍是本旧版。等 2027 春新版出来后再替换。
  //   2026-09-04 用户按官方教材逐词录入（每 Unit 20+ 词条，比此前精简版更完整）。
  {
    grade: 5,
    unit: 7,
    title: "My day 我的一天",
    entries: [
      mk(5, 7, "phrase", "eat breakfast", "/iːt ˈbrekfəst/", "吃早饭"),
      mk(5, 7, "phrase", "have ... class", "", "上......课"),
      mk(5, 7, "phrase", "play sports", "/pleɪ spɔːts/", "进行体育运动"),
      mk(5, 7, "word", "exercise", "/ˈeksəsaɪz/", "活动；运动"),
      mk(5, 7, "phrase", "do morning exercises", "", "做早操"),
      mk(5, 7, "phrase", "eat dinner", "", "吃晚饭"),
      mk(5, 7, "phrase", "clean my room", "/kliːn maɪ ruːm/", "打扫我的房间"),
      mk(5, 7, "phrase", "go for a walk", "", "散步"),
      mk(5, 7, "phrase", "go shopping", "", "去买东西；购物"),
      mk(5, 7, "word", "take", "/teɪk/", "学习；上（课）"),
      mk(5, 7, "word", "dancing", "/ˈdɑːnsɪŋ/", "跳舞；舞蹈"),
      mk(5, 7, "phrase", "take a dancing class", "", "上舞蹈课"),
      mk(5, 7, "word", "when", "/wen/", "什么时候；何时"),
      mk(5, 7, "word", "after", "/ˈɑːftə(r)/", "在（时间）后"),
      mk(5, 7, "word", "start", "/stɑːt/", "开始"),
      mk(5, 7, "word", "usually", "/ˈjuːʒuəli/", "通常地；惯常地"),
      mk(5, 7, "word", "Spain", "/speɪn/", "西班牙"),
      mk(5, 7, "word", "late", "/leɪt/", "晚；迟"),
      mk(5, 7, "word", "a.m.", "/ˌeɪ ˈem/", "午前；上午"),
      mk(5, 7, "word", "p.m.", "/ˌpiː ˈem/", "午后；下午"),
      mk(5, 7, "word", "why", "/waɪ/", "为什么"),
      mk(5, 7, "word", "shop", "/ʃɒp/", "去买东西；购物"),
      mk(5, 7, "word", "work", "/wɜːk/", "工作"),
      mk(5, 7, "word", "last", "/lɑːst/", "上一个的；刚过去的"),
      mk(5, 7, "word", "sound", "/saʊnd/", "听起来好像"),
      mk(5, 7, "word", "also", "/ˈɔːlsəʊ/", "还；也"),
      mk(5, 7, "word", "busy", "/ˈbɪzi/", "忙的"),
      mk(5, 7, "word", "need", "/niːd/", "需要"),
      mk(5, 7, "word", "play", "/pleɪ/", "戏剧；剧本"),
      mk(5, 7, "word", "letter", "/ˈletə(r)/", "信"),
      mk(5, 7, "word", "live", "/lɪv/", "居住"),
      mk(5, 7, "word", "island", "/ˈaɪlənd/", "岛"),
      mk(5, 7, "word", "always", "/ˈɔːlweɪz/", "总是；一直"),
      mk(5, 7, "word", "cave", "/keɪv/", "山洞；洞穴"),
      mk(5, 7, "phrase", "go swimming", "", "去游泳"),
      mk(5, 7, "word", "win", "/wɪn/", "获胜"),
      mk(5, 7, "sentence", "When do you finish class in the morning?", "", "你们上午的课到几点结束？"),
      mk(5, 7, "sentence", "We finish class at 1 o'clock.", "", "我们一点钟结束上午的课。"),
      mk(5, 7, "sentence", "What do you do on the weekend?", "", "你周末做什么？"),
      mk(5, 7, "sentence", "I often watch TV and play ping-pong with my father.", "", "我经常看电视，也常和我爸爸一起打乒乓球。"),
    ],
  },
  {
    grade: 5,
    unit: 8,
    title: "My favourite season 我最喜欢的季节",
    entries: [
      mk(5, 8, "word", "spring", "/sprɪŋ/", "春天"),
      mk(5, 8, "word", "summer", "/ˈsʌmə(r)/", "夏天"),
      mk(5, 8, "word", "autumn", "/ˈɔːtəm/", "秋天"),
      mk(5, 8, "word", "winter", "/ˈwɪntə(r)/", "冬天"),
      mk(5, 8, "word", "season", "/ˈsiːzn/", "季节"),
      mk(5, 8, "word", "picnic", "/ˈpɪknɪk/", "野餐"),
      mk(5, 8, "word", "pick", "/pɪk/", "摘；采集"),
      mk(5, 8, "phrase", "pick apples", "", "摘苹果"),
      mk(5, 8, "word", "snowman", "/ˈsnəʊmən/", "雪人"),
      mk(5, 8, "phrase", "make a snowman", "", "堆雪人"),
      mk(5, 8, "phrase", "go swimming", "", "去游泳"),
      mk(5, 8, "phrase", "go on a picnic", "", "去野餐"),
      mk(5, 8, "word", "which", "/wɪtʃ/", "哪一个"),
      mk(5, 8, "word", "best", "/best/", "最；最高程度地"),
      mk(5, 8, "word", "snow", "/snəʊ/", "雪"),
      mk(5, 8, "phrase", "good job", "", "做得好"),
      mk(5, 8, "word", "because", "/bɪˈkɒz/", "因为"),
      mk(5, 8, "word", "vacation", "/vəˈkeɪʃn/", "假期"),
      mk(5, 8, "word", "all", "/ɔːl/", "全；完全"),
      mk(5, 8, "word", "pink", "/pɪŋk/", "粉色；粉色的"),
      mk(5, 8, "word", "lovely", "/ˈlʌvli/", "可爱的；美丽的"),
      mk(5, 8, "word", "leaf", "/liːf/", "叶子"),
      mk(5, 8, "word", "fall", "/fɔːl/", "落下；【美】秋天"),
      mk(5, 8, "word", "paint", "/peɪnt/", "用颜料绘画"),
      mk(5, 8, "sentence", "Which season do you like best, Miss White?", "", "怀特小姐，你最喜欢哪个季节？"),
      mk(5, 8, "sentence", "Summer.", "", "夏天。"),
      mk(5, 8, "sentence", "Why?", "", "为什么？"),
      mk(5, 8, "sentence", "Because I like summer vacation!", "", "因为我喜欢暑假！"),
    ],
  },
  {
    grade: 5,
    unit: 9,
    title: "My school calendar 学校日历",
    entries: [
      mk(5, 9, "word", "January", "/ˈdʒænjuəri/", "一月"),
      mk(5, 9, "word", "February", "/ˈfebruəri/", "二月"),
      mk(5, 9, "word", "March", "/mɑːtʃ/", "三月"),
      mk(5, 9, "word", "April", "/ˈeɪprəl/", "四月"),
      mk(5, 9, "word", "May", "/meɪ/", "五月"),
      mk(5, 9, "word", "June", "/dʒuːn/", "六月"),
      mk(5, 9, "word", "July", "/dʒuˈlaɪ/", "七月"),
      mk(5, 9, "word", "August", "/ˈɔːɡəst/", "八月"),
      mk(5, 9, "word", "September", "/sepˈtembə(r)/", "九月"),
      mk(5, 9, "word", "October", "/ɒkˈtəʊbə(r)/", "十月"),
      mk(5, 9, "word", "November", "/nəʊˈvembə(r)/", "十一月"),
      mk(5, 9, "word", "December", "/dɪˈsembə(r)/", "十二月"),
      mk(5, 9, "word", "few", "/fjuː/", "不多；很少"),
      mk(5, 9, "phrase", "a few", "", "一些"),
      mk(5, 9, "word", "thing", "/θɪŋ/", "事情"),
      mk(5, 9, "word", "meet", "/miːt/", "集会；开会"),
      mk(5, 9, "phrase", "sports meet", "", "运动会"),
      mk(5, 9, "word", "trip", "/trɪp/", "旅行"),
      mk(5, 9, "word", "year", "/jɪə(r)/", "年"),
      mk(5, 9, "word", "plant", "/plɑːnt/", "种植"),
      mk(5, 9, "word", "contest", "/ˈkɒntest/", "比赛；竞赛"),
      mk(5, 9, "word", "labour", "/ˈleɪbə(r)/", "劳动"),
      mk(5, 9, "phrase", "Labour Day", "", "劳动节"),
      mk(5, 9, "phrase", "the Great Wall", "", "长城"),
      mk(5, 9, "word", "national", "/ˈnæʃnəl/", "国家的"),
      mk(5, 9, "phrase", "National Day", "", "国庆节"),
      mk(5, 9, "word", "American", "/əˈmerɪkən/", "美国的"),
      mk(5, 9, "word", "Thanksgiving", "/ˈθæŋksˈɡɪvɪŋ/", "感恩节"),
      mk(5, 9, "word", "Christmas", "/ˈkrɪsməs/", "圣诞节"),
      mk(5, 9, "word", "game", "/ɡeɪm/", "游戏"),
      mk(5, 9, "word", "riddle", "/ˈrɪdl/", "谜；谜语"),
      mk(5, 9, "word", "act", "/ækt/", "扮演"),
      mk(5, 9, "phrase", "act out", "", "把......表演出来"),
      mk(5, 9, "phrase", "RSVP", "", "（尤用于请柬）请赐复"),
      mk(5, 9, "word", "by", "/baɪ/", "在......之前"),
      mk(5, 9, "sentence", "When is the party?", "", "聚会什么时候举行？"),
      mk(5, 9, "sentence", "It's in April.", "", "在 4 月。"),
      mk(5, 9, "sentence", "When is the trip this year?", "", "今年的（秋）游在什么时候？"),
      mk(5, 9, "sentence", "It's in October. We'll go to the Great Wall.", "", "在 10 月。我们将去长城。"),
    ],
  },
  {
    grade: 5,
    unit: 10,
    title: "When is the art show? 艺术节是哪天",
    entries: [
      mk(5, 10, "word", "first", "/fɜːst/", "第一（的）"),
      mk(5, 10, "word", "second", "/ˈsekənd/", "第二（的）"),
      mk(5, 10, "word", "third", "/θɜːd/", "第三（的）"),
      mk(5, 10, "word", "fourth", "/fɔːθ/", "第四（的）"),
      mk(5, 10, "word", "fifth", "/fɪfθ/", "第五（的）"),
      mk(5, 10, "word", "twelfth", "/twelfθ/", "第十二（的）"),
      mk(5, 10, "word", "twentieth", "/ˈtwentiəθ/", "第二十（的）"),
      mk(5, 10, "word", "twenty-first", "/ˌtwentiˈfɜːst/", "第二十一（的）"),
      mk(5, 10, "word", "twenty-third", "/ˌtwentiˈθɜːd/", "第二十三（的）"),
      mk(5, 10, "word", "thirtieth", "/ˈθɜːtiəθ/", "第三十（的）"),
      mk(5, 10, "word", "other", "/ˈʌðə(r)/", "其他"),
      mk(5, 10, "word", "special", "/ˈspeʃl/", "特殊的；特别的"),
      mk(5, 10, "word", "show", "/ʃəʊ/", "展览"),
      mk(5, 10, "word", "festival", "/ˈfestɪvl/", "节日"),
      mk(5, 10, "word", "kitten", "/ˈkɪtn/", "小猫"),
      mk(5, 10, "word", "diary", "/ˈdaɪəri/", "日记"),
      mk(5, 10, "word", "still", "/stɪl/", "仍然；依旧；还是"),
      mk(5, 10, "word", "noise", "/nɔɪz/", "声音；响声；噪音"),
      mk(5, 10, "word", "fur", "/fɜː(r)/", "（某些动物的）浓密的软毛"),
      mk(5, 10, "word", "open", "/ˈəʊpən/", "开着的"),
      mk(5, 10, "word", "walk", "/wɔːk/", "行走"),
      mk(5, 10, "sentence", "When is the art show?", "", "艺术节是哪天？"),
      mk(5, 10, "sentence", "It's on May 1st.", "", "它在 5 月 1 日。"),
      mk(5, 10, "sentence", "When is your birthday?", "", "你的生日是哪天？"),
      mk(5, 10, "sentence", "My birthday is on April 4th.", "", "我的生日是 4 月 4 日。"),
    ],
  },
  {
    grade: 5,
    unit: 11,
    title: "Whose dog is it? 这是谁的狗",
    entries: [
      mk(5, 11, "word", "mine", "/maɪn/", "我的"),
      mk(5, 11, "word", "yours", "/jɔːz/", "你（们）的"),
      mk(5, 11, "word", "his", "/hɪz/", "他的"),
      mk(5, 11, "word", "hers", "/hɜːz/", "她的"),
      mk(5, 11, "word", "theirs", "/ðeəz/", "他们的；她们的；它们的"),
      mk(5, 11, "word", "ours", "/ɑːz; ˈaʊəz/", "我们的"),
      mk(5, 11, "word", "climbing", "/ˈklaɪmɪŋ/", "（正在）攀登；攀爬"),
      mk(5, 11, "word", "eating", "/ˈiːtɪŋ/", "（正在）吃"),
      mk(5, 11, "word", "playing", "/ˈpleɪɪŋ/", "（正在）玩耍"),
      mk(5, 11, "word", "jumping", "/ˈdʒʌmpɪŋ/", "（正在）跳"),
      mk(5, 11, "word", "drinking", "/ˈdrɪŋkɪŋ/", "（正在）喝（水）"),
      mk(5, 11, "word", "sleeping", "/ˈsliːpɪŋ/", "（正在）睡觉"),
      mk(5, 11, "word", "each", "/iːtʃ/", "每一；各个"),
      mk(5, 11, "phrase", "each other", "", "相互"),
      mk(5, 11, "word", "excited", "/ɪkˈsaɪtɪd/", "兴奋的；激动的"),
      mk(5, 11, "word", "like", "/laɪk/", "像......那样"),
      mk(5, 11, "sentence", "The yellow picture is mine.", "", "那幅黄颜色的画是我的。"),
      mk(5, 11, "sentence", "Are these all ours?", "", "这些都是我们的画吗？"),
      mk(5, 11, "sentence", "Whose is it?", "", "这是谁的？"),
      mk(5, 11, "sentence", "It's Zhang Peng's.", "", "是张鹏的。"),
      mk(5, 11, "sentence", "Is he drinking water?", "", "他在喝水吗？"),
      mk(5, 11, "sentence", "No, he isn't. He's eating.", "", "不是。他在吃东西。"),
    ],
  },
  {
    grade: 5,
    unit: 12,
    title: "Work quietly! 安静地工作",
    entries: [
      mk(5, 12, "phrase", "doing morning exercises", "", "（正在）做早操"),
      mk(5, 12, "phrase", "having ... class", "", "（正在）上......课"),
      mk(5, 12, "phrase", "eating lunch", "/ˈiːtɪŋ lʌntʃ/", "（正在）吃午饭"),
      mk(5, 12, "phrase", "reading a book", "/ˈriːdɪŋ ə bʊk/", "（正在）看书"),
      mk(5, 12, "phrase", "listening to music", "/ˈlɪsnɪŋ tuː ˈmjuːzɪk/", "（正在）听音乐"),
      mk(5, 12, "word", "keep", "/kiːp/", "保持某种状态"),
      mk(5, 12, "phrase", "keep to the right", "", "靠右"),
      mk(5, 12, "phrase", "keep your desk clean", "", "保持你的课桌干净"),
      mk(5, 12, "phrase", "talk quietly", "", "小声说话"),
      mk(5, 12, "word", "turn", "/tɜːn/", "顺序"),
      mk(5, 12, "phrase", "take turns", "", "按顺序来"),
      mk(5, 12, "word", "bamboo", "/bæmˈbuː/", "竹子"),
      mk(5, 12, "word", "its", "/ɪts/", "它的；他的；她的"),
      mk(5, 12, "word", "show", "/ʃəʊ/", "给人看"),
      mk(5, 12, "word", "anything", "/ˈeniθɪŋ/", "任何事物"),
      mk(5, 12, "word", "else", "/els/", "另外；其他"),
      mk(5, 12, "word", "exhibition", "/ˌeksɪˈbɪʃn/", "展览"),
      mk(5, 12, "word", "say", "/seɪ/", "说；讲"),
      mk(5, 12, "phrase", "have a look", "", "看一看"),
      mk(5, 12, "word", "sushi", "/ˈsuːʃi/", "寿司"),
      mk(5, 12, "word", "teach", "/tiːtʃ/", "教"),
      mk(5, 12, "word", "sure", "/ʃʊə(r)/", "（表示同意）当然"),
      mk(5, 12, "word", "Canadian", "/kəˈneɪdiən/", "加拿大的"),
      mk(5, 12, "word", "Spanish", "/ˈspænɪʃ/", "西班牙的"),
      mk(5, 12, "sentence", "What are they doing?", "", "它们在干什么？"),
      mk(5, 12, "sentence", "They're eating lunch!", "", "它们在吃午饭！"),
      mk(5, 12, "sentence", "What's the little monkey doing?", "", "那只小猴子在干什么？"),
      mk(5, 12, "sentence", "It's playing with its mother!", "", "它在和妈妈玩耍！"),
      mk(5, 12, "sentence", "Shh. Talk quietly.", "", "嘘，小声讲话。"),
      mk(5, 12, "sentence", "Keep your desk clean.", "", "保持桌面整洁。"),
    ],
  },
  // ==================== Appendix 5: Proverbs（教材附录谚语，2026-09-04 用户提供截图） ====================
  {
    grade: 5,
    unit: 13,
    title: "Proverbs 谚语（Appendix 5）",
    entries: [
      mk(5, 13, "sentence", "The early bird catches the worm.", "", "早起的鸟儿有虫吃。"),
      mk(5, 13, "sentence", "Every season brings its joy.", "", "春有百花秋有月，夏有凉风冬有雪。"),
      mk(5, 13, "sentence", "Life has seasons.", "", "人生有四季。"),
      mk(5, 13, "sentence", "Yesterday, today and tomorrow - these are the three days of man.", "", "人生有三天：昨天、今天和明天。"),
      mk(5, 13, "sentence", "Let sleeping dogs lie.", "", "别惹是生非。"),
      mk(5, 13, "sentence", "It's the empty can that makes the most noise.", "", "半瓶水响叮当。"),
    ],
  },`;

const src = readFileSync(FILE, "utf8");
const startIdx = src.indexOf(OLD_START_MARK);
const endIdx = src.indexOf(OLD_END_MARK);

if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
  console.error("❌ 标记未找到");
  console.error("OLD_START_MARK idx =", startIdx);
  console.error("OLD_END_MARK idx =", endIdx);
  process.exit(2);
}

const before = src.slice(0, startIdx);
const after = src.slice(endIdx + OLD_END_MARK.length);
const next = before + NEW_BLOCK + after;

writeFileSync(FILE, next, "utf8");
console.log(`[OK] G5U7-13 已重写`);
console.log(`  替换前 G5U7-12 段长度: ${endIdx - startIdx + OLD_END_MARK.length} 字符`);
console.log(`  替换后新段长度: ${NEW_BLOCK.length} 字符`);
console.log(`  文件总行数变化: ${(src.split("\n").length)} → ${next.split("\n").length}`);
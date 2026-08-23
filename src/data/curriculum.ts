import { mk } from "./mk";
import { GRADES_4_TO_9 } from "./grades4to9";
import { WAIYANSHE_CURRICULUM } from "./waiyanshe";
import { OXFORD_CURRICULUM } from "./oxford";
import { applyKebiaoTo, makeRenjiaoEntry } from "./kebiaoBank";

export type EntryType = "word" | "phrase" | "sentence";

/**
 * 词库版本号：词库结构/内容变更时 +1，旧学习进度将自动重置（积分保留）
 * v7：课标 1600 词补全——按 2022 版义务教育英语课标词汇表，为人教/外研社/
 *  沪教牛津三个教材各自补齐缺失的课标词，按年级分配到「课标词汇」单元，
 *  含英式音标与中文释义；全部词条美音+英音本地化（generate_audio_kebiao.mjs）。
 * v6：多教材版本支持——
 *  人教（默认）：1-2 年级一年级起点 + 3-6 PEP + 7-9 Go for it
 *  外研社：1-2 一年级起点 + 3-6 三年级起点 + 7-9 初中新标准
 *  沪教牛津：1-6 一年级起始 + 7-9 初中
 *  每个用户的教材/口音配置独立（user.config）
 */
export const CURRICULUM_VERSION = 7;

export type CurriculumVersion =
  | "renjiao"
  | "renjiao3"
  | "waiyanshe"
  | "waiyanshe3"
  | "oxford";

export const CURRICULUM_LABELS: Record<CurriculumVersion, string> = {
  renjiao: "人教版·一年级起点",
  renjiao3: "人教版·三年级起点",
  waiyanshe: "外研社·一年级起点",
  waiyanshe3: "外研社·三年级起点",
  oxford: "沪教牛津",
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
      mk(1, 1, "word", "book", "/bʊk/", "n. 书"),
      mk(1, 1, "word", "ruler", "/ˈruːlə(r)/", "n. 尺子"),
      mk(1, 1, "word", "pencil", "/ˈpensl/", "n. 铅笔"),
      mk(1, 1, "word", "schoolbag", "/ˈskuːlbæɡ/", "n. 书包"),
      mk(1, 1, "word", "teacher", "/ˈtiːtʃə(r)/", "n. 老师"),
      mk(1, 1, "word", "hello", "/həˈləʊ/", "int. 你好"),
      mk(1, 1, "word", "hi", "/haɪ/", "int. 嗨"),
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
      mk(1, 2, "word", "face", "/feɪs/", "n. 脸"),
      mk(1, 2, "word", "ear", "/ɪə(r)/", "n. 耳朵"),
      mk(1, 2, "word", "eye", "/aɪ/", "n. 眼睛"),
      mk(1, 2, "word", "nose", "/nəʊz/", "n. 鼻子"),
      mk(1, 2, "word", "mouth", "/maʊθ/", "n. 嘴巴"),
      mk(1, 2, "word", "touch", "/tʌtʃ/", "v. 触摸"),
      mk(1, 2, "word", "this", "/ðɪs/", "pron. 这（个）"),
      mk(1, 2, "word", "is", "/ɪz/", "v. 是"),
      mk(1, 2, "word", "my", "/maɪ/", "adj. 我的"),
      mk(1, 2, "word", "body", "/ˈbɒdi/", "n. 身体"),
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
      mk(1, 3, "word", "see", "/siː/", "v. 看见"),
      mk(1, 3, "word", "look", "/lʊk/", "v. 看"),
    ],
  },
  {
    grade: 1,
    unit: 4,
    title: "Numbers 数字",
    entries: [
      mk(1, 4, "word", "one", "/wʌn/", "num. 一"),
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
      mk(1, 5, "word", "black", "/blæk/", "adj. 黑色的"),
      mk(1, 5, "word", "yellow", "/ˈjeləʊ/", "adj. 黄色的"),
      mk(1, 5, "word", "blue", "/bluː/", "adj. 蓝色的"),
      mk(1, 5, "word", "red", "/red/", "adj. 红色的"),
      mk(1, 5, "word", "green", "/ɡriːn/", "adj. 绿色的"),
      mk(1, 5, "word", "colour", "/ˈkʌlə(r)/", "n. 颜色"),
      mk(1, 5, "word", "white", "/waɪt/", "adj. 白色的"),
      mk(1, 5, "word", "brown", "/braʊn/", "adj. 棕色的"),
      mk(1, 5, "word", "show", "/ʃəʊ/", "v. 出示"),
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
      mk(1, 6, "word", "orange", "/ˈɒrɪndʒ/", "n. 橙子"),
      mk(1, 6, "word", "do", "/duː/", "aux. （助动词）"),
      mk(1, 6, "word", "you", "/juː/", "pron. 你；你们"),
      mk(1, 6, "word", "like", "/laɪk/", "v. 喜欢"),
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
      mk(1, 7, "word", "in", "/ɪn/", "prep. 在……里面"),
      mk(1, 7, "word", "where", "/weə(r)/", "adv. 在哪里"),
      mk(1, 7, "word", "the", "/ðə/", "art. 这；那"),
      mk(1, 7, "word", "open", "/ˈəʊpən/", "v. 打开"),
      mk(1, 7, "word", "close", "/kləʊz/", "v. 关上"),
    ],
  },
  {
    grade: 1,
    unit: 8,
    title: "Room 房间",
    entries: [
      mk(1, 8, "word", "light", "/laɪt/", "n. 灯"),
      mk(1, 8, "word", "bed", "/bed/", "n. 床"),
      mk(1, 8, "word", "door", "/dɔː(r)/", "n. 门"),
      mk(1, 8, "word", "box", "/bɒks/", "n. 盒子"),
      mk(1, 8, "word", "near", "/nɪə(r)/", "prep. 靠近"),
      mk(1, 8, "word", "behind", "/bɪˈhaɪnd/", "prep. 在……后面"),
      mk(1, 8, "word", "room", "/ruːm/", "n. 房间"),
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
      mk(1, 9, "word", "ball", "/bɔːl/", "n. 球"),
      mk(1, 9, "word", "doll", "/dɒl/", "n. 玩偶；娃娃"),
      mk(1, 9, "word", "train", "/treɪn/", "n. 火车"),
      mk(1, 9, "word", "car", "/kɑː(r)/", "n. 小汽车"),
      mk(1, 9, "word", "bear", "/beə(r)/", "n. 玩具熊；熊"),
      mk(1, 9, "word", "can", "/kæn/", "aux. 可以；能够"),
      mk(1, 9, "word", "sure", "/ʃʊə(r)/", "adv. 当然"),
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
      mk(1, 10, "word", "fish", "/fɪʃ/", "n. 鱼"),
      mk(1, 10, "word", "chicken", "/ˈtʃɪkɪn/", "n. 鸡肉；鸡"),
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
      mk(1, 11, "word", "milk", "/mɪlk/", "n. 牛奶"),
      mk(1, 11, "word", "water", "/ˈwɔːtə(r)/", "n. 水"),
      mk(1, 11, "word", "thirsty", "/ˈθɜːsti/", "adj. 口渴的"),
      mk(1, 11, "word", "thanks", "/θæŋks/", "int. 谢谢"),
      mk(1, 11, "word", "drink", "/drɪŋk/", "v. 喝"),
      mk(1, 11, "word", "please", "/pliːz/", "int. 请"),
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
      mk(1, 12, "word", "dress", "/dres/", "n. 连衣裙"),
      mk(1, 12, "word", "socks", "/sɒks/", "n. 短袜"),
      mk(1, 12, "word", "shorts", "/ʃɔːts/", "n. 短裤"),
      mk(1, 12, "word", "hat", "/hæt/", "n. 帽子"),
      mk(1, 12, "word", "coat", "/kəʊt/", "n. 外套"),
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
      mk(2, 2, "word", "name", "/neɪm/", "n. 名字"),
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
      mk(2, 3, "word", "pretty", "/ˈprɪti/", "adj. 漂亮的"),
      mk(2, 3, "word", "thin", "/θɪn/", "adj. 瘦的"),
      mk(2, 3, "word", "short", "/ʃɔːt/", "adj. 矮的；短的"),
      mk(2, 3, "word", "handsome", "/ˈhænsəm/", "adj. 英俊的"),
      mk(2, 3, "word", "new", "/njuː/", "adj. 新的"),
      mk(2, 3, "word", "does", "/dʌz/", "aux. （助动词）"),
      mk(2, 3, "word", "small", "/smɔːl/", "adj. 小的"),
      mk(2, 3, "word", "long", "/lɒŋ/", "adj. 长的"),
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
      mk(2, 4, "word", "park", "/pɑːk/", "n. 公园"),
      mk(2, 4, "word", "hospital", "/ˈhɒspɪtl/", "n. 医院"),
      mk(2, 4, "word", "go", "/ɡəʊ/", "v. 去"),
      mk(2, 4, "word", "to", "/tuː/", "prep. 到；向"),
      mk(2, 4, "word", "shop", "/ʃɒp/", "n. 商店"),
      mk(2, 4, "word", "farm", "/fɑːm/", "n. 农场"),
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
      mk(2, 6, "word", "card", "/kɑːd/", "n. 贺卡"),
      mk(2, 6, "word", "present", "/ˈpreznt/", "n. 礼物"),
      mk(2, 6, "word", "merry", "/ˈmeri/", "adj. 愉快的"),
      mk(2, 6, "word", "happy", "/ˈhæpi/", "adj. 高兴的"),
      mk(2, 6, "word", "thank", "/θæŋk/", "v. 感谢"),
      mk(2, 6, "word", "too", "/tuː/", "adv. 也"),
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
      mk(2, 7, "word", "fly", "/flaɪ/", "v. 放飞"),
      mk(2, 7, "word", "ride", "/raɪd/", "v. 骑"),
      mk(2, 7, "word", "swim", "/swɪm/", "v. 游泳"),
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
      mk(2, 8, "word", "hot", "/hɒt/", "adj. 炎热的"),
      mk(2, 8, "word", "cold", "/kəʊld/", "adj. 寒冷的"),
      mk(2, 8, "word", "warm", "/wɔːm/", "adj. 温暖的"),
    ],
  },
  {
    grade: 2,
    unit: 9,
    title: "Seasons 四季",
    entries: [
      mk(2, 9, "word", "spring", "/sprɪŋ/", "n. 春天"),
      mk(2, 9, "word", "summer", "/ˈsʌmə(r)/", "n. 夏天"),
      mk(2, 9, "word", "autumn", "/ˈɔːtəm/", "n. 秋天"),
      mk(2, 9, "word", "winter", "/ˈwɪntə(r)/", "n. 冬天"),
      mk(2, 9, "word", "season", "/ˈsiːzn/", "n. 季节"),
      mk(2, 9, "word", "favourite", "/ˈfeɪvərɪt/", "adj. 最喜欢的"),
      mk(2, 9, "word", "cool", "/kuːl/", "adj. 凉爽的"),
      mk(2, 9, "word", "pick", "/pɪk/", "v. 采摘"),
      mk(2, 9, "word", "leaf", "/liːf/", "n. 树叶"),
      mk(2, 9, "word", "snow", "/snəʊ/", "n. 雪"),
    ],
  },
  {
    grade: 2,
    unit: 10,
    title: "Time 时间",
    entries: [
      mk(2, 10, "word", "time", "/taɪm/", "n. 时间"),
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
      mk(2, 11, "word", "home", "/həʊm/", "n. 家"),
      mk(2, 11, "word", "get", "/ɡet/", "v. 得到"),
      mk(2, 11, "word", "up", "/ʌp/", "adv. 向上"),
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
      mk(2, 12, "word", "today", "/təˈdeɪ/", "adv. 今天"),
      mk(2, 12, "word", "week", "/wiːk/", "n. 星期；周"),
      mk(2, 12, "word", "day", "/deɪ/", "n. 天；日"),
    ],
  },
  // ==================== 三年级（PEP 三上） ====================
  {
    grade: 3,
    unit: 1,
    title: "Hello! 你好！",
    entries: [
      mk(3, 1, "word", "ruler", "/ˈruːlə(r)/", "n. 尺子"),
      mk(3, 1, "word", "pencil", "/ˈpensl/", "n. 铅笔"),
      mk(3, 1, "word", "eraser", "/ɪˈreɪzə(r)/", "n. 橡皮"),
      mk(3, 1, "word", "crayon", "/ˈkreɪən/", "n. 蜡笔"),
      mk(3, 1, "word", "pen", "/pen/", "n. 钢笔"),
      mk(3, 1, "word", "book", "/bʊk/", "n. 书"),
      mk(3, 1, "word", "bag", "/bæɡ/", "n. 包"),
      mk(3, 1, "phrase", "pencil box", "/ˈpensl bɒks/", "铅笔盒"),
      mk(3, 1, "sentence", "What is your name?", "", "你叫什么名字？"),
      mk(3, 1, "sentence", "My name is Lily.", "", "我的名字叫莉莉。"),
    ],
  },
  {
    grade: 3,
    unit: 2,
    title: "Colours 颜色",
    entries: [
      mk(3, 2, "word", "red", "/red/", "adj. 红色的"),
      mk(3, 2, "word", "green", "/ɡriːn/", "adj. 绿色的"),
      mk(3, 2, "word", "yellow", "/ˈjeləʊ/", "adj. 黄色的"),
      mk(3, 2, "word", "blue", "/bluː/", "adj. 蓝色的"),
      mk(3, 2, "word", "black", "/blæk/", "adj. 黑色的"),
      mk(3, 2, "word", "brown", "/braʊn/", "adj. 棕色的"),
      mk(3, 2, "word", "white", "/waɪt/", "adj. 白色的"),
      mk(3, 2, "word", "orange", "/ˈɒrɪndʒ/", "adj. 橙色的"),
      mk(3, 2, "sentence", "Nice to meet you.", "", "很高兴认识你。"),
      mk(3, 2, "sentence", "This is Miss Green.", "", "这是格林老师。"),
    ],
  },
  {
    grade: 3,
    unit: 3,
    title: "Look at me! 看我！",
    entries: [
      mk(3, 3, "word", "face", "/feɪs/", "n. 脸"),
      mk(3, 3, "word", "ear", "/ɪə(r)/", "n. 耳朵"),
      mk(3, 3, "word", "eye", "/aɪ/", "n. 眼睛"),
      mk(3, 3, "word", "nose", "/nəʊz/", "n. 鼻子"),
      mk(3, 3, "word", "mouth", "/maʊθ/", "n. 嘴巴"),
      mk(3, 3, "word", "arm", "/ɑːm/", "n. 手臂"),
      mk(3, 3, "word", "hand", "/hænd/", "n. 手"),
      mk(3, 3, "word", "head", "/hed/", "n. 头"),
      mk(3, 3, "word", "leg", "/leɡ/", "n. 腿"),
      mk(3, 3, "word", "foot", "/fʊt/", "n. 脚"),
    ],
  },
  {
    grade: 3,
    unit: 4,
    title: "We love animals 我们爱动物",
    entries: [
      mk(3, 4, "word", "duck", "/dʌk/", "n. 鸭子"),
      mk(3, 4, "word", "pig", "/pɪɡ/", "n. 猪"),
      mk(3, 4, "word", "cat", "/kæt/", "n. 猫"),
      mk(3, 4, "word", "bear", "/beə(r)/", "n. 熊"),
      mk(3, 4, "word", "dog", "/dɒɡ/", "n. 狗"),
      mk(3, 4, "word", "elephant", "/ˈelɪfənt/", "n. 大象"),
      mk(3, 4, "word", "monkey", "/ˈmʌŋki/", "n. 猴子"),
      mk(3, 4, "word", "bird", "/bɜːd/", "n. 鸟"),
      mk(3, 4, "word", "tiger", "/ˈtaɪɡə(r)/", "n. 老虎"),
      mk(3, 4, "word", "panda", "/ˈpændə/", "n. 熊猫"),
    ],
  },
  {
    grade: 3,
    unit: 5,
    title: "Let's eat! 吃吧！",
    entries: [
      mk(3, 5, "word", "bread", "/bred/", "n. 面包"),
      mk(3, 5, "word", "water", "/ˈwɔːtə(r)/", "n. 水"),
      mk(3, 5, "word", "juice", "/dʒuːs/", "n. 果汁"),
      mk(3, 5, "word", "cake", "/keɪk/", "n. 蛋糕"),
      mk(3, 5, "word", "egg", "/eɡ/", "n. 鸡蛋"),
      mk(3, 5, "word", "fish", "/fɪʃ/", "n. 鱼"),
      mk(3, 5, "word", "milk", "/mɪlk/", "n. 牛奶"),
      mk(3, 5, "word", "rice", "/raɪs/", "n. 米饭"),
      mk(3, 5, "sentence", "I like bread.", "", "我喜欢面包。"),
      mk(3, 5, "sentence", "Have some juice.", "", "喝点果汁吧。"),
    ],
  },
  {
    grade: 3,
    unit: 6,
    title: "Happy birthday! 生日快乐！",
    entries: [
      mk(3, 6, "word", "one", "/wʌn/", "num. 一"),
      mk(3, 6, "word", "two", "/tuː/", "num. 二"),
      mk(3, 6, "word", "three", "/θriː/", "num. 三"),
      mk(3, 6, "word", "four", "/fɔː(r)/", "num. 四"),
      mk(3, 6, "word", "five", "/faɪv/", "num. 五"),
      mk(3, 6, "word", "six", "/sɪks/", "num. 六"),
      mk(3, 6, "word", "seven", "/ˈsevn/", "num. 七"),
      mk(3, 6, "word", "eight", "/eɪt/", "num. 八"),
      mk(3, 6, "word", "nine", "/naɪn/", "num. 九"),
      mk(3, 6, "word", "ten", "/ten/", "num. 十"),
    ],
  },
  // ==================== 三年级（PEP 三下） ====================
  {
    grade: 3,
    unit: 7,
    title: "Welcome back to school! 欢迎回到学校！",
    entries: [
      mk(3, 7, "word", "China", "/ˈtʃaɪnə/", "n. 中国"),
      mk(3, 7, "word", "Canada", "/ˈkænədə/", "n. 加拿大"),
      mk(3, 7, "word", "USA", "/ˌjuː es ˈeɪ/", "n. 美国"),
      mk(3, 7, "word", "UK", "/ˌjuː ˈkeɪ/", "n. 英国"),
      mk(3, 7, "word", "teacher", "/ˈtiːtʃə(r)/", "n. 老师"),
      mk(3, 7, "word", "student", "/ˈstjuːdnt/", "n. 学生"),
      mk(3, 7, "word", "boy", "/bɔɪ/", "n. 男孩"),
      mk(3, 7, "word", "girl", "/ɡɜːl/", "n. 女孩"),
      mk(3, 7, "word", "friend", "/frend/", "n. 朋友"),
      mk(3, 7, "word", "new", "/njuː/", "adj. 新的"),
    ],
  },
  {
    grade: 3,
    unit: 8,
    title: "My family 我的家庭",
    entries: [
      mk(3, 8, "word", "dad", "/dæd/", "n. 爸爸"),
      mk(3, 8, "word", "mum", "/mʌm/", "n. 妈妈"),
      mk(3, 8, "word", "man", "/mæn/", "n. 男人"),
      mk(3, 8, "word", "woman", "/ˈwʊmən/", "n. 女人"),
      mk(3, 8, "word", "grandma", "/ˈɡrænmɑː/", "n. 奶奶；外婆"),
      mk(3, 8, "word", "grandpa", "/ˈɡrænpɑː/", "n. 爷爷；外公"),
      mk(3, 8, "word", "family", "/ˈfæməli/", "n. 家庭"),
      mk(3, 8, "word", "father", "/ˈfɑːðə(r)/", "n. 爸爸"),
      mk(3, 8, "word", "mother", "/ˈmʌðə(r)/", "n. 妈妈"),
      mk(3, 8, "word", "sister", "/ˈsɪstə(r)/", "n. 姐姐；妹妹"),
    ],
  },
  {
    grade: 3,
    unit: 9,
    title: "At the zoo 在动物园",
    entries: [
      mk(3, 9, "word", "thin", "/θɪn/", "adj. 瘦的"),
      mk(3, 9, "word", "fat", "/fæt/", "adj. 胖的"),
      mk(3, 9, "word", "tall", "/tɔːl/", "adj. 高的"),
      mk(3, 9, "word", "short", "/ʃɔːt/", "adj. 矮的"),
      mk(3, 9, "word", "long", "/lɒŋ/", "adj. 长的"),
      mk(3, 9, "word", "small", "/smɔːl/", "adj. 小的"),
      mk(3, 9, "word", "big", "/bɪɡ/", "adj. 大的"),
      mk(3, 9, "word", "giraffe", "/dʒəˈrɑːf/", "n. 长颈鹿"),
      mk(3, 9, "word", "tail", "/teɪl/", "n. 尾巴"),
      mk(3, 9, "word", "children", "/ˈtʃɪldrən/", "n. 孩子们"),
    ],
  },
  {
    grade: 3,
    unit: 10,
    title: "Where is my car? 我的车在哪里？",
    entries: [
      mk(3, 10, "word", "on", "/ɒn/", "prep. 在……上面"),
      mk(3, 10, "word", "in", "/ɪn/", "prep. 在……里面"),
      mk(3, 10, "word", "under", "/ˈʌndə(r)/", "prep. 在……下面"),
      mk(3, 10, "word", "chair", "/tʃeə(r)/", "n. 椅子"),
      mk(3, 10, "word", "desk", "/desk/", "n. 书桌"),
      mk(3, 10, "word", "cap", "/kæp/", "n. 帽子"),
      mk(3, 10, "word", "ball", "/bɔːl/", "n. 球"),
      mk(3, 10, "word", "car", "/kɑː(r)/", "n. 小汽车"),
      mk(3, 10, "word", "map", "/mæp/", "n. 地图"),
      mk(3, 10, "word", "toy", "/tɔɪ/", "n. 玩具"),
    ],
  },
  {
    grade: 3,
    unit: 11,
    title: "Do you like pears? 你喜欢梨吗？",
    entries: [
      mk(3, 11, "word", "pear", "/peə(r)/", "n. 梨"),
      mk(3, 11, "word", "apple", "/ˈæpl/", "n. 苹果"),
      mk(3, 11, "word", "banana", "/bəˈnɑːnə/", "n. 香蕉"),
      mk(3, 11, "word", "watermelon", "/ˈwɔːtəmelən/", "n. 西瓜"),
      mk(3, 11, "word", "strawberry", "/ˈstrɔːbəri/", "n. 草莓"),
      mk(3, 11, "word", "grape", "/ɡreɪp/", "n. 葡萄"),
      mk(3, 11, "word", "fruit", "/fruːt/", "n. 水果"),
      mk(3, 11, "word", "buy", "/baɪ/", "v. 买"),
      mk(3, 11, "sentence", "Do you like pears?", "", "你喜欢梨吗？"),
      mk(3, 11, "sentence", "No, I don't. I like bananas.", "", "不，我不喜欢。我喜欢香蕉。"),
    ],
  },
  {
    grade: 3,
    unit: 12,
    title: "How many? 多少个？",
    entries: [
      mk(3, 12, "word", "eleven", "/ɪˈlevn/", "num. 十一"),
      mk(3, 12, "word", "twelve", "/twelv/", "num. 十二"),
      mk(3, 12, "word", "thirteen", "/ˌθɜːˈtiːn/", "num. 十三"),
      mk(3, 12, "word", "fourteen", "/ˌfɔːˈtiːn/", "num. 十四"),
      mk(3, 12, "word", "fifteen", "/ˌfɪfˈtiːn/", "num. 十五"),
      mk(3, 12, "word", "sixteen", "/ˌsɪksˈtiːn/", "num. 十六"),
      mk(3, 12, "word", "seventeen", "/ˌsevnˈtiːn/", "num. 十七"),
      mk(3, 12, "word", "eighteen", "/ˌeɪˈtiːn/", "num. 十八"),
      mk(3, 12, "word", "nineteen", "/ˌnaɪnˈtiːn/", "num. 十九"),
      mk(3, 12, "word", "twenty", "/ˈtwenti/", "num. 二十"),
    ],
  },
  ...GRADES_4_TO_9,
];

// 课标词汇补全：在教材数组求值完成后，把缺失的课标词分配到各年级末尾新单元
// 必须在 CURRICULUM 数组（含 GRADES_4_TO_9 展开）求值后调用，保证 mk 全局序在既有词条之后
applyKebiaoTo(CURRICULUM, makeRenjiaoEntry, [3, 4, 5, 6], [7, 8, 9]);

/**
 * 外研社两条教材线派生。
 * 外研版《新标准英语》实际发行两种教材：一年级起点（1-6 年级）与
 * 三年级起点（3-6 年级），两条线都从零起点内容（问候/数字/文具等）
 * 开始，词表大量交叉。词库 WAIYANSHE_CURRICULUM 中 1-2 年级取自
 * 一年级起点教材、3-6 年级取自三年级起点教材、7-9 年级为初中新标准。
 *
 * - waiyanshe（一年级起点）：完整 1-9 年级。对 3 年级及以上单元过滤掉
 *   1-2 年级已学过的词（按英文小写比较），避免同一孩子连学重复；
 *   过滤后清空的单元（三上 U2-U4 与一年级完全重复）整体移除，
 *   剩 1-3 词的薄单元保留（快速通过即可）。
 * - waiyanshe3（三年级起点）：仅 3-9 年级，按三年级起点教材原样，
 *   不做跨线去重（该线没有 1-2 年级内容，不存在跨线重复）。
 */
/**
 * 一年级起点线的带内去重：maxGrade（默认 2）及以下的单元里，
 * 后面单元中与前面单元重复的词条（按英文小写比较）一律移除，
 * 保留序列中首次出现的位置。词条 id 保持不变（去重发生在构建层，
 * 不动数据文件），被移除词条的历史进度引用由 loadProgress 统一清理。
 * 例如外研社 spring/summer/autumn/winter 在一年级 U9 首次出现，
 * 二年级 U5 的重复项会被移除。
 */
function dedupeEarlyGrades(units: UnitInfo[], maxGrade = 2): UnitInfo[] {
  const seen = new Set<string>();
  return units
    .map((u) => {
      if (u.grade > maxGrade) return u;
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

const wyEarlyWords = new Set(
  WAIYANSHE_CURRICULUM.filter((u) => u.grade <= 2)
    .flatMap((u) => u.entries)
    .map((e) => e.english.toLowerCase())
);
const WAIYANSHE_G1_START: UnitInfo[] = dedupeEarlyGrades(
  WAIYANSHE_CURRICULUM.map((u) =>
    u.grade <= 2
      ? u
      : {
          ...u,
          entries: u.entries.filter(
            (e) => !wyEarlyWords.has(e.english.toLowerCase())
          ),
        }
  )
);
const WAIYANSHE_G3_START: UnitInfo[] = WAIYANSHE_CURRICULUM.filter(
  (u) => u.grade >= 3
);

/**
 * 人教版两条教材线派生。
 * 人教社小学英语实际发行两种教材：《新起点》（一年级起点，1-6 年级）
 * 与 PEP（三年级起点，3-6 年级），两条线都从零起点内容开始，词表交叉。
 * 词库 CURRICULUM 中 1-2 年级取自新起点教材、3-6 年级取自 PEP 教材、
 * 7-9 年级为初中 Go for it（PEP 线延续）。
 *
 * - renjiao（一年级起点）：完整 1-9 年级。对 3 年级及以上单元过滤掉
 *   1-2 年级已学过的词（按英文小写比较），避免同一孩子连学重复；
 *   过滤后清空的单元（三上 U6 数字，与一年级 U4 完全重复）整体移除，
 *   剩 1-2 词的薄单元保留（快速通过即可）。
 * - renjiao3（三年级起点）：仅 3-9 年级，按 PEP + Go for it 原样，
 *   不做跨线去重（该线没有 1-2 年级内容，不存在跨线重复）。
 */
const rjEarlyWords = new Set(
  CURRICULUM.filter((u) => u.grade <= 2)
    .flatMap((u) => u.entries)
    .map((e) => e.english.toLowerCase())
);
const RENJIAO_G1_START: UnitInfo[] = dedupeEarlyGrades(
  CURRICULUM.map((u) =>
    u.grade <= 2
      ? u
      : {
          ...u,
          entries: u.entries.filter(
            (e) => !rjEarlyWords.has(e.english.toLowerCase())
          ),
        }
  )
);
const RENJIAO_G3_START: UnitInfo[] = CURRICULUM.filter((u) => u.grade >= 3);

/** 全部教材版本索引（人教为默认） */
export const CURRICULA: Record<CurriculumVersion, UnitInfo[]> = {
  renjiao: RENJIAO_G1_START,
  renjiao3: RENJIAO_G3_START,
  waiyanshe: WAIYANSHE_G1_START,
  waiyanshe3: WAIYANSHE_G3_START,
  oxford: OXFORD_CURRICULUM,
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

// patch_g7.mjs
// G7 上（旧 12 Unit） → 新 10 Unit（3 Starter + 7 正式 Unit，按 PEP 2024 秋新版）
// 用户 2026-09-05 拍 11 张截图：CONTENTS + Section A/B + Vocabulary in Each Unit P106-112
// OLD_START_MARK：G7 上注释起点
// OLD_END_MARK：G7U12 闭合 },\n  之后 → G7 下注释起点之前
//
// Vocabulary A-Z (P113) / Useful Expressions / Vocab from Primary School (P119) /
// Reference Word List (P126) 这次未拍 —— Vocab in Each Unit P106-112 是分单元全量，
// 已覆盖全部词条；Useful Expressions 已被 Section B Key Sentences 取代。

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const TARGET = path.resolve(__filename, '../../src/data/grades4to9.ts');
const text = fs.readFileSync(TARGET, 'utf8');

const OLD_START_MARK = `  // ==================== 七年级上（Go for it 七上全册） ====================
  {
    grade: 7,
    unit: 1,
    title: "My name's Gina 我的名字叫吉娜",
`;
const OLD_END_MARK = `  // ==================== 七年级下（Go for it 七下 U1-3） ====================
`;

const startIdx = text.indexOf(OLD_START_MARK);
if (startIdx < 0) {
  console.error('OLD_START_MARK not found');
  process.exit(1);
}
const endIdx = text.indexOf(OLD_END_MARK, startIdx);
if (endIdx < 0) {
  console.error('OLD_END_MARK not found');
  process.exit(1);
}

// 构造 NEW_BLOCK
const m = (g, u, t, en, ph, cn) => `      mk(${g}, ${u}, ${JSON.stringify(t)}, ${JSON.stringify(en)}, ${JSON.stringify(ph)}, ${JSON.stringify(cn)}),`;

// ============ Starter Unit 1 Hello! ============
const S1 = [
  m(7,1,'word','unit','/ˈjuːnɪt/','n. 单元'),
  m(7,1,'word','starter','/ˈstɑːtər/','n. unit 过渡单元'),
  m(7,1,'word','section','/ˈsekʃn/','n. 部分；地区'),
  m(7,1,'word','greet','/ɡriːt/','v. 招呼；问候'),
  m(7,1,'word','oh','/əʊ/','interj. 哦；啊'),
  m(7,1,'word','everyone','/ˈevriwʌn/','pron. 每人；所有人'),
  m(7,1,'word','start','/stɑːt/','v. 开始；着手'),
  m(7,1,'word','conversation','/ˌkɑːnvərˈseɪʃn/','n. 谈话；交谈'),
  m(7,1,'word','spell','/spel/','v. 用字母拼；拼写'),
  m(7,1,'word','bell','/bel/','n. 铃（声）；钟（声）'),
  m(7,1,'word','Helen','/ˈhelən/','海伦'),
  m(7,1,'word','Ella','/ˈelə/','埃拉'),
  m(7,1,'word','Emma','/ˈemə/','埃玛'),
  m(7,1,'word','Peter','/ˈpiːtər/','彼得'),
  m(7,1,'word','Brown','/braʊn/','布朗'),
  m(7,1,'word','PRC','/ˌpiː ɑːr ˈsiː/','abbr. 中华人民共和国'),
  m(7,1,'word','PLA','/ˌpiː el ˈeɪ/','abbr. 中国人民解放军'),
  m(7,1,'word','VR','/ˌviː ˈɑːr/','abbr. 虚拟现实'),
  m(7,1,'word','WHO','/ˌdʌbljuː eɪtʃ ˈəʊ/','abbr. 世界卫生组织'),
  m(7,1,'word','UN','/ˌjuː ˈen/','abbr. 联合国'),
  m(7,1,'word','Miller','/ˈmɪlər/','米勒'),
  // Section B Key Sentences
  m(7,1,'sentence','Hi.','',''),
  m(7,1,'sentence','Hello.','',''),
  m(7,1,'sentence','Good morning.','',''),
  m(7,1,'sentence','How are you?','',''),
  m(7,1,'sentence','Nice to meet you.','',''),
  m(7,1,'sentence',"What's your name?",'',''),
  m(7,1,'sentence','How do you spell your name?','',''),
].join('\n');

// ============ Starter Unit 2 Keep Tidy! ============
const S2 = [
  m(7,2,'word','bottle','/ˈbɑːtl/','n. 瓶子'),
  m(7,2,'word','eraser','/ɪˈreɪzər/','n. 橡皮'),
  m(7,2,'word','key','/kiː/','n. 钥匙；关键'),
  m(7,2,'word','thing','/θɪŋ/','n. 东西；事情'),
  m(7,2,'sentence',"You're welcome.",'','别客气；不用谢。'),
  // Section B Key Sentences
  m(7,2,'sentence','What do you have in your schoolbag?','',''),
  m(7,2,'sentence','What colour is the cap?','',''),
  m(7,2,'sentence','What colour are the rulers?','',''),
  m(7,2,'sentence','Some books are in / on / under the box.','',''),
].join('\n');

// ============ Starter Unit 3 Welcome! ============
const S3 = [
  m(7,3,'word','fun','/fʌn/','n. 乐趣；快乐  adj. 有趣的；使人快乐的'),
  m(7,3,'word','yard','/jɑːd/','n. 院子；园圃'),
  m(7,3,'word','carrot','/ˈkærət/','n. 胡萝卜'),
  m(7,3,'word','goose','/ɡuːs/','n. (pl. geese /ɡiːs/) 鹅'),
  m(7,3,'word','count','/kaʊnt/','v. 数数'),
  m(7,3,'word','another','/əˈnʌðər/','adj. & pron. 另一；又一（人或事物）'),
  m(7,3,'word','else','/els/','adv. 其他的；别的'),
  m(7,3,'word','circle','/ˈsɜːkl/','v. 围出  n. 圆形；圆圈'),
  m(7,3,'phrase','look at','','看；瞧'),
  // Section B Key Sentences
  m(7,3,'sentence',"What's this / that?",'',''),
  m(7,3,'sentence','What are these / those?','',''),
  m(7,3,'sentence','How many rabbits do they have?','',''),
].join('\n');

// ============ Unit 1 You and Me ============
const U1 = [
  m(7,4,'phrase','make friends','','交朋友'),
  m(7,4,'phrase','get to know','','认识；了解'),
  m(7,4,'word','each','/iːtʃ/','adj. & pron. 每个；各自'),
  m(7,4,'word','other','/ˈʌðər/','pron. 另外的人（或物）  adj. 另外的；其他的'),
  m(7,4,'phrase','each other','','互相；彼此'),
  m(7,4,'word','full','/fʊl/','adj. 完整的；满的'),
  m(7,4,'phrase','full name','','全名'),
  m(7,4,'word','grade','/ɡreɪd/','n. 年级；等级'),
  m(7,4,'phrase','last name','','姓'),
  m(7,4,'word','classmate','/ˈklɑːsmeɪt/','n. 同班同学'),
  m(7,4,'phrase','class teacher','','班主任'),
  m(7,4,'phrase','first name','','名字'),
  m(7,4,'word','mistake','/mɪˈsteɪk/','n. 错误；失误'),
  m(7,4,'word','country','/ˈkʌntri/','n. 国家'),
  m(7,4,'word','same','/seɪm/','adj. 相同的'),
  m(7,4,'word','twin','/twɪn/','n. 双胞胎之一  adj. 双胞胎之一的'),
  m(7,4,'word','pot','/pɑːt/','n. 锅'),
  m(7,4,'word','tofu','/ˈtəʊfuː/','n. 豆腐'),
  m(7,4,'word','need','/niːd/','v. & n. 需要'),
  m(7,4,'word','parrot','/ˈpærət/','n. 鹦鹉'),
  m(7,4,'word','guitar','/ɡɪˈtɑːr/','n. 吉他'),
  m(7,4,'word','tennis','/ˈtenɪs/','n. 网球；网球运动'),
  m(7,4,'phrase','play the guitar','','弹吉他'),
  m(7,4,'word','would','/wʊd/','modal v. 想（用于礼貌地邀请或向某人提供某物）；将会'),
  m(7,4,'phrase','would (d) like to','','表示愿意、喜欢'),
  m(7,4,'word','information','/ˌɪnfərˈmeɪʃn/','n. 信息；消息'),
  m(7,4,'word','hobby','/ˈhɑːbi/','n. 业余爱好'),
  m(7,4,'word','re:','/riː/','prep. （用于回复电子邮件）关于；事由'),
  // 专有名词
  m(7,4,'word','Green','/ɡriːn/','格林'),
  m(7,4,'word','UK','/ˌjuː ˈkeɪ/','abbr. 英国'),
  m(7,4,'word','US','/ˌjuː ˈes/','abbr. 美国'),
  m(7,4,'word','Smith','/smɪθ/','史密斯'),
  m(7,4,'word','Lisa','/ˈliːsə/','丽莎'),
  m(7,4,'word','Tom','/tɑːm/','汤姆'),
  m(7,4,'phrase','hot pot','','火锅'),
  m(7,4,'word','Sally','/ˈsæli/','萨莉'),
  m(7,4,'word','Wood','/wʊd/','伍德'),
  m(7,4,'word','Sydney','/ˈsɪdni/','悉尼（澳大利亚城市）'),
  m(7,4,'word','Australia','/ɔːˈstreɪliə/','澳大利亚'),
  m(7,4,'phrase','Mapo tofu','','麻婆豆腐'),
  m(7,4,'phrase','Beijing roast duck','','北京烤鸭'),
  m(7,4,'word','Singapore','/ˌsɪŋəˈpɔːr/','新加坡'),
  m(7,4,'phrase','the Great Wall','','长城'),
  m(7,4,'word','Pauline','/pɔːˈliːn/','保利娜'),
  m(7,4,'word','Lee','/liː/','李'),
  m(7,4,'word','Coco','/ˈkəʊkəʊ/','科科'),
  m(7,4,'word','London','/ˈlʌndən/','伦敦（英国首都）'),
].join('\n');

// ============ Unit 2 We're Family! ============
const U2 = [
  m(7,5,'word','mean','/miːn/','v. 意思是；打算'),
  m(7,5,'word','husband','/ˈhʌzbənd/','n. 丈夫'),
  m(7,5,'word','bat','/bæt/','n. 球棒；球拍'),
  m(7,5,'phrase','ping-pong bat','','乒乓球拍'),
  m(7,5,'phrase','play ping-pong','','打乒乓球'),
  m(7,5,'word','together','/təˈɡeðər/','adv. 在一起；共同'),
  m(7,5,'phrase','every day','','每天'),
  m(7,5,'word','spend','/spend/','v. 花（时间、钱等）'),
  m(7,5,'phrase','a lot of / lots of','','大量；许多'),
  m(7,5,'word','hey','/heɪ/','interj. 嘿；喂'),
  m(7,5,'word','really','/ˈriːəli/','adv. 非常；确实；真正地'),
  m(7,5,'word','member','/ˈmembər/','n. 成员；会员'),
  m(7,5,'word','activity','/ækˈtɪvəti/','n. 活动'),
  m(7,5,'word','chess','/tʃes/','n. 国际象棋'),
  m(7,5,'phrase','Chinese chess','','中国象棋'),
  m(7,5,'phrase','a lot','','很；非常'),
  m(7,5,'word','grandparent','/ˈɡrænpeərənt/','n. 祖父（母）；外祖父（母）'),
  m(7,5,'word','funny','/ˈfʌni/','adj. 好笑的；奇怪的'),
  m(7,5,'word','laugh','/lɑːf/','v. & n. 笑；笑声'),
  m(7,5,'word','different','/ˈdɪfrənt/','adj. 不同的'),
  m(7,5,'phrase','have fun','','玩得高兴'),
  m(7,5,'word','hat','/hæt/','n. 帽子'),
  m(7,5,'word','handsome','/ˈhænsəm/','adj. 英俊的'),
  m(7,5,'word','knee','/niː/','n. 膝；膝盖'),
  m(7,5,'phrase','at night','','在夜晚'),
  m(7,5,'word','grandchild','/ˈɡræntʃaɪld/','n. (pl. grandchildren /ˈɡræntʃɪldrən/) （外）孙子；（外）孙女'),
  m(7,5,'word','son','/sʌn/','n. 儿子'),
  m(7,5,'phrase','listen to','','听；倾听'),
  m(7,5,'phrase','next to','','紧邻；在……近旁'),
  // 专有名词
  m(7,5,'word','David','/ˈdeɪvɪd/','戴维'),
  m(7,5,'word','Jim','/dʒɪm/','吉姆'),
  m(7,5,'word','Kate','/keɪt/','凯特'),
  m(7,5,'word','Lily','/ˈlɪli/','莉莉'),
  m(7,5,'word','Ireland','/ˈaɪərlənd/','爱尔兰'),
  m(7,5,'word','Fred','/fred/','弗雷德'),
  m(7,5,'word','Sam','/sæm/','萨姆'),
  m(7,5,'word','Jane','/dʒeɪn/','简'),
  m(7,5,'word','Jack','/dʒæk/','杰克'),
  m(7,5,'word','Sarah','/ˈseərə/','萨拉'),
  m(7,5,'word','Oscar','/ˈɑːskər/','奥斯卡'),
  m(7,5,'word','Lucy','/ˈluːsi/','露西'),
].join('\n');

// ============ Unit 3 My School ============
const U3 = [
  m(7,6,'word','hall','/hɔːl/','n. 礼堂；大厅'),
  m(7,6,'phrase','dining hall','','餐厅'),
  m(7,6,'phrase','in front of','','在……前面'),
  m(7,6,'word','building','/ˈbɪldɪŋ/','n. 建筑物；房子'),
  m(7,6,'phrase','in the middle of','','在……中间'),
  m(7,6,'word','across','/əˈkrɑːs/','adv. & prep. 在（……）对面；横过'),
  m(7,6,'phrase','across from','','在对面'),
  m(7,6,'word','centre','/ˈsentər/','n. 中心；中央 (= center)'),
  m(7,6,'word','gym','/dʒɪm/','n. (= gymnasium /dʒɪmˈneɪziəm/) 体育馆，健身房；（尤指学校的）体育活动'),
  m(7,6,'word','field','/fiːld/','n. 场地；田地'),
  m(7,6,'phrase','sports field','','运动场'),
  m(7,6,'word','office','/ˈɔːfɪs/','n. 办公室'),
  m(7,6,'word','large','/lɑːdʒ/','adj. 大的；大号的'),
  m(7,6,'word','special','/ˈspeʃl/','adj. 特别的；特殊的'),
  m(7,6,'word','smart','/smɑːt/','adj. 智能的；聪明的'),
  m(7,6,'word','whiteboard','/ˈwaɪtbɔːrd/','n. 白板；白色书写板'),
  m(7,6,'phrase','put up','','张贴；搭建；举起'),
  m(7,6,'word','important','/ɪmˈpɔːrtnt/','adj. 重要的'),
  m(7,6,'word','notice','/ˈnəʊtɪs/','n. 通知；注意  v. 注意到；意识到'),
  m(7,6,'word','locker','/ˈlɑːkər/','n. 有锁储物柜；寄物柜'),
  m(7,6,'word','drawer','/drɔːr/','n. 抽屉'),
  m(7,6,'phrase','at the back (of)','','在（……）后面'),
  m(7,6,'word','corner','/ˈkɔːrnər/','n. 角；墙角；街角'),
  m(7,6,'word','bookcase','/ˈbʊkkeɪs/','n. 书架；书柜'),
  m(7,6,'word','screen','/skriːn/','n. 屏幕；银幕'),
  m(7,6,'phrase','at school','','在学校'),
  m(7,6,'phrase','different from','','与……不一样'),
  m(7,6,'word','modern','/ˈmɑːdərn/','adj. 现代的；当代的'),
  m(7,6,'phrase','do exercises','','做体操'),
  m(7,6,'word','amazing','/əˈmeɪzɪŋ/','adj. 令人惊奇（惊喜或惊叹）的'),
  m(7,6,'word','raise','/reɪz/','v. 使升高；提高'),
  m(7,6,'word','flag','/flæɡ/','n. 旗；旗帜'),
  m(7,6,'word','most','/məʊst/','adj. & pron. 大多数；最多；最大  adv. 最'),
  m(7,6,'word','change','/tʃeɪndʒ/','v. & n. 改变；变化'),
  m(7,6,'word','seat','/siːt/','n. 席位'),
  m(7,6,'word','delicious','/dɪˈlɪʃəs/','adj. 美味的；可口的'),
  m(7,6,'phrase','How about...?','','……怎么样？'),
  m(7,6,'word','yours','/jɔːrz/','pron. （通常写作Yours, 用于书信结尾的签名前）你的；您的'),
  m(7,6,'word','send','/send/','v. 发送；邮寄'),
  m(7,6,'word','similar','/ˈsɪmələr/','adj. 类似的；相像的'),
  m(7,6,'phrase','similar to','','和……相似'),
  m(7,6,'word','sound','/saʊnd/','v. 听起来；好像  n. 声音；响声'),
  m(7,6,'phrase','bye for now','','再见'),
  m(7,6,'word','Flora','/ˈflɔːrə/','弗洛拉'),
].join('\n');

// ============ Unit 4 My Favourite Subject ============
const U4 = [
  m(7,7,'word','biology','/baɪˈɑːlədʒi/','n. 生物学'),
  m(7,7,'phrase','IT','/ˌaɪ ˈtiː/','(= information technology /ˌɪnfərˈmeɪʃn tekˈnɑːlədʒi/) 信息技术'),
  m(7,7,'word','geography','/dʒiˈɑːɡrəfi/','n. 地理（学）'),
  m(7,7,'word','history','/ˈhɪstri/','n. 历史；历史课'),
  m(7,7,'word','boring','/ˈbɔːrɪŋ/','adj. 乏味的；令人厌烦的'),
  m(7,7,'word','useful','/ˈjuːsfl/','adj. 有用的；有益的'),
  m(7,7,'word','exciting','/ɪkˈsaɪtɪŋ/','adj. 令人激动的；使人兴奋的'),
  m(7,7,'word','past','/pæst/','n. 过去；过去的事情  adj. 过去的  prep. 在……之后'),
  m(7,7,'phrase','good with','','善于应付……的'),
  m(7,7,'word','number','/ˈnʌmbər/','n. 数字；号码'),
  m(7,7,'phrase','help sb with','','帮助某人做（某事）'),
  m(7,7,'word','reason','/ˈriːzn/','n. 原因；理由'),
  m(7,7,'phrase','good at','','擅长'),
  m(7,7,'word','remember','/rɪˈmembər/','v. 记住；记起'),
  m(7,7,'word','as','/æz/','prep. 如同；作为  conj. 当……时；由于'),
  m(7,7,'word','AM','/ˌeɪ ˈem/','abbr. (= a.m.) 上午'),
  m(7,7,'word','PM','/ˌpiː ˈem/','abbr. (= p.m.) 下午；午后'),
  m(7,7,'word','French','/frentʃ/','n. 法语  adj. 法国的；法国人的；法语的'),
  m(7,7,'word','excellent','/ˈeksələnt/','adj. 优秀的；极好的'),
  m(7,7,'word','instrument','/ˈɪnstrəmənt/','n. 乐器；器械；工具'),
  m(7,7,'word','singer','/ˈsɪŋər/','n. 歌手'),
  m(7,7,'word','future','/ˈfjuːtʃər/','n. 将来；未来'),
  m(7,7,'phrase','in the future','','将来；未来'),
  m(7,7,'word','term','/tɜːrm/','n. 学期'),
  m(7,7,'phrase','work out','','计算出；解决'),
  m(7,7,'word','problem','/ˈprɑːbləm/','n. 难题；困难'),
  m(7,7,'phrase','in class','','在课堂上'),
  m(7,7,'word','magic','/ˈmædʒɪk/','n. 魔法；魔力；魔术  adj. 有魔力的；有神奇力量的'),
  m(7,7,'word','life','/laɪf/','n. 生活；生命'),
  m(7,7,'word','scientist','/ˈsaɪəntɪst/','n. 科学家'),
  m(7,7,'word','both','/bəʊθ/','pron. & adj. 两个；两个都'),
  // 专有名词
  m(7,7,'word','Baker','/ˈbeɪkər/','贝克'),
  m(7,7,'word','Mike','/maɪk/','迈克'),
  m(7,7,'word','Davis','/ˈdeɪvɪs/','戴维斯'),
  m(7,7,'word','Canada','/ˈkænədə/','加拿大'),
].join('\n');

// ============ Unit 5 Fun Clubs ============
const U5 = [
  m(7,8,'word','club','/klʌb/','n. 俱乐部；社团'),
  m(7,8,'word','join','/dʒɔɪn/','v. 参加；加入'),
  m(7,8,'word','choose','/tʃuːz/','v. 选择；挑选'),
  m(7,8,'word','drama','/ˈdrɑːmə/','n. 戏剧；戏剧表演'),
  m(7,8,'phrase','play Chinese chess','','下中国象棋'),
  m(7,8,'word','feeling','/ˈfiːlɪŋ/','n. 感觉；情感'),
  m(7,8,'word','news','/njuːz/','n. 消息；新闻'),
  m(7,8,'word','musical','/ˈmjuːzɪkl/','adj. 音乐的；有音乐天赋的'),
  m(7,8,'phrase','musical instrument','','乐器'),
  m(7,8,'word','exactly','/ɪɡˈzæktli/','adv. 正是如此；准确地'),
  m(7,8,'word','violin','/ˌvaɪəˈlɪn/','n. 小提琴'),
  m(7,8,'word','drum','/drʌm/','n. 鼓'),
  m(7,8,'word','ability','/əˈbɪləti/','n. 能力；才能'),
  m(7,8,'word','paint','/peɪnt/','v. 用颜料画；在……上刷油漆  n. 油漆；涂料'),
  m(7,8,'word','climb','/klaɪm/','v. 攀登；爬'),
  m(7,8,'word','even','/ˈiːvn/','adv. 甚至；愈加'),
  m(7,8,'word','more','/mɔːr/','adj. & pron. 更多（的）'),
  m(7,8,'word','act','/ækt/','v. 扮演；行动  n. （戏剧等）一幕；行动'),
  m(7,8,'phrase','act out','','表演'),
  m(7,8,'phrase','at home','','在家里'),
  m(7,8,'word','interested','/ˈɪntrəstɪd/','adj. 感兴趣的'),
  m(7,8,'phrase','interested in','','对……感兴趣'),
  m(7,8,'word','nature','/ˈneɪtʃər/','n. 自然界；大自然'),
  m(7,8,'word','hike','/haɪk/','v. & n. 远足；徒步旅行'),
  m(7,8,'word','beef','/biːf/','n. 牛肉'),
  m(7,8,'word','soon','/suːn/','adv. 不久；很快'),
  m(7,8,'word','than','/ðæn; ðən/','prep. & conj. （用以引出比较的第二部分）比'),
  m(7,8,'phrase','more than','','多于'),
  m(7,8,'word','mind','/maɪnd/','n. 头脑；心思'),
  m(7,8,'word','fall','/fɔːl/','v. & n. 进入；掉落；跌倒  n. （美式）秋天'),
  m(7,8,'phrase','fall in love with','','爱上……'),
  m(7,8,'phrase','take photos','','拍照'),
  m(7,8,'word','collect','/kəˈlekt/','v. 收集；采集'),
  m(7,8,'word','insect','/ˈɪnsekt/','n. 昆虫'),
  m(7,8,'word','discover','/dɪˈskʌvər/','v. 发现；发觉'),
  m(7,8,'word','wildlife','/ˈwaɪldlaɪf/','n. 野生动物；野生生物'),
  // 专有名词
  m(7,8,'word','Linda','/ˈlɪndə/','琳达'),
  m(7,8,'word','Alice','/ˈælɪs/','爱丽丝'),
  m(7,8,'word','Bill','/bɪl/','比尔'),
  m(7,8,'word','Jenny','/ˈdʒeni/','珍妮'),
].join('\n');

// ============ Unit 6 A Day in the Life ============
const U6 = [
  m(7,9,'phrase','make use of','','使用……；利用……'),
  m(7,9,'word','quarter','/ˈkwɔːrtər/','n. 一刻钟；四等分之一'),
  m(7,9,'word','shower','/ˈʃaʊər/','n. 淋浴；淋浴器；阵雨  v. 洗淋浴'),
  m(7,9,'phrase','take a shower','','淋浴'),
  m(7,9,'phrase','get dressed','','穿衣服'),
  m(7,9,'word','brush','/brʌʃ/','v. （用刷子）刷  n. 刷子；画笔'),
  m(7,9,'word','tooth','/tuːθ/','n. (pl. teeth /tiːθ/) 牙齿'),
  m(7,9,'word','duty','/ˈdjuːti/','n. 值班；职责'),
  m(7,9,'phrase','on duty','','值班'),
  m(7,9,'word','usually','/ˈjuːʒuəli/','adv. 通常地；一般地'),
  m(7,9,'phrase','get up','','起床；站起'),
  m(7,9,'word','reporter','/rɪˈpɔːrtər/','n. 记者'),
  m(7,9,'word','around','/əˈraʊnd/','adv. & prep. 大约；环绕；到处'),
  m(7,9,'word','homework','/ˈhəʊmwɜːrk/','n. 家庭作业'),
  m(7,9,'phrase','go to bed','','上床睡觉'),
  m(7,9,'word','saying','/ˈseɪɪŋ/','n. 谚语；格言'),
  m(7,9,'word','rise','/raɪz/','v. 起来；升起；增长  n. 增加；增强'),
  m(7,9,'word','stay','/steɪ/','v. 停留；保持'),
  m(7,9,'word','routine','/ruːˈtiːn/','n. 常规'),
  m(7,9,'word','restaurant','/ˈrestrɑːnt/','n. 餐馆；餐厅'),
  m(7,9,'word','housework','/ˈhaʊswɜːrk/','n. 家务劳动'),
  m(7,9,'word','while','/waɪl/','n. 一段时间；一会儿  conj. 在……期间；当……的时候'),
  m(7,9,'word','weekend','/ˈwiːkend/','n. 周末'),
  m(7,9,'phrase','at weekends','','在周末'),
  m(7,9,'word','daily','/ˈdeɪli/','adj. 每日的；日常的'),
  m(7,9,'phrase','daily routine','','日常生活'),
  m(7,9,'word','only','/ˈəʊnli/','adv. 只；仅'),
  m(7,9,'word','break','/breɪk/','v. （使）破碎；损坏  n. 休息；中断'),
  m(7,9,'word','Finnish','/ˈfɪnɪʃ/','n. 芬兰语  adj. 芬兰的；芬兰人的；芬兰语的'),
  m(7,9,'word','finish','/ˈfɪnɪʃ/','v. 结束；完成'),
  m(7,9,'word','hockey','/ˈhɑːki/','n. 曲棍球'),
  m(7,9,'phrase','ice hockey','','冰球运动；冰上曲棍球'),
  m(7,9,'word','already','/ɔːlˈredi/','adv. 已经；早已'),
  m(7,9,'word','dark','/dɑːrk/','adj. 昏暗的；深色的'),
  m(7,9,'word','outside','/ˌaʊtˈsaɪd/','adv. & prep. 在（……）外面  adj. 外面的'),
  m(7,9,'word','part','/pɑːrt/','n. 部分'),
  m(7,9,'word','everyday','/ˈevrideɪ/','adj. 每天的；日常的'),
  m(7,9,'word','prepare','/prɪˈpeər/','v. 把……准备好；准备'),
  m(7,9,'phrase','prepare sth for','','为……把某物准备好'),
  // 专有名词
  m(7,9,'word','Timo','/ˈtiːməʊ/','蒂莫'),
  m(7,9,'word','Halla','/ˈhɑːlə/','哈拉'),
  m(7,9,'word','Helsinki','/helˈsɪŋki/','赫尔辛基（芬兰首都）'),
  m(7,9,'word','Finland','/ˈfɪnlənd/','芬兰'),
  m(7,9,'phrase','home economics','/ˌhəʊm ˌekəˈnɑːmɪks/','家政学；家庭经济学'),
].join('\n');

// ============ Unit 7 Happy Birthday! ============
const U7 = [
  m(7,10,'word','celebrate','/ˈselɪbreɪt/','v. 庆祝；庆贺'),
  m(7,10,'word','surprise','/sərˈpraɪz/','n. 惊奇；惊讶  v. 使感到意外'),
  m(7,10,'word','something','/ˈsʌmθɪŋ/','pron. 某事；某物'),
  m(7,10,'word','sale','/seɪl/','n. 出售；销售'),
  m(7,10,'word','kilo','/ˈkiːləʊ/','n. 千克 (= kilogram /ˈkɪləɡræm/, kilogramme /ˈkɪləɡræm/) (pl. kilos)'),
  m(7,10,'word','yogurt','/ˈjɑːɡərt/','n. 酸奶 (= yoghurt)'),
  m(7,10,'word','total','/ˈtəʊtl/','n. 总数；合计  adj. 总的；全体的'),
  m(7,10,'word','price','/praɪs/','n. 价格'),
  m(7,10,'word','balloon','/bəˈluːn/','n. 气球'),
  m(7,10,'word','chocolate','/ˈtʃɑːklət/','n. 巧克力'),
  m(7,10,'word','pizza','/ˈpiːtsə/','n. 比萨饼'),
  m(7,10,'word','list','/lɪst/','n. 名单；清单  v. 列表；列清单'),
  m(7,10,'word','own','/əʊn/','adj. & pron. 自己的；本人的'),
  m(7,10,'word','example','/ɪɡˈzɑːmpl/','n. 例子；范例'),
  m(7,10,'phrase','for example','','例如'),
  m(7,10,'word','language','/ˈlæŋɡwɪdʒ/','n. 语言'),
  m(7,10,'word','international','/ˌɪntərˈnæʃnəl/','adj. 国际的'),
  m(7,10,'word','mark','/mɑːrk/','n. 记号；纪念；打分  v. 记号'),
  m(7,10,'word','national','/ˈnæʃnəl/','adj. 国家的；民族的'),
  m(7,10,'word','found','/faʊnd/','v. 创建；创立'),
  m(7,10,'word','meaningful','/ˈmiːnɪŋfl/','adj. 有意义的；重要的'),
  m(7,10,'phrase','make a wish','','许愿'),
  m(7,10,'word','celebration','/ˌselɪˈbreɪʃn/','n. 庆典；庆祝（活动）'),
  m(7,10,'word','post','/pəʊst/','n. 帖子；邮政  v. 邮寄；发布'),
  m(7,10,'word','contact','/ˈkɑːntækt/','n. 联系；接触  v. 联系；联络'),
  m(7,10,'word','symbol','/ˈsɪmbl/','n. 象征；符号'),
  m(7,10,'phrase','take a photo','','拍照'),
  m(7,10,'word','village','/ˈvɪlɪdʒ/','n. 村庄；村镇'),
  m(7,10,'word','grow','/ɡrəʊ/','v. 成长；长大；增长'),
  m(7,10,'word','blow','/bləʊ/','v. 吹；刮'),
  m(7,10,'phrase','blow out','','吹灭'),
  m(7,10,'word','enjoy','/ɪnˈdʒɔɪ/','v. 享受……的乐趣；喜欢'),
  m(7,10,'word','height','/haɪt/','n. 身高；高度'),
  m(7,10,'word','later','/ˈleɪtər/','adv. & adj. 以后（的）；后来（的）'),
  m(7,10,'phrase','next time','','下次'),
  m(7,10,'word','whom','/huːm/','pron. 谁；什么人'),
  // 专有名词
  m(7,10,'word','William Shakespeare','/ˈwɪljəm ˈʃeɪkspɪr/','威廉·莎士比亚'),
  m(7,10,'word','Florence Nightingale','/ˈflɔːrəns ˈnaɪtɪŋɡeɪl/','弗洛伦斯·南丁格尔'),
  m(7,10,'phrase','National Day','','国庆节'),
  m(7,10,'phrase','CPC Founding Day','','中国共产党建党纪念日'),
  m(7,10,'phrase','PLA Day','','中国人民解放军建军节'),
  m(7,10,'word','Judy','/ˈdʒuːdi/','朱迪'),
  m(7,10,'word','Clark','/klɑːrk/','克拉克'),
].join('\n');

// 拼装 NEW_BLOCK
const HEAD = `  // ==================== 七年级上（PEP 2024 秋新版 · 3 Starter + 7 Unit） ====================
  // 来源：用户 2026-09-05 拍 11 张截图
  //   - CONTENTS（目录页，3 Starter + 7 正式 Unit）
  //   - Section A/B（含 Project 与 Key Sentences 整句）
  //   - Vocabulary in Each Unit P106-112（分单元全量词表）
  // Vocab A-Z P113 / Useful Expressions / Vocab from Primary School P119 / Reference Word List P126 这次未拍：
  //   - Vocab A-Z 只是 Vocab in Each Unit 的字母排序版本，不新增
  //   - Useful Expressions 已被 Section B Key Sentences 取代
`;

const block = (n, title, body) => `  {
    grade: 7,
    unit: ${n},
    title: ${JSON.stringify(title)},
    entries: [
${body}
    ],
  },
`;

const NEW_BLOCK = HEAD
  + block(1, 'Starter Unit 1 Hello! 你好！', S1)
  + block(2, 'Starter Unit 2 Keep Tidy! 保持整洁！', S2)
  + block(3, 'Starter Unit 3 Welcome! 欢迎！', S3)
  + block(4, 'You and Me 你和我', U1)
  + block(5, "We're Family! 我们是一家人！", U2)
  + block(6, 'My School 我的学校', U3)
  + block(7, 'My Favourite Subject 我最喜欢的学科', U4)
  + block(8, 'Fun Clubs 趣味社团', U5)
  + block(9, 'A Day in the Life 一天的生活', U6)
  + block(10, 'Happy Birthday! 生日快乐！', U7);

// 拼接：before + NEW_BLOCK + OLD_END_MARK + after
const before = text.slice(0, startIdx);
const after  = text.slice(endIdx + OLD_END_MARK.length);

const next = before + NEW_BLOCK + OLD_END_MARK + after;

fs.writeFileSync(TARGET, next, 'utf8');
console.log('✅ patched');
console.log('  OLD len:', endIdx - startIdx + OLD_END_MARK.length);
console.log('  NEW_BLOCK len:', NEW_BLOCK.length);
console.log('  before/after unchanged');
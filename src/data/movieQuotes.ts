// 经典电影励志台词库（上进/努力/坚持/勇气/梦想），用于单元完成祝贺页随机展示
// 精选标准：广为流传的经典台词 + 催人奋进（励志优先，凑数句不收）
// 2026-08 更新：删 12 条弱句，补 13 条经典励志句；二次更新：用户筛选删 8 条，补 25 条（共 102 条）

export interface MovieQuote {
  en?: string;
  cn: string;
  movie: string;
}

export const MOVIE_QUOTES: MovieQuote[] = [
  // 死亡诗社
  { en: "Carpe diem. Seize the day.", cn: "把握当下，抓住今天。", movie: "死亡诗社" },
  { en: "Make your lives extraordinary.", cn: "让你们的生活非同凡响。", movie: "死亡诗社" },
  { en: "No matter what anybody tells you, words and ideas can change the world.", cn: "无论别人怎么说，文字和思想真的能改变世界。", movie: "死亡诗社" },
  // 阿甘正传
  { en: "Miracles happen every day.", cn: "奇迹每天都在发生。", movie: "阿甘正传" },
  { en: "My mama always said you've got to put the past behind you before you can move on.", cn: "妈妈说，只有放下过去，才能继续前行。", movie: "阿甘正传" },
  { en: "You have to do the best with what God gave you.", cn: "你必须用好上天给予你的一切。", movie: "阿甘正传" },
  { en: "My mama always said life was like a box of chocolates. You never know what you're gonna get.", cn: "妈妈说，人生就像一盒巧克力，你永远不知道下一颗是什么味道。", movie: "阿甘正传" },
  // 肖申克的救赎
  { en: "Hope is a good thing, maybe the best of things, and no good thing ever dies.", cn: "希望是美好的，也许是人间至善，而美好的事物永不消逝。", movie: "肖申克的救赎" },
  { en: "Get busy living, or get busy dying.", cn: "要么忙着活，要么忙着死。", movie: "肖申克的救赎" },
  { en: "Fear can hold you prisoner. Hope can set you free.", cn: "恐惧囚禁你的灵魂，希望还你自由。", movie: "肖申克的救赎" },
  // 狮子王
  { en: "Remember who you are.", cn: "永远记住你是谁。", movie: "狮子王" },
  { en: "The past can hurt. But the way I see it, you can either run from it, or learn from it.", cn: "往事会让人受伤，但你可以逃避它，也可以从中学习。", movie: "狮子王" },
  { en: "Look inside yourself, Simba. You are more than what you have become.", cn: "审视你的内心，辛巴。你所成为的，远不是你的全部。", movie: "狮子王" },
  // 功夫熊猫
  { en: "Yesterday is history. Tomorrow is a mystery. But today is a gift. That's why it's called the present.", cn: "昨日是历史，明日是谜团，唯有今天是礼物——所以它才叫 present。", movie: "功夫熊猫" },
  { en: "If you only do what you can do, you will never be more than you are now.", cn: "如果只做自己力所能及的事，就永远无法超越现在的自己。", movie: "功夫熊猫" },
  { en: "Your story may not have such a happy beginning, but that doesn't make you who you are.", cn: "你的故事开头也许并不完美，但那决定不了你是谁。", movie: "功夫熊猫" },
  { en: "There is no secret ingredient. To make something special, you just have to believe it's special.", cn: "根本没有什么秘方。想做出特别的东西，你只需要相信它很特别。", movie: "功夫熊猫" },
  // 当幸福来敲门
  { en: "Don't ever let somebody tell you you can't do something. Not even me.", cn: "别让别人告诉你你成不了才，即使是我也不行。", movie: "当幸福来敲门" },
  { en: "You got a dream, you gotta protect it. If you want something, go get it. Period.", cn: "有梦想，就要捍卫它。想要什么，就去争取，就这么简单。", movie: "当幸福来敲门" },
  // 玩具总动员
  { en: "To infinity and beyond!", cn: "飞向无限远！", movie: "玩具总动员" },
  // 灰姑娘
  { en: "Have courage and be kind.", cn: "要有勇气，也要善良。", movie: "灰姑娘" },
  { en: "A dream is a wish your heart makes.", cn: "梦想，是你心之所愿。", movie: "灰姑娘" },
  // 花木兰
  { en: "The flower that blooms in adversity is the most rare and beautiful of all.", cn: "逆境中绽放的花朵，是最稀有、最美丽的。", movie: "花木兰" },
  { en: "The greatest gift and honor is having you for a daughter.", cn: "最大的礼物与荣耀，就是有你这样的女儿。", movie: "花木兰" },
  // 料理鼠王
  { en: "If you focus on what you left behind, you will never be able to see what lies ahead.", cn: "如果只盯着身后，就永远看不到前方。", movie: "料理鼠王" },
  { en: "Not everyone can become a great artist, but a great artist can come from anywhere.", cn: "并非人人都能成为伟大的艺术家，但伟大的艺术家可以来自任何地方。", movie: "料理鼠王" },
  // 指环王
  { en: "Even the smallest person can change the course of the future.", cn: "即使最渺小的人，也能改变未来的走向。", movie: "指环王" },
  { en: "All we have to decide is what to do with the time that is given us.", cn: "我们必须决定的，是如何度过上天赐予我们的时光。", movie: "指环王" },
  { en: "I can't carry it for you, but I can carry you.", cn: "我无法替你背负它，但我可以背着你走。", movie: "指环王：王者归来" },
  { en: "There's some good in this world, and it's worth fighting for.", cn: "这世上仍有美好，值得我们为之奋斗。", movie: "指环王：双塔奇兵" },
  // 哈利·波特
  { en: "It is our choices, that show what we truly are, far more than our abilities.", cn: "是我们的选择，而不是能力，决定了我们是什么样的人。", movie: "哈利·波特与密室" },
  { en: "Happiness can be found even in the darkest of times, if one only remembers to turn on the light.", cn: "即使在最黑暗的时刻，只要记得打开灯，也能找到幸福。", movie: "哈利·波特与死亡圣器" },
  { en: "It takes a great deal of bravery to stand up to our enemies, but just as much to stand up to our friends.", cn: "反抗敌人需要巨大的勇气，反抗朋友也需要同样的勇气。", movie: "哈利·波特与魔法石" },
  // 勇敢的心
  { en: "Every man dies, not every man really lives.", cn: "每个人都会死，但不是每个人都真正活过。", movie: "勇敢的心" },
  // 洛奇
  { en: "It ain't about how hard you hit. It's about how hard you can get hit and keep moving forward.", cn: "重要的不是你能打多重，而是你能承受多大打击，依然向前。", movie: "洛奇" },
  { en: "Going in one more round when you don't think you can. That's what makes all the difference in your life.", cn: "在撑不住的时候再坚持一个回合，这才是改变人生的关键。", movie: "洛奇" },
  // 闻香识女人
  { en: "No mistakes in the tango, not like life. If you make a mistake, just tango on.", cn: "探戈里没有错误，不像人生。犯了错，就继续跳下去。", movie: "闻香识女人" },
  // 成事在人
  { en: "I am the master of my fate, I am the captain of my soul.", cn: "我是命运的主宰，我是灵魂的船长。", movie: "成事在人" },
  { en: "The harder the struggle, the more glorious the triumph.", cn: "挣扎越艰难，胜利就越辉煌。", movie: "成事在人" },
  // 疯狂原始人
  { en: "Don't be afraid of the dark. Follow the lights, then you can find tomorrow.", cn: "不要害怕黑暗，跟着光走，就能找到明天。", movie: "疯狂原始人" },
  // 冰雪奇缘
  { en: "Do the next right thing.", cn: "做好下一件正确的事。", movie: "冰雪奇缘2" },
  // 至暗时刻
  { en: "Success is not final, failure is not fatal. It is the courage to continue that counts.", cn: "成功不是终点，失败也不是末日，重要的是继续前行的勇气。", movie: "至暗时刻" },
  // 蝙蝠侠
  { en: "Why do we fall? So that we can learn to pick ourselves up.", cn: "我们为什么会跌倒？为了学会自己爬起来。", movie: "蝙蝠侠：侠影之谜" },
  { en: "It's not who I am underneath, but what I do that defines me.", cn: "定义我的，不是我的外表，而是我的所作所为。", movie: "蝙蝠侠：侠影之谜" },
  { en: "The night is darkest just before the dawn.", cn: "黎明前的夜，总是最黑暗的。", movie: "蝙蝠侠：黑暗骑士" },
  // 惊奇队长
  { en: "Higher, further, faster.", cn: "更高，更远，更快。", movie: "惊奇队长" },
  // 黑客帝国
  { en: "There is a difference between knowing the path and walking the path.", cn: "知道路怎么走，和真正走在路上，是不同的。", movie: "黑客帝国" },
  // 盗梦空间
  { en: "You mustn't be afraid to dream a little bigger, darling.", cn: "别害怕把梦做得更大一点，亲爱的。", movie: "盗梦空间" },
  // 星际穿越
  { en: "We've always defined ourselves by the ability to overcome the impossible.", cn: "我们一直以克服不可能来定义自己。", movie: "星际穿越" },
  // 阿波罗13号
  { en: "Failure is not an option.", cn: "失败，不是一个选项。", movie: "阿波罗13号" },
  // 千钧一发
  { en: "I never saved anything for the swim back.", cn: "我从不为游回来保存体力——我只管全力以赴。", movie: "千钧一发" },
  // 侏罗纪公园
  { en: "Life finds a way.", cn: "生命自会找到出路。", movie: "侏罗纪公园" },
  // 火星救援
  { en: "You solve one problem, and you solve the next one, and if you solve enough problems, you get to come home.", cn: "解决一个问题，再解决下一个，当问题都解决了，你就能回家。", movie: "火星救援" },
  // 模仿游戏
  { en: "Sometimes it's the very people who no one imagines anything of who do the things that no one can imagine.", cn: "有时候，正是那些没人看得起的人，做出了没人能想象的事。", movie: "模仿游戏" },
  // 教父
  { en: "Great men are not born great, they grow great.", cn: "伟大的人不是天生伟大，而是在成长中变得伟大。", movie: "教父" },
  // 绿野仙踪
  { en: "You've always had the power, my dear. You just had to learn it for yourself.", cn: "亲爱的，你一直拥有力量，只是你还没学会相信自己。", movie: "绿野仙踪" },
  { en: "Courage! What makes a king out of a slave? Courage!", cn: "勇气！是什么让奴隶成为国王？勇气！", movie: "绿野仙踪" },
  // 回到未来
  { en: "If you put your mind to it, you can accomplish anything.", cn: "只要下定决心，你就能做成任何事。", movie: "回到未来" },
  // 勇敢传说
  { en: "Our fate lives within us. You only have to be brave enough to see it.", cn: "命运就在我们心中，你只要足够勇敢去看见它。", movie: "勇敢传说" },
  // 心灵奇旅
  { en: "Your spark isn't your purpose. When you're ready to live, it fills in.", cn: "火花不是人生目标，当你准备好生活，它自然就会点亮。", movie: "心灵奇旅" },
  // 寻梦环游记
  { en: "Seize your moment.", cn: "抓住属于你的时刻。", movie: "寻梦环游记" },
  // 三傻大闹宝莱坞
  { en: "Follow excellence, and success will chase you.", cn: "追求卓越，成功就会不期而至。", movie: "三傻大闹宝莱坞" },
  // 海洋奇缘
  { en: "The call isn't out there at all. It's inside me.", cn: "呼唤不在远方，它就在我心里。", movie: "海洋奇缘" },
  // 心灵捕手
  { en: "You'll have bad times, but it'll always wake you up to the good stuff you weren't paying attention to.", cn: "你会经历低谷，但低谷会提醒你注意那些你未曾留意的美好。", movie: "心灵捕手" },
  // 追梦赤子心
  { en: "In this lifetime, you don't have to prove nothin' to nobody except yourself.", cn: "这一生，你不需要向任何人证明什么，除了你自己。", movie: "追梦赤子心" },
  // 本杰明·巴顿奇事
  { en: "I hope you live a life you're proud of. If you find that you're not, I hope you have the strength to start all over again.", cn: "我希望你过让自己骄傲的一生。如果没有，我希望你有勇气从头再来。", movie: "本杰明·巴顿奇事" },
  // 绿皮书
  { en: "The world's full of lonely people afraid to make the first move.", cn: "世界充满害怕迈出第一步的孤独者，别做其中之一。", movie: "绿皮书" },
  { en: "Whatever you do, do it a hundred percent. When you work, work. When you laugh, laugh.", cn: "无论做什么，都要百分之百投入。工作时认真工作，开心时尽情大笑。", movie: "绿皮书" },
  // 奔腾年代
  { en: "It's not the size of the dog in the fight, it's the size of the fight in the dog.", cn: "决定胜负的不是狗的大小，而是它心中的斗志。", movie: "奔腾年代" },
  // 卡特教练
  { en: "Our deepest fear is not that we are inadequate. Our deepest fear is that we are powerful beyond measure.", cn: "我们最深的恐惧，不是自己不够好，而是自己拥有超乎想象的力量。", movie: "卡特教练" },
  // 国王的演讲
  { en: "I have a voice!", cn: "我有自己的声音！", movie: "国王的演讲" },
  // 白日梦想家
  { en: "Stop dreaming. Start living.", cn: "别再做梦，去生活。", movie: "白日梦想家" },
  // 奇迹男孩
  { en: "When given the choice between being right or being kind, choose kind.", cn: "当可以在正确与善良之间选择时，请选择善良。", movie: "奇迹男孩" },
  // 起风了
  { en: "The wind is rising! We must try to live.", cn: "风起之时，唯有努力生存。", movie: "起风了" },
  // 功夫梦
  { en: "Your focus needs more focus.", cn: "你的专注，还需要更专注。", movie: "功夫梦" },
  // 大力士
  { en: "A true hero isn't measured by the size of his strength, but by the strength of his heart.", cn: "真正的英雄，不在于力量的大小，而在于内心的强大。", movie: "大力士" },
  // 钢铁巨人
  { en: "You are who you choose to be.", cn: "你是谁，由你自己选择。", movie: "钢铁巨人" },
  // 星际宝贝
  { en: "'Ohana means family. Family means nobody gets left behind or forgotten.", cn: "Ohana 就是家人，家人就意味着没有人会被抛下或遗忘。", movie: "星际宝贝" },
  // 小飞象
  { en: "The very things that held you down are going to lift you up.", cn: "曾经拖住你、让你低落的东西，终将把你高高托起。", movie: "小飞象" },
  // 木偶奇遇记
  { en: "When you wish upon a star, your dreams come true.", cn: "当你向星星许愿，梦想就会成真。", movie: "木偶奇遇记" },
  // 阿拉丁
  { en: "Like so many things, it is not what is outside, but what is inside that counts.", cn: "正如许多事情一样，真正重要的不是外表，而是内在。", movie: "阿拉丁" },
  // 音乐之声
  { en: "Climb every mountain, ford every stream, follow every rainbow, till you find your dream.", cn: "攀过每一座山，蹚过每一条河，追随每一道彩虹，直到找到你的梦想。", movie: "音乐之声" },
  // 欢乐满人间
  { en: "In every job that must be done, there is an element of fun.", cn: "每一件必须完成的事情里，都藏着一份乐趣。", movie: "欢乐满人间" },
  // 小王子
  { en: "It is only with the heart that one can see rightly; what is essential is invisible to the eye.", cn: "只有用心才能看得清楚，真正重要的东西，用眼睛是看不见的。", movie: "小王子" },
  // 查理和巧克力工厂
  { en: "We are the music-makers, and we are the dreamers of dreams.", cn: "我们是音乐的创造者，我们是梦想的梦想家。", movie: "查理和巧克力工厂" },
  // 爱丽丝梦游仙境
  { en: "You're entirely bonkers. But I'll tell you a secret: all the best people are.", cn: "你确实有点疯狂，但告诉你一个秘密：所有最优秀的人都是如此。", movie: "爱丽丝梦游仙境" },
  { en: "Sometimes I believe as many as six impossible things before breakfast.", cn: "有时我在早餐前，就能相信六件不可能的事。", movie: "爱丽丝梦游仙境" },
  // 马戏之王
  { en: "No one ever made a difference by being like everyone else.", cn: "从来没有谁，因为和所有人一样而改变世界。", movie: "马戏之王" },
  // 灵魂冲浪人
  { en: "I don't need easy, I just need possible.", cn: "我不需要容易，我只需要可能。", movie: "灵魂冲浪人" },
  // 冰上轻驰
  { en: "A gold medal is a wonderful thing, but if you're not enough without it, you'll never be enough with it.", cn: "金牌确实是好东西，但如果你离开金牌就不行，那拥有金牌你也依然不行。", movie: "冰上轻驰" },
  // 冰上奇迹
  { en: "Great moments are born from great opportunity.", cn: "伟大的时刻，诞生于伟大的机遇。", movie: "冰上奇迹" },
  // 弱点
  { en: "You should hope for courage and try for honor.", cn: "你应该期许勇气，追求荣誉。", movie: "弱点" },
  // 帕丁顿熊
  { en: "If we're kind and polite, the world will be right.", cn: "只要我们善良又礼貌，世界就会好起来。", movie: "帕丁顿熊" },
  // 欢乐好声音
  { en: "Don't let fear stop you from doing the thing you love.", cn: "别让恐惧阻止你去做你热爱的事。", movie: "欢乐好声音" },
  // 中文电影
  { en: "Work hard! Fight on!", cn: "努力！奋斗！", movie: "喜剧之王" },
  { en: "A man without dreams is no different from a salted fish.", cn: "做人如果没梦想，跟咸鱼有什么分别。", movie: "少林足球" },
  { en: "My fate is decided by me, not by the heavens.", cn: "我命由我不由天。", movie: "哪吒之魔童降世" },
  { en: "Hope is as precious as a diamond in this era.", cn: "希望，是这个时代像钻石一样珍贵的东西。", movie: "流浪地球" },
  { en: "What is a dream? A dream is something that makes persistence feel like happiness.", cn: "梦想是什么？梦想就是一种让你感到坚持就是幸福的东西。", movie: "中国合伙人" },
  { en: "Never stop thinking. As long as your mind keeps working, you can do anything in this world.", cn: "只要脑子一直想，一直想，你就能干这个地球上所有的事情。", movie: "银河补习班" },
  { en: "As long as the drum beats in your heart, you are the lion.", cn: "只要心中有鼓点，你就是雄狮。", movie: "雄狮少年" },
  { en: "Love what you love, do what you do, follow your heart.", cn: "爱你所爱，行你所行，听从你心，无问西东。", movie: "无问西东" },
];

export function randomMovieQuote(): MovieQuote {
  return MOVIE_QUOTES[Math.floor(Math.random() * MOVIE_QUOTES.length)];
}

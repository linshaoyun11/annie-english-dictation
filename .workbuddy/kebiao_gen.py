# -*- coding: utf-8 -*-
"""生成 kebiaoBank.ts 词条数据
音标：ipa-dict en_UK（规范化：ɐ→ə, ɹ→r, 重音移到音节首, 单音节去重音, 词尾r补(r)）
释义：ECDICT stardict 提取（取第一义项, a.→adj.）
特殊词条（缩写/短语/专有名词）人工覆盖
"""
import re, io, sys, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = r"C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27"
TMP = r"C:/Users/huawei/AppData/Local/Temp"

# 1) 课标词表
src = open(BASE + "/.workbuddy/kebiao_compare.py", encoding="utf-8").read()
ns = {}
exec(src.split("print(")[0], ns)
l2 = ns["l2"]; full = ns["full"]; seen = ns["seen"]
for w in ["all","bear","dog","feel","hurt","interesting","may","move","or","ping-pong","sing","week","worry"]:
    l2.add(w)
    if w not in seen:
        seen.add(w); full.append(w)
for dup in ["neighbor","favorite"]:
    if dup in seen:
        seen.discard(dup); full.remove(dup)

# 2) 音标
uk_ipa = {}
for line in open(TMP + "/en_uk.txt", encoding="utf-8"):
    line = line.rstrip("\n")
    if not line or "\t" not in line: continue
    w, ipa = line.split("\t", 1)
    m = re.match(r"/([^/]+)/", ipa.strip())
    if m and w.lower() not in uk_ipa:
        uk_ipa[w.lower()] = "/" + m.group(1) + "/"

VOWELS = set("iɪeæɑɒɔʊuʌəɐaɜɔɛ")
DIPHTHONGS = {"aɪ","aʊ","əʊ","eɪ","ɔɪ","ɪə","eə","ʊə","oʊ","ɑɪ","ɑʊ"}

def syllable_count(ipa_inner):
    i, n, cnt = 0, len(ipa_inner), 0
    while i < n:
        pair = ipa_inner[i:i+2]
        if pair in DIPHTHONGS:
            cnt += 1; i += 2
        elif ipa_inner[i] in VOWELS:
            # 处理 ɜː ɑː 等长元音（已计入单元音）
            cnt += 1
            i += 1
            if i < n and ipa_inner[i] == "ː":
                i += 1
        else:
            i += 1
    return cnt

def normalize_ipa(word, raw):
    inner = raw.strip().strip("/")
    inner = inner.replace("ɐ", "ə").replace("ɹ", "r").replace("ˈ", "ˈ").replace("ˌ", "ˌ")
    # 该词典用 ɛ 表示 /e/，与 app 风格不一致
    inner = inner.replace("ɛ", "e")
    # 辅音后的 iə 实为 /ɪə/（如 fear→fɪə），aɪə/eɪə 中已是 ɪ 不受影响
    inner = re.sub(r"(?<![aɑeæiɪoɔuʊə])iə", "ɪə", inner)
    # 合法音节首辅音簇（英语音系）
    VALID_ONSET2 = {"pl","pr","tr","tw","kl","kr","kw","bl","br","dr","dw","gl","gr",
                    "fl","fr","θr","ʃr","hj","sw","sl","sm","sn","sp","st","sk"}
    VALID_ONSET3 = {"spl","spr","str","skr","skw","skj","spj","stj"}
    # 重音符号移到音节首（向前移过辅音串，但不能超过合法音节首辅音簇）
    for mark in ("ˈ", "ˌ"):
        while True:
            idx = inner.find(mark)
            if idx <= 0: break
            j = idx - 1
            while j >= 0 and (inner[j] == "ː" or
                              (inner[j] not in VOWELS and inner[j] not in ("ˈ", "ˌ"))):
                j -= 1
            if j < 0:
                inner = mark + inner[:idx] + inner[idx+1:]   # 移到最前
                break
            if inner[j] in ("ˈ", "ˌ"):
                inner = inner[:idx] + inner[idx+1:]
                inner = inner[:j+1] + mark + inner[j+1:]
                break
            cluster_raw = inner[j+1:idx]            # 元音与重音符之间的原始串（可含 ː）
            cluster = cluster_raw.lstrip("ː")
            n = len(cluster)
            onset = None
            for L in (3, 2):
                if L <= n and cluster[-L:] in (VALID_ONSET3 if L == 3 else VALID_ONSET2):
                    onset = cluster[-L:]; break
            if onset is None:
                onset = cluster[-1:] if n else ""   # 单辅音总合法；无辅音不动
            remainder = cluster[:n - len(onset)]
            lead = cluster_raw[:len(cluster_raw) - len(cluster)]  # 被跳过的 ː
            inner = inner[:j+1] + lead + remainder + mark + onset + inner[idx+1:]
            break
    # 单音节去重音
    if syllable_count(inner) <= 1:
        inner = inner.replace("ˈ", "").replace("ˌ", "")
    # 非复合词去掉词中次重音（词典次重音位置普遍不准，如 factory/ˈfæktəˌri/）
    compound = bool(re.search(r"[ -]", word)) or bool(
        re.match(r"^(every|some|any|no|what|when|where|how)(thing|body|one|where|way|time)$", word))
    if not compound:
        inner = inner[0] + inner[1:].replace("ˌ", "") if inner else inner
    # 词尾 ə → ə(r)（词以 r/re 结尾时，匹配 app 既有风格）
    if inner.endswith("ə") and re.search(r"(r|re)$", word.lower()):
        inner = inner + "(r)"
    # 同理：ɔː/ɑː/ɜː 结尾 → 加 (r)
    if re.search(r"(r|re)$", word.lower()):
        for v in ("ɔː", "ɑː", "ɜː"):
            if inner.endswith(v):
                inner = inner + "(r)"; break
    return "/" + inner + "/"

# 3) 释义（来自旧 stardict 提取结果）
extract = json.load(open(BASE + "/.workbuddy/kebiao_extract.json", encoding="utf-8"))
results = extract["results"]

def clean_cn(raw):
    cn = raw.strip()
    cn = re.sub(r"^a\.\s*", "adj. ", cn)
    cn = re.sub(r"^ad\.\s*", "adv. ", cn)
    cn = re.sub(r"^na\.\s*", "", cn)
    # app 风格统一用 v.，不用 vt./vi.
    cn = re.sub(r"^v[ti]\.\s*", "v. ", cn)
    # 去掉领域前缀（如"[计] 因特网"）
    cn = re.sub(r"^\[[^\]]+\]\s*", "", cn)
    cn = re.sub(r"^interj\.\s*", "int. ", cn)
    # 去掉尾部括号补充说明（如"网站（全球资讯网的主机站）"）
    cn = re.sub(r"[(（][^()（）]*[)）]\s*$", "", cn)
    # 只取第一义项
    cn = re.split(r"[；;,，]", cn)[0].strip()
    if len(cn) > 20:
        cn = cn[:20]
    return cn

# ECDICT 首义项词性不适合教学的词，人工修正
CN_FIX = {
    "show": "v. 展示；给……看",
    "run": "v. 跑；奔跑",
    "pay": "v. 支付；付钱",
    "use": "v. 使用；利用",
    "copy": "v. 复制；复印",
    "ring": "n. 戒指；铃响",
    "mall": "n. 购物中心",
    "website": "n. 网站",
    "screen": "n. 屏幕",
    "fall": "v. 落下；跌倒",
    "lot": "pron. 许多",
    "post": "v. 邮寄；n. 邮政",
    "order": "n. 顺序；v. 命令",
    "watch": "v. 观看；注视",
    "call": "v. 打电话；称呼",
    "play": "v. 玩；踢（球）",
    "sing": "v. 唱歌",
    "dance": "v. 跳舞",
    "eat": "v. 吃",
    "drink": "v. 喝；饮",
    "cook": "v. 烹调；煮",
    "wash": "v. 洗",
    "clean": "v. 打扫；干净的",
    "brush": "n. 刷子；v. 刷",
    "write": "v. 写",
    "draw": "v. 画",
    "paint": "v. 用颜料画",
    "count": "v. 数数；计算",
    "find": "v. 找到；发现",
    "give": "v. 给",
    "take": "v. 拿；带走",
    "make": "v. 制作；使得",
    "know": "v. 知道；了解",
    "think": "v. 想；认为",
    "tell": "v. 告诉",
    "say": "v. 说",
    "speak": "v. 说话",
    "hear": "v. 听见",
    "see": "v. 看见",
    "look": "v. 看",
    "come": "v. 来",
    "go": "v. 去",
    "sit": "v. 坐",
    "stand": "v. 站；站立",
    "sleep": "v. 睡觉",
    "walk": "v. 走路；散步",
    "jump": "v. 跳",
    "swim": "v. 游泳",
    "fly": "v. 飞；放（风筝）",
    "ride": "v. 骑；乘",
    "drive": "v. 驾驶",
    "buy": "v. 买",
    "sell": "v. 卖",
    "send": "v. 送；发送",
    "spend": "v. 花费",
    "meet": "v. 遇见；见面",
    "help": "v. 帮助",
    "open": "v. 打开",
    "close": "v. 关闭；adj. 近的",
    "carry": "v. 携带；搬运",
    "catch": "v. 抓住；接住",
    "throw": "v. 扔；投",
    "cut": "v. 切；剪",
    "put": "v. 放",
    "wear": "v. 穿；戴",
    "turn": "v. 转动；变得",
    "move": "v. 移动",
    "pass": "v. 传递；通过",
    "hold": "v. 拿着；举行",
    "keep": "v. 保持；保存",
    "leave": "v. 离开；留下",
    "learn": "v. 学习；学会",
    "teach": "v. 教",
    "study": "v. 学习；n. 书房",
    "answer": "v. 回答；n. 答案",
    "ask": "v. 问；请求",
    "bring": "v. 带来",
    "borrow": "v. 借入",
    "begin": "v. 开始",
    "start": "v. 开始；启动",
    "finish": "v. 完成；结束",
    "wake": "v. 醒来",
    "pick": "v. 挑选；采摘",
    "point": "v. 指；n. 点",
    "save": "v. 救；节省",
    "share": "v. 分享",
    # 不规则复数与其他特殊释义
    "children": "n. 孩子们（child 的复数）",
    "feet": "n. 脚（foot 的复数）",
    "gentlemen": "n. 先生们（gentleman 的复数）",
    "leaves": "n. 树叶（leaf 的复数）",
    "lives": "n. 生命（life 的复数）",
    "men": "n. 男人们（man 的复数）",
    "mice": "n. 老鼠（mouse 的复数）",
    "policemen": "n. 男警察（policeman 的复数）",
    "postmen": "n. 邮递员（postman 的复数）",
    "firemen": "n. 消防员（fireman 的复数）",
    "scissors": "n. 剪刀",
    "shelves": "n. 架子（shelf 的复数）",
    "teeth": "n. 牙齿（tooth 的复数）",
    "trousers": "n. 裤子",
    "wives": "n. 妻子（wife 的复数）",
    "wolves": "n. 狼（wolf 的复数）",
    "women": "n. 女人们（woman 的复数）",
    "download": "v. 下载",
    "internet": "n. 因特网；互联网",
    "laptop": "n. 笔记本电脑",
    "online": "adj. 在线的；adv. 在网上",
    "account": "n. 账户",
    "achieve": "v. 达到；实现",
    "admire": "v. 钦佩；赞赏",
    "alarm": "n. 闹钟；警报",
    "apartment": "n. 公寓",
    "average": "adj. 平均的；普通的",
    "advice": "n. 建议",
    "has": "v. 有（have 的第三人称单数）",
    "grandpa": "n. 爷爷",
    "hello": "int. 喂；你好",
    "hi": "int. 喂；你好",
    # ── 审查补充：高频动词（ECDICT 首义项给名词义/生僻义）──
    "change": "v. 改变；n. 零钱",
    "check": "v. 检查；核对",
    "choose": "v. 选择",
    "climb": "v. 爬；攀登",
    "communicate": "v. 交流；沟通",
    "consider": "v. 考虑；认为",
    "cover": "v. 覆盖；n. 封面",
    "cross": "v. 穿过",
    "describe": "v. 描述",
    "die": "v. 死；死亡",
    "dig": "v. 挖",
    "drop": "v. 掉落；落下",
    "enjoy": "v. 享受；喜爱",
    "enter": "v. 进入",
    "fail": "v. 失败；不及格",
    "feed": "v. 喂养",
    "fill": "v. 装满；填满",
    "fight": "v. 打架；打仗",
    "fix": "v. 修理",
    "follow": "v. 跟随；接着",
    "forget": "v. 忘记",
    "guess": "v. 猜",
    "hate": "v. 讨厌；恨",
    "hide": "v. 藏；躲藏",
    "hope": "v. 希望",
    "hurt": "v. 弄疼；受伤",
    "imagine": "v. 想象",
    "influence": "n. 影响",
    "introduce": "v. 介绍",
    "join": "v. 加入；参加",
    "knock": "v. 敲",
    "laugh": "v. 笑",
    "lay": "v. 放置；下蛋",
    "lend": "v. 借出",
    "lose": "v. 丢失；输",
    "love": "v. 爱；喜爱",
    "marry": "v. 结婚",
    "mean": "v. 意思是",
    "mend": "v. 修补",
    "mind": "v. 介意；n. 头脑",
    "nod": "v. 点头",
    "notice": "v. 注意到；n. 通知",
    "obey": "v. 服从；遵守",
    "offer": "v. 提供",
    "own": "v. 拥有；adj. 自己的",
    "practise": "v. 练习",
    "praise": "v. 表扬",
    "prefer": "v. 更喜欢",
    "prepare": "v. 准备",
    "pretend": "v. 假装",
    "promise": "v. 承诺；n. 诺言",
    "protect": "v. 保护",
    "pull": "v. 拉",
    "push": "v. 推",
    "raise": "v. 举起；提高",
    "reach": "v. 到达；伸手拿",
    "realise": "v. 意识到；实现",
    "receive": "v. 收到",
    "regret": "v. 后悔",
    "relax": "v. 放松",
    "remember": "v. 记得",
    "repeat": "v. 重复",
    "reply": "v. 回复",
    "retell": "v. 复述",
    "rise": "v. 上升；升起",
    "sail": "v. 航行",
    "search": "v. 搜索；搜寻",
    "serve": "v. 服务；上菜",
    "shake": "v. 摇动",
    "shine": "v. 照耀；发光",
    "shout": "v. 喊叫",
    "shut": "v. 关闭",
    "smile": "v. 微笑",
    "solve": "v. 解决",
    "spell": "v. 拼写",
    "spread": "v. 传播；摊开",
    "stay": "v. 停留",
    "steal": "v. 偷",
    "succeed": "v. 成功",
    "suggest": "v. 建议",
    "support": "v. 支持",
    "taste": "v. 尝起来；n. 味道",
    "touch": "v. 触摸",
    "translate": "v. 翻译",
    "travel": "v. 旅行",
    "treat": "v. 对待；治疗",
    "trust": "v. 信任",
    "try": "v. 尝试；努力",
    "understand": "v. 理解",
    "visit": "v. 拜访；参观",
    "wait": "v. 等待",
    "want": "v. 想要",
    "welcome": "v. 欢迎",
    "win": "v. 赢；获胜",
    "wish": "v. 希望；祝愿",
    "wonder": "v. 想知道",
    "worry": "v. 担心",
    # ── 审查补充：生僻义修正 ──
    "coach": "n. 教练",
    "dumpling": "n. 饺子",
    "mum": "n. 妈妈",
    "tap": "n. 水龙头",
    "tidy": "adj. 整洁的；v. 整理",
    "still": "adv. 仍然",
    "underground": "n. 地铁",
    "weekday": "n. 工作日",
    "capital": "n. 首都",
    "film": "n. 电影",
    "movie": "n. 电影",
    "letter": "n. 信；字母",
    "match": "n. 比赛；火柴",
    "race": "n. 比赛；赛跑",
    "lift": "n. 电梯；v. 举起",
    "flat": "n. 公寓",
    "rubber": "n. 橡皮",
    "boot": "n. 靴子",
    "spring": "n. 春天；泉水",
    "fan": "n. 迷；风扇",
    "band": "n. 乐队",
    "bill": "n. 账单",
    "block": "n. 街区",
    "board": "n. 木板",
    "button": "n. 纽扣；按钮",
    "cap": "n. 帽子",
    "cause": "n. 原因；v. 导致",
    "chalk": "n. 粉笔",
    "chance": "n. 机会",
    "choice": "n. 选择",
    "course": "n. 课程",
    "crowd": "n. 人群",
    "dream": "n. 梦；梦想",
    "dress": "n. 连衣裙",
    "interest": "n. 兴趣",
    "mistake": "n. 错误",
    "note": "n. 笔记",
    "patient": "adj. 耐心的；n. 病人",
    "pardon": "int. 什么；请再说一遍",
    "period": "n. 时期；课时",
    "pleasure": "n. 高兴；乐事",
    "present": "n. 礼物；adj. 目前的",
    "programme": "n. 节目；计划",
    "purpose": "n. 目的",
    "result": "n. 结果",
    "role": "n. 角色",
    "rock": "n. 岩石",
    "rule": "n. 规则",
    "seat": "n. 座位",
    "sentence": "n. 句子",
    "stamp": "n. 邮票",
    "tip": "n. 小费；提示",
    "tour": "n. 旅行；观光",
    "tourist": "n. 游客",
    "tower": "n. 塔",
    "trip": "n. 旅行",
    "trouble": "n. 麻烦",
    "view": "n. 景色；观点",
    "wood": "n. 木头；树林",
    "yard": "n. 院子",
    "medicine": "n. 药",
    "lawyer": "n. 律师",
    "environment": "n. 环境",
    "congratulation": "n. 祝贺",
    "medium": "adj. 中等的",
    "the": "art. 这；那",
    "madam": "n. 夫人；女士",
    "sir": "n. 先生",
    "dear": "int. 哎呀；adj. 亲爱的",
    "well": "adv. 好；int. 嗯",
    "sound": "n. 声音",
    "matter": "v. 要紧；n. 事情",
    "mine": "pron. 我的",
    "people": "n. 人们",
    "news": "n. 新闻",
    "food": "n. 食物",
    "home": "n. 家；adv. 在家",
    "water": "n. 水",
    "milk": "n. 牛奶",
    "rice": "n. 米饭",
    "meat": "n. 肉",
    "chicken": "n. 鸡；鸡肉",
    "fish": "n. 鱼",
    "fruit": "n. 水果",
    "noodle": "n. 面条",
    # ── 审查补充：功能词（ECDICT 给生僻义或缺失词性）──
    "then": "adv. 然后；那时",
    "there": "adv. 那里",
    "here": "adv. 这里",
    "now": "adv. 现在",
    "just": "adv. 刚刚；只是",
    "only": "adv. 仅仅；adj. 唯一的",
    "even": "adv. 甚至",
    "ever": "adv. 曾经",
    "too": "adv. 也；太",
    "so": "adv. 如此；因此",
    "again": "adv. 再一次",
    "away": "adv. 离开",
    "back": "adv. 回；向后",
    "soon": "adv. 不久",
    "later": "adv. 稍后",
    "already": "adv. 已经",
    "once": "adv. 一次；曾经",
    "twice": "adv. 两次",
    "today": "adv. 今天；n. 今天",
    "tomorrow": "adv. 明天；n. 明天",
    "yesterday": "adv. 昨天；n. 昨天",
    "yet": "adv. 还；尚未",
    "though": "conj. 虽然",
    "while": "conj. 当……时；然而",
    "whether": "conj. 是否",
    "than": "conj. 比",
    "that": "pron. 那；那个",
    "this": "pron. 这；这个",
    "these": "pron. 这些",
    "those": "pron. 那些",
    "what": "pron. 什么",
    "who": "pron. 谁",
    "whose": "pron. 谁的",
    "which": "pron. 哪一个",
    "when": "adv. 什么时候",
    "where": "adv. 在哪里",
    "why": "adv. 为什么",
    "how": "adv. 怎样；多么",
    # ── 审查补充：介词/副词小品词 ──
    "in": "prep. 在……里",
    "into": "prep. 到……里面",
    "like": "v. 喜欢；prep. 像",
    "of": "prep. ……的",
    "on": "prep. 在……上",
    "at": "prep. 在",
    "by": "prep. 通过；被",
    "for": "prep. 为；给",
    "from": "prep. 从",
    "with": "prep. 和……一起；用",
    "about": "prep. 关于",
    "after": "prep. 在……之后",
    "before": "prep. 在……之前",
    "under": "prep. 在……下面",
    "over": "prep. 在……上方",
    "between": "prep. 在……之间",
    "behind": "prep. 在……后面",
    "beside": "prep. 在……旁边",
    "near": "prep. 在……附近",
    "without": "prep. 没有",
    "until": "prep. 直到",
    "up": "adv. 向上",
    "down": "adv. 向下",
    "out": "adv. 出；在外",
    "off": "adv. 离开；关",
    "to": "prep. 到；向",
    "towards": "prep. 朝；向",
    # ── 审查补充：颜色词 adj. 化 ──
    "black": "adj. 黑色的",
    "blue": "adj. 蓝色的",
    "brown": "adj. 棕色的",
    "green": "adj. 绿色的",
    "orange": "n. 橙子；橙色",
    "pink": "adj. 粉红色的",
    "purple": "adj. 紫色的",
    "red": "adj. 红色的",
    "white": "adj. 白色的",
    "yellow": "adj. 黄色的",
    "grey": "adj. 灰色的",
    "gray": "adj. 灰色的",
    # ── 审查补充：其他常见词 ──
    "light": "adj. 轻的；明亮的",
    "right": "adj. 正确的；右边的",
    "wrong": "adj. 错误的",
    "last": "adj. 最后的；v. 持续",
    "little": "adj. 小的",
    "sweet": "adj. 甜的",
    "kind": "adj. 友好的；n. 种类",
    "fair": "adj. 公平的",
    # ── 复检补充：首义项偏差 ──
    "can": "aux. 能；可以",
    "corn": "n. 玉米",
    "fool": "n. 傻瓜",
    "game": "n. 游戏；比赛",
    "kid": "n. 小孩",
    "mark": "n. 记号；分数",
    "metre": "n. 米",
    "pool": "n. 游泳池",
    "pot": "n. 锅；壶",
    "stick": "n. 木棍；枝条",
    "fear": "n. 害怕；恐惧",
    "cartoon": "n. 动画片；卡通",
    "radio": "n. 收音机；无线电",
    "night": "n. 夜晚",
    "goal": "n. 目标；进球",
    # ── 终检补充：全面修正 ECDICT 首义项偏差 ──
    "fine": "adj. 好的；晴朗的",
    "live": "v. 居住；生活",
    "plane": "n. 飞机",
    "will": "aux. 将要",
    "must": "aux. 必须",
    "might": "aux. 可能；也许",
    "need": "v. 需要",
    "no": "adv. 不",
    "old": "adj. 老的；旧的",
    "many": "adj. 许多的",
    "much": "adj. 许多的；adv. 非常",
    "more": "adj. 更多的",
    "most": "adj. 大多数的",
    "less": "adj. 更少的",
    "enough": "adj. 足够的；adv. 足够地",
    "else": "adv. 另外；其他",
    "high": "adj. 高的",
    "low": "adj. 低的",
    "ill": "adj. 生病的",
    "sick": "adj. 生病的",
    "shy": "adj. 害羞的",
    "cold": "adj. 冷的；n. 感冒",
    "cool": "adj. 凉的；酷的",
    "full": "adj. 满的",
    "good": "adj. 好的",
    "great": "adj. 伟大的；好极的",
    "quiet": "adj. 安静的",
    "dark": "adj. 黑暗的",
    "wild": "adj. 野生的",
    "wet": "adj. 湿的",
    "whole": "adj. 整个的",
    "worth": "adj. 值得的",
    "pale": "adj. 苍白的",
    "normal": "adj. 正常的",
    "negative": "adj. 消极的；否定的",
    "medical": "adj. 医学的",
    "special": "adj. 特别的",
    "spare": "adj. 空闲的；多余的",
    "sudden": "adj. 突然的",
    "round": "adj. 圆的；adv. 在周围",
    "straight": "adj. 直的",
    "public": "adj. 公共的；n. 公众",
    "general": "adj. 一般的；大体的",
    "double": "adj. 两倍的；双的",
    "calm": "adj. 平静的；镇静的",
    "expensive": "adj. 昂贵的",
    "fat": "adj. 胖的；n. 脂肪",
    "through": "prep. 穿过",
    "around": "prep. 在……周围",
    "except": "prep. 除……之外",
    "within": "prep. 在……里面",
    "but": "conj. 但是",
    "blow": "v. 吹",
    "boil": "v. 煮；烧开",
    "break": "v. 打破；n. 休息",
    "cancel": "v. 取消",
    "care": "n. 照顾；v. 关心",
    "chat": "v. 聊天",
    "cheat": "v. 作弊；欺骗",
    "cheer": "v. 欢呼；加油",
    "cost": "v. 花费；n. 费用",
    "cry": "v. 哭；喊",
    "deal": "v. 处理；n. 协议",
    "design": "v. 设计",
    "depend": "v. 依靠；取决于",
    "express": "v. 表达",
    "fit": "v. 适合；adj. 健康的",
    "found": "v. 创建；成立",
    "grow": "v. 生长；种植",
    "hang": "v. 悬挂",
    "hug": "v. 拥抱",
    "hunt": "v. 打猎",
    "hurry": "v. 匆忙；赶紧",
    "improve": "v. 改进；提高",
    "jog": "v. 慢跑",
    "kick": "v. 踢",
    "kill": "v. 杀死",
    "kiss": "v. 吻",
    "lie": "v. 躺；撒谎",
    "litter": "v. 乱扔垃圾；n. 垃圾",
    "manage": "v. 管理；设法做到",
    "mention": "v. 提到",
    "pour": "v. 倒；灌",
    "press": "v. 按；压",
    "print": "v. 打印",
    "recognise": "v. 认出；承认",
    "repair": "v. 修理",
    "review": "v. 复习；评论",
    "rush": "v. 冲；匆忙",
    "scare": "v. 使害怕",
    "seem": "v. 好像；似乎",
    "set": "v. 放置；设置",
    "shoot": "v. 射击",
    "skate": "v. 滑冰",
    "smell": "v. 闻；n. 气味",
    "stop": "v. 停止；n. 车站",
    "sweep": "v. 扫；打扫",
    "talk": "v. 说话；谈话",
    "thank": "v. 感谢",
    "vote": "v. 投票",
    "waste": "v. 浪费；n. 浪费",
    "wave": "n. 波浪；v. 挥手",
    "baby": "n. 婴儿",
    "bath": "n. 洗澡；浴室",
    "belt": "n. 腰带",
    "benefit": "n. 好处",
    "brain": "n. 大脑",
    "case": "n. 情况",
    "character": "n. 角色；性格",
    "charity": "n. 慈善",
    "cheese": "n. 奶酪",
    "chip": "n. 薯条；芯片",
    "chore": "n. 家务活",
    "circle": "n. 圆；圆圈",
    "conversation": "n. 对话",
    "couple": "n. 一对；几个",
    "cow": "n. 奶牛",
    "dictionary": "n. 词典",
    "dining": "n. 用餐",
    "director": "n. 导演；主管",
    "disaster": "n. 灾难",
    "effect": "n. 效果；影响",
    "elephant": "n. 大象",
    "eraser": "n. 橡皮",
    "everywhere": "adv. 到处",
    "exercise": "n. 锻炼；练习",
    "fashion": "n. 时尚",
    "feeling": "n. 感觉",
    "field": "n. 田地；领域",
    "flag": "n. 旗",
    "folk": "n. 民间；人们",
    "form": "n. 形式；表格",
    "gas": "n. 气体；煤气",
    "grade": "n. 年级；分数",
    "ground": "n. 地面",
    "hall": "n. 大厅",
    "hobby": "n. 业余爱好",
    "hole": "n. 洞",
    "housework": "n. 家务",
    "industry": "n. 工业",
    "information": "n. 信息",
    "instruction": "n. 说明；指示",
    "instrument": "n. 乐器；工具",
    "juice": "n. 果汁",
    "kilo": "n. 千克",
    "knee": "n. 膝盖",
    "line": "n. 线；排",
    "manner": "n. 方式；礼貌",
    "map": "n. 地图",
    "mess": "n. 杂乱",
    "number": "n. 数字；号码",
    "power": "n. 力量；电力",
    "practice": "n. 练习",
    "project": "n. 项目",
    "risk": "n. 风险",
    "rubbish": "n. 垃圾",
    "shock": "n. 震惊",
    "shoulder": "n. 肩膀",
    "shower": "n. 淋浴；阵雨",
    "sign": "n. 标志；手势",
    "skill": "n. 技能",
    "space": "n. 太空；空间",
    "speed": "n. 速度",
    "spoon": "n. 勺子",
    "stage": "n. 舞台；阶段",
    "state": "n. 状态；州",
    "surface": "n. 表面",
    "survey": "n. 调查",
    "tail": "n. 尾巴",
    "task": "n. 任务",
    "throat": "n. 喉咙",
    "tie": "n. 领带；v. 系",
    "tradition": "n. 传统",
    "umbrella": "n. 雨伞",
    "uncle": "n. 叔叔",
    "video": "n. 视频",
    "wallet": "n. 钱包",
    "way": "n. 方法；道路",
    "weight": "n. 重量",
    "whale": "n. 鲸鱼",
    "word": "n. 单词；话",
    "worst": "adj. 最坏的",
    "wound": "n. 伤口",
    "youth": "n. 青年；青春",
}

# en_uk.txt 缺失的 75 词，手写英式音标
IPA_FIX = {
    "absent": "/əbˈsent/", "ache": "/eɪk/", "address": "/əˈdres/",
    "afternoon": "/ˌɑːftəˈnuːn/", "as": "/əz/", "bamboo": "/ˌbæmˈbuː/",
    "christmas": "/ˈkrɪsməs/", "close": "/kləʊs/", "collect": "/kəˈlekt/",
    "concert": "/ˈkɒnsət/", "desert": "/ˈdezət/", "do": "/duː/",
    "email": "/ˈiːmeɪl/", "evening": "/ˈiːvnɪŋ/", "excuse": "/ɪkˈskjuːs/",
    "fine": "/faɪn/", "finish": "/ˈfɪnɪʃ/", "flower": "/ˈflaʊə(r)/",
    "graduate": "/ˈɡrædʒuət/", "have": "/hæv/", "he": "/hiː/",
    "house": "/haʊs/", "increase": "/ɪnˈkriːs/", "inside": "/ˌɪnˈsaɪd/",
    "invite": "/ɪnˈvaɪt/", "job": "/dʒɒb/", "lead": "/liːd/",
    "live": "/lɪv/", "lives": "/lɪvz/", "maths": "/mæθs/",
    "minute": "/ˈmɪnɪt/", "mobile": "/ˈməʊbaɪl/", "mother": "/ˈmʌðə(r)/",
    "mouse": "/maʊs/", "mouth": "/maʊθ/", "nice": "/naɪs/",
    "no": "/nəʊ/", "none": "/nʌn/", "number": "/ˈnʌmbə(r)/",
    "object": "/ˈɒbdʒɪkt/", "olympic": "/əˈlɪmpɪk/", "organize": "/ˈɔːɡənaɪz/",
    "outside": "/ˌaʊtˈsaɪd/", "perfect": "/ˈpɜːfɪkt/", "present": "/ˈpreznt/",
    "princess": "/ˌprɪnˈses/", "produce": "/prəˈdjuːs/", "progress": "/ˈprəʊɡres/",
    "project": "/ˈprɒdʒekt/", "put": "/pʊt/", "quite": "/kwaɪt/",
    "read": "/riːd/", "real": "/ˈrɪəl/", "record": "/ˈrekɔːd/",
    "refuse": "/rɪˈfjuːz/", "repair": "/rɪˈpeə(r)/", "report": "/rɪˈpɔːt/",
    "research": "/rɪˈsɜːtʃ/", "return": "/rɪˈtɜːn/", "review": "/rɪˈvjuː/",
    "river": "/ˈrɪvə(r)/", "rose": "/rəʊz/", "row": "/rəʊ/",
    "secret": "/ˈsiːkrət/", "separate": "/ˈseprət/", "shower": "/ˈʃaʊə(r)/",
    "subject": "/ˈsʌbdʒɪkt/", "survey": "/ˈsɜːveɪ/", "tower": "/ˈtaʊə(r)/",
    "underground": "/ˈʌndəɡraʊnd/", "use": "/juːz/", "wear": "/weə(r)/",
    "wind": "/wɪnd/", "windy": "/ˈwɪndi/", "wound": "/wuːnd/",
    "onion": "/ˈʌnjən/", "radio": "/ˈreɪdiəʊ/",
    # ex- 前缀词（词典原始数据有误）
    "exactly": "/ɪɡˈzæktli/", "exam": "/ɪɡˈzæm/", "examination": "/ɪɡˌzæmɪˈneɪʃn/",
    "example": "/ɪɡˈzɑːmpəl/", "except": "/ɪkˈsept/", "excited": "/ɪkˈsaɪtɪd/",
    "exciting": "/ɪkˈsaɪtɪŋ/", "exercise": "/ˈeksəsaɪz/", "expect": "/ɪkˈspekt/",
    "expensive": "/ɪkˈspensɪv/", "experience": "/ɪkˈspɪəriəns/",
    "explain": "/ɪkˈspleɪn/", "explore": "/ɪkˈsplɔː(r)/", "express": "/ɪkˈspres/",
    # 词典数据有误或缺失，增补
    "tour": "/tʊə(r)/", "tourist": "/ˈtʊərɪst/", "towards": "/təˈwɔːdz/",
    "museum": "/mjuˈziːəm/", "lawyer": "/ˈlɔːjə(r)/", "encourage": "/ɪnˈkʌrɪdʒ/",
    "environment": "/ɪnˈvaɪrənmənt/", "congratulation": "/kənˌɡrætʃuˈleɪʃn/",
    "the": "/ðə/", "realise": "/ˈriːəlaɪz/", "medium": "/ˈmiːdiəm/",
    "medicine": "/ˈmedsn/", "into": "/ˈɪntuː/",
}

# 4) 人工覆盖（音标与释义均为 app 风格）
OVERRIDE = {
    "a":        ("/ə/", "art. 一（个）"),
    "an":       ("/ən/", "art. 一（个）"),
    "a.m.":     ("/ˌeɪ ˈem/", "n. 上午；午前"),
    "p.m.":     ("/ˌpiː ˈem/", "n. 下午；午后"),
    "o'clock":  ("/əˈklɒk/", "adv. ……点钟"),
    "mr":       ("/ˈmɪstə(r)/", "n. 先生"),
    "mrs":      ("/ˈmɪsɪz/", "n. 夫人；太太"),
    "ms":       ("/mɪz/", "n. 女士"),
    "pe":       ("/ˌpiː ˈiː/", "n. 体育课"),
    "tv":       ("/ˌtiː ˈviː/", "n. 电视"),
    "ai":       ("/ˌeɪ ˈaɪ/", "n. 人工智能"),
    "app":      ("/æp/", "n. 应用程序"),
    "ad":       ("/æd/", "n. 广告"),
    "ok":       ("/ˌəʊˈkeɪ/", "int. 好；行"),
    "x-ray":    ("/ˈeks reɪ/", "n. X射线；X光"),
    "t-shirt":  ("/ˈtiː ʃɜːt/", "n. T恤衫"),
    "kung fu":  ("/ˌkʌŋ ˈfuː/", "n. 功夫"),
    "ice cream":("/ˌaɪs ˈkriːm/", "n. 冰淇淋"),
    "ping-pong":("/ˈpɪŋ pɒŋ/", "n. 乒乓球"),
    "per cent": ("/pə ˈsent/", "n. 百分之……"),
    "according to": ("/əˈkɔːdɪŋ tuː/", "prep. 根据；按照"),
    "be":       ("/biː/", "v. 是（am/is/are 的原形）"),
    "may":      ("/meɪ/", "v. 可以；也许"),
    "china":    ("/ˈtʃaɪnə/", "n. 中国"),
    "chinese":  ("/ˌtʃaɪˈniːz/", "n. 中文；中国人"),
    "english":  ("/ˈɪŋɡlɪʃ/", "n. 英语"),
    "i":        ("/aɪ/", "pron. 我"),
    "goodbye":  ("/ˌɡʊdˈbaɪ/", "int. 再见"),
    "miss":     ("/mɪs/", "n. 女士；错过"),
    "yogurt":   ("/ˈjɒɡət/", "n. 酸奶"),
}

bank, fail = [], []
for word in sorted(full, key=str.lower):
    low = word.lower()
    band = 2 if word in l2 else 3
    if low in OVERRIDE:
        ph, cn = OVERRIDE[low]
    else:
        raw = uk_ipa.get(low)
        if not raw:
            # 尝试连字符变体
            alt = low.replace(" ", "-")
            raw = uk_ipa.get(alt) or uk_ipa.get(low.replace("-", ""))
        if low in IPA_FIX:
            ph = IPA_FIX[low]   # 词典数据有误或缺失，人工修正优先
        elif raw:
            ph = normalize_ipa(word, raw)
        else:
            fail.append(word); continue
        r = results.get(word)
        if not r or not r.get("cn"):
            fail.append(word + "(cn)"); continue
        cn = clean_cn(r["cn"])
        if low in CN_FIX:
            cn = CN_FIX[low]
        if not cn:
            fail.append(word + "(cn-empty)"); continue
    bank.append({"en": word, "ph": ph, "cn": cn, "band": band})

print("生成词条:", len(bank), " 失败:", len(fail))
if fail: print("失败:", fail)

# 抽样检查
import random
random.seed(3)
for e in random.sample(bank, 30):
    print(f"  band{e['band']} {e['en']:<16} {e['ph']:<22} {e['cn']}")

json.dump(bank, open(BASE + "/.workbuddy/kebiao_bank.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=0)
print("bank json 写入完成")

# 5) 质量扫描：释义必须以标准词性开头
POS_OK = re.compile(r"^(n|v|adj|adv|prep|pron|int|art|num|conj|aux)\.")
suspect = [e for e in bank if not POS_OK.match(e["cn"])]
print("释义缺词性标头:", len(suspect))
for e in suspect:
    print(f"  {e['en']:<16} {e['cn']}")

# 6) 导出全量审查文件
with open(BASE + "/.workbuddy/kebiao_bank_review.txt", "w", encoding="utf-8") as f:
    for e in bank:
        f.write(f"{e['en']}\t{e['ph']}\t{e['cn']}\n")
print("review 文件写入完成")

# -*- coding: utf-8 -*-
"""校验全部教材词库：id 唯一、结构闭合、单元连续、同年级无重复英文、单词必有音标。

支持文件：
  - src/data/curriculum.ts      （人教，mk 六参）
  - src/data/grades4to9.ts      （人教 4-9 年级，mk 六参）
  - src/data/waiyanshe.ts       （外研社，mk("wy", ...) 七参）
  - src/data/oxford.ts          （沪教牛津，mk("ox", ...) 七参）
"""
import io, re, sys
from collections import Counter, defaultdict

FILES = [
    "src/data/curriculum.ts",
    "src/data/grades4to9.ts",
    "src/data/waiyanshe.ts",
    "src/data/oxford.ts",
]

# 版本 -> 期望词条数
EXPECTED = {
    "renjiao": 1060,
    "waiyanshe": 960,
    "oxford": 960,
}

s = "\n".join(io.open(f, encoding="utf-8").read() for f in FILES)

# 1. 括号配平
for a, b in [("{", "}"), ("[", "]"), ("(", ")")]:
    if s.count(a) != s.count(b):
        print(f"括号不平衡: {a}={s.count(a)} {b}={s.count(b)}")
        sys.exit(1)
print("括号配平 OK")

# 2. 提取 mk 调用（六参人教 / 七参带前缀版本）
pat6 = re.compile(r'mk\(\s*(\d+),\s*(\d+),\s*"(\w+)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)"\)')
pat7 = re.compile(r'mk\(\s*"([a-z]+)",\s*(\d+),\s*(\d+),\s*"(\w+)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)"\)')

entries = []  # (version, prefix, grade, unit, type, english, phonetic, chinese)
for m in pat6.finditer(s):
    g, u, t, en, ph, zh = m.groups()
    entries.append(("renjiao", "", g, u, t, en, ph, zh))
for m in pat7.finditer(s):
    prefix, g, u, t, en, ph, zh = m.groups()
    version = "waiyanshe" if prefix == "wy" else "oxford"
    entries.append((version, prefix, g, u, t, en, ph, zh))

print(f"mk 调用总数: {len(entries)}")
for ver, n in sorted(Counter(e[0] for e in entries).items()):
    exp = EXPECTED[ver]
    flag = "OK" if n == exp else f"!! 期望 {exp}"
    print(f"  {ver}: {n} 条 -> {flag}")

# 3. 异常条目：空英文 / 单词无音标 / id 唯一性
# 模拟运行时 id 生成：renjiao 全局递增（mk），wy/ox 各自独立递增（mkWithPrefix）
ids = set()
dup_ids = []
problems = []
seqs = {"renjiao": 0, "wy": 0, "ox": 0}
for ver, prefix, g, u, t, en, ph, zh in entries:
    key = prefix if prefix else "renjiao"
    seqs[key] += 1
    if prefix:
        pid = f"{prefix}-g{g}u{u}e{seqs[key]:04d}"
    else:
        pid = f"g{g}u{u}e{seqs[key]:04d}"
    if pid in ids:
        dup_ids.append(pid)
    ids.add(pid)
    if not en.strip():
        problems.append(("empty-english", ver, g, u))
    if not ph.strip() and t == "word":
        problems.append(("word-no-phonetic", ver, en, g, u))

if dup_ids:
    print(f"!! 重复 id: {dup_ids[:10]}")
else:
    print("id 唯一性 OK")

if problems:
    print("!! 异常条目:")
    for d in problems:
        print("   ", d)
    sys.exit(1)
print("无异常条目（空英文/单词缺音标）")

# 4. 分版本：单元组合、单元号连续性、同年级重复英文
for ver in ("renjiao", "waiyanshe", "oxford"):
    sub = [e for e in entries if e[0] == ver]
    combos = Counter((e[2], e[3]) for e in sub)
    print(f"\n=== {ver} ===")
    print(f"单元组合数: {len(combos)}")
    by_grade = defaultdict(list)
    for (g, u), n in combos.items():
        by_grade[g].append((u, n))
    ok_all = True
    for g in sorted(by_grade, key=int):
        units = sorted(by_grade[g], key=lambda x: int(x[0]))
        nums = [int(u) for u, _ in units]
        expect = list(range(1, len(units) + 1))
        status = "OK" if nums == expect else f"!! 不连续 {nums}"
        if status != "OK":
            ok_all = False
        total = sum(n for _, n in units)
        print(f"  grade {g}: {len(units)} 单元, {total} 条 -> {status}")
    # 同年级重复英文（english 在元组第 5 位）
    for g in sorted(by_grade, key=int):
        words = [e[5].lower() for e in sub if e[2] == g]
        dups = [w for w, c in Counter(words).items() if c > 1]
        if dups:
            ok_all = False
            print(f"  grade {g} 内重复词: {dups}")
    if not ok_all:
        sys.exit(1)

print("\n全部检查完成 ✓")

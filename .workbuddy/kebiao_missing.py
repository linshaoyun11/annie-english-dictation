# -*- coding: utf-8 -*-
"""比对课标1600词表与三个教材词库，输出各版本缺失词（按二级/初中分档）"""
import re, io, sys, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = r"C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27"
sys.path.insert(0, BASE + "/.workbuddy")

# 复用上一步的词表定义
import importlib.util
spec = importlib.util.spec_from_file_location("kc", BASE + "/.workbuddy/kebiao_compare.py")

# 直接 exec 拿变量
src = open(BASE + "/.workbuddy/kebiao_compare.py", encoding="utf-8").read()
ns = {}
exec(src.split("print(")[0], ns)
l2 = ns["l2"]; full = ns["full"]; seen = ns["seen"]

# 补上缺失的二级词 + 清理美式重复
extra_l2 = ["all","bear","dog","feel","hurt","interesting","may","move","or","ping-pong","sing","week","worry"]
for w in extra_l2:
    l2.add(w)
    if w not in seen:
        seen.add(w); full.append(w)
for dup in ["neighbor","favorite"]:
    if dup in seen:
        seen.discard(dup); full.remove(dup)

print("最终课标词表总数:", len(full), " 二级:", len(l2))

def read_entries(files):
    text = ""
    for f in files:
        text += open(BASE + "/" + f, encoding="utf-8").read() + "\n"
    re_ent = re.compile(r'mk\((?:"[a-z]+",\s*)?(\d+),\s*(\d+),\s*"(word|phrase|sentence)",\s*"([^"]*)"')
    out = []
    for m in re_ent.finditer(text):
        g = int(m.group(1))
        en = m.group(4).lower().strip()
        out.append((g, en))
    return out

def key(en):
    return re.sub(r"[^a-z' -]", "", en.lower()).strip()

versions = {
    "renjiao": read_entries(["src/data/curriculum.ts", "src/data/grades4to9.ts"]),
    "waiyanshe": read_entries(["src/data/waiyanshe.ts"]),
    "oxford": read_entries(["src/data/oxford.ts"]),
}

result = {}
for name, ents in versions.items():
    existing = set(key(e[1]) for e in ents)
    # 单词型词条集合（短语/句子不算，但拆词后可比对，这里简单用整串比对 + 单词集合）
    # 对课标每个词判断是否已存在（容差：去掉空格连字符后比对）
    def has(w):
        if key(w) in existing: return True
        k2 = key(w).replace(" ", "").replace("-", "")
        for e in existing:
            if e.replace(" ", "").replace("-", "") == k2:
                return True
        return False
    missing_l2 = sorted([w for w in full if w in l2 and not has(w)])
    missing_mid = sorted([w for w in full if w not in l2 and not has(w)])
    result[name] = {"l2": missing_l2, "mid": missing_mid}
    print(f"\n[{name}] 总词条 {len(ents)}  去重后已覆盖课标词: "
          f"{len([w for w in full if has(w)])}/{len(full)}")
    print(f"  缺二级(小学): {len(missing_l2)}  缺初中: {len(missing_mid)}")

json.dump(result, open(BASE + "/.workbuddy/kebiao_missing.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("\n已写入 .workbuddy/kebiao_missing.json")

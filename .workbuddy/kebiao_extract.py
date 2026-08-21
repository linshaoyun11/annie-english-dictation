# -*- coding: utf-8 -*-
"""从 ECDICT stardict 提取课标词表音标+释义，生成 kebiaoBank.ts 词条数据"""
import struct, re, io, sys, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = r"C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27"
SD = r"C:/Users/huawei/AppData/Local/Temp/ecdict/stardict-ecdict-2.4.2/stardict-ecdict-2.4.2"

# 1) 载入课标词表（复用前面的定义）
src = open(BASE + "/.workbuddy/kebiao_compare.py", encoding="utf-8").read()
ns = {}
exec(src.split("print(")[0], ns)
l2 = ns["l2"]; full = ns["full"]; seen = ns["seen"]
extra_l2 = ["all","bear","dog","feel","hurt","interesting","may","move","or","ping-pong","sing","week","worry"]
for w in extra_l2:
    l2.add(w)
    if w not in seen:
        seen.add(w); full.append(w)
for dup in ["neighbor","favorite"]:
    if dup in seen:
        seen.discard(dup); full.remove(dup)
print("课标词表:", len(full), "词；二级:", len(l2))

# 2) 解析 stardict idx，找目标词偏移
targets = {w.lower(): w for w in full}
found = {}  # lower -> (offset, size)
idx = open(SD + ".idx", "rb").read()
pos, n = 0, len(idx)
while pos < n:
    z = idx.index(b"\x00", pos)
    word = idx[pos:z].decode("utf-8", "replace")
    low = word.lower()
    if low in targets and low not in found:
        off, size = struct.unpack(">II", idx[z+1:z+9])
        found[low] = (off, size)
    pos = z + 9
print("idx 中命中:", len(found), "/", len(targets))

# 3) 读释义
dictf = open(SD + ".dict", "rb")

def clean_translation(lines):
    """取第一条含词性标注的中文释义，最多2个义项，总长<=28字"""
    for ln in lines:
        ln = ln.strip()
        if not ln or ln.startswith("[网络]") or ln.startswith("[地名]") or ln.startswith("[人名]"):
            continue
        # 形如 "n. 苹果" / "vt. 接受" / "na. 一"
        if re.match(r"^[a-z]{1,4}\.", ln):
            parts = re.split(r"[;；]", ln, maxsplit=2)[:2]
            out = "；".join(p.strip() for p in parts if p.strip())
            if len(out) > 28:
                out = re.split(r"[；;]", out)[0].strip()
            return out
        if re.search(r"[\u4e00-\u9fff]", ln):
            # 无词性前缀但有中文，取第一义项
            first = re.split(r"[；;]", ln)[0].strip()
            return first[:24]
    return ""

results, missing = {}, []
for low, orig in sorted(targets.items()):
    if low not in found:
        missing.append(orig); continue
    off, size = found[low]
    dictf.seek(off)
    data = dictf.read(size).decode("utf-8", "replace")
    lines = [l for l in data.split("\n") if l.strip()]
    ph = ""
    if lines and lines[0].startswith("*["):
        ph = lines[0][2:].rstrip("]").strip()
        lines = lines[1:]
    cn = clean_translation(lines)
    if not cn:
        missing.append(orig); continue
    results[orig] = {"ph": ph, "cn": cn}
print("提取成功:", len(results), " 失败:", len(missing))
print("失败清单:", missing)
json.dump({"results": results, "missing": missing},
          open(BASE + "/.workbuddy/kebiao_extract.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

# 4) 抽样打印检查
import random
random.seed(7)
for w in random.sample(list(results), 25):
    r = results[w]
    print(f"  {w:<14} /{r['ph']}/  {r['cn']}")

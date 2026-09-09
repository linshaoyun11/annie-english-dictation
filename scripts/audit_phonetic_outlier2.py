#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音标少数派检测 v2（消噪版）。

改进：
  1. 只取第一个 /.../ 段，忽略 "; /.../" 双音标与 "(pl. deer)" 补充说明
  2. 归一化英美的 (r) 差异：/ɑːr/ -> /ɑː/、/ɜːr/ -> /ɜː/ 等
  3. 再比较音素骨架
"""
import re
import pathlib
import collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"

STR = r'"((?:[^"\\]|\\.)*)"'
PAT_PLAIN = re.compile(r"\bmk\(\s*(\d+)\s*,\s*(\d+)\s*,\s*" + STR + r"\s*,\s*" + STR + r"\s*,\s*" + STR + r"\s*,\s*" + STR + r"\s*\)")
PAT_PREFIX = re.compile(r"\bmk\(\s*" + STR + r"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*" + STR + r"\s*,\s*" + STR + r"\s*,\s*" + STR + r"\s*,\s*" + STR + r"\s*\)")

# 英音 -> 通用（去掉美音专属的 r 色彩）
R_PATTERNS = ["ɑːr", "ɜːr", "ɔːr", "ɪər", "eər", "ʊər", "ər", "ːr"]


def normalize(ph: str) -> str:
    """取第一个 /.../ 段并归一化英美差异"""
    m = re.search(r"/([^/]+)/", ph or "")
    core = m.group(1) if m else (ph or "")
    for p in R_PATTERNS:
        core = core.replace(p, p.replace("r", ""))
    # 去重音符号、长音符号、分音节空格
    core = core.replace("ˈ", "").replace("ˌ", "").replace("ː", "").replace(" ", "")
    return core


def skeleton(ph: str) -> str:
    return "".join(ch for ch in normalize(ph) if ch.isalpha())


entries = collections.defaultdict(list)
for fp in sorted(DATA.glob("*.ts")):
    s = fp.read_text(encoding="utf-8")
    for m in PAT_PLAIN.finditer(s):
        g, u, typ, eng, ph, cn = m.groups()
        entries[eng.strip().lower()].append((fp.name, int(g), int(u), typ, ph, cn))
    for m in PAT_PREFIX.finditer(s):
        pre, g, u, typ, eng, ph, cn = m.groups()
        entries[eng.strip().lower()].append((f"{fp.name}[{pre}]", int(g), int(u), typ, ph, cn))

total = sum(len(v) for v in entries.values())
print(f"entry 总数 {total} · 唯一 english {len(entries)}")

suspects = []
for eng, lst in entries.items():
    with_ph = [x for x in lst if skeleton(x[4])]
    if len(with_ph) < 2:
        continue
    sk_count = collections.Counter(skeleton(x[4]) for x in with_ph)
    main_sk, main_n = sk_count.most_common(1)[0]
    for fn, g, u, typ, ph, cn in with_ph:
        sk = skeleton(ph)
        if sk == main_sk:
            continue
        first_diff = (sk[0] != main_sk[0]) if (sk and main_sk) else False
        lr = len(sk) / len(main_sk) if main_sk else 1
        len_diff = lr < 0.4 or lr > 2.5
        if first_diff or len_diff:
            suspects.append((eng, fn, g, u, typ, ph, cn, main_sk, main_n, len(with_ph), sk))

suspects.sort(key=lambda r: r[0])
print(f"\n=== 音标少数派（消噪后）: {len(suspects)} 条 ===\n")
for eng, fn, g, u, typ, ph, cn, main_sk, main_n, n, sk in suspects:
    print(f"{eng!r:22s} {fn:20s} G{g}U{u} {typ:8s}")
    print(f"    本条: {ph!r:30s} -> {sk}")
    print(f"    主流: {main_sk}  ({main_n}/{n} 条)   释义: {cn!r}")
    print()
if not suspects:
    print("（无）")

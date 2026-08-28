# -*- coding: utf-8 -*-
"""统计多义项覆盖率（按分号或多词性判定）"""
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

pat_mk = re.compile(
    r'mk(?:WithPrefix)?\(\s*"[^"]*"\s*,\s*\d+\s*,\s*\d+\s*,\s*"\w+"\s*,'
    r'\s*"([^"]+)"\s*,\s*"[^"]*"\s*,\s*"([^"]+)"\s*\)'
)
pat_mk2 = re.compile(
    r'mk\(\s*\d+\s*,\s*\d+\s*,\s*"\w+"\s*,\s*"([^"]+)"\s*,\s*"[^"]*"\s*,\s*"([^"]+)"\s*\)'
)
pat_bank = re.compile(r'\{\s*en:\s*"([^"]+)"\s*,\s*ph:\s*"[^"]*"\s*,\s*cn:\s*"([^"]+)"')

POS = ("n.", "v.", "adj.", "adv.", "prep.", "conj.", "pron.", "aux.", "int.", "num.", "art.")

words = {}
for f in ["waiyanshe.ts", "oxford.ts", "grades4to9.ts", "curriculum.ts"]:
    src = open(f, encoding="utf-8").read()
    for m in pat_mk.finditer(src):
        words.setdefault(m.group(1).lower(), set()).add(m.group(2))
    for m in pat_mk2.finditer(src):
        words.setdefault(m.group(1).lower(), set()).add(m.group(2))
src = open("kebiaoBank.ts", encoding="utf-8").read()
for m in pat_bank.finditer(src):
    words.setdefault(m.group(1).lower(), set()).add(m.group(2))

multi = 0
single = []
for w, cns in words.items():
    if any(("；" in c) or (sum(c.count(p) for p in POS) > 1) for c in cns):
        multi += 1
    else:
        single.append(w)

print("唯一词条:", len(words))
print("多义项词条(；或多词性):", multi)
print("仍单义:", len(single))
print("样例仍单义词:", sorted(single)[:40])

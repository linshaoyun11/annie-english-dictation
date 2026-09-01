# -*- coding: utf-8 -*-
"""导出全部单义项词条（word 类型）及其当前释义，供编写补齐词典用"""
import re
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")

pat_mk = re.compile(
    r'mk(?:WithPrefix)?\(\s*"[^"]*"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*"(\w+)"\s*,'
    r'\s*"([^"]+)"\s*,\s*"[^"]*"\s*,\s*"([^"]+)"\s*\)'
)
pat_mk2 = re.compile(
    r'mk\(\s*(\d+)\s*,\s*(\d+)\s*,\s*"(\w+)"\s*,\s*"([^"]+)"\s*,\s*"[^"]*"\s*,\s*"([^"]+)"\s*\)'
)
pat_bank = re.compile(r'\{\s*en:\s*"([^"]+)"\s*,\s*ph:\s*"[^"]*"\s*,\s*cn:\s*"([^"]+)"')
pat_obj = re.compile(r'en:\s*"([^"]+)"\s*,\s*ph:\s*"[^"]*"\s*,\s*cn:\s*"([^"]+)"')

words = defaultdict(set)
kinds = {}

for f in ["waiyanshe.ts", "oxford.ts", "grades4to9.ts", "curriculum.ts"]:
    src = open(f, encoding="utf-8").read()
    for m in pat_mk.finditer(src):
        if m.group(3) == "word":
            words[m.group(4).lower()].add(m.group(5))
    for m in pat_mk2.finditer(src):
        if m.group(3) == "word":
            words[m.group(4).lower()].add(m.group(5))
    for m in pat_obj.finditer(src):
        words[m.group(1).lower()].add(m.group(2))

src = open("kebiaoBank.ts", encoding="utf-8").read()
for m in pat_bank.finditer(src):
    words[m.group(1).lower()].add(m.group(2))

single = {w: sorted(cns) for w, cns in words.items() if all("；" not in c for c in cns)}
out = open("single_words.txt", "w", encoding="utf-8")
for w in sorted(single):
    out.write(f"{w}\t{single[w][0]}\n")
out.close()
print("单义项 word 数:", len(single))

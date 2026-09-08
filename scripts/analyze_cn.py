# -*- coding: utf-8 -*-
"""统计各词库词条数与单释义词条数量（只读分析）"""
import re
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")

pat_mk = re.compile(
    r'mk(?:WithPrefix)?\(\s*"[^"]*"\s*,\s*\d+\s*,\s*\d+\s*,\s*"\w+"\s*,'
    r'\s*"([^"]+)"\s*,\s*"[^"]*"\s*,\s*"([^"]+)"\s*\)'
)
pat_bank = re.compile(r'\{\s*en:\s*"([^"]+)"\s*,\s*ph:\s*"[^"]*"\s*,\s*cn:\s*"([^"]+)"')
pat_obj = re.compile(r'en:\s*"([^"]+)"[^}]*?cn:\s*"([^"]+)"')

words = defaultdict(set)
total = 0
for f in ["waiyanshe.ts", "oxford.ts", "grades4to9.ts", "curriculum.ts"]:
    src = open(f, encoding="utf-8").read()
    for m in pat_mk.finditer(src):
        total += 1
        words[m.group(1).lower()].add(m.group(2))
    for m in pat_obj.finditer(src):
        total += 1
        words[m.group(1).lower()].add(m.group(2))
    # obj 模式也会命中 mk 行中不含的 en/cn 对象字面量
src = open("kebiaoBank.ts", encoding="utf-8").read()
for m in pat_bank.finditer(src):
    total += 1
    words[m.group(1).lower()].add(m.group(2))

multi = {w for w, cns in words.items() if any("；" in c for c in cns)}
print("词条总数(含重复):", total)
print("唯一词条数:", len(words))
print("已含多义项(；) 的词条:", len(multi))
print("仅单义项的词条:", len(words) - len(multi))

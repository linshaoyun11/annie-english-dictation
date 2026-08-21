# -*- coding: utf-8 -*-
"""把 kebiao_bank.json 转为 TS 字面量，替换 kebiaoBank.ts 中的占位符"""
import json, io, sys, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE = r"C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27"

bank = json.load(open(BASE + "/.workbuddy/kebiao_bank.json", encoding="utf-8"))

def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

lines = []
for e in bank:
    lines.append(
        f'  {{ en: "{esc(e["en"])}", ph: "{esc(e["ph"])}", '
        f'cn: "{esc(e["cn"])}", band: {e["band"]} }},'
    )
body = "\n".join(lines)

path = BASE + "/src/data/kebiaoBank.ts"
src = open(path, encoding="utf-8").read()
new = re.sub(
    r"/\* __BANK_WORDS__.*?\*/",
    "/* __BANK_WORDS__ 由 kebiao_gen.py 生成（1619 词，勿手改）*/\n" + body,
    src,
    count=1,
    flags=re.S,
)
open(path, "w", encoding="utf-8").write(new)
print("写入完成:", len(bank), "词条 ->", path)

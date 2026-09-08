import re, io

s = (io.open('src/data/curriculum.ts', encoding='utf-8').read()
     + "\n" + io.open('src/data/grades4to9.ts', encoding='utf-8').read())

# 统计每个年级的单元
grades = {}
for m in re.finditer(r'grade:\s*(\d+),\s*\n\s*unit:\s*(\d+),\s*\n\s*title:\s*"([^"]+)"', s):
    g = int(m.group(1))
    grades.setdefault(g, []).append((int(m.group(2)), m.group(3)))

print('=== 年级单元概览 ===')
for g in sorted(grades):
    print('年级', g, '->', len(grades[g]), '个单元', grades[g])
print('总单元数:', sum(len(v) for v in grades.values()))
print()

# 统计每个单元的条目数
blocks = re.findall(r'grade:\s*(\d+),\s*unit:\s*(\d+),\s*\n\s*title:\s*"([^"]+)",\s*entries:\s*\[(.*?)\]', s, re.S)
total_entries = 0
for g, u, t, entries in blocks:
    n = len(re.findall(r'mk\(', entries))
    total_entries += n
    print(f'g{g}u{u} {t}: {n} 条')

print()
print('总条目数:', total_entries)

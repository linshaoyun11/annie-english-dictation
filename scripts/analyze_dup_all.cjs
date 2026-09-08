// 分析人教版、沪教牛津两个教材的词条重复情况
const c = require("../.tmp-curriculum2.cjs");

function analyze(name, version) {
  const cur = c.getCurriculum(version);
  const grades = [...new Set(cur.map((u) => u.grade))].sort((a, b) => a - b);
  const all = c.getAllEntries(version);
  console.log("========================================");
  console.log(`【${name}】 单元数: ${cur.length} | 年级: ${grades.join(",")} | 词条: ${all.length}`);

  // 1) 同一单元内重复
  let intraDup = 0;
  for (const u of cur) {
    const seen = new Set();
    const dup = [];
    for (const e of u.entries) {
      const k = e.english.toLowerCase();
      if (seen.has(k)) dup.push(k);
      seen.add(k);
    }
    if (dup.length) {
      intraDup += dup.length;
      console.log(`  [单元内重复] ${u.grade}年级 U${u.unit} ${u.title}: ${dup.join(", ")}`);
    }
  }
  if (!intraDup) console.log("  单元内重复: 无");

  // 2) 跨单元重复（按年级推进视角：后面的单元再次出现前面已学过的词）
  const seenWords = new Map(); // word -> first unit label
  const crossByGrade = {};
  const crossPairs = {};
  for (const u of cur) {
    for (const e of u.entries) {
      const k = e.english.toLowerCase();
      if (seenWords.has(k)) {
        const first = seenWords.get(k);
        if (first.grade !== u.grade || first.unit !== u.unit) {
          crossByGrade[u.grade] = (crossByGrade[u.grade] || 0) + 1;
          const pk = `${first.grade}U${first.unit} -> ${u.grade}U${u.unit}`;
          if (!crossPairs[pk]) crossPairs[pk] = [];
          if (crossPairs[pk].length < 8) crossPairs[pk].push(k);
        }
      } else {
        seenWords.set(k, { grade: u.grade, unit: u.unit });
      }
    }
  }
  const crossTotal = Object.values(crossByGrade).reduce((a, b) => a + b, 0);
  console.log(`  跨单元重复词次: ${crossTotal}`);
  for (const g of Object.keys(crossByGrade).sort((a, b) => a - b)) {
    console.log(`    ${g}年级再次出现的词: ${crossByGrade[g]}`);
  }
  // 展示重复最多的配对
  const pairs = Object.entries(crossPairs).sort((a, b) => b[1].length - a[1].length).slice(0, 12);
  for (const [pk, words] of pairs) {
    console.log(`    ${pk} (${words.length}${words.length >= 8 ? "+" : ""}): ${words.join(", ")}`);
  }

  // 3) id 唯一性
  const ids = new Set(all.map((e) => e.id));
  console.log(`  词条 id 唯一: ${ids.size === all.length ? "是" : "否(" + all.length + "/" + ids.size + ")"}`);
  // 4) 空单元
  const empty = cur.filter((u) => u.entries.length === 0);
  if (empty.length) console.log(`  空单元: ${empty.map((u) => u.grade + "U" + u.unit).join(", ")}`);
}

analyze("人教版", "renjiao");
analyze("沪教牛津", "oxford");

import { CURRICULUM, WAIYANSHE_CURRICULUM, OXFORD_CURRICULUM, getAllEntries } from "../src/data/curriculum.ts";

function stats(name, curr) {
  const total = curr.reduce((s, u) => s + u.entries.length, 0);
  const kbUnits = curr.filter((u) => u.title.startsWith("课标词汇"));
  const kbWords = kbUnits.reduce((s, u) => s + u.entries.length, 0);
  const grades = [...new Set(kbUnits.map((u) => u.grade))].sort((a, b) => a - b);
  console.log(name + ": 总词条 " + total + ", 课标单元 " + kbUnits.length + " 个 / " + kbWords + " 词, 涉及年级 " + JSON.stringify(grades));
  if (kbUnits.length) {
    const u = kbUnits[0];
    console.log("  样例单元 g" + u.grade + "u" + u.unit + ' "' + u.title + '": ' + u.entries.slice(0, 3).map((e) => e.english).join(", ") + " ... (id=" + u.entries[0].id + ")");
  }
}
stats("人教", CURRICULUM);
stats("外研社", WAIYANSHE_CURRICULUM);
stats("牛津", OXFORD_CURRICULUM);

const rj = getAllEntries("renjiao");
const seen = new Map();
let dup = 0;
for (const e of rj) {
  const k = e.english.toLowerCase();
  if (seen.has(k)) dup++;
  seen.set(k, e.id);
}
console.log("人教去重检查: 总 " + rj.length + ", 重复 " + dup);

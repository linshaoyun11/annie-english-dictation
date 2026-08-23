// 临时诊断脚本：对比外研社词库各单元词条集合是否重复
const fs = require("fs");
const path = require("path");

const t = fs.readFileSync(
  path.join(__dirname, "..", "src", "data", "waiyanshe.ts"),
  "utf8"
);

// 提取每个 mk("wy", grade, unit, "type", "english", ...) 调用
const re = /mk\("wy",\s*(\d+),\s*(\d+),\s*"(\w+)",\s*"((?:[^"\\]|\\.)*)"/g;
const units = new Map();
let m;
while ((m = re.exec(t))) {
  const key = `g${m[1]}-u${m[2]}`;
  if (!units.has(key)) units.set(key, []);
  units.get(key).push(m[4].toLowerCase());
}

const keys = [...units.keys()];
let dupFound = false;
for (let i = 0; i < keys.length; i++) {
  for (let j = i + 1; j < keys.length; j++) {
    const a = new Set(units.get(keys[i]));
    const b = units.get(keys[j]);
    const overlap = b.filter((w) => a.has(w)).length;
    if (overlap === b.length && b.length > 0) {
      console.log(`完全重复: ${keys[i]} 与 ${keys[j]}（${b.length} 词全部相同）`);
      dupFound = true;
    } else if (overlap >= 6) {
      console.log(`高度重叠(${overlap}/${b.length}): ${keys[i]} vs ${keys[j]}`);
    }
  }
}
if (!dupFound) console.log("（无完全重复的单元）");
console.log(`单元总数: ${keys.length}`);

console.log("\n--- 一年级 vs 三年级 前 5 单元词表 ---");
for (const k of ["g1-u1", "g1-u2", "g1-u3", "g1-u4", "g1-u5", "g3-u1", "g3-u2", "g3-u3", "g3-u4"]) {
  console.log(`g${k}: ${(units.get(k) || []).join(", ")}`);
}

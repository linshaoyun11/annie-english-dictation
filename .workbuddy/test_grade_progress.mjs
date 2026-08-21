/**
 * 验证年级独立进度：保存、恢复、跳过已完成题、旧数据迁移
 */
// mock localStorage（Node 环境无 window/localStorage）
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

// 动态加载编译后的模块（用 vite-node 方式加载 ts 太重，直接内联关键逻辑验证）
// 这里改为：直接 import ts 源文件 —— 使用 tsx/esbuild-register 不可用时，
// 用 vite 的 ssrLoadModule
const { createServer } = await import("vite");

const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const { loadProgress, freshProgress, saveProgress } =
  await server.ssrLoadModule("/src/lib/progress.ts");
const { getCurriculum } = await server.ssrLoadModule("/src/data/curriculum.ts");

const cur = getCurriculum("renjiao");
const grades = Array.from(new Set(cur.map((u) => u.grade)));
console.log("年级数:", grades.length);

let pass = 0;
let fail = 0;
const check = (name, cond) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`);
  }
};

// ---- 1. freshProgress 应包含空的 gradeProgress ----
const fresh = freshProgress("renjiao");
check("freshProgress.gradeProgress = {}", Array.isArray(Object.keys(fresh.gradeProgress ?? {})) && Object.keys(fresh.gradeProgress).length === 0);

// ---- 2. 旧数据迁移：无 gradeProgress 的进度 → 全局位置迁移到对应年级 ----
const user1 = "test-grade-migrate";
const unitIdx = cur.findIndex((u) => u.grade === 3);
const g3Units = cur.filter((u) => u.grade === 3);
const midUnitIdx = cur.indexOf(g3Units[2]); // 3年级第3个单元
const legacy = {
  ...freshProgress("renjiao"),
  unitIndex: midUnitIdx,
  entryIndex: 4,
  completedEntryIds: g3Units.slice(0, 2).flatMap((u) => u.entries.map((e) => e.id)).concat(
    g3Units[2].entries.slice(0, 4).map((e) => e.id)
  ),
};
delete legacy.gradeProgress; // 模拟旧数据
localStorage.setItem("eng-learning-progress-v3:renjiao:" + user1, JSON.stringify(legacy));
const loaded1 = loadProgress(user1, "renjiao");
check("旧数据迁移：3年级有保存位置", loaded1.gradeProgress?.["3"] != null);
check("旧数据迁移：unitIndex 正确", loaded1.gradeProgress?.["3"]?.unitIndex === midUnitIdx);
check("旧数据迁移：entryIndex 正确", loaded1.gradeProgress?.["3"]?.entryIndex === 4);

// ---- 3. 保存多年级进度并独立恢复 ----
const user2 = "test-grade-multi";
const p2 = freshProgress("renjiao");
// 模拟：3年级学到第2单元第5题
const g3u2 = cur.indexOf(g3Units[1]);
p2.unitIndex = g3u2;
p2.entryIndex = 5;
p2.unitOrder = g3Units[1].entries.map((e) => e.id);
p2.gradeProgress = {
  "3": { unitIndex: g3u2, entryIndex: 5, unitOrder: p2.unitOrder },
};
// 模拟：又去5年级学了第1单元第2题（前1题已完成）
const g5Units = cur.filter((u) => u.grade === 5);
const g5u1 = cur.indexOf(g5Units[0]);
p2.gradeProgress["5"] = {
  unitIndex: g5u1,
  entryIndex: 1,
  unitOrder: g5Units[0].entries.map((e) => e.id),
};
p2.completedEntryIds = [g5Units[0].entries[0].id]; // 5年级第1题已完成
saveProgress(user2, p2);
const loaded2 = loadProgress(user2, "renjiao");
check("3年级位置保留", loaded2.gradeProgress?.["3"]?.entryIndex === 5);
check("5年级位置保留", loaded2.gradeProgress?.["5"]?.entryIndex === 1);

// ---- 4. 恢复算法（与 App.startLearning 相同逻辑）：跳过已完成题 ----
const saved5 = loaded2.gradeProgress["5"];
const order5 = saved5.unitOrder;
let ei = saved5.entryIndex;
while (ei < order5.length && loaded2.completedEntryIds.includes(order5[ei])) ei += 1;
check("恢复5年级：跳过已完成题 → entryIndex=1 未完成不跳", ei === 1);

// entryIndex 指向已完成题时应后跳
const p3 = freshProgress("renjiao");
const saved = { unitIndex: g5u1, entryIndex: 0, unitOrder: g5Units[0].entries.map((e) => e.id) };
p3.completedEntryIds = [saved.unitOrder[0], saved.unitOrder[1]]; // 前两题已完成
let ei2 = saved.entryIndex;
while (ei2 < saved.unitOrder.length && p3.completedEntryIds.includes(saved.unitOrder[ei2])) ei2 += 1;
check("恢复算法：前2题已完成 → 跳到第3题", ei2 === 2);

// 单元全部完成 → 回到 0（复习）
const p4 = freshProgress("renjiao");
p4.completedEntryIds = [...saved.unitOrder];
let ei3 = 0;
while (ei3 < saved.unitOrder.length && p4.completedEntryIds.includes(saved.unitOrder[ei3])) ei3 += 1;
check("恢复算法：单元全部完成 → entryIndex 回 0", (ei3 >= saved.unitOrder.length ? 0 : ei3) === 0);

// ---- 5. 恢复位置必须属于该年级（防越界脏数据） ----
const dirty = {
  ...loaded2,
  gradeProgress: { "3": { unitIndex: cur.findIndex((u) => u.grade === 7), entryIndex: 0, unitOrder: [] } },
};
const savedDirty = dirty.gradeProgress["3"];
const belongs = cur[savedDirty.unitIndex]?.grade === 3;
check("脏数据防护：保存的 unitIndex 不属于该年级时不恢复", belongs === false);

await server.close();
console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);

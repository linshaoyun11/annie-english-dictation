import { createServer } from "vite";

const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
});

try {
  const mod = await server.ssrLoadModule("/src/data/curriculum.ts");
  const progressMod = await server.ssrLoadModule("/src/lib/progress.ts");
  const { getCurriculum, getAllEntries } = mod;
  const { freshProgress, makeUnitOrder } = progressMod;

  const cur = getCurriculum("renjiao");
  console.log("=== 模拟学习流程测试 ===");
  console.log("总单元:", cur.length);
  console.log("总词条:", cur.reduce((s, u) => s + u.entries.length, 0));

  // 模拟完成第一个单元的所有词条
  let progress = freshProgress("renjiao");
  const unit0 = cur[0];
  const order = progress.unitOrder;
  const seenIds = new Set();
  let repeated = false;

  console.log("\n单元0:", unit0.grade, unit0.unit, unit0.title, "词条数:", unit0.entries.length);

  for (let i = 0; i < unit0.entries.length; i++) {
    const id = order[i];
    if (seenIds.has(id)) {
      console.log("重复ID!", i, id);
      repeated = true;
      break;
    }
    seenIds.add(id);
    progress = {
      ...progress,
      completedEntryIds: [...progress.completedEntryIds, id],
      entryIndex: i,
    };
  }

  if (!repeated) {
    console.log("单元0内无重复，完成", seenIds.size, "个不同词条");
  }

  // 检查 unitOrder 是否全部来自当前单元
  const unit0Ids = new Set(unit0.entries.map((e) => e.id));
  const allFromUnit0 = order.every((id) => unit0Ids.has(id));
  console.log("unitOrder 全部属于单元0:", allFromUnit0);
  console.log("unitOrder 长度:", order.length, "单元0词条数:", unit0.entries.length);

  // 模拟进入下一单元
  const nextOrder = makeUnitOrder(1, "renjiao");
  const unit1 = cur[1];
  const unit1Ids = new Set(unit1.entries.map((e) => e.id));
  const overlap = nextOrder.filter((id) => unit0Ids.has(id));
  console.log("\n单元0->单元1 重叠词条数:", overlap.length);
  if (overlap.length) {
    const allMap = new Map(getAllEntries("renjiao").map((e) => [e.id, e]));
    console.log("重叠样例:", overlap.slice(0, 5).map((id) => {
      const e = allMap.get(id);
      return e ? e.english : id;
    }));
  }

  // 检查跨单元重复词条（同一 english 词多次出现）
  const englishCount = {};
  for (const u of cur.slice(0, 5)) {
    for (const e of u.entries) {
      englishCount[e.english] = (englishCount[e.english] || 0) + 1;
    }
  }
  const dups = Object.entries(englishCount).filter(([k, v]) => v > 1).slice(0, 10);
  console.log("\n前5个单元中重复出现的英文词（前10）:", dups);

} finally {
  await server.close();
}

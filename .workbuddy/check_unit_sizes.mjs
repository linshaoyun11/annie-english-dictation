/** 检查三教材每个单元的词条数分布：是否存在"随机取10个"或词条数>10的单元 */
const { createServer } = await import("vite");
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const { getCurriculum } = await server.ssrLoadModule("/src/data/curriculum.ts");

for (const v of ["renjiao", "waiyanshe", "oxford"]) {
  const cur = getCurriculum(v);
  const dist = {};
  let over10 = [];
  for (const u of cur) {
    const n = u.entries.length;
    dist[n] = (dist[n] || 0) + 1;
    if (n > 10) over10.push(`${u.grade}年级U${u.unit}(${u.title}):${n}`);
  }
  console.log(`\n=== ${v} === 单元数 ${cur.length}`);
  console.log("  词条数分布:", JSON.stringify(dist));
  if (over10.length) {
    console.log(`  >10词条的单元 ${over10.length} 个:`, over10.slice(0, 8).join(", "), over10.length > 8 ? "..." : "");
  } else {
    console.log("  没有 >10 词条的单元");
  }
}
await server.close();

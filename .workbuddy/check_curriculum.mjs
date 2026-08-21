import { createServer } from "vite";

const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
});

try {
  const mod = await server.ssrLoadModule("/src/data/curriculum.ts");
  const cur = mod.getCurriculum("renjiao");
  console.log("人教总单元:", cur.length);
  console.log("人教总词条:", cur.reduce((s, u) => s + u.entries.length, 0));
  const grades = [...new Set(cur.map((u) => u.grade))].sort((a, b) => a - b);
  for (const g of grades) {
    const units = cur.filter((u) => u.grade === g);
    const words = units.reduce((s, u) => s + u.entries.length, 0);
    const kebiao = units.filter((u) => u.title.startsWith("课标")).length;
    console.log(`  年级${g}: 单元${units.length} (课标${kebiao}) 词${words}`);
  }
} finally {
  await server.close();
}

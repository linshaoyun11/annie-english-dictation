/**
 * 仁爱 10 个漏播词在其他教材里出现情况
 */
import { readFileSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";
import { existsSync, unlinkSync } from "node:fs";

const TMP = ".tmp-gaps.mjs";
await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
process.on("exit", () => { if (existsSync(TMP)) unlinkSync(TMP); });
const m = await import(`../${TMP}`);
const CUR = m.CURRICULA;

const norm = (s) =>
  s.trim().toLowerCase()
    .replace(/[\s\u2019\u2018']/g, "")
    .replace(/[.,!?;\-()"]/g, "");

const gaps = [
  { id: "ra-g8u21e1648", text: "superstorm" },
  { id: "ra-g9u29e2014", text: "self-driving" },
  { id: "ra-g9u29e2024", text: "the Asia-Pacific area" },
  { id: "ra-g9u31e2139", text: "world-famous" },
  { id: "ra-g9u35e2268", text: "would rather ... than ..." },
  { id: "ra-g9u36e2302", text: "in one's view" },
];

for (const g of gaps) {
  const k = norm(g.text);
  const inOther = [];
  for (const [v, units] of Object.entries(CUR)) {
    if (v === "renai") continue;
    for (const u of units) for (const e of u.entries) {
      if (norm(e.english) === k) inOther.push({ v, id: e.id, text: e.english });
    }
  }
  console.log(g.id.padEnd(14), JSON.stringify(g.text).padEnd(32), "其他教材出现:", inOther.length, inOther.length ? inOther.slice(0, 3) : "");
}

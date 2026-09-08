/**
 * 真正的跨教材音频共享分析：
 * 1. 从 src/data/*.ts 提取每条教材的 (prefix, g, u, n, text) 元组
 * 2. 找出**词条原文**在两本教材中都出现的词
 * 3. 列出哪些仁爱音频可以被其他教材的同名音频覆盖
 */
import { readFileSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { build as rolldownBuild } from "rolldown";
import { existsSync, unlinkSync } from "node:fs";

const AUDIO = "public/audio";
const MAX = 60_000, MIN = 1_000;
const PREF = { "": 0, "g": 0, "wy": 1, "ox": 2, "ra": 3 };

// 用 rolldown 转一道再 import，直接从求值后的 CURRICULA 取
const TMP = ".tmp-curricula.mjs";
await rolldownBuild({
  input: ["src/data/curriculum.ts"],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
process.on("exit", () => { if (existsSync(TMP)) unlinkSync(TMP); });

const m = await import(`../${TMP}`);
const CURRICULA = m.CURRICULA;

const LABEL = {
  renjiao: "g (人教一起)",
  renjiao3: "g (人教三起)",
  waiyanshe: "wy (外研一起)",
  waiyanshe3: "wy (外研三起)",
  oxford: "ox (牛津)",
  renai: "ra (仁爱)",
};

// 每教材线：text → {id, size, ok} （以 us manifest 为准）
const usMan = JSON.parse(readFileSync(AUDIO + "/manifest.json", "utf8"));
const norm = (s) => s.trim().toLowerCase().replace(/[\s\u2019\u2018']/g, "").replace(/[.,!?;:\-()"]/g, "").replace(/[、。！？；：（）【】《》「」]/g, "");

// 同一词可能映射到多个 id（不同教材），所以重建 manifest
const textToAllIds = new Map();
for (const [k, v] of Object.entries(usMan)) {
  if (!textToAllIds.has(k)) textToAllIds.set(k, []);
  textToAllIds.get(k).push(v);
}

const audioHealth = new Map();
for (const f of readdirSync(AUDIO)) {
  if (!f.endsWith(".mp3")) continue;
  const m = f.match(/^(.+?)(-uk)?\.mp3$/);
  if (!m) continue;
  audioHealth.set(m[1] + (m[2] ?? ""), {
    size: statSync(AUDIO + "/" + f).size,
    ok: statSync(AUDIO + "/" + f).size >= MIN && statSync(AUDIO + "/" + f).size <= MAX,
  });
}

// 对每个仁爱 entry，按 norm(text) 找所有其他教材同名条目
const renai = CURRICULA.renai;
let raWithSibling = 0, raNoSibling = 0, raTextInOther = 0;
const reusableList = [];
const noSiblingList = [];

for (const unit of renai) {
  for (const e of unit.entries) {
    const k = norm(e.english);
    if (!k) { raNoSibling++; continue; }
    // 在其他线里找同 norm 词
    const sibs = [];
    for (const [v, units] of Object.entries(CURRICULA)) {
      if (v === "renai") continue;
      for (const u of units) {
        for (const x of u.entries) {
          if (norm(x.english) === k) {
            sibs.push({ version: v, id: x.id, text: x.english });
          }
        }
      }
    }
    if (sibs.length === 0) {
      raNoSibling++;
      if (noSiblingList.length < 30) noSiblingList.push({ id: e.id, text: e.english });
      continue;
    }
    raTextInOther++;
    // 看是否真有该 id 的健康音频
    const candidates = [];
    for (const s of sibs) {
      const usKey = s.id;
      const h = audioHealth.get(usKey);
      if (h?.ok) candidates.push({ ...s, usSize: h.size });
    }
    if (candidates.length === 0) {
      raNoSibling++;
      continue;
    }
    // 选首选源（人教一起 > 人教三起 > 外研一起 > 外研三起 > 牛津）
    const order = ["renjiao3", "renjiao", "waiyanshe3", "waiyanshe", "oxford"];
    candidates.sort((a, b) => order.indexOf(a.version) - order.indexOf(b.version));
    const best = candidates[0];
    // 仁爱当前的音频
    const raUs = audioHealth.get(e.id + "");
    const raUk = audioHealth.get(e.id + "-uk");
    reusableList.push({
      raId: e.id, raText: e.english, raUsOk: raUs?.ok, raUsSize: raUs?.size,
      raUkOk: raUk?.ok, raUkSize: raUk?.size,
      bestSrcId: best.id, bestSrcVersion: best.version, bestSrcSize: best.usSize,
    });
    raWithSibling++;
  }
}

console.log("=== 仁爱 2388 条的跨教材同名分析 ===");
console.log("  其他教材里有同原文（norm 后）:", raTextInOther);
console.log("  其中有健康音频可借:", raWithSibling);
console.log("  仍需自补:", raNoSibling);

console.log(`\n=== 可借清单（按 size 差异降序） === ${reusableList.length}`);
// 优先列出仁爱端 >60KB 或 <1KB 的（异常）
const filtered = reusableList.filter(r => (r.raUsSize > MAX || (r.raUsSize ?? 0) < MIN || r.raUkSize > MAX || (r.raUkSize ?? 0) < MIN));
console.log(`其中仁爱端异常（>${MAX} 或 <${MIN}）: ${filtered.length}`);
for (const r of filtered) {
  console.log(`  ${r.raId.padEnd(14)} (${r.raText.padEnd(30)}) ra:us=${r.raUsSize??'缺失'}/uk=${r.raUkSize??'缺失'} ← ${r.bestSrcVersion}:${r.bestSrcId}(${r.bestSrcSize}B)`);
}

/**
 * audit_waiyanshe_gaps.mjs — 外研三起 G7-G9 音频缺口审计
 *
 * 从 App 端播放路径（manifest.get(text.toLowerCase()) → id → mp3）出发，
 * 统计外研三起 G7-G9 各文本的真实缺口，区分四类：
 *   - skip-ok: 已有合格 mp3（断点续传场景）
 *   - reuse:   manifest 命中其他教材 id 且文件合格（跨教材共用，0 网络请求）
 *   - need-gen: manifest 未命中 或 命中但文件不合格（须有道/Edge 生成）
 *   - missing-file: manifest 命中但文件不在磁盘上
 *
 * 这是 G7-G9 音频生成的真理脚本，每次动完数据/音频跑一次。
 */
import { readFileSync, existsSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";

const MIN_BYTES = 1000;
const MAX_BYTES = 60000;
const ROOT = process.cwd();
const TMP = join(ROOT, ".tmp-audit.mjs");

await build({
  input: [join(ROOT, "src/data/curriculum.ts")],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
const m = await import(pathToFileURL(TMP).href);
unlinkSync(TMP);

const us = JSON.parse(readFileSync(join(ROOT, "public/audio/manifest.json"), "utf8"));
const uk = JSON.parse(readFileSync(join(ROOT, "public/audio/manifest-uk.json"), "utf8"));

const wy3 = m.CURRICULA.waiyanshe3.filter((u) => u.grade >= 7 && u.grade <= 9);

// 按 text 去重：审计每个 unique text 是否有可用 mp3
// 注：App 端命中 = manifest.get(text) → id → mp3 合格
// 我们只需要看 manId 对应的 mp3 合格即可，无论 manId 是哪个教材的 id
const uniqueTexts = new Set();
for (const u of wy3)
  for (const e of u.entries) {
    uniqueTexts.add(e.english.trim().toLowerCase());
  }
const wyTexts = [...uniqueTexts];
console.log(
  `外研三起 G7-G9 词条 ${wy3.reduce((s, u) => s + u.entries.length, 0)} 条 / 去重文本 ${
    wyTexts.length
  } 个\n`
);

function classify(text, variant) {
  // 美音 key = 原小写文本；英音 key = 去标点小写
  const lookupKey =
    variant === "us" ? text : text.replace(/[^a-z ]/g, "").trim();
  const manId = variant === "us" ? us[lookupKey] : uk[lookupKey];
  if (!manId) return { cat: "need-gen", reason: "no-manifest-hit" };

  const suf = variant === "us" ? "" : "-uk";
  const f = join(ROOT, `public/audio/${manId}${suf}.mp3`);
  if (!existsSync(f))
    return { cat: "need-gen", reason: "manifest-hit-but-file-missing" };

  const sz = statSync(f).size;
  if (sz < MIN_BYTES || sz > MAX_BYTES)
    return { cat: "need-gen", reason: `bad-size ${sz}B` };

  return { cat: "ok", reason: `id=${manId}` };
}

function report(variant, label) {
  let cnt = { ok: 0, "need-gen": 0 };
  const need = [];
  for (const t of wyTexts) {
    const r = classify(t, variant);
    cnt[r.cat]++;
    if (r.cat === "need-gen") need.push({ text: t, ...r });
  }
  console.log(`===== ${label} =====`);
  console.log(`  ok       (manifest 命中 + 文件合格) : ${cnt["ok"]}`);
  console.log(`  need-gen (须有道/Edge 补齐)         : ${cnt["need-gen"]}`);
  console.log(
    `  App 端播放覆盖                      : ${((cnt["ok"] / wyTexts.length) * 100).toFixed(
      1
    )}%`
  );

  // 按 reason 细分
  const byReason = {};
  for (const n of need)
    byReason[n.reason] = (byReason[n.reason] || 0) + 1;
  console.log(`  need-gen 细分：`);
  for (const [k, v] of Object.entries(byReason).sort((a, b) => b[1] - a[1]))
    console.log(`    ${k.padEnd(35)} ${v}`);

  console.log(`  前 10 个 need-gen:`);
  for (const n of need.slice(0, 10)) {
    console.log(`    «${n.text}»  ${n.reason}`);
  }
  console.log("");
  return need;
}

const needUS = report("us", "美音 (manifest.json)");
const needUK = report("uk", "英音 (manifest-uk.json)");

console.log(`===== 总结 =====`);
console.log(`  美音须新生成 ${needUS.length} 条 → 期望 mp3 ${needUS.length} 个`);
console.log(`  英音须新生成 ${needUK.length} 条 → 期望 mp3 ${needUK.length} 个`);
console.log(
  `  合计 ${needUS.length + needUK.length} 个文件（每个 text 可能需美音+英音两个）`
);

/**
 * fix_waiyanshe_manifest.mjs — 给「已生成但 manifest 未写入」的 wy-id 文件补 manifest 键
 *
 * 用 App 端播放路径（manifest.get(text) → id → file）视角：
 * - 解析 waiyanshe.ts 所有 mk("wy",...) 调用得到 (id, english) 配对
 * - 对每对：若 id 对应 mp3 存在且合格，但 manifest.json 中 english 还没键 → 写入
 *
 * 用法：node scripts/fix_waiyanshe_manifest.mjs
 */
import { readFileSync, writeFileSync, existsSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";

const MIN_BYTES = 1000;
const MAX_BYTES = 60000;
const ROOT = process.cwd();
const TMP = join(ROOT, ".tmp-fix.mjs");

await build({
  input: [join(ROOT, "src/data/curriculum.ts")],
  output: { file: TMP, format: "esm" },
  logLevel: "silent",
});
const m = await import(pathToFileURL(TMP).href);
unlinkSync(TMP);

const manUs = JSON.parse(readFileSync(join(ROOT, "public/audio/manifest.json"), "utf8"));
const manUk = JSON.parse(readFileSync(join(ROOT, "public/audio/manifest-uk.json"), "utf8"));

// 扫所有外研 line（一起 + 三起）的全部 entry（waiyanshe 三起 = 一起 G3+，所以二选一即可）
const wyAll = [...m.CURRICULA.waiyanshe, ...m.CURRICULA.waiyanshe3];

function isGood(p) {
  if (!existsSync(p)) return false;
  const sz = statSync(p).size;
  return MIN_BYTES <= sz && sz <= MAX_BYTES;
}

// 按 text 分组：每个 unique text 挑一个代表 id（文件都合规者优先）
const textRep = new Map();
for (const u of wyAll) {
  for (const e of u.entries) {
    const text = e.english.trim().toLowerCase();  // 保留标点（与 App lookup 一致）
    const id = e.id;
    const fileUs = join(ROOT, `public/audio/${id}.mp3`);
    const fileUk = join(ROOT, `public/audio/${id}-uk.mp3`);

    if (!textRep.has(text)) {
      textRep.set(text, { id, fileUs, fileUk });
    } else {
      const cur = textRep.get(text);
      const curOK = isGood(cur.fileUs) || isGood(cur.fileUk);
      const newOK = isGood(fileUs) || isGood(fileUk);
      if (newOK && !curOK) textRep.set(text, { id, fileUs, fileUk });
    }
  }
}

let addUs = 0, addUk = 0;
let missingUs = 0, missingUk = 0;

for (const [text, rep] of textRep) {
  // 美音：key = 原小写（保留标点，与 App lookup 一致）
  if (!manUs[text]) {
    if (isGood(rep.fileUs)) {
      manUs[text] = rep.id;
      addUs++;
    } else if (existsSync(rep.fileUs)) {
      missingUs++;
    }
  }
  // 英音：key = 原小写（与美音一致）
  if (!manUk[text]) {
    if (isGood(rep.fileUk)) {
      manUk[text] = rep.id;
      addUk++;
    } else if (existsSync(rep.fileUk)) {
      missingUk++;
    }
  }
}

writeFileSync(
  join(ROOT, "public/audio/manifest.json"),
  JSON.stringify(manUs),
  "utf8"
);
writeFileSync(
  join(ROOT, "public/audio/manifest-uk.json"),
  JSON.stringify(manUk),
  "utf8"
);

console.log(`美音：新增 manifest 映射 ${addUs} 条，文件不合格 ${missingUs} 条`);
console.log(`英音：新增 manifest 映射 ${addUk} 条，文件不合格 ${missingUk} 条`);
console.log(`manifest 键数：美音 ${Object.keys(manUs).length} / 英音 ${Object.keys(manUk).length}`);

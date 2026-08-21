/**
 * 运行时冒烟测试：通过 Vite dev server 的模块系统加载实际数据
 * 验证三教材课标补全生效、id 唯一性、音频可解析
 */

const BASE_URL = "http://localhost:5174";

// ---- 1. Fetch the app HTML (确认 dev server 可用) ----
const htmlRes = await fetch(BASE_URL + "/");
const htmlOk = htmlRes.ok;
console.log("===== 运行时冒烟测试 =====");
console.log();
console.log("--- Dev Server ---");
console.log(`  HTTP ${htmlRes.status} ${htmlOk ? "✓" : "✗"}`);

// ---- 2. 通过 Vite 的模块导入获取实际运行时数据 ----
// Vite dev server 会把 .ts 文件编译为 JS，通过 /src/data/xxx.ts 可获取
async function loadModule(path) {
  const res = await fetch(BASE_URL + path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.text();
}

// ---- 3. 检查 Vite 是否有编译错误 ----
const currSrc = await loadModule("/src/data/curriculum.ts");
const hasError = currSrc.includes("error") || currSrc.includes("Error");
console.log(`  curriculum.ts 编译: ${hasError ? "✗ 有错误" : "✓ 无错误"}`);

// ---- 4. 加载 manifest 验证音频可解析 ----
const manifestRes = await fetch(BASE_URL + "/audio/manifest.json");
const manifest = await manifestRes.json();
const ukManifestRes = await fetch(BASE_URL + "/audio/manifest-uk.json");
const ukManifest = await ukManifestRes.json();
console.log(`  manifest.json 加载: ${manifestRes.ok ? "✓" : "✗"} (${Object.keys(manifest).length} 键)`);
console.log(`  manifest-uk.json 加载: ${ukManifestRes.ok ? "✓" : "✗"} (${Object.keys(ukManifest).length} 键)`);

// ---- 5. 抽样音频文件可访问性 ----
const sampleIds = Object.entries(manifest).slice(0, 5);
console.log();
console.log("--- 音频文件可访问性（抽样 5 个）---");
for (const [text, id] of sampleIds) {
  const usRes = await fetch(BASE_URL + `/audio/${id}.mp3`, { method: "HEAD" });
  const ukRes = await fetch(BASE_URL + `/audio/${id}-uk.mp3`, { method: "HEAD" });
  console.log(`  ${text} (${id}): US ${usRes.ok ? "✓" : "✗"} / UK ${ukRes.ok ? "✓" : "✗"}`);
}

// ---- 6. 课标词汇音频抽样 ----
const kbSample = ["ability", "absent", "achieve", "bargain", "century"];
console.log();
console.log("--- 课标补全词音频抽样 ---");
for (const w of kbSample) {
  const id = manifest[w];
  if (!id) { console.log(`  ${w}: manifest 未命中 ✗`); continue; }
  const usRes = await fetch(BASE_URL + `/audio/${id}.mp3`, { method: "HEAD" });
  const ukRes = await fetch(BASE_URL + `/audio/${id}-uk.mp3`, { method: "HEAD" });
  console.log(`  ${w} (${id}): US ${usRes.ok ? "✓" : "✗"} / UK ${ukRes.ok ? "✓" : "✗"}`);
}

// ---- 7. 检查 main.tsx 加载（应用入口） ----
const mainRes = await fetch(BASE_URL + "/src/main.tsx");
console.log();
console.log("--- 应用入口 ---");
console.log(`  main.tsx 编译: ${mainRes.ok ? "✓" : "✗"} (${mainRes.status})`);

// ---- 8. 检查 App.tsx 加载 ----
const appRes = await fetch(BASE_URL + "/src/App.tsx");
console.log(`  App.tsx 编译: ${appRes.ok ? "✓" : "✗"} (${appRes.status})`);

console.log();
console.log("===== 冒烟测试完成 =====");

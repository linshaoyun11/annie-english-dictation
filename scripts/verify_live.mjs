#!/usr/bin/env node
// 上线核验：查 App 在 App Store 的真实状态（无需登录 ASC，走公开的 iTunes API）
//
// 用途：每次发版后跑一次，把三件容易混为一谈的事分开验 ——
//       ① 过审（ASC 里状态变了）≠ ② 已上架（商店里查得到、下得动）
//       ≠ ③ 能被搜到（进了 Apple 的搜索索引，且排名能被人看见）
//       版本页显示 Ready for Sale 之后，②③ 都还要各自等一段时间。
//
// 用法：
//   node scripts/verify_live.mjs                  # 默认查中国区
//   node scripts/verify_live.mjs us cn jp         # 指定多个地区
//   node scripts/verify_live.mjs --expect 1.0.1   # 断言线上版本，不符则退出码 1
//   node scripts/verify_live.mjs --search 英语听写  # 额外测通用词的收录与排名
//
// 能查到什么 / 查不到什么：
//   ✅ 是否已上架、版本号、上架时间、价格、类目、内容分级、描述全文、
//      截图张数与文件名、支持语言、最低系统、包体积、**搜索索引是否已收录**
//   ❌ build 号（CFBundleVersion）——Apple 不通过任何公开接口暴露，只能在 ASC 里看
//   ❌ 副标题 —— 该接口**根本不返回 subtitle 字段**（实测 lookup / lookup+lang / search
//      三种调法都是 undefined，不是空字符串）。⚠️ 所以「这里查不到」**绝不等于**
//      「线上副标题为空」—— 曾据此误判过一次。要确认副标题只能看 ASC → App 信息。
//      推广同理：任何字段拿到 undefined，都只能记"无法核验"，不能记成"线上为空"。
//
// ⚠️ 搜索索引一节的意义：App 上架当时的实测是 —— 8 个地区 lookup 都能查到（可下载），
//    但连搜全名「安妮英语听写」的返回都是 0 个结果 ⇒ 已可下载、尚未被收录。
//    这是正常现象，不是故障：品牌全名一般 24 小时内入索引，通用词排名要 2-4 周
//    （且**每次改元数据都会重置索引窗口**）。这期间用 trackViewUrl 直达即可。

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";

// 从 Apple 的缩略图 URL 里取回原始文件名。
// URL 形如 .../v4/9b/03/c2/<uuid>/05-select.png/320x480bb.jpg
// 倒数第二段才是上传时的文件名，最后一段是 Apple 生成的缩略图规格。
const shotName = (url) => url.split("/").filter(Boolean).slice(-2)[0];

const BUNDLE_ID = "com.annie.dictation";
const APP_NAME = "安妮英语听写";

// ---------- 参数 ----------
const argv = process.argv.slice(2);
let expect = null;
const regions = [];
const extraTerms = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--expect") expect = argv[++i];
  else if (argv[i] === "--search") extraTerms.push(argv[++i]);
  else if (!argv[i].startsWith("-")) regions.push(argv[i]);
}
if (regions.length === 0) regions.push("cn");

// ---------- 拉数据 ----------
// 用 curl 而不是 fetch：本机是 Windows + 可能走代理，curl 更能反映用户实际网络
function curlJson(url) {
  const out = execFileSync("curl", ["-s", "--compressed", "--max-time", "20", url], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(out);
}

function lookup(country) {
  const j = curlJson(`https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}&country=${country}`);
  return j.resultCount > 0 ? j.results[0] : null;
}

// 搜索接口与 lookup 是**两套索引**：lookup 按 bundleId 直查（上架即可用），
// search 走 Apple 的关键词索引（要额外花时间建立）。所以两者结论不一致是正常的。
function searchTerm(term, country, limit = 50) {
  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}` +
    `&country=${country}&entity=software&limit=${limit}`;
  return curlJson(url);
}

function ts(iso) {
  if (!iso) return "(无)";
  return new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) + " (北京)";
}

// ---------- 逐区输出 ----------
let failed = false;
let firstRegion = null;
const seen = new Map(); // 用第一个有数据的地区做详细核对

for (const region of regions) {
  let r;
  try {
    r = lookup(region);
  } catch (e) {
    console.log(`\n【${region.toUpperCase()}】查询失败：${e.message}`);
    failed = true;
    continue;
  }

  console.log(`\n${"=".repeat(64)}`);
  if (!r) {
    console.log(`【${region.toUpperCase()}】未查到 —— 尚未上架 / 尚未同步 / 不在该地区销售`);
    failed = true;
    continue;
  }
  console.log(`【${region.toUpperCase()}】已上架`);
  console.log(`${"=".repeat(64)}`);
  console.log(`  App ID       ${r.trackId}`);
  console.log(`  名称         ${r.trackName}`);
  // ⚠️ 踩过的坑：iTunes API **不返回** subtitle 字段（实测 lookup / lookup+lang /
  //    search 三种调法都是 undefined，不是空字符串）。所以「这里查不到」**绝不能**
  //    推断成「线上副标题为空」—— 要确认副标题只能看 ASC 的「App 信息」页。
  console.log(`  副标题       ${r.subtitle ?? "(该接口不返回此字段 · 无法核验，只能看 ASC → App 信息)"}`);
  console.log(`  版本         ${r.version}`);
  console.log(`  上架时间     ${ts(r.releaseDate)}`);
  console.log(`  本版发布     ${ts(r.currentVersionReleaseDate)}`);
  console.log(`  更新说明     ${r.releaseNotes ? JSON.stringify(r.releaseNotes.slice(0, 60)) : "(空 · 首版无此字段)"}`);
  console.log(`  类目         ${r.primaryGenreName}${r.genres?.length > 1 ? " > " + r.genres.slice(1).join(" > ") : ""}`);
  console.log(`  内容分级     ${r.contentAdvisoryRating}`);
  console.log(`  价格         ${r.formattedPrice ?? r.price} ${r.currency ?? ""}`);
  console.log(`  开发者       ${r.sellerName}`);
  console.log(`  营销 URL     ${r.sellerUrl || "(空 · 可选)"}`);
  console.log(`  最低系统     iOS ${r.minimumOsVersion}`);
  console.log(`  支持语言     ${(r.languageCodesISO2A || []).join(", ") || "(未返回)"}`);
  console.log(`  包体积       ${(r.fileSizeBytes / 1048576).toFixed(1)} MB` +
    ((r.fileSizeBytes / 1048576) > 200 ? "  ⚠️ 超过 200MB —— 部分用户蜂窝网络下无法直接下载" : ""));
  console.log(`  商店链接     ${r.trackViewUrl}`);

  // 截图核对：与本地 appstore-screenshots/ 的产出对比
  const shots = r.screenshotUrls || [];
  console.log(`\n  iPhone 截图  ${shots.length} 张`);
  shots.forEach((u, i) => console.log(`    ${i + 1}. ${shotName(u)}`));
  const ipad = r.ipadScreenshotUrls || [];
  console.log(`  iPad   截图  ${ipad.length} 张`);

  // 本地应有几张？能读到就直接比
  const localDir = `appstore-screenshots/${process.env.SHOT_SET || "iphone-6.5"}`;
  if (existsSync(localDir) && shots.length) {
    const local = readdirSync(localDir).filter((f) => f.endsWith(".png")).sort();
    const online = new Set(shots.map(shotName));
    const missing = local.filter((f) => !online.has(f));
    console.log(`\n  本地 ${localDir} 有 ${local.length} 张`);
    if (missing.length) {
      console.log(`  ⚠️  线上缺 ${missing.length} 张：${missing.join(", ")}`);
      failed = true;
    } else {
      console.log(`  ✅ 线上张数与本地一致`);
    }
  }

  console.log(`\n  描述 ${(r.description || "").length} 字符（上限 4000）`);
  if (expect && r.version !== expect) {
    console.log(`\n  ❌ 版本不符：期望 ${expect}，线上是 ${r.version}`);
    failed = true;
  } else if (expect) {
    console.log(`\n  ✅ 版本符合预期：${r.version}`);
  }

  if (!firstRegion) firstRegion = region;
  if (!seen.has("first")) seen.set("first", r);
}

// ---------- 搜索索引（第三件事：能不能被搜到）----------
if (firstRegion) {
  const terms = [APP_NAME, ...extraTerms];
  console.log(`\n${"=".repeat(64)}`);
  console.log(`【${firstRegion.toUpperCase()}】搜索索引（与"已上架"是两套索引，需各自等待）`);
  console.log(`${"=".repeat(64)}`);

  for (const term of terms) {
    let j;
    try {
      j = searchTerm(term, firstRegion);
    } catch (e) {
      console.log(`  「${term}」查询失败：${e.message}`);
      continue;
    }
    const idx = (j.results || []).findIndex((x) => x.bundleId === BUNDLE_ID);
    if (idx >= 0) {
      console.log(`  「${term}」  ✅ 已收录 —— 第 ${idx + 1} / ${j.resultCount} 位`);
    } else {
      console.log(`  「${term}」  ❌ 未收录（返回 ${j.resultCount} 个结果，前 50 名里没有本 App）`);
    }
  }

  console.log("");
  console.log("  说明：搜不到全名属正常现象，不是故障 —— 上架当时实测就是这样。");
  console.log("        ① 索引建立：品牌全名通常 24 小时内可搜到；");
  console.log("        ② 通用词排名：新 App 无下载量 / 无评分，通常要 2-4 周才有人看得见的排名；");
  console.log("        ③ ⚠️ **每次改元数据（名称 / 副标题 / 关键词）都会重置索引窗口** ⇒ 攒一起改。");
  console.log("        此期间用上面的「商店链接」直达即可，链接不受搜索索引影响。");
}

console.log(`\n${"-".repeat(64)}`);
console.log("提示：build 号（CFBundleVersion）任何公开接口都查不到，");
console.log("      要确认线上是哪个包，只能看 ASC → 该版本 → 构建版本。");
if (expect) console.log(failed ? "\n结论：存在不符项（见上）" : "\n结论：全部符合预期");

process.exit(failed && expect ? 1 : 0);

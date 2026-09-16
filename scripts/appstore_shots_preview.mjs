// 生成 App Store 截图的评审预览页（base64 内嵌，双击即看，不依赖服务器）
//
//   node scripts/appstore_shots_preview.mjs
//
// 环境变量：
//   SHOTS_DIR=<dir>   源目录，默认 appstore-screenshots
//   SHOTS_OUTHTML=<f> 输出 HTML，默认 .workbuddy/preview/appstore-screenshots.html
//
// 用途：交付前让用户一页扫完 16 张 + 逐张尺寸/色彩/体积校验表。
// 会读同目录的 capture.log 判断这批是「裸截图」还是带外观层的版本，直接标在页头上，
// 免得两版混在一起时看不出手上这份是哪版。
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync, existsSync } from "node:fs";

const CWD = "C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27";
const ROOT = process.env.SHOTS_DIR || `${CWD}/appstore-screenshots`;
const OUT =
  process.env.SHOTS_OUTHTML || `${CWD}/.workbuddy/preview/appstore-screenshots.html`;

const DEVICES = [
  {
    dir: "iphone-6.5",
    title: "iPhone 6.5 英寸",
    expect: "1284 × 2778",
    asc: "ASC「iPhone 6.5 英寸显示屏」槽位（接受 1242×2688 / 1284×2778）",
  },
  {
    dir: "ipad-13",
    title: "iPad 13 英寸",
    expect: "2064 × 2752",
    asc: "ASC「iPad」槽位（接受 2064×2752 / 2048×2732）",
  },
];

const LABELS = {
  "01-home": "首页（当前学习 + 按年级开始）",
  "02-learn": "听写页（自绘 A–Z 键盘）",
  "03-learn-reveal": "查看提示（音标 + 释义）",
  "04-difficult": "重点记忆列表",
  "05-select": "用户选择页（多角色）",
  "06-register": "创建角色页（自绘数字键盘）",
  "07-leaderboard": "排行榜",
  "08-settings": "设置页（吸顶顶栏，六条教材线）",
};

const pngSize = (buf) => `${buf.readUInt32BE(16)} × ${buf.readUInt32BE(20)}`;
const colorType = (buf) =>
  buf[25] === 2 ? "RGB（无 alpha）✅" : buf[25] === 6 ? "RGBA ⚠️" : `type=${buf[25]}`;

/** capture.log 里每套设备那行会写「裸截图（默认）」或「外观层 · 状态栏 …」 */
function detectVariant() {
  const log = `${ROOT}/capture.log`;
  if (!existsSync(log)) return { label: "未知（缺 capture.log）", hint: "" };
  const txt = readFileSync(log, "utf8");
  if (/外观层 · 状态栏/.test(txt))
    return {
      label: "真机外观层版（状态栏 / 刘海 / 手势条 + 安全区）",
      hint: "由 SHOTS_CHROME=1 生成",
    };
  if (/安全区 \d+\/\d+/.test(txt))
    return { label: "安全区修正版（无系统 UI）", hint: "由 SHOTS_INSETS=1 生成" };
  return { label: "裸截图（默认）", hint: "无系统 UI、无安全区修正" };
}

const variant = detectVariant();
const sections = [];
const rows = [];

for (const dev of DEVICES) {
  const dh = `${ROOT}/${dev.dir}`;
  if (!existsSync(dh)) {
    console.error(`❌ 缺目录 ${dh} —— 先跑 bash scripts/appstore_shots_run.sh`);
    process.exit(1);
  }
  const files = readdirSync(dh)
    .filter((f) => f.endsWith(".png"))
    .sort();
  const cards = files.map((f) => {
    const buf = readFileSync(`${dh}/${f}`);
    const key = f.replace(/^\d+-/, "").replace(/\.png$/, "");
    const label = LABELS[key] || key;
    rows.push({
      dev: dev.title,
      file: f,
      size: pngSize(buf),
      type: colorType(buf),
      kb: (buf.length / 1024).toFixed(0),
    });
    return `<figure>
  <img src="data:image/png;base64,${buf.toString("base64")}" alt="${f}" />
  <figcaption><b>${f}</b><br><span>${label}</span><br><span class="dim">${pngSize(buf)}</span></figcaption>
</figure>`;
  });
  sections.push(`<section>
  <h2>${dev.title} <span class="dim">— 期望 ${dev.expect}</span></h2>
  <p class="dim">${dev.asc}</p>
  <div class="grid">${cards.join("\n")}</div>
</section>`);
}

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>App Store 截图 · 评审</title>
<style>
  :root{--bg:#f5f5f8;--card:#fff;--text:#1c1b22;--dim:#6b6a78;--line:#e3e2ea;--accent:#534ab7}
  *{box-sizing:border-box}
  body{margin:0;padding:28px;background:var(--bg);color:var(--text);
       font:14px/1.6 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
  h1{font-size:22px;margin:0 0 6px}
  h2{font-size:16px;margin:0 0 4px}
  .dim{color:var(--dim);font-weight:400}
  .lead{color:var(--dim);margin:0 0 14px}
  .variant{display:inline-block;background:#eeedf5;color:var(--accent);border-radius:999px;
           padding:3px 12px;font-size:12.5px;font-weight:600;margin:0 0 20px}
  section{margin:0 0 38px}
  .grid{display:flex;gap:16px;overflow-x:auto;padding:14px 0 6px}
  figure{margin:0;flex:0 0 auto;width:210px;background:var(--card);border:1px solid var(--line);
         border-radius:14px;padding:10px;box-shadow:0 1px 3px rgba(28,27,34,.06)}
  figure img{width:100%;height:auto;display:block;border-radius:8px;border:1px solid var(--line)}
  figcaption{margin-top:8px;font-size:11.5px;line-height:1.5;word-break:break-all}
  figcaption b{color:var(--accent)}
  table{border-collapse:collapse;width:100%;background:var(--card);border-radius:12px;overflow:hidden;
        box-shadow:0 1px 3px rgba(28,27,34,.06);font-size:12.5px}
  th,td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--line)}
  th{background:#eeedf5;font-weight:600}
  tr:last-child td{border-bottom:none}
  code{background:#eeedf5;padding:1px 5px;border-radius:4px;font-size:12px}
  .note{background:#fff;border-left:3px solid var(--accent);border-radius:0 10px 10px 0;
        padding:12px 16px;margin:18px 0}
  .note ul{margin:6px 0 0;padding-left:20px}
</style></head><body>
<h1>App Store 截图 · 提交前评审</h1>
<p class="lead">共 ${rows.length} 张 / ${DEVICES.length} 套，抓取自当前开发版本。</p>
<p class="variant">本批：${variant.label}${variant.hint ? `　·　${variant.hint}` : ""}</p>

<div class="note">
  <b>ASC 上传须知</b>
  <ul>
    <li>每套 <b>3–10 张</b>，这里各 8 张；文件名前缀 <code>01…08</code> 就是建议的上传顺序（前 3 张最显眼）。</li>
    <li>PNG/JPG、<b>不能带 alpha 通道</b>、单张 ≤10MB —— 下面表格里逐张核过。</li>
    <li>iPhone 那套填「iPhone 6.5 英寸显示屏」槽位；iPad 那套填 iPad 槽位（App 支持 iPad 时必填）。</li>
  </ul>
</div>

${sections.join("\n")}

<section>
  <h2>逐张校验</h2>
  <table><thead><tr><th>套</th><th>文件</th><th>像素</th><th>色彩</th><th>体积</th></tr></thead>
  <tbody>
  ${rows
    .map(
      (r) =>
        `<tr><td>${r.dev}</td><td>${r.file}</td><td><b>${r.size}</b></td><td>${r.type}</td><td>${r.kb} KB</td></tr>`
    )
    .join("\n  ")}
  </tbody></table>
</section>

<section>
  <h2>重新生成</h2>
  <pre><code>npx vite --port 5180 --strictPort     # 另开终端
bash scripts/appstore_shots_run.sh    # 输出到 appstore-screenshots/</code></pre>
  <p class="dim">改了 UI 就要重跑，否则会踩「截图与 App 实际不符」这条退回理由。</p>
</section>
</body></html>`;

mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
writeFileSync(OUT, html, "utf8");
console.log("本批版本:", variant.label);
console.log("输出:", OUT, (statSync(OUT).size / 1024 / 1024).toFixed(2) + "MB");

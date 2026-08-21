/**
 * DOM 深检：元素内部文本溢出 + 元素重叠检测
 * 运行：node .workbuddy/layout_deep_test.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync, appendFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const puppeteer = require("C:/Users/huawei/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = "http://localhost:5173/";
const OUT_DIR = "C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27/.workbuddy/screenshots";
const LOG_FILE = "C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27/.workbuddy/layout_deep.log";
mkdirSync(OUT_DIR, { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  appendFileSync(LOG_FILE, line + "\n");
  process.stdout.write(line + "\n");
}

const USERS = [{
  id: "u-test", avatarId: "dog", password: "1234", points: 66, learnedCount: 12,
  createdAt: Date.now(), config: { curriculum: "waiyanshe", accent: "uk", autoNext: false },
}];
const PROGRESS = {
  curriculumVersion: 7, version: "waiyanshe", unitIndex: 0, entryIndex: 3,
  unitOrder: ["e-0-0", "e-0-1", "e-0-2", "e-0-3", "e-0-4"],
  completedEntryIds: ["e-0-0", "e-0-1", "e-0-2"], difficultEntryIds: ["e-0-4"],
  errorCounts: { "e-0-4": 2 }, lastLearnedAt: Date.now(),
  unitStartedAt: { "3-1": Date.now() }, mistakeEntryIds: ["e-0-4"], celebratedUnits: [],
  gradeProgress: { "3": { unitIndex: 0, entryIndex: 3, unitOrder: ["e-0-0", "e-0-1", "e-0-2", "e-0-3", "e-0-4"] } },
};

const VIEWPORTS = [
  { name: "moto-360x640", width: 360, height: 640, dpr: 2.75 },
  { name: "iphone14-390x844", width: 390, height: 844, dpr: 3 },
  { name: "ipad-768x1024", width: 768, height: 1024, dpr: 2 },
  { name: "desktop-1280x800", width: 1280, height: 800, dpr: 1 },
];

// 深度检测：元素文本溢出 + 兄弟元素重叠
async function deepCheck(page) {
  return page.evaluate(() => {
    const issues = [];
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const cls = (el) => {
      const c = el.className;
      return String(c && c.baseVal !== undefined ? c.baseVal : c || "").slice(0, 70);
    };

    // A) 文本/内容溢出容器（scrollWidth > clientWidth 且无横向滚动能力）
    const els = document.querySelectorAll("body *");
    for (const el of els) {
      if (!visible(el)) continue;
      const sw = el.scrollWidth, cw = el.clientWidth;
      if (sw > cw + 2) {
        const st = window.getComputedStyle(el);
        // overflow-x: auto/scroll 的容器允许滚动，不算错；hidden 会裁剪属于潜在问题
        if (st.overflowX === "auto" || st.overflowX === "scroll") continue;
        const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
        issues.push({ type: "text-overflow", tag: el.tagName, cls: cls(el), overflowX: st.overflowX, sw, cw, text });
      }
    }

    // B) 重叠检测：互为兄弟的可见元素矩形相交（跳过 flex/grid 正常换行场景的误报，
    //    只标记相交面积 > 小面积元素 30% 的情况）
    const siblings = new Map();
    for (const el of els) {
      if (!visible(el) || el.children.length === 0) continue;
      const kids = Array.from(el.children).filter(visible);
      for (let i = 0; i < kids.length; i++) {
        for (let j = i + 1; j < kids.length; j++) {
          const a = kids[i].getBoundingClientRect();
          const b = kids[j].getBoundingClientRect();
          const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          const area = ix * iy;
          if (area === 0) continue;
          const minArea = Math.min(a.width * a.height, b.width * b.height);
          if (minArea === 0) continue;
          if (area / minArea > 0.3) {
            const ai = kids[i], bi = kids[j];
            // 跳过常规嵌套结构：absolutely positioned 徽章/装饰与 fixed 遮罩
            const aPos = window.getComputedStyle(ai).position;
            const bPos = window.getComputedStyle(bi).position;
            if (aPos === "absolute" || bPos === "absolute") continue;
            if (aPos === "fixed" || bPos === "fixed") continue;
            // 跳过 progress bar 与父容器背景的正常覆盖
            issues.push({
              type: "overlap",
              a: `${ai.tagName}.${cls(ai)}`,
              b: `${bi.tagName}.${cls(bi)}`,
              ratio: Math.round((area / minArea) * 100) + "%",
            });
          }
        }
      }
    }
    return issues.slice(0, 25);
  });
}

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  log(`\n===== ${vp.name} (${vp.width}×${vp.height}) =====`);
  try {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr });
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.evaluate(([u, p]) => {
      localStorage.setItem("eng-learning-users-v1", JSON.stringify([u]));
      localStorage.setItem(`eng-learning-progress-v3:${p.version}:${u.id}`, JSON.stringify(p));
    }, [USERS[0], PROGRESS]);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 500));

    // 登录
    const av = await page.$("button.group");
    if (av) {
      await av.click().catch(() => {});
      await new Promise((r) => setTimeout(r, 400));
      await page.keyboard.type("1234", { delay: 40 });
      await new Promise((r) => setTimeout(r, 900));
    }

    // home 深检
    let issues = await deepCheck(page);
    log(`[home] 发现问题 ${issues.length} 个`);
    for (const i of issues) log("   " + JSON.stringify(i));

    // 进学习页
    const cards = await page.$$("button");
    for (const c of cards) {
      const t = await c.evaluate((el) => el.textContent || "");
      if (t.includes("个单元")) { await c.click().catch(() => {}); break; }
    }
    await new Promise((r) => setTimeout(r, 1600));
    issues = await deepCheck(page);
    log(`[learn] 发现问题 ${issues.length} 个`);
    for (const i of issues) log("   " + JSON.stringify(i));

    // 揭示态
    await page.keyboard.press("Space");
    await new Promise((r) => setTimeout(r, 700));
    issues = await deepCheck(page);
    log(`[learn-reveal] 发现问题 ${issues.length} 个`);
    for (const i of issues) log("   " + JSON.stringify(i));
  } catch (e) {
    log("  异常: " + (e.message || e).slice(0, 120));
  }
  await page.close().catch(() => {});
}
await browser.close();
log("\n完成");

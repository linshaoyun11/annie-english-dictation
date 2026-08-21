/**
 * 祝贺页 + 答题流程布局专项验证
 * 用真实词库数据：预置"单元最后一题"状态 → 进入学习页 → 答对 → 祝贺页弹出 → 深检布局
 * 运行：node .workbuddy/test_celebration_layout.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync, appendFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const puppeteer = require("C:/Users/huawei/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = "http://localhost:5173/";
const OUT_DIR = "C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27/.workbuddy/screenshots";
const LOG_FILE = "C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27/.workbuddy/celebration_layout.log";
mkdirSync(OUT_DIR, { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  appendFileSync(LOG_FILE, line + "\n");
  process.stdout.write(line + "\n");
}

// 1) 用 vite SSR 拿外研社第一单元真实词条
const { createServer } = await import("vite");
const server = await createServer({
  root: "C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27",
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
const { WAIYANSHE_CURRICULUM } = await server.ssrLoadModule("/src/data/waiyanshe.ts");
const cur = WAIYANSHE_CURRICULUM;
const unit = cur[0];
const entries = unit.entries;
log(`单元0: ${unit.title} 共 ${entries.length} 词，首词="${entries[0].english}" 末词="${entries[entries.length - 1].english}"`);
await server.close();

// 2) 预置 progress：把首词（hello，无空格）排到最后，其余词全部已完成
const first = entries[0];
const rest = entries.slice(1);
const orderedIds = [...rest.map((e) => e.id), first.id]; // 最后一题 = hello
const doneIds = rest.map((e) => e.id);
const USERS = [{
  id: "u-test", avatarId: "dog", password: "1234", points: 66, learnedCount: 12,
  createdAt: Date.now(), config: { curriculum: "waiyanshe", accent: "uk", autoNext: false },
}];
function makeProgress() {
  return {
    curriculumVersion: 7, version: "waiyanshe", unitIndex: 0, entryIndex: orderedIds.length - 1,
    unitOrder: orderedIds,
    completedEntryIds: doneIds,
    difficultEntryIds: [], errorCounts: {}, lastLearnedAt: Date.now(),
    unitStartedAt: { "3-1": Date.now() }, mistakeEntryIds: [], celebratedUnits: [],
    gradeProgress: { "1": { unitIndex: 0, entryIndex: orderedIds.length - 1, unitOrder: orderedIds } },
  };
}

// 3) 深检
async function deepCheck(page) {
  return page.evaluate(() => {
    const issues = [];
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const cls = (el) => { const c = el.className; return String(c && c.baseVal !== undefined ? c.baseVal : c || "").slice(0, 70); };
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue;
      const sw = el.scrollWidth, cw = el.clientWidth;
      if (sw > cw + 2) {
        const st = window.getComputedStyle(el);
        if (st.overflowX === "auto" || st.overflowX === "scroll") continue;
        const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
        issues.push({ type: "text-overflow", tag: el.tagName, cls: cls(el), sw, cw, text });
      }
    }
    const body = document.body;
    const iw = window.innerWidth;
    return {
      overflow: document.documentElement.scrollWidth > iw + 1.5,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: iw,
      bodyHeight: body.scrollHeight,
      innerHeight: window.innerHeight,
      issues: issues.slice(0, 20),
    };
  });
}

const VIEWPORTS = [
  { name: "moto-360x640", width: 360, height: 640, dpr: 2.75 },
  { name: "iphone14-390x844", width: 390, height: 844, dpr: 3 },
];

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
    }, [USERS[0], makeProgress()]);
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

    // 进入年级卡片（点第 1 个"个单元"）→ 恢复该年级进度（最后一词）
    const cards = await page.$$("button");
    for (const c of cards) {
      const t = await c.evaluate((el) => el.textContent || "");
      if (t.includes("个单元")) { await c.click().catch(() => {}); break; }
    }
    await new Promise((r) => setTimeout(r, 1800));

    // 当前应显示最后一题（hello）。输入单词完成答题
    const lastWord = first.english;
    log(`  待输入单词: "${lastWord}"`);
    await page.keyboard.type(lastWord, { delay: 80 });
    await new Promise((r) => setTimeout(r, 1500));

    // 此时应是「回答正确」页（autoNext=false 停在正确页）
    const isCorrect = await page.evaluate(() => document.body.textContent.includes("回答正确"));
    log(`  答对状态: ${isCorrect ? "✓ 回答正确" : "✗ 未出现正确页"}`);

    // 按空格 → 单元全部完成 → 祝贺页弹出
    await page.keyboard.press("Space");
    await new Promise((r) => setTimeout(r, 1300));
    const txt2 = await page.evaluate(() => document.body.textContent.slice(0, 500).replace(/\n+/g, " "));
    const hasCelebration = /恭喜|完成|用时|继续学习/.test(txt2) && !txt2.includes("回答正确");
    log(`  祝贺页弹出: ${hasCelebration ? "✓" : "✗"}`);
    log(`  文案片段: ${txt2.slice(0, 220)}`);

    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: `${OUT_DIR}/${vp.name}-celebration.png` });
    const d = await deepCheck(page);
    log(`  横向溢出: ${d.overflow ? "❌" : "✓"} (scrollWidth=${d.scrollWidth}/${d.innerWidth})`);
    log(`  页面高度: body=${d.bodyHeight}px / 视口=${d.innerHeight}px（可滚动=${d.bodyHeight > d.innerHeight ? "是" : "否"}）`);
    log(`  文本溢出问题: ${d.issues.length} 个`);
    for (const i of d.issues) log("    " + JSON.stringify(i));

    // 再按空格继续 → 进入下一单元第一题（验证跨单元推进后布局）
    await page.keyboard.press("Space");
    await new Promise((r) => setTimeout(r, 1200));
    const d2 = await deepCheck(page);
    log(`  继续学习后: 横向溢出 ${d2.overflow ? "❌" : "✓"}，文本溢出 ${d2.issues.length} 个`);
    await page.screenshot({ path: `${OUT_DIR}/${vp.name}-after-celebration.png` });
  } catch (e) {
    log("  异常: " + (e.message || e).slice(0, 150));
  }
  await page.close().catch(() => {});
}
await browser.close();
log("\n完成");

/**
 * 多视口布局兼容性实测 v3（带 watchdog 与逐步日志）
 * 运行：node .workbuddy/layout_test.mjs > .workbuddy/layout_test.log 2>&1
 */
import { createRequire } from "node:module";
import { mkdirSync, appendFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const puppeteer = require("C:/Users/huawei/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = "http://localhost:5173/";
const OUT_DIR = "C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27/.workbuddy/screenshots";
const LOG_FILE = "C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27/.workbuddy/layout_test.log";

mkdirSync(OUT_DIR, { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  appendFileSync(LOG_FILE, line + "\n");
  process.stdout.write(line + "\n");
}

const VIEWPORTS = [
  { name: "moto-360x640", width: 360, height: 640, dpr: 2.75 },
  { name: "se-375x667", width: 375, height: 667, dpr: 2 },
  { name: "iphone14-390x844", width: 390, height: 844, dpr: 3 },
  { name: "xr-414x896", width: 414, height: 896, dpr: 2 },
  { name: "promax-428x926", width: 428, height: 926, dpr: 3 },
  { name: "ipad-768x1024", width: 768, height: 1024, dpr: 2 },
  { name: "desktop-1280x800", width: 1280, height: 800, dpr: 1 },
];

const USERS = [
  {
    id: "u-test",
    avatarId: "dog",
    password: "1234",
    points: 66,
    learnedCount: 12,
    createdAt: Date.now(),
    config: { curriculum: "waiyanshe", accent: "uk", autoNext: false },
  },
];
const PROGRESS = {
  curriculumVersion: 7,
  version: "waiyanshe",
  unitIndex: 0,
  entryIndex: 3,
  unitOrder: ["e-0-0", "e-0-1", "e-0-2", "e-0-3", "e-0-4"],
  completedEntryIds: ["e-0-0", "e-0-1", "e-0-2"],
  difficultEntryIds: ["e-0-4"],
  errorCounts: { "e-0-4": 2 },
  lastLearnedAt: Date.now(),
  unitStartedAt: { "3-1": Date.now() },
  mistakeEntryIds: ["e-0-4"],
  celebratedUnits: [],
  gradeProgress: { "3": { unitIndex: 0, entryIndex: 3, unitOrder: ["e-0-0", "e-0-1", "e-0-2", "e-0-3", "e-0-4"] } },
};

async function detectOverflow(page) {
  return page.evaluate(() => {
    const iw = window.innerWidth;
    const sw = document.documentElement.scrollWidth;
    const offenders = [];
    const els = document.querySelectorAll("body *");
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > iw + 1.5 || r.left < -1.5) {
        const st = window.getComputedStyle(el);
        if (st.position === "fixed" && r.left <= 0 && r.width >= iw * 0.98) continue;
        if (r.right - iw < 3 && r.left >= -3) continue;
        const cls = (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || "")).slice(0, 90);
        offenders.push({ tag: el.tagName, cls, right: Math.round(r.right), left: Math.round(r.left), width: Math.round(r.width) });
      }
    }
    return { iw, sw, overflow: sw > iw + 1.5, offenderCount: offenders.length, offenders: offenders.slice(0, 12) };
  });
}

async function clickLabel(page, label) {
  const el = await page.$(`[aria-label="${label}"]`);
  if (!el) return false;
  await el.click({ timeout: 4000 }).catch(() => false);
  return true;
}

async function clickText(page, text) {
  const btns = await page.$$("button");
  for (const b of btns) {
    const t = await b.evaluate((el) => el.textContent || "");
    if (t.includes(text)) { await b.click({ timeout: 4000 }).catch(() => {}); return true; }
  }
  return false;
}

async function clickSvg(page, pathFragment) {
  const btns = await page.$$("button");
  for (const b of btns) {
    const html = await b.evaluate((el) => el.outerHTML);
    if (html.includes(pathFragment)) { await b.click({ timeout: 4000 }).catch(() => {}); return true; }
  }
  return false;
}

async function waitText(page, text, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const found = await page.evaluate((t) => document.body.textContent.includes(t), text).catch(() => false);
    if (found) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

let browser;
try {
  browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
} catch (e) {
  log("浏览器启动失败: " + e.message);
  process.exit(1);
}

const results = [];

for (const vp of VIEWPORTS) {
  const lines = [`\n===== ${vp.name} (${vp.width}×${vp.height} @${vp.dpr}x) =====`];
  const page = await browser.newPage();

  // 视口级 watchdog：90 秒强制跳过
  const watchdog = setTimeout(() => {
    log(`  ⚠️ [${vp.name}] 视口超时强制跳过`);
    lines.push("  ⚠️ 视口超时");
  }, 90000);

  try {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr });
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.evaluate(
      ([u, p]) => {
        localStorage.setItem("eng-learning-users-v1", JSON.stringify([u]));
        localStorage.setItem(`eng-learning-progress-v3:${p.version}:${u.id}`, JSON.stringify(p));
      },
      [USERS[0], PROGRESS]
    );
    await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 500));

    const ovf = {};
    const shot = async (key) => {
      await new Promise((r) => setTimeout(r, 300));
      await page.screenshot({ path: `${OUT_DIR}/${vp.name}-${key}.png` });
      ovf[key] = await detectOverflow(page);
    };
    const report = (key) => {
      const o = ovf[key];
      if (!o) return `[${key}] 未截图`;
      const head = o.overflow ? `❌ 横向溢出 ${o.sw}>${o.iw}` : `✓ (scrollWidth=${o.sw})`;
      const det = o.offenderCount ? ` | 越界 ${o.offenderCount} 个: ${o.offenders.map((x) => `[${x.tag}]${x.cls}→${x.right}px`).join("; ")}` : " | 无越界";
      return `[${key}] ${head}${det}`;
    };

    // 1) 用户选择页
    await shot("select");
    lines.push(report("select"));

    // 2) 注册页
    if (await clickText(page, "新用户注册")) {
      await new Promise((r) => setTimeout(r, 400));
      if (await waitText(page, "选一个头像", 2500)) {
        await shot("register");
        lines.push(report("register"));
        await clickLabel(page, "返回");
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    // 3) 登录 → 首页
    let loggedIn = false;
    const av = await page.$("button.group");
    if (av) {
      await av.click({ timeout: 4000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 400));
      if (await waitText(page, "请输入 4 位数字密码", 2500)) {
        await page.keyboard.type("1234", { delay: 50 });
        loggedIn = await waitText(page, "按年级开始", 4000);
      }
    }
    if (loggedIn) {
      await shot("home");
      lines.push(report("home"));
    } else {
      lines.push("  ⚠️ 登录失败，跳过后续页面");
    }

    // 4) 学习页
    if (loggedIn) {
      if (await clickText(page, "个单元")) {
        await new Promise((r) => setTimeout(r, 1500));
        const inLearn = (await waitText(page, "查看提示", 4000)) || (await waitText(page, "听写", 2500));
        if (inLearn) {
          await shot("learn");
          lines.push(report("learn"));
          await page.keyboard.press("Space");
          await new Promise((r) => setTimeout(r, 600));
          await shot("learn-reveal");
          lines.push(report("learn-reveal"));
        } else {
          lines.push("  ⚠️ 学习页未打开");
        }
      }

      // 5) 退出 → 设置页
      await clickLabel(page, "返回首页");
      await new Promise((r) => setTimeout(r, 600));
      if (await clickLabel(page, "设置")) {
        await new Promise((r) => setTimeout(r, 500));
        await shot("settings");
        lines.push(report("settings"));
        await clickSvg(page, "M19 12H5");
        await new Promise((r) => setTimeout(r, 400));
      }

      // 6) 重点记忆
      if (await clickLabel(page, "重点记忆")) {
        await new Promise((r) => setTimeout(r, 500));
        await shot("difficult");
        lines.push(report("difficult"));
        await clickSvg(page, "M19 12H5");
        await new Promise((r) => setTimeout(r, 400));
      }

      // 7) 排行榜
      if (await clickLabel(page, "排行榜")) {
        await new Promise((r) => setTimeout(r, 500));
        await shot("leaderboard");
        lines.push(report("leaderboard"));
      }
    }
  } catch (e) {
    lines.push("  ❌ 异常: " + (e.message || e).slice(0, 120));
  } finally {
    clearTimeout(watchdog);
    await page.close().catch(() => {});
  }

  const text = lines.join("\n");
  log(text);
  results.push({ name: vp.name, text });
}

await browser.close();
log("\n==================== 汇总 ====================");
for (const r of results) {
  const bad = r.text.includes("❌") || r.text.includes("越界") || r.text.includes("⚠️");
  log(`${bad ? "⚠️" : "✅"} ${r.name}`);
}

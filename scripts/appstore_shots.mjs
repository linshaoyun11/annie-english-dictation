/**
 * App Store 截图生成器 —— 按 Apple 规格输出「iPhone 6.5"」与「iPad 13"」两套。
 *
 *   iPhone 6.5" : 428×926 pt @3x = 1284×2778 px   （ASC 6.5" 位接受尺寸之一）
 *   iPad 13"    : 1032×1376 pt @2x = 2064×2752 px （ASC 13" 位主推尺寸）
 *
 * 为什么这么抓：应用是 Capacitor 壳 + Web 渲染，同一份代码按「设备逻辑分辨率 × DPR」
 * 渲染即可得到与真机一致的版式，不依赖 Mac 模拟器。
 *
 * 用法：
 *   1) 另开终端跑开发服务器： npx vite --port 5180 --strictPort
 *   2) bash scripts/appstore_shots_run.sh      ← 推荐（它负责拉起无头 Edge）
 *      也可自行拉起 Edge 后： SHOTS_CDP=http://127.0.0.1:<port> node scripts/appstore_shots.mjs
 *   3) 产物在 appstore-screenshots/<device>/<序号>-<页面>.png
 *
 * 三个必须记住的坑：
 *   1. 本机 puppeteer.launch() 会让 Edge 直接崩（Code: 0），只能依附已启动的实例。
 *   2. 本项目多处交互绑在 onPointerDown/onPointerUp（自绘键盘、年级卡片），
 *      合成 element.click() 完全不生效 —— 一律用 page.mouse.click 发真实指针事件。
 *   3. 截图不参与构建；改了 UI 就要重跑（Apple 要求截图与 App 实际一致）。
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const puppeteer = require("C:/Users/huawei/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");

const BASE = process.env.SHOTS_BASE || "http://127.0.0.1:5180/";
const ROOT = "C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27/appstore-screenshots";
const PASSWORD = "1234";

const DEVICES = [
  { name: "iphone-6.5", width: 428, height: 926, dpr: 3, expect: "1284x2778" },
  { name: "ipad-13", width: 1032, height: 1376, dpr: 2, expect: "2064x2752" },
];

/** 上传到 ASC 时的展示顺序（前 3 张最重要，决定搜索结果里的第一印象） */
const ORDER = {
  home: "01",
  learn: "02",
  "learn-reveal": "03",
  difficult: "04",
  select: "05",
  register: "06",
  leaderboard: "07",
  settings: "08",
};

/* ─────────────── 页面操作小工具（全部走真实鼠标事件） ─────────────── */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitText(page, text, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const ok = await page
      .evaluate((t) => (document.body.innerText || "").includes(t), text)
      .catch(() => false);
    if (ok) return true;
    await sleep(120);
  }
  return false;
}

async function clickPoint(page, point) {
  if (!point) return false;
  await page.mouse.click(point.x, point.y);
  return true;
}

/**
 * 按文案点。取「包含该文案的面积最小的可见元素」——也就是最内层那个，
 * 真实鼠标事件会自然冒泡到外层卡片/按钮上的 onPointerDown/onClick。
 */
async function tapText(page, text, { exact = false } = {}) {
  const pt = await page.evaluate(
    ({ t, exact }) => {
      let best = null;
      let bestArea = Infinity;
      for (const el of document.querySelectorAll("body *")) {
        if (el.offsetParent === null && el.tagName !== "BODY") continue;
        const s = (el.innerText || "").trim();
        if (exact ? s !== t : !s.includes(t)) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        const area = r.width * r.height;
        if (area < bestArea) {
          bestArea = area;
          best = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return best;
    },
    { t: text, exact }
  );
  return clickPoint(page, pt);
}

/** 按 aria-label 点（首页的 IconButton 系列：重点记忆 / 排行榜 / 设置 / 返回首页 / 返回） */
async function tapLabel(page, label) {
  const pt = await page.evaluate((l) => {
    const el = document.querySelector(`[aria-label="${l}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  return clickPoint(page, pt);
}

/**
 * 回首页。各页返回键的 aria-label 不统一：
 *   学习页（LearningCard 头部）=「返回首页」；重点记忆 / 排行榜 / 设置 =「返回」。
 * 所以两种都试，并用首页文案确认真的到了，避免后面在错误的页面上继续点。
 */
async function goHome(page) {
  for (const label of ["返回首页", "返回"]) {
    if (await tapLabel(page, label)) {
      if (await waitText(page, "按年级开始", 2500)) return true;
    }
  }
  return false;
}

/**
 * 点自绘数字键盘的数字键。
 * NumberPad 的按键绑在 onPointerDown，合成 click() 触发不了，必须真实指针事件。
 */
async function tapDigit(page, d) {
  const pt = await page.evaluate((digit) => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => (x.innerText || "").trim().startsWith(digit) && x.offsetParent !== null
    );
    if (!b) return null;
    const r = b.getBoundingClientRect();
    if (r.width <= 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, d);
  return clickPoint(page, pt);
}

async function dumpButtons(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ((b.innerText || "").trim() || b.getAttribute("aria-label") || "?").slice(0, 22))
      .slice(0, 34)
  );
}

/** 建角色：创建新角色 → 选头像 → 自绘键盘输两遍 4 位密码 → 创建并开始学习 */
async function createUser(page) {
  if (!(await tapText(page, "创建新角色"))) return { ok: false, why: "找不到「创建新角色」入口" };
  if (!(await waitText(page, "选一个头像"))) return { ok: false, why: "创建角色页未打开" };
  await sleep(500);

  // 选一个未占用的头像（头像网格里第一个可点按钮）
  const picked = await page.evaluate(() => {
    const grid = document.querySelector('[class*="grid-cols-4"]');
    const b = grid && [...grid.querySelectorAll("button")].find((x) => !x.disabled);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!await clickPoint(page, picked)) return { ok: false, why: "没有可选头像" };
  await sleep(500);

  // 聚焦第一格密码 → 自绘键盘滑出（注册页截图就在这一刻拍，键盘才是主角）
  const focused = await page.evaluate(() => {
    const first = [...document.querySelectorAll("input")].find((i) => i.readOnly);
    if (!first) return false;
    first.focus();
    return true;
  });
  if (!focused) return { ok: false, why: "找不到密码输入框" };
  await sleep(650);

  // 第一格填满会自动跳到第二格，所以连按 8 下即可
  for (let i = 0; i < PASSWORD.length * 2; i++) {
    await tapDigit(page, PASSWORD[i % PASSWORD.length]);
    await sleep(170);
  }
  await sleep(400);
  await tapText(page, "创建并开始学习");
  const ok = await waitText(page, "按年级开始", 9000);
  return { ok, why: ok ? "" : "点「创建并开始学习」后没进首页" };
}

/** 登录：点头像 → 密码弹窗输 4 位（弹窗是真实 input，可用键盘；先显式聚焦更稳） */
async function login(page) {
  const av = await page.$("button.group");
  if (!av) return false;
  await av.click({ timeout: 5000 }).catch(() => {});
  if (!(await waitText(page, "请输入 4 位数字密码", 4000))) return false;
  await page.evaluate(() => {
    const inp = [...document.querySelectorAll("input")].find((i) => i.readOnly === false);
    if (inp) inp.focus();
  });
  await sleep(250);
  await page.keyboard.type(PASSWORD, { delay: 70 }).catch(() => {});
  return await waitText(page, "按年级开始", 9000);
}

/** 横向溢出检测（截图里出现被裁切的元素会很扎眼） */
async function overflow(page) {
  return page.evaluate(() => {
    const iw = window.innerWidth;
    const sw = document.documentElement.scrollWidth;
    return { iw, sw, bad: sw > iw + 1.5 };
  });
}

/* ─────────────── 主流程 ─────────────── */

const CDP = process.env.SHOTS_CDP || "";
if (!CDP) {
  console.error("缺少 SHOTS_CDP。请先拉起无头 Edge，再用 SHOTS_CDP=http://127.0.0.1:<port> 运行；");
  console.error("推荐直接跑： bash .workbuddy/tmp/run_shots.sh");
  process.exit(2);
}
const browser = await puppeteer.connect({ browserURL: CDP, defaultViewport: null });

const log = [];
const say = (m) => {
  log.push(m);
  console.log(m);
};

/* 注意：不要 rmSync 输出目录 —— 沙箱的 safe-delete 拦截器会让它抛错。
   固定文件名直接覆盖即可；若曾改过 ORDER 的键名，旧文件会残留，需手动清。 */
mkdirSync(ROOT, { recursive: true });

/* 第一遍：用真实 UI 建号并打开一个单元，把 App 自己算出来的真实词条 id 抓回来。
   不手写状态 —— 词条 id 体系变过一次，硬编码的种子会静默失效。 */
let seedUsers = null;
let seedProgress = null;
{
  const page = await browser.newPage();
  await page.setViewport({ width: 428, height: 926, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(900);

  const created = await createUser(page);
  say("【建号】" + (created.ok ? "成功" : "失败：" + created.why));
  if (!created.ok) say("  可点按钮=" + JSON.stringify(await dumpButtons(page)));

  if (await tapText(page, "个单元")) {
    await sleep(2200);
    say("【进入学习页】" + ((await waitText(page, "查看提示", 6000)) ? "成功" : "失败"));
  } else {
    say("【进入学习页】找不到单元入口；可点按钮=" + JSON.stringify(await dumpButtons(page)));
  }

  seedUsers = await page.evaluate(() => JSON.parse(localStorage.getItem("eng-learning-users-v1") || "null"));
  const keys = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("eng-learning-progress-v3"))
  );
  seedProgress = await page.evaluate((k) => (k[0] ? JSON.parse(localStorage.getItem(k[0])) : null), keys);
  say("  用户=" + (seedUsers && seedUsers[0] ? seedUsers[0].id + " / " + seedUsers[0].avatarId : "null"));
  say("  进度键=" + JSON.stringify(keys));
  await page.close();
}

if (!seedUsers || !seedProgress) {
  say("❌ 未能建立种子（建号或进度读取失败），中止");
  writeFileSync(`${ROOT}/capture.log`, log.join("\n"), "utf8");
  await browser.disconnect().catch(() => {});
  process.exit(1);
}

/* 进度调成「已经用了一阵子」的样子 —— 空状态或刚开始的进度放进商店截图没有说服力 */
const gs = seedProgress.grades?.[String(seedProgress.activeGrade)];
const unitIds = (gs?.unitOrder || []).slice();
const done = Math.min(18, unitIds.length);
const cursor = Math.min(done, Math.max(0, unitIds.length - 1));
say(`  年级 ${seedProgress.activeGrade}，当前单元词条数 ${unitIds.length}，进度种子 ${done}`);

const progress = {
  ...seedProgress,
  grades: {
    ...seedProgress.grades,
    [String(seedProgress.activeGrade)]: {
      ...gs,
      entryIndex: cursor,
      completedEntryIds: unitIds.slice(0, done),
      skippedEntryIds: unitIds.slice(done, done + 1),
      rounds: 0,
    },
  },
  difficultEntryIds: unitIds.slice(2, Math.min(8, unitIds.length)),
  difficultAwardedIds: unitIds.slice(2, 4),
  mistakeEntryIds: unitIds.slice(2, Math.min(8, unitIds.length)),
  errorCounts: Object.fromEntries(unitIds.slice(2, 6).map((id) => [id, 2])),
  lastLearnedAt: Date.now(),
};

/* 多档案：单机版允许一台设备注册多个用户（一家人共用一台 iPad），
   排行榜正是围绕这个场景做的 —— 只有 1 个用户时会剩下一大片空白，不能当商店截图。
   真实那一个（seedUsers[0]）保留 App 自己生成的 id / config，其余按同一结构补齐。
   挑靠后几排的头像，免得把「创建角色」页第一排都变灰。

   ⚠️ 必须让「我」是积分榜第一。用户选择页和排行榜都按积分降序排
   （`[...users].sort((a,b) => b.points - a.points)`），而登录只能点页面上的头像
   （currentUser 只存在 React state 里，没有 localStorage 键可以预写）。
   把「我」顶到第一 ⇒ 登录时点第一个头像就一定登到带进度的那个档案。
   给「我」降低名次会让首页变成 0/31「开始学习」的空状态。下方有登录后断言兜底。 */
const ME_POINTS = 215;
const ROSTER = [
  { avatarId: "tiger", points: 148, learnedCount: 28, ago: 9 },
  { avatarId: "monkey", points: 112, learnedCount: 22, ago: 7 },
  { avatarId: "pig", points: 82, learnedCount: 16, ago: 5 },
  { avatarId: "rabbit", points: 64, learnedCount: 13, ago: 4 },
  { avatarId: "bear", points: 43, learnedCount: 9, ago: 3 },
  { avatarId: "penguin", points: 26, learnedCount: 5, ago: 2 },
  { avatarId: "chick", points: 12, learnedCount: 2, ago: 1 },
];
const me = { ...seedUsers[0], points: ME_POINTS, learnedCount: 41 };
const others = ROSTER.filter((r) => r.avatarId !== me.avatarId).map((r, i) => ({
  id: `u-seed-${i}`,
  avatarId: r.avatarId,
  password: PASSWORD,
  points: r.points,
  learnedCount: r.learnedCount,
  createdAt: Date.now() - r.ago * 86400000,
  config: { ...me.config },
}));
const users = [me, ...others];
say(`  档案数 ${users.length}（我 ${me.points} 分居首，其余最高 ${others[0].points} 分）`);

let failures = 0;

for (const dev of DEVICES) {
  const out = `${ROOT}/${dev.name}`;
  mkdirSync(out, { recursive: true });
  say(`\n===== ${dev.name} (${dev.width}×${dev.height} @${dev.dpr}x → ${dev.expect}) =====`);

  const page = await browser.newPage();
  await page.setViewport({
    width: dev.width,
    height: dev.height,
    deviceScaleFactor: dev.dpr,
    isMobile: true,
    hasTouch: true,
  });

  const shot = async (key) => {
    await sleep(450);
    await page.screenshot({ path: `${out}/${ORDER[key]}-${key}.png` });
    const o = await overflow(page);
    say(`  [${ORDER[key]}-${key}] ${o.bad ? `❌ 横向溢出 ${o.sw}>${o.iw}` : "✓"}`);
  };

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.evaluate(
      ([u, p]) => {
        localStorage.clear();
        localStorage.setItem("eng-learning-users-v1", JSON.stringify(u));
        localStorage.setItem(`eng-learning-progress-v3:${p.version}:${u[0].id}`, JSON.stringify(p));
      },
      [users, progress]
    );
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(1000);

    // 1) 用户选择页
    await shot("select");

    // 2) 创建角色页（含自绘数字键盘）
    if (await tapText(page, "创建新角色")) {
      if (await waitText(page, "选一个头像", 5000)) {
        const picked = await page.evaluate(() => {
          const grid = document.querySelector('[class*="grid-cols-4"]');
          const b = grid && [...grid.querySelectorAll("button")].find((x) => !x.disabled);
          if (!b) return null;
          const r = b.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        await clickPoint(page, picked);
        await sleep(450);
        await page.evaluate(() => {
          const first = [...document.querySelectorAll("input")].find((i) => i.readOnly);
          if (first) first.focus();
        });
        await sleep(700);
        // 聚焦会把内容区滚下去（键盘在文档流内），滚回顶部才能连标题一起入镜
        await page.evaluate(() => {
          const first = [...document.querySelectorAll("input")].find((i) => i.readOnly);
          for (let p = first && first.parentElement; p; p = p.parentElement) {
            if (getComputedStyle(p).overflowY === "auto" || getComputedStyle(p).overflowY === "scroll") {
              p.scrollTop = 0;
              break;
            }
          }
        });
        await sleep(500);
        await shot("register");
      } else {
        say("  ⚠️ 创建角色页未打开");
      }
      // 不用页面上的返回键（时灵时不灵），直接 reload 回到用户选择页
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      await waitText(page, "点击头像开始学习", 5000);
      await sleep(500);
    } else {
      say("  ⚠️ 找不到创建角色入口");
    }

    // 3) 登录 → 首页
    if (!(await login(page))) {
      say("  ❌ 登录失败，跳过。可点按钮=" + JSON.stringify(await dumpButtons(page)));
      failures += 1;
      await page.close();
      continue;
    }
    /* 兜底断言：登错档案时首页会显示别人的积分 ⇒ 也就没有进度种子，
       拍出来是 0/31「开始学习」的空状态。这种图不能交，直接算失败。 */
    const loggedInAsMe = await page.evaluate(
      (p) => (document.body.innerText || "").includes(`${p} 积分`),
      ME_POINTS
    );
    if (!loggedInAsMe) {
      say(`  ❌ 登进了别的档案（首页没有「${ME_POINTS} 积分」），跳过该设备`);
      failures += 1;
      await page.close();
      continue;
    }
    await shot("home");

    // 4) 学习页 / 查看提示
    if (await tapText(page, "个单元")) {
      await sleep(2200);
      if ((await waitText(page, "查看提示", 7000)) || (await waitText(page, "听写", 3000))) {
        await shot("learn");
        await page.keyboard.press("Space");
        await sleep(800);
        await shot("learn-reveal");
      } else {
        say("  ⚠️ 学习页未打开。可点按钮=" + JSON.stringify(await dumpButtons(page)));
      }
    } else {
      say("  ⚠️ 找不到单元入口");
    }

    // 5) 返回首页 → 重点记忆 / 排行榜 / 设置
    if (!(await goHome(page))) say("  ⚠️ 从学习页回首页失败");

    for (const [label, key] of [
      ["重点记忆", "difficult"],
      ["排行榜", "leaderboard"],
    ]) {
      if (await tapLabel(page, label)) {
        await sleep(900);
        await shot(key);
        if (!(await goHome(page))) say(`  ⚠️ 从「${label}」回首页失败`);
      } else {
        say(`  ⚠️ 找不到「${label}」入口`);
      }
    }

    if (await tapLabel(page, "设置")) {
      await sleep(900);
      await shot("settings");
    } else {
      say("  ⚠️ 找不到设置入口");
    }
  } catch (e) {
    say("  ❌ 异常: " + String(e.message || e).slice(0, 160));
    failures += 1;
  } finally {
    await page.close().catch(() => {});
  }
}

await browser.disconnect().catch(() => {});
writeFileSync(`${ROOT}/capture.log`, log.join("\n"), "utf8");
say(`\n完成。失败设备数=${failures}，输出目录 ${ROOT}`);
process.exit(failures ? 1 : 0);

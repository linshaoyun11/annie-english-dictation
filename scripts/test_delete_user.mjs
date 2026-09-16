/**
 * 「删除本用户」端到端回归测试。
 *
 * 走完整真实路径（不 mock React 状态）：创建角色 → 进资料页 → 删除本用户
 * （点自绘键盘输密码）→ 二次确认弹窗 → 核对跳转 / localStorage 清理 / 头像释放。
 * 顺带覆盖「密码输错被拒」「点取消不删档」两条反向路径 —— 删除是不可逆操作，
 * 反向路径比正向更值得盯。
 *
 * 用法：bash scripts/headless_edge_run.sh scripts/test_delete_user.mjs
 * 前置：另开终端跑 `npx vite --port 5180 --strictPort`
 *
 * 视口默认 428×926@2x（iPhone 14 Plus），可用 VERIFY_W / VERIFY_H 覆盖；
 * 截图落在 .workbuddy/tmp/delete-flow/<视口>-*.png（列表态 / 密码态 / 错误态 / 确认框）。
 *
 * 三个必须记住的地方：
 *   1. 交互一律用 page.mouse.click —— 自绘 NumberPad 绑的是 onPointerDown，
 *      合成 element.click() 完全不生效。
 *   2. 密码错误提示只亮 500ms（与全站一致）⇒ 最后一位要点完**立刻**断言，
 *      不能等 typeOnPad 的内置间隔走完（会把提示等没，误判成失败）。
 *   3. 「已删除」的判据不能只看页面：还要读 localStorage 的 eng-* 键，确认
 *      档案没了、且**所有教材线**的进度键都清干净（测试里专门埋了一条
 *      renjiao 线的进度来验证这一点）。
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const puppeteer = require(
  "C:/Users/huawei/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core"
);

const SHOT_DIR =
  "C:/Users/huawei/WorkBuddy/2026-08-17-22-58-27/.workbuddy/tmp/delete-flow";
mkdirSync(SHOT_DIR, { recursive: true });

const CDP = process.env.EDGE_CDP;
if (!CDP) {
  console.error("❌ 缺 EDGE_CDP —— 请用启动器运行：");
  console.error("   bash scripts/headless_edge_run.sh scripts/test_delete_user.mjs");
  process.exit(2);
}

const BASE = process.env.VERIFY_BASE || "http://127.0.0.1:5180/";
const PASSWORD = ["1", "2", "3", "4"];
/** 视口可配：小屏核对用 VERIFY_W=375 VERIFY_H=667 */
const VW = Number(process.env.VERIFY_W || 428);
const VH = Number(process.env.VERIFY_H || 926);
const TAG = `${VW}x${VH}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures += 1;
    console.log(`  ✗ ${msg}`);
  }
};

/** 页面可见文本 */
const textOf = (page) =>
  page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));

/** 找「文本包含 text 的**面积最小**元素」（最内层，事件会自然冒泡到外层卡片） */
async function findByText(page, sel, text) {
  const handles = await page.$$(sel);
  let best = null;
  let bestArea = Infinity;
  for (const h of handles) {
    const info = await h.evaluate(
      (el, t) => {
        const txt = (el.textContent || "").trim();
        if (!txt.includes(t)) return null;
        const r = el.getBoundingClientRect();
        return { area: r.width * r.height, visible: r.width > 0 && r.height > 0 };
      },
      text
    );
    if (!info || !info.visible) continue;
    if (info.area < bestArea) {
      best = h;
      bestArea = info.area;
    }
  }
  return best;
}

/** 真实鼠标点击（本项目自绘键盘绑 onPointerDown，合成 click 无效） */
async function clickEl(page, handle, what) {
  if (!handle) throw new Error(`找不到可点击元素：${what}`);
  await handle.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await sleep(150);
  const b = await handle.boundingBox();
  if (!b) throw new Error(`元素不可见：${what}`);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(180);
}

async function tapText(page, text, what = text) {
  const h = await findByText(page, "button", text);
  await clickEl(page, h, what);
}

/** 点自绘数字键盘输入密码（NumberPad 的键是 aria-label="1"…"0"） */
async function typeOnPad(page, digits) {
  for (const d of digits) {
    const key = await page.$(`[data-number-pad] button[aria-label="${d}"]`);
    await clickEl(page, key, `数字键 ${d}`);
    await sleep(120);
  }
}

const keys = (page) =>
  page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("eng-"))
  );

/* ─────────────── 主流程 ─────────────── */
const browser = await puppeteer.connect({ browserURL: CDP, defaultViewport: null });
const page = await browser.newPage();
await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

console.log(`== 0) 清空本地数据、打开应用（${VW}×${VH}）==`);
await page.goto(BASE, { waitUntil: "networkidle2" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle2" });
await sleep(400);
ok((await textOf(page)).includes("还没有小伙伴"), "初始为空态用户选择页");

console.log("\n== 1) 创建角色（小狗 / 1234）==");
await tapText(page, "创建新角色");
await sleep(500);
await tapText(page, "小狗", "小狗头像");
await sleep(200);
// 密码框在文档流内，点它只负责“标记写哪一格”，键盘由自绘键盘驱动
await clickEl(page, await page.$("input"), "第一个密码框");
await typeOnPad(page, PASSWORD);
await sleep(250);
// 满 4 位自动跳到第二格
await typeOnPad(page, PASSWORD);
await sleep(250);
await tapText(page, "创建并开始学习");
await sleep(800);

const homeText = await textOf(page);
ok(homeText.includes("继续学习") || homeText.includes("开始学习"), "已登录进首页");
ok(!homeText.includes("还没有小伙伴"), "不在用户选择页");

const beforeKeys = await keys(page);
console.log(`  删除前的 eng-* 键：${JSON.stringify(beforeKeys)}`);
const usersRaw = await page.evaluate(() => localStorage.getItem("eng-learning-users-v1"));
const usersBefore = JSON.parse(usersRaw || "[]");
ok(usersBefore.length === 1 && usersBefore[0].avatarId === "dog", "档案已写入（1 个 / dog）");
const userId = usersBefore[0].id;

// 造一条该用户在**另一条教材线**下的进度，验证「清全部教材线」而不只是当前线
await page.evaluate((uid) => {
  localStorage.setItem(
    `eng-learning-progress-v3:renjiao:${uid}`,
    JSON.stringify({ lastLearnedAt: Date.now(), version: "renjiao" })
  );
}, userId);
ok((await keys(page)).some((k) => k.includes(":renjiao:")), "已埋入 renjiao 线的进度键（待清）");

console.log("\n== 2) 进用户资料页 ==");
const profileBtn = await page.$('button[aria-label="用户资料"]');
await clickEl(page, profileBtn, "首页头像 → 用户资料");
await sleep(500);
let t = await textOf(page);
ok(t.includes("用户资料"), "已进入用户资料页");
ok(t.includes("删除本用户"), "列表里出现「删除本用户」");
ok(t.includes("危险操作"), "有「危险操作」分组标题");
await page.screenshot({ path: `${SHOT_DIR}/${TAG}-01-profile-list.png` });

console.log("\n== 3) 点删除 → 弹密码键盘 ==");
await tapText(page, "删除本用户");
await sleep(500);
ok(!!(await page.$("[data-number-pad]")), "自绘数字键盘已展开");
t = await textOf(page);
ok(t.includes("危险操作"), "密码验证时仍能从标题看出是危险操作");
await page.screenshot({ path: `${SHOT_DIR}/${TAG}-02-password.png` });

console.log("　 3a) 先输错密码，应被拒 ==");
// 提示只亮 500ms（与改密码流程一致）⇒ 最后一位单独点、点完立刻读，
// 否则等 typeOnPad 内置间隔走完，提示已经复位
await typeOnPad(page, ["9", "9", "9"]);
await clickEl(page, await page.$('[data-number-pad] button[aria-label="9"]'), "数字键 9");
t = await textOf(page);
ok(t.includes("密码不对"), "错误密码有提示");
await page.screenshot({ path: `${SHOT_DIR}/${TAG}-03-password-wrong.png` });
ok(!t.includes("确认删除"), "错误密码不弹确认框");
await sleep(600); // 等抖动复位

console.log("　 3b) 输正确密码 → 弹确认框 ==");
await typeOnPad(page, PASSWORD);
await sleep(600);
t = await textOf(page);
ok(t.includes("删除「猴子」") || t.includes("删除「小狗」"), "弹出确认框（标题带角色名）");
ok(t.includes("所有资料、积分与学习进度"), "提示文案说明会删掉资料/积分/进度");
ok(t.includes("确认删除"), "有「确认删除」按钮");
ok(!(await page.$("[data-number-pad]")), "确认框打开时键盘已收起");
await page.screenshot({ path: `${SHOT_DIR}/${TAG}-04-confirm.png` });

console.log("　 3c) 先点「取消」应回列表、且档案还在 ==");
await tapText(page, "取消", "弹窗取消");
await sleep(500);
t = await textOf(page);
ok(t.includes("删除本用户") && t.includes("修改密码"), "回到资料页列表");
ok(
  JSON.parse((await page.evaluate(() => localStorage.getItem("eng-learning-users-v1"))) || "[]")
    .length === 1,
  "取消后档案未被删"
);

console.log("\n== 4) 重走一遍并确认删除 ==");
await tapText(page, "删除本用户");
await sleep(450);
await typeOnPad(page, PASSWORD);
await sleep(600);
await tapText(page, "确认删除");
await sleep(900);

t = await textOf(page);
ok(t.includes("还没有小伙伴"), "已跳回初始页（用户选择页空态）");
ok(!t.includes("用户资料"), "已离开用户资料页");

const afterUsers = JSON.parse(
  (await page.evaluate(() => localStorage.getItem("eng-learning-users-v1"))) || "[]"
);
ok(afterUsers.length === 0, "档案已从 localStorage 删除");
const afterKeys = await keys(page);
console.log(`  删除后的 eng-* 键：${JSON.stringify(afterKeys)}`);
ok(
  afterKeys.filter((k) => k.includes("eng-learning-progress")).length === 0,
  "该用户所有教材线的进度键都已清除"
);
ok(
  !afterKeys.some((k) => k.includes(userId)),
  "没有任何残留键带着这个 userId"
);

console.log("\n== 5) 进创建角色页，核对头像已释放 ==");
await tapText(page, "创建新角色");
await sleep(600);
const dogState = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) =>
    (b.textContent || "").includes("小狗")
  );
  return btn ? { disabled: btn.disabled, opacity: getComputedStyle(btn).opacity } : null;
});
console.log(`  小狗头像状态：${JSON.stringify(dogState)}`);
ok(dogState && !dogState.disabled, "小狗头像恢复为可选（不再 disabled）");

console.log(
  `\n${failures === 0 ? "✅ 全部通过" : `❌ ${failures} 项未通过`}`
);
await page.close();
await browser.disconnect();
process.exit(failures === 0 ? 0 : 1);

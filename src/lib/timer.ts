/**
 * 安全定时器：防 iOS WKWebView 后台挂起后的"定时器冻结"。
 *
 * 现象（WebKit 时钟停走 bug）：
 * App 放后台一段时间被系统挂起后回到前台，DOM 事件（键盘/触摸）仍能
 * 正常送达，但 setTimeout / setInterval 回调不再触发，且新创建的定时器
 * 也可能永不执行。表现为：答对不自动跳题、密码输完不进入下一步、
 * 音频循环播完一次就静音；重启 App 才恢复（重建 WebView 重置时钟）。
 *
 * 原理：
 * safeTimeout 在原生 setTimeout 之外记录每个挂起定时器的回调与计划
 * 时刻；模块级"心跳"监听（keydown / touchstart / pointerdown /
 * visibilitychange→visible）在每次用户交互时检查挂起队列，发现
 * "已到期"或"时钟自调度以来完全没走动（冻结）"的定时器立即补发。
 * 用户唤醒后第一次打字/触摸即触发恢复，无需重启。
 */

interface PendingTimer {
  fn: () => void;
  /** 调度时的 Date.now()；时钟冻结时它不会前进 */
  scheduledAt: number;
  /** scheduledAt + delay */
  due: number;
  handle: number;
}

const pending = new Map<number, PendingTimer>();
let kickInstalled = false;

function fireEntry(entry: PendingTimer) {
  window.clearTimeout(entry.handle);
  pending.delete(entry.handle);
  try {
    entry.fn();
  } catch {
    /* 补发回调自身异常不影响其他定时器 */
  }
}

/** 心跳检查：补发所有已到期或时钟冻结期间挂起的定时器 */
function runKicks() {
  if (pending.size === 0) return;
  const now = Date.now();
  for (const entry of [...pending.values()]) {
    // 1) now >= due：正常到期（含后台期间积压的），补发；
    // 2) now <= scheduledAt：调度后时钟完全没走动 → 判定冻结，补发
    //    （时钟正常时两个事件几乎不可能落在同一毫秒，误伤可忽略，
    //     即便误伤也只是让短延时回调提前几十毫秒执行，无副作用）。
    if (now >= entry.due || now <= entry.scheduledAt) {
      fireEntry(entry);
    }
  }
}

function installKick() {
  if (kickInstalled) return;
  kickInstalled = true;
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  document.addEventListener("keydown", runKicks, opts);
  document.addEventListener("touchstart", runKicks, opts);
  document.addEventListener("pointerdown", runKicks, opts);
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "visible") {
        // 回前台立即补发一次（无需等用户交互），音频循环/跳题链自动恢复
        runKicks();
      }
    },
    opts
  );
}

/**
 * setTimeout 的安全替代：返回值可直接交给 safeClearTimeout。
 * 与原生 setTimeout 语义一致（未捕获的回调异常不传播）。
 */
export function safeTimeout(fn: () => void, ms: number): number {
  const handle = window.setTimeout(() => {
    pending.delete(handle);
    fn();
  }, ms);
  pending.set(handle, {
    fn,
    scheduledAt: Date.now(),
    due: Date.now() + ms,
    handle,
  });
  installKick();
  return handle;
}

/** clearTimeout 的安全替代：必须与 safeTimeout 配对使用，防止幽灵补发 */
export function safeClearTimeout(handle: number | null | undefined): void {
  if (handle == null) return;
  window.clearTimeout(handle);
  pending.delete(handle);
}

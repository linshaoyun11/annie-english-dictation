/**
 * Worker 心跳倒计时：iOS WKWebView「后台唤醒冻结」下的最后一条活路。
 *
 * 实测矩阵（2026-09-12/13 真机，App 切后台再唤醒后）：
 *   setTimeout / rAF / animationend 全部不再触发（build 92/93 的三路
 *   兜底在真机唤醒场景下全部失效——"合成器动画活着 ⇒ rAF 活着"的
 *   前提不成立）；而用户输入事件（触摸/按键）仍然正常送达。
 *
 * Web Worker 跑在独立线程、拥有自己的定时器队列，不依赖主线程的
 * 时钟与渲染更新；其 postMessage 走主线程事件通道（与输入事件同族，
 * 实测可送达）。因此用 Worker 心跳计数实现倒计时：
 *   Worker 端 100ms 一拍 postMessage（纯计数，不依赖任何墙钟）；
 *   主线程数到 ceil(ms/100)+1 拍触发——+1 拍对齐相位抖动，
 *   保证不早于 1.8s 进度条走完（宁可慢不可早）。
 *
 * 局限：整个 App 进程被系统挂起期间 Worker 同样停摆，但唤醒后即恢复
 * 计数（Worker 定时器不受主线程冻结 bug 影响）；若 Worker 构造失败
 * （极端环境），自动退回原生 setTimeout。
 */

type Cancel = () => void;

let worker: Worker | null = null;
let failed = false;
const listeners = new Set<(tick: number) => void>();

function getWorker(): Worker | null {
  if (failed) return null;
  if (worker) return worker;
  try {
    // 纯计数心跳：每 100ms 上报累计拍数，不依赖 Worker 内墙钟
    const src = "let n=0;setInterval(function(){postMessage(++n);},100);";
    worker = new Worker(
      URL.createObjectURL(new Blob([src], { type: "text/javascript" }))
    );
    worker.onmessage = (e: MessageEvent) => {
      const tick = e.data as number;
      for (const fn of listeners) fn(tick);
    };
    return worker;
  } catch {
    failed = true;
    return null;
  }
}

/**
 * workerCountdown：ms 毫秒后触发 fn（基于 Worker 心跳计数）。
 * 返回取消函数。可多个并存，互不干扰。
 */
export function workerCountdown(fn: () => void, ms: number): Cancel {
  const w = getWorker();
  if (!w) {
    const h = window.setTimeout(fn, ms);
    return () => window.clearTimeout(h);
  }
  const need = Math.ceil(ms / 100) + 1; // +1 拍：抵消订阅相位差，绝不早触发
  let count = 0;
  const onTick = () => {
    count += 1;
    if (count >= need) {
      listeners.delete(onTick);
      fn();
    }
  };
  listeners.add(onTick);
  return () => {
    listeners.delete(onTick);
  };
}

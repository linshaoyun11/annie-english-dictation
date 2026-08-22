/**
 * 持久化存储层：localStorage + 原生 Preferences 双写
 *
 * 背景：iOS WKWebView 的 localStorage 在 App 切后台被系统杀掉时，
 * 最后若干次写入可能没有 flush 到磁盘（表现为"进度只保存到单元，
 * 单元内第几个词丢失"）。@capacitor/preferences 底层是
 * NSUserDefaults（原生落盘，绝不丢），因此：
 *  - 写：localStorage（同步，供现有同步读取逻辑）+ 原生 Preferences（异步兜底）
 *  - 读：仍从 localStorage 同步读
 *  - 启动时 recoverStorage()：逐 key 对比两份副本的时间戳
 *    （JSON 里的 lastLearnedAt），取较新者回写到 localStorage，
 *    保证被丢写的 localStorage 能从原生副本恢复。
 *
 * Web 端（浏览器 dev / 桌面）：prefs 为 null，全部退化为纯 localStorage，行为不变。
 */

import { Capacitor } from "@capacitor/core";

interface PrefsLike {
  set(options: { key: string; value: string }): Promise<void>;
  get(options: { key: string }): Promise<{ value: string | null }>;
  remove(options: { key: string }): Promise<void>;
  keys(): Promise<{ keys: string[] }>;
}

let prefs: PrefsLike | null = null;
let prefsReady: Promise<void> | null = null;

function initPrefs(): Promise<void> {
  if (prefsReady) return prefsReady;
  prefsReady = (async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const m = await import("@capacitor/preferences");
      prefs = m.Preferences;
    } catch {
      /* 插件不可用（老原生包未含 pod）时静默降级为纯 localStorage */
    }
  })();
  return prefsReady;
}

/** 从 JSON 字符串中提取 lastLearnedAt 时间戳（无则 0），用于新旧比较 */
function extractTs(json: string): number {
  try {
    const o = JSON.parse(json) as { lastLearnedAt?: unknown };
    return typeof o.lastLearnedAt === "number" ? o.lastLearnedAt : 0;
  } catch {
    return 0;
  }
}

export function storageGet(key: string): string | null {
  return localStorage.getItem(key);
}

export function storageSet(key: string, value: string): void {
  localStorage.setItem(key, value);
  initPrefs()
    .then(() => prefs?.set({ key, value }))
    .catch(() => {});
}

export function storageRemove(key: string): void {
  localStorage.removeItem(key);
  initPrefs()
    .then(() => prefs?.remove({ key }))
    .catch(() => {});
}

/**
 * App 启动时调用（渲染前）：用原生副本修复可能丢写的 localStorage。
 * 两个方向都修：native 新 → 写回 local；local 新 → 写回 native（对齐）。
 */
export async function recoverStorage(): Promise<void> {
  await initPrefs();
  if (!prefs) return;
  try {
    const { keys } = await prefs.keys();
    for (const key of keys) {
      const local = localStorage.getItem(key);
      const { value: native } = await prefs.get({ key });
      if (!native) {
        // 原生没有该 key（新装/清过），local 有 → 补写对齐
        if (local) await prefs.set({ key, value: local });
        continue;
      }
      if (!local) {
        // localStorage 整体丢失（WKWebView 偶发清空）→ 从原生恢复
        localStorage.setItem(key, native);
        continue;
      }
      if (local === native) continue;
      const lt = extractTs(local);
      const nt = extractTs(native);
      if (nt > lt) localStorage.setItem(key, native);
      else if (lt > nt) await prefs.set({ key, value: local });
      // 时间戳相同但内容不同（同秒多次写入）：以 local 为准，对齐原生
      else if (local !== native) await prefs.set({ key, value: local });
    }
  } catch {
    /* 恢复失败不影响启动 */
  }
}

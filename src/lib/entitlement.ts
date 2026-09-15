/**
 * 权益（Entitlement）判定层 —— 内购预留骨架
 *
 * ⚠️ 本文件目前**没有被任何模块 import**，这是有意的：
 *    它不会进入构建产物（未被引用 ⇒ 被 rolldown tree-shake 掉），
 *    也不会改变现有 App 的任何行为（isUnlocked 恒为 true）。
 *    建立它的目的只有一个：将来接入 App 内购买时，**只改这一个文件**，
 *    所有 UI 通过 isUnlocked() 询问即可，避免 `if (isPro)` 散落到十几个组件里。
 *
 * 接入内购时必须遵守的三条（依据见 .workbuddy/memory/topics/iap-planning.md）：
 *
 *  1) 权益必须存在**独立**的存储 key（建议 `annie.entitlement`），
 *     **绝不能写进进度对象**。本项目有 freshProgress / CURRICULUM_VERSION 机制：
 *     动教材 id ⇒ 升版本 ⇒ 重置进度。若权益混在其中，某次教材重建会把
 *     用户**付过钱的权益一起清掉**。
 *
 *  2) 权益按**整机**授予，不绑定到某个 App 内角色。
 *     本 App 是多角色（角色 + 4 位密码）本地多用户，而 Apple ID 是设备级/系统级的。
 *     一次购买解锁整台设备的所有角色 —— 最简、最不易被拒、家长最好理解。
 *
 *  3) 读取权益必须经 StoreKit 的 `Transaction.currentEntitlements` /
 *     恢复购买（`restorePurchases()`）同步一次，本地缓存只作离线兜底。
 *
 * 产品 ID 命名规范见 docs/iap-readiness.md。
 */

/** App 内可被付费墙区分的功能点（教材线 + 独立功能页） */
export type FeatureId =
  | "curriculum:renjiao"
  | "curriculum:renjiao3"
  | "curriculum:waiyanshe"
  | "curriculum:waiyanshe3"
  | "curriculum:oxford"
  | "curriculum:renai"
  | "difficult-words"
  | "leaderboard"
  | "movie-quotes";

/** 权益来源 */
export type EntitlementSource = "free" | "lifetime" | "subscription" | "restored";

export interface EntitlementState {
  /** 是否为付费用户 */
  readonly pro: boolean;
  readonly source: EntitlementSource;
  /** 已单独解锁的功能点（买断模式下为全部） */
  readonly unlocked: readonly FeatureId[];
  /** 上次与商店同步的时间戳；0 = 从未同步 */
  readonly syncedAt: number;
}

/** 首发（免费版）的权益状态：没有付费概念 */
const FREE_STATE: EntitlementState = {
  pro: false,
  source: "free",
  unlocked: [],
  syncedAt: 0,
};

let current: EntitlementState = FREE_STATE;

/** 读取当前权益。将来：先返回本地缓存，再由一次商店同步异步刷新。 */
export function getEntitlement(): EntitlementState {
  return current;
}

/**
 * 功能点当前是否可用。
 *
 * 现在恒为 `true`：免费版没有任何限制，所以即使将来把它引入 UI 也不会锁住功能。
 * 接入内购后改为：
 *   return current.pro || current.unlocked.includes(feature);
 */
export function isUnlocked(_feature: FeatureId): boolean {
  return true;
}

/**
 * 写入权益（将来由购买回调 / 商店同步流程调用）。
 * 注意：写入前请先落盘到独立 key，不要碰进度对象（见文件头第 1 条）。
 */
export function setEntitlement(next: EntitlementState): void {
  current = next;
}

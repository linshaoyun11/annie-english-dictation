# 内购（IAP）规划 · 2026-09-15

> 起因：用户问「APP 正式发布后加内购改动大吗？发布前要提前为付费做什么准备？」
> 本文 = 从 Apple 官方文档核实过的事实 + 本项目落点。**真动手前重读本文。**

## 一、结论

改动**不大，且集中在薄薄一层**：约 2-4 天（含 ASC 配置 + 沙盒联调）。
教材数据 / 音频 / 进度体系 / 学习 UI 全不用碰。
唯一「现在不做、以后会卡进度」的是**商店侧行政项**（见第四节第 1 条）。

## 二、商店政策事实（2026-09-15 从 Apple 官方文档核实）

| 事项 | 结论 |
|---|---|
| 免费上架需要什么 | 只需《Apple Developer Program 许可协议》 |
| 内购需要什么 | **账户持有人必须签《付费应用程序协议》** |
| 没签协议能上架吗 | 能，但**只能免费**：*"you can only offer your app for free"* |
| 签了能反悔吗 | **不能**：*"Once you've accepted the terms, you can't undo this action"* |
| 收款还要什么 | 银行信息 + 税表（中国开发者走 W-8BEN）。未提供只影响打款，不挡上架 |
| 协议出新版 | 未同意最新版**就不能创建新 App 或新内购项** |
| 订阅硬性 UI 要求 | 付费墙必须出现：**名称 / 周期 / 完整续费价（不得只显示折算价）/ 自动续费说明 / 取消路径 / 隐私政策 + 使用条款（EULA）链接**，且无需额外点击或滚动即可见 |
| EULA 链接位置 | ASC 元数据（App 描述或 EULA 字段）**＋ App 内付费墙与账户页**（3.1.2(c) 最高频拒审点；Apple 标准 EULA 即可，不必自拟） |
| 订阅内容要求 | 订阅须**跨用户所有设备可用**、周期 ≥7 天、提供持续价值 |
| 恢复购买 | 必须实现且审核可演示 |
| 内购与提审关系 | 内购项目**必须与某个 App 版本一起提审**，不能先上架再单独加 |
| 佣金 | 订阅满 1 年后 85%；可申请 App Store Small Business Program 提前拿 85% |

## 三、本项目落点（具体到文件）

现状：**无后端、无账号**，数据全在设备本地 ——
`src/lib/storage.ts` = localStorage 同步读 + `@capacitor/preferences`（NSUserDefaults）兜底双写，
按 key 存，进度对象挂在 `user.id` 下。

✅ **关键结论：不需要为内购自建后端。**
StoreKit 的 `Transaction.currentEntitlements` / `restorePurchases()` 本身就是 Apple ID 级别的，
重装 / 换机可恢复；用 RevenueCat 则连服务端收据校验都托管。

### 三个必须先想清楚的坑

1. **权益存储绝不能和进度放同一个 key。**
   项目有 `freshProgress` 机制：动教材 id ⇒ 升 `CURRICULUM_VERSION` ⇒ 重置进度。
   若「已购买」存在进度对象里，某次教材重建会把用户**付过钱的权益**一起清掉。
   ⇒ 用独立 key（如 `annie.entitlement`），**永不参与版本重置**，也不进 `freshProgress`。

2. **多角色怎么分配权益。**
   App 是多用户（角色 + 4 位 `NumberPad` 密码），而 Apple ID 是设备级 / 系统级。
   建议：**一次购买解锁整台设备的所有角色** —— 最简、最不易被拒、家长最好理解。
   不要试图把权益绑到某个 App 内角色上（跨设备对不上，恢复购买会变成玄学）。

3. **权益判定要单一入口。**
   新建 `src/lib/entitlement.ts`，对外只暴露 `isUnlocked(feature)` / 已解锁范围；
   首发版恒 `true`。以后接内购只改这一个文件，所有 UI 不动（成本约 1 小时）。
   配合「列表页一律 `PageTopBar`」那类约定，避免将来在十几个组件里散落 `if (isPro)`。

### 技术选型（2026-09 核实）

| 方案 | 特点 | 适合 |
|---|---|---|
| `@revenuecat/purchases-capacitor` | RevenueCat 官方插件，服务端校验收据 + 权益管理 + 分析，免费额度够个人用 | **本项目推荐**（无后端） |
| `@capawesome-team/capacitor-purchases` | 轻量、不依赖第三方后端，但需 Capawesome Insiders 许可，收据校验自己扛 | 已有后端时 |

- `@capgo/native-purchases` 是更裸的 StoreKit / Play Billing 直连版本，同样要自己校验。
- 两者都要求 Capacitor 8+（本项目已是 8.x）。
- ⚠️ **Windows 无 Mac 的硬约束**：加原生插件后 `ios/` 由 CI 现场生成（已 gitignore），
  本地**无法调试支付流程** ⇒ 只能用 TestFlight + 沙盒 Apple ID 测（沙盒购买不计费、
  可重复触发）。CI 需在新依赖下重跑 `npx cap sync ios`（Podfile 会变），这一环实施时先验证。

## 四、发布前建议做的（成本极低，1 小时内）

1. **ASC 签《付费应用程序协议》+ 补银行 / 税表** ← 唯一「早做省事」的项。
   不签的唯一后果是以后要临时补、且**签之前无法创建任何内购项目**。
2. `privacy-policy.html` / `support.html` 加一段内购措辞：支付由 Apple 处理、
   **开发者不接触任何支付信息与卡号**、未成年人购买需家长同意。
   现在零成本；等付费墙上了再改要连带重新提审元数据。
3. 定好产品 ID 命名并写进 docs —— **ID 一旦创建不可修改，只能删了重建**：
   建议 `com.annie.dictation.<tier>`，如 `com.annie.dictation.pro.lifetime`。
4. （可选）抽 `entitlement.ts` 空壳。

## 五、首发版本「不要」做的事

- **不要塞未完成的内购框架**：IAP 必须与版本一起提审，半成品会被按 2.1 / 3.2.1 拒。
- 不要放任何第三方支付入口、站外充值引导、跨平台比价文案（3.1.1 高危，可直接下架账号）。
- 不要在首发就做账号体系 —— 没有跨平台需求时是纯负担。

## 六、待用户决策（尚未拍板）

- **商业模式**：一次性买断（非消耗型） vs 自动续期订阅 vs 消耗型积分包。
  → 家长向、内容型产品：买断心理门槛最低、无续费争议；订阅收入稳但需持续交付新内容，
    且审核更严（EULA / 续费披露 / 跨设备可用）。**倾向买断。**
- **免费范围切在哪**：按教材线（如免费人教一线，其余解锁）or 按功能（重点记忆 / 排行榜）。

## 七、执行记录：发布前预留（2026-09-15 已完成）

用户要求「把发布前值得做的 4 点全部做掉，且**不改动任何现有程序文件**」。结果：

| # | 事项 | 状态 |
|---|---|---|
| 1 | ASC 签付费协议 + 银行 + 税表 | ⏳ **只能用户本人操作**（需账户持有人登录 + 双重认证 + 银行/税务信息）。逐步路径已写进 `docs/iap-readiness.md` §1 |
| 2 | 隐私政策 / 支持页加内购措辞 | ✅ 已改 `privacy-policy.html`（新增「四、App 内购买与支付」，原四~七章顺延为五~八）+ `support.html`（新增 FAQ 第 6 条）；`privacy-deploy/` 两份副本同步，**md5 逐字节一致** |
| 3 | 产品 ID 命名规范 | ✅ 已写进 `docs/iap-readiness.md` §3（含订阅路线额外硬性要求） |
| 4 | `entitlement.ts` 骨架 | ✅ 新建 `src/lib/entitlement.ts`，**零引用**（grep 确认所有匹配都在文件自身），`isUnlocked()` 恒 true |

**「不动程序文件」是怎么保证的**（`git diff --name-only` 可复核）：

- 改动过的已跟踪文件只有 4 个政策页 HTML + 2 个记忆文件，**`src/` 下无任何 ` M`**；
- `package.json` / `vite.config.ts` / `capacitor.config.ts` / `codemagic.yaml` / `index.html` 全未动；
- 政策页在项目根，**不是 vite 入口、也不在 `public/`** ⇒ 不进 `dist`；
- `entitlement.ts` 未被 import ⇒ 被 rolldown tree-shake，不进 bundle；
- ⇒ **`dist` 内容不变 ⇒ 不需要重新构建、`APP_BUILD` 保持 120**。`npx tsc -b --noEmit` 通过。

⚠️ **两件仍需用户处理的收尾**：

1. **政策页要重新部署 `privacy-deploy/` 才会在线上生效**（本机没做部署，也没找到部署脚本）。
2. **首发应用描述里那句「无广告、无内购」建议改掉** —— 见
   `docs/ios-appstore-release-guide.md` §3.4。那是公开承诺，以后加内购必改。
3. `docs/privacy-policy.html` / `.md` / `-en.*` 是 2026-08-20 的**废弃草稿**
   （正文还留着「[开发者/公司名，请填写]」），与线上版本不一致，**建议清理**，别当权威源。

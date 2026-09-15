# 内购（IAP）准备工作

> 建立：2026-09-15 · 当前状态：**只做了「零改动」的预留，尚未接入任何内购能力**
> 决策依据与 Apple 政策出处：`.workbuddy/memory/topics/iap-planning.md`
> 本文只放**可执行步骤**，真正接入时照着做。

## 0. 一句话结论

上架后加内购 ≈ **2-4 天编码 + 一轮提审往返**。教材数据 / 音频 / 进度体系 / 学习页 UI 全不用动。
**不需要自建后端** —— StoreKit 的交易本身就是 Apple ID 级别的，重装换机可恢复。

---

## 1. 现在就做：App Store Connect 侧（唯一「不做会卡进度」的项）

### 1.1 签署《付费应用程序协议》

| 项 | 内容 |
| --- | --- |
| 前置 | 只有**账户持有人（Account Holder）**能签，需通过双重认证 |
| 路径 | App Store Connect → **Business（商务）** → **Agreements（协议）** → Paid Apps 行 → **View and Agree to Terms** |
| 不签的后果 | 官方规则：只能以**免费**形式上架；且**无法创建任何 App 内购买项目** |
| ⚠️ 注意 | 官方明确「**签署后不可撤销**」（*you can't undo this action*）。这不是风险，它只是开通收款通道 |
| 协议更新 | Apple 出新版时若未同意，**不能创建新 App 或新内购项目** |

### 1.2 银行账户

Business → **Bank Accounts** → 添加收款账户（户名、账号、SWIFT 等，需账户持有人或财务职能）。
中国开发者用境内银行账户即可，Apple 按月结算。

### 1.3 税务表格

Business → **Tax Forms** → **Add Tax Info** → 选 Paid Apps → 完成 **W-8BEN**（个人）或 W-8BEN-E（公司）。
- 非美国开发者**必须**提交美国税表才能收款；
- 表格提交后**无法在后台自行修改**，要改动需联系 Apple；
- 未填只影响**打款**，不影响上架。

> 三项互相独立可并行办；**只有 1.1 是硬前提**。

### 1.4 元数据措辞：首发描述里不要写「无内购」

`docs/ios-appstore-release-guide.md` 第 3.4 节的应用描述示例里目前有一句
「**无广告、无内购**、不收集任何个人信息」。这是**对用户的公开承诺**，
以后加内购就得改描述（元数据改动不需要重新提审，但会被用户和审核员引用）。
建议首发就写成「**无广告、不收集任何个人信息**」，不提内购。

---

## 2. 现在就做：仓库侧（已完成）

| 项 | 位置 | 说明 |
| --- | --- | --- |
| 隐私政策加内购条款 | `privacy-policy.html` / `privacy-deploy/index.html` | 新增「四、App 内购买与支付」，原四~七章顺延为五~八 |
| 支持页加内购 FAQ | `support.html` / `privacy-deploy/support.html` | 新增第 6 条「App 是免费的吗？以后会收费吗？」 |
| 权益判定骨架 | `src/lib/entitlement.ts` | **零引用**，首发恒为「全部解锁」，不进构建产物 |

> ✅ `docs/privacy-policy.html`、`docs/privacy-policy.md`、`docs/privacy-policy-en.*`
> 是 **2026-08-20 的废弃草稿**（正文里还留着「[开发者/公司名，请填写]」占位符），
> 已于 2026-09-15 **从仓库删除**。权威源是仓库根的 `privacy-policy.html` / `support.html`。
> ⚠️ 政策页改完必须**重新部署**（GitHub Pages 随 push 自动更新；WorkBuddy 静态托管需手动触发）
> 才会在线上生效。

---

## 3. 产品 ID 命名规范（先定好，创建后不可修改）

### 3.1 规则

1. 前缀固定为 Bundle ID：`com.annie.dictation.`
2. 全小写，层级用 `.` 分隔：`com.annie.dictation.<group>.<tier>`
3. **语义化、与价格无关** —— 别把价格写进 ID（`pro.68` ✗、`pro.98year` ✗）
4. ID 创建后**不可修改**；删除后**也不可重用**（永久占用）
5. 非消耗型一旦发布就**永远不要换 ID**，否则老用户恢复不到购买

### 3.2 建议清单

| 用途 | 建议 ID | 类型 | 备注 |
| --- | --- | --- | --- |
| 永久解锁全部内容 | `com.annie.dictation.pro.lifetime` | 非消耗型 | **推荐**：买断、无续费争议 |
| 年度订阅 | `com.annie.dictation.pro.yearly` | 自动续期 | 放订阅组 `pro` 的**级别 1** |
| 月度订阅 | `com.annie.dictation.pro.monthly` | 自动续期 | 同组**级别 2** |
| 积分包（不推荐） | `com.annie.dictation.points.small` | 消耗型 | 儿童向 App 用积分包容易被质疑 |

### 3.3 若走订阅路线（额外硬性要求）

- 只建**一个**订阅组（组内一次只能生效一个订阅，避免误购叠加）；组内按内容多少排级别 1 / 2；
- App 内必须同时提供**隐私政策链接 + 使用条款（EULA）链接**。无自拟 EULA 时用 Apple 标准版：
  <https://www.apple.com/legal/internet-services/itunes/dev/stdeula/>；
- 付费墙必须在**无需点击、无需滚动**的情况下展示四要素：**价格 / 计费周期 / 自动续费说明 / 取消路径**；
- 付费墙与账户页都要放 EULA 链接（3.1.2(c) 最高频拒审点）；
- 订阅须**跨用户所有设备可用**，周期 ≥ 7 天；
- 佣金：订阅满 1 年后 85%；可申请 App Store Small Business Program 提前拿 85%。

---

## 4. 接入那个版本要做的事（预告，勿提前做）

1. 装插件（推荐 `@revenuecat/purchases-capacitor`，要求 Capacitor 8+），跑 `npx cap sync ios`；
2. 把 `src/lib/entitlement.ts` 的 `isUnlocked()` 从恒 `true` 改为真实判定 —— **只改这一个文件**，UI 不动；
3. 权益存**独立 key**（`annie.entitlement`），**绝不写进进度对象** ——
   否则 `freshProgress` / `CURRICULUM_VERSION` 升版重置进度时会把已付费权益一起清掉；
4. 权益按**整机**授予（Apple ID 是设备级的，App 内是多角色），不要绑到某个角色；
5. 实现「恢复购买」与「管理订阅」入口，审核会实测；
6. 内购项目**必须与 App 版本一起提审**，不能先上架再单独加；
7. CI（`codemagic.yaml`）要能跑通带新 pod 的 `cap sync`；本机是 Windows，**无法本地调试支付**，
   只能用 TestFlight + 沙盒 Apple ID 验证（沙盒购买不计费、可重复触发）。

## 5. 相关文件

- 决策与政策依据：`.workbuddy/memory/topics/iap-planning.md`
- 发布手册：`docs/ios-appstore-release-guide.md`
- 权益骨架：`src/lib/entitlement.ts`
- 政策页：`privacy-policy.html`、`support.html`（部署副本在 `privacy-deploy/`）

# Capacitor iOS 打包与上架指南

> 本文档记录将「安妮英语听写」从 Vite + React Web App 打包为 iOS App 并提交 App Store 的完整步骤。  
> **Windows 侧可预先完成的步骤已在本项目完成。**  
> 提供两条发布路径：**方案 A（自有 Mac）**——Xcode 手动打包；**方案 B（无 Mac，推荐）**——Codemagic 云端自动打包签名，全程网页操作。  
> 注意：iPad 无法运行 Xcode，**不能替代 Mac 打包**；但 iPad 浏览器可以管理 App Store Connect（提交审核、回复意见），也可安装 TestFlight 做真机测试。

---

## 一、Windows 侧已完成的工作

以下文件与配置已在本机（Windows）准备就绪，提交到 Git 后即可在云端 CI（方案 B）或 Mac（方案 A）上继续：

| 文件 | 说明 |
|---|---|
| `capacitor.config.ts` | Capacitor 主配置，包含 Bundle ID `com.annie.dictation`、应用名、webDir 等 |
| `package.json` | 已添加 `@capacitor/core`（运行时）与 `@capacitor/cli`（开发依赖） |
| `codemagic.yaml` | 云端 CI 打包配置（方案 B 用，云端自动打包/签名/上传 TestFlight） |
| `.gitignore` | 已忽略 `ios/`、`android/` 原生平台目录，避免把生成文件提交到仓库 |
| `assets/app-icon*.png` | App Store 图标资源（1024×1024 及常见 iOS 尺寸） |
| `docs/ios-appstore-release-guide.md` | 完整 App Store 上架流程、成本、审核注意事项 |
| `docs/privacy-policy.html` | 可直接部署的隐私政策静态页面 |

### 1.1 验证 Capacitor CLI

在 Mac 上克隆仓库并安装依赖后，执行：

```bash
npx cap --version
# 应输出 8.x.x
```

### 1.2 构建 Web 产物

Capacitor 读取 `dist/` 目录作为 Web 资源。每次更新前端代码后需重新构建：

```bash
npm run build
```

确保 `dist/index.html` 存在且 `dist/` 包含全部静态资源（含 `audio/` 目录）。

---

## 二、发布路径总览

| | 方案 A：自有 Mac | 方案 B：无 Mac 云 CI（推荐） |
|---|---|---|
| 打包签名 | 本地 Xcode 手动 Archive | Codemagic 云端 Mac 自动打包签名 |
| 需要的设备 | 一台可装 Xcode 26 的 Mac | 仅需 Windows 电脑（现有）+ 浏览器 |
| 成本 | Mac 硬件（二手 Mac mini 约 ¥3000-4000） | ¥0（Codemagic 免费额度 500 分钟/月，一次 iOS 构建约 15-25 分钟） |
| 适合场景 | 长期双端迭代、需要模拟器调试 | 首次发布、偶发更新 |
| 交互调试 | ✅ 可用模拟器/真机断点调试 | ❌ 只能产出包，不能交互调试 |

> 两条路径最终都上传到同一个 App Store Connect 后台，后续提审流程完全一致（见第五节）。

---

## 三、方案 B：无 Mac 云端发布（Codemagic）

### 3.1 原理

Xcode、签名、iOS 编译只能在 macOS 上运行，但 Codemagic 会在云端启动一台真实 Mac（M2 Mac mini），按仓库根目录的 `codemagic.yaml`（**本项目已创建**）自动执行：安装依赖 → 构建 Web 资源 → `cap add/sync ios` → 注入图标与版本号 → 签名打包 → 自动上传 TestFlight。全程只需在网页上点一次「Start build」。

### 3.2 前置准备（全在浏览器中完成）

1. **推送代码到 Git 仓库**（GitHub/GitLab/Bitbucket 均可）：
   - `public/audio/`（114MB 音频）**必须随仓库提交**，否则云端打出的包没有声音。仓库整体约 130MB，在 GitHub 限制内（单文件 100MB、建议仓库 <1GB），首次 push 耗时较长属正常；
   - `ios/` 已在 `.gitignore` 中，云端 CI 会现场生成，不提交。
2. **注册 Apple Developer 账号**（$99/年）并完成激活；
3. **创建 App Store Connect API 密钥**：登录 [App Store Connect](https://appstoreconnect.apple.com) → 用户和访问 → 集成 → 「+」创建密钥，权限选 **App Manager**，下载 `.p8` 文件并记下 Key ID 和 Issuer ID；
4. **注册 Codemagic**（<https://codemagic.io>，可用 GitHub 账号登录）：免费额度 500 分钟/月；
5. 在 Codemagic → Teams → App Store Connect API keys 中录入第 3 步的密钥（用于云端签名与上传）；
6. 在 Codemagic → Applications 中关联 Git 仓库，Codemagic 会自动识别 `codemagic.yaml`。

### 3.3 触发构建

进入 Codemagic 控制台 → 选择 `ios-release` 工作流 → **Start build**。之后：

- 构建日志实时可见，整个过程约 15-25 分钟；
- 构建产物 `.ipa` 可在 Artifacts 下载；
- 配置了 `submit_to_testflight: true`，构建成功后自动上传 TestFlight，无需任何手动操作。

### 3.4 版本迭代

每次发新版本只需改 `codemagic.yaml` 中的两个变量后 push：

```yaml
APP_VERSION: 1.0.1   # 语义化版本，递增
APP_BUILD: 2         # 构建号，每次 +1
```

### 3.5 重要注意事项（踩坑预防）

| 坑 | 说明 |
|---|---|
| **Windows 上不要执行 `npx cap sync ios`** | 会把 `Package.swift` 里的路径写成 Windows 格式，云端 Mac 无法识别。本方案中 iOS 的 sync 完全由 CI 执行，本地只跑 `npm run build` |
| 图标透明通道 | App Store 要求 1024 图标 PNG 无 alpha 透明。若上传时报错，先用 Photoshop/在线工具把 `assets/app-icon-1024.png` 背景压平（填品牌紫 #534AB7） |
| 构建分钟数 | 免费额度 500 分钟/月，一次构建约 15-25 分钟，足够每月 20+ 次构建；失败重试也计费，先确认本地 `npm run build` 通过再触发 |
| 审核备注 | 云端构建与本地构建产物无差别，审核不会因为 CI 构建而被拒，放心使用 |

### 3.6 替代云服务

若不想用 Codemagic，还有两家专为 Capacitor 设计的服务（付费）：

- **Capgo Build**：`bunx @capgo/cli build com.annie.dictation --platform ios` 一条命令从 Windows 直接触发云端打包；
- **Capawesome Cloud**：专为 Capacitor/Ionic 设计，云端 M4 Pro 构建，并提供**浏览器版 iOS 证书生成器**（免 Mac 生成 .p12 证书）。

---

## 四、方案 A：Mac 侧必须执行的步骤

### 4.1 环境要求

- **macOS**：建议 Sonoma 14 或更高版本
- **Xcode**：16 或更高版本（2026-04-28 起 App Store 要求使用 iOS 26 SDK 构建）
- **Node.js**：22.x（与 Windows 侧保持一致）
- **Apple Developer 账号**：个人账号 $99/年，已签署《Apple Developer Program License Agreement》

### 4.2 首次生成 iOS 工程

在 Mac 项目根目录执行：

```bash
# 1. 安装依赖
npm install

# 2. 构建 Web 产物
npm run build

# 3. 生成 iOS 原生工程（仅首次）
npx cap add ios

# 4. 将前端改动同步到 ios/ 目录
npx cap sync ios

# 5. 用 Xcode 打开工程
npx cap open ios
```

> 注意：`npx cap add ios` 只需执行一次。后续修改前端代码后，只需执行 `npm run build && npx cap sync ios`。

### 4.3 Xcode 配置

打开 `ios/App/App.xcworkspace` 后，按顺序完成：

1. **设置 Bundle Identifier**  
   选择 `App` Target → Signing & Capabilities → Bundle Identifier 应已自动填充为 `com.annie.dictation`。  
   **该 ID 创建后不可更改**，请确认与 `capacitor.config.ts` 中一致。

2. **配置签名团队**  
   在 Team 下拉框中选择你的 Apple Developer 账号（个人或公司团队）。

3. **设置版本号**  
   - Version：首次上架建议 `1.0.0`
   - Build：首次建议 `1`
   - 后续每次提审 Version 按语义化递增（1.0.1、1.1.0），Build 每次加 1

4. **配置 App Icon**  
   打开 `Assets.xcassets/AppIcon.appiconset`，将 `assets/` 目录下对应尺寸拖入：
   - 1024×1024 → App Store iOS
   - 180×180 → iPhone 60pt @3x
   - 120×120 → iPhone 60pt @2x
   - 167×167 → iPad 83.5pt @2x
   - 152×152 → iPad 76pt @2x

   或使用 Xcode 的 `Contents.json` 批量导入。可借助工具 [appicon.co](https://appicon.co) 一键生成完整 `AppIcon.appiconset` 文件夹。

5. **启动图 / Launch Screen**  
   默认已有 `LaunchScreen.storyboard`，可在 Xcode 中替换背景色为品牌紫 `#534AB7`，并居中放置耳机图标。

6. **屏幕方向**  
   教育类听写应用建议仅保留 **Portrait**：  
   Target → General → Deployment Info → Device Orientation：仅勾选 Portrait。

### 4.4 隐私与权限配置

打开 `ios/App/App/Info.plist`，确认或添加以下条目：

```xml
<!-- 不收集定位，无需 Location -->
<!-- 无相机/麦克风权限需求：所有音频均为预置文件或在线 TTS URL -->

<!-- 如果未来加入语音输入，需添加： -->
<key>NSMicrophoneUsageDescription</key>
<string>安妮英语听写需要访问麦克风，以便进行语音拼写练习。</string>
```

> 当前版本不需要麦克风权限，请确保 `Info.plist` 中不残留未使用的权限声明，否则会被拒。

### 4.5 测试

#### 4.5.1 模拟器测试

在 Xcode 中选择 iPhone 16 Pro 模拟器，点击 Run（⌘+R）。重点验证：

- 首页年级卡片正常显示
- 学习页音频播放正常
- 单元完成祝贺页弹出与继续学习
- 设置页切换账号、清除数据
- 横竖屏切换下布局无错位

#### 4.5.2 真机测试（TestFlight 前必须做）

1. 用 USB 连接 iPhone
2. 在 Xcode 顶部选择你的设备
3. 点击 Run 安装到真机
4. 断开网络测试离线音频播放
5. 开启飞行模式测试首次启动

---

## 五、提交 TestFlight 与 App Store（两种方案共用）

### 5.1 归档与上传

**方案 B（云 CI）**：跳过本节——`codemagic.yaml` 已配置 `submit_to_testflight: true`，构建完成即自动上传。

**方案 A（Mac）**：

1. Xcode 选择 Any iOS Device (arm64)
2. Product → Archive
3. Organizer 窗口中选择最新归档 → Distribute App → App Store Connect → Upload
4. 等待处理完成（通常 10-30 分钟）

### 5.2 App Store Connect 配置

1. 登录 [App Store Connect](https://appstoreconnect.apple.com)
2. 创建新 App：
   - 平台：iOS
   - 名称：安妮英语听写
   - 主要语言：简体中文
   - Bundle ID：`com.annie.dictation`
   - SKU：建议 `annie-dictation-001`
3. 填写 App 信息：
   - 副标题：小学到初中英语单词听写
   - 类别：教育
   - 年龄分级：4+
   - 价格：免费
4. 上传截图：
   - 6.7 英寸：iPhone 16 Pro Max / 15 Pro Max（必须）
   - 6.5 英寸：iPhone 14 Pro Max / 13 Pro Max（必须）
   - 5.5 英寸：iPhone 8 Plus（可选但建议）
   - iPad Pro 12.9（如果支持 iPad）
5. 填写审核信息：
   - 演示账户：无需登录（本应用使用本地账号）
   - 备注：说明这是一个离线英语听写学习应用，无广告、无第三方 SDK、数据本地存储
   - 联系信息：填写真实手机号
6. 隐私政策 URL：托管 `docs/privacy-policy.html` 后的公开链接

### 5.3 隐私标签

在 App Store Connect → 隐私标签中申报：

| 数据类型 | 是否收集 | 说明 |
|---|---|---|
| 联系信息 | 否 | 不收集姓名、邮箱、电话 |
| 位置 | 否 | 不使用定位 |
| 用户内容 | 否 | 学习数据仅本地存储 |
| 标识符 | 否 | 不使用设备 ID |
| 诊断 | 否 | 不上传崩溃日志 |
| 其他数据 | 否 | 不收集任何个人数据 |

结论：**不收集数据（Data Not Collected）**，这是本应用最大的审核优势。

---

## 六、常见问题与排查

### Q1：构建报错 "AppIcon 尺寸不正确"

确保 `Assets.xcassets/AppIcon.appiconset` 中所有尺寸与 `Contents.json` 严格对应，且为 PNG 格式无 alpha 透明（App Store 1024 图标要求无透明）。

### Q2：音频在真机不播放

检查 `capacitor.config.ts` 中 `ios.scheme` 是否为自定义 scheme。若使用自定义 scheme，音频 URL 需使用相对路径，Capacitor 会自动转换。  
本配置已设为 `AnnieDictation`，Web 代码中 `import.meta.env.BASE_URL` 生成的相对路径可直接使用。

### Q3：iOS 底部按钮被 Home 条遮挡

已在全局样式中加入 `pb-[env(safe-area-inset-bottom)]` 支持。如仍有遮挡，检查 `capacitor.config.ts` 中 `contentInset: "always"` 是否生效。

### Q4：审核被拒 "最低功能不足"

教育类应用功能明确即可。如被拒，强调：三套教材、双口音发音、重点记忆、学习进度追踪、积分激励。

### Q5："无法验证应用开发者"

真机调试需先在 iPhone 设置 → 通用 → VPN 与设备管理中信任开发者证书。

---

## 七、Windows ↔ 云端/Mac 协作建议

1. **Git 管理**：将 `ios/` 和 `android/` 加入 `.gitignore`（已做），避免跨平台生成文件冲突。
2. **前端迭代**：Windows 侧修改代码 → `npm run build` 验证 → 提交 push → Mac 侧 `git pull && npx cap sync ios`。
3. **版本号统一**：每次提审前同步修改 `package.json` 的 `version`、`capacitor.config.ts` 的版本提示、Xcode 中的 Version/Build。
4. **大文件处理**：`public/audio/` 约 114MB，随 `dist/` 一起打包进 App。确保 Git LFS 未误追踪音频文件（音频不应提交到 Git，而应作为构建输入保留在项目目录）。

---

## 八、下一步行动清单

**方案 B（无 Mac，推荐先走通这条路）：**

- [ ] 注册 Apple Developer 账号（$99/年）并激活
- [ ] 推送项目到 GitHub 仓库（含 public/audio 音频）
- [ ] App Store Connect 创建 API 密钥（App Manager 权限）
- [ ] 注册 Codemagic 并关联仓库、录入 API 密钥
- [ ] 网页触发 `ios-release` 构建 → 确认自动上传 TestFlight
- [ ] iPad/iPhone 安装 TestFlight 真机验证
- [ ] App Store Connect 填全元数据 + 隐私标签
- [ ] 提交 App Store 审核

**方案 A（如有 Mac）：**

- [ ] 在 Mac 上安装 Node.js 22.x、Xcode 16+
- [ ] 克隆仓库并执行 `npm install`
- [ ] 执行 `npm run build && npx cap add ios`
- [ ] 在 Xcode 中配置签名、图标、版本号
- [ ] 真机运行验证
- [ ] 上传 TestFlight 内测
- [ ] 准备 App Store 截图与元数据
- [ ] 提交 App Store 审核

---

**参考文档**：
- [Capacitor iOS 文档](https://capacitorjs.com/docs/ios)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect 帮助](https://help.apple.com/app-store-connect/)

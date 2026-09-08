import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // App Store Bundle ID：创建后不可更改，请谨慎确认
  appId: "com.annie.dictation",
  appName: "安妮英语听写",
  webDir: "dist",
  // 说明：bundledWebRuntime 同样是已移除的旧字段（Capacitor 5 起 runtime 改为
  // 自动注入，无需手工开关）。删除不改变任何行为。

  // iOS 专项配置
  ios: {
    // 使用标准 https 协议，避免自定义 scheme 的兼容问题
    scheme: "AnnieDictation",
    // 让 WebView 铺满刘海屏/灵动岛全屏，黑边由 CSS safe-area-inset 处理
    contentInset: "never",
    // WebView 背景色与 App 主题一致，状态栏/底部手势条区域不露黑
    backgroundColor: "#F8F7FF",
    // 说明：Capacitor 8 已移除 minVersion 配置（2.x/3.x 时代的字段），
    // iOS 最低版本由原生模板的 Podfile / Xcode 工程决定，这里改不动。
    // 该字段本来就不被读取，删除不改变任何行为。
    // 允许 release 构建（TestFlight 包）被 Safari Web Inspector 调试。
    // 不加这一项时默认 false —— 即开发版可调试、TestFlight 版不可调试，
    // 导致真机上出现的问题（如 iPad 音频无声）完全无法用 Console / Network
    // 面板查看，只能靠猜。开启后配合 ios-webkit-debug-proxy 即可在
    // Windows 上远程调试 iPad 上的 app。
    // 只影响可调试性，不改变任何运行时行为；不需要时删掉本项即可。
    webContentsDebuggingEnabled: true,
  },

  // 服务器配置：生产包使用本地资源，不依赖远程服务器
  server: {
    // 开发调试时可开启，生产请务必关闭
    // url: "http://localhost:5173/",
    // cleartext: true,
    androidScheme: "https",
    iosScheme: "AnnieDictation",
  },

  // 插件默认配置
  plugins: {
    // 键盘插件：隐藏 iOS 键盘上方"上下箭头"工具栏（代码里 setAccessoryBarVisible(false)）。
    // resize=none：保持现有 visualViewport(--kb-h) 避让方案不变，避免双重压缩
    Keyboard: {
      resize: "none",
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#534AB7",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;

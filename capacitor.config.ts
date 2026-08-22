import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // App Store Bundle ID：创建后不可更改，请谨慎确认
  appId: "com.annie.dictation",
  appName: "安妮英语听写",
  webDir: "dist",
  bundledWebRuntime: false,

  // iOS 专项配置
  ios: {
    // 使用标准 https 协议，避免自定义 scheme 的兼容问题
    scheme: "AnnieDictation",
    // 让 WebView 铺满刘海屏/灵动岛全屏，黑边由 CSS safe-area-inset 处理
    contentInset: "never",
    // WebView 背景色与 App 主题一致，状态栏/底部手势条区域不露黑
    backgroundColor: "#F8F7FF",
    // 编译目标最低版本（Capacitor 8 默认 iOS 14）
    minVersion: "14.0",
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

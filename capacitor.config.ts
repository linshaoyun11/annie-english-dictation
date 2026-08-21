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
    // 允许内容延伸到安全区底部，配合 CSS safe-area-inset-bottom 使用
    contentInset: "always",
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
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#534AB7",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;

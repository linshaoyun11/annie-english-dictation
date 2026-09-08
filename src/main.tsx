import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { recoverStorage } from './lib/storage.ts'

// 渲染前先做存储恢复：iOS 上 localStorage 可能因后台被杀丢写，
// 从原生 Preferences 副本修复后再加载进度/用户数据。
// Web 端无原生副本，此调用立即返回，不影响启动速度。
recoverStorage().catch(() => {}).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

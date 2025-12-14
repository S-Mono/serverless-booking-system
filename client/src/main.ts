import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// 🟢 グローバルAbortErrorハンドラー（vConsoleより先に設定）
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  
  // AbortErrorを多様な方法で検出
  const isAbortError = 
    reason?.name === 'AbortError' ||
    reason?.constructor?.name === 'AbortError' ||
    (reason instanceof Error && reason.name === 'AbortError') ||
    (typeof reason === 'object' && reason !== null && (
      reason.message?.includes('aborted') ||
      reason.message?.includes('user aborted')
    ))
  
  if (isAbortError) {
    event.preventDefault() // コンソールエラーを抑制
    event.stopImmediatePropagation() // 他のリスナーへの伝播を停止
    return false
  }
}, true) // キャプチャフェーズで先に処理

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// グローバルAbortErrorハンドラー（vConsoleより先に設定）
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
  
  // それ以外のエラーは詳細にログ出力
  console.error('=== Unhandled Promise Rejection ===')
  console.error('Reason:', reason)
  console.error('Type:', typeof reason)
  console.error('Stack:', reason?.stack)
}, true) // キャプチャフェーズで先に処理

// グローバルエラーハンドラー
window.addEventListener('error', (event) => {
  console.error('=== Global Error ===')
  console.error('Message:', event.message)
  console.error('Filename:', event.filename)
  console.error('Line:', event.lineno, 'Column:', event.colno)
  console.error('Error:', event.error)
})

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

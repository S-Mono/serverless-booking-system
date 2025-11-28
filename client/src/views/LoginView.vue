<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../lib/firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth'
import liff from '@line/liff'
import { seedDatabase } from '../lib/seed'

const router = useRouter()

const isLoginMode = ref(true)
const phoneNumber = ref('')
const password = ref('')
const loading = ref(false)
const message = ref('')
const liffLoading = ref(true)
const isLineApp = ref(false)
const debugInfo = ref('') // デバッグ用

const PSEUDO_DOMAIN = '@local.booking-system'

// LIFF IDの取得（デバッグ表示用）
const liffIdEnv = import.meta.env.VITE_LIFF_ID || '(未設定)'

onMounted(async () => {
  // 1. UA判定
  const ua = navigator.userAgent
  const isLineUA = /Line/i.test(ua)
  debugInfo.value += `UA: ${ua}\nLineUA判定: ${isLineUA}\n`

  if (isLineUA) {
    isLineApp.value = true
  }

  // 2. Googleリダイレクト復帰チェック
  try {
    const result = await getRedirectResult(auth)
    if (result) {
      router.push('/')
      return
    }
  } catch (error: any) {
    if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/redirect-cancelled-by-user') {
      message.value = `ログインエラー: ${error.message}`
    }
  }

  // 3. LIFF初期化
  try {
    const liffId = import.meta.env.VITE_LIFF_ID
    debugInfo.value += `LIFF ID: ${liffId}\n`

    if (liffId) {
      await liff.init({ liffId })
      debugInfo.value += `LIFF Init成功. InClient: ${liff.isInClient()}\n`

      if (liff.isInClient()) {
        isLineApp.value = true
      }
    } else {
      debugInfo.value += 'ERROR: VITE_LIFF_IDがありません\n'
    }
  } catch (error: any) {
    console.error('LIFF init failed', error)
    debugInfo.value += `LIFF Init失敗: ${error.message}\n`
  } finally {
    liffLoading.value = false
  }
})

// 外部ブラウザを開く処理
const openExternalBrowser = async () => {
  const url = window.location.href

  // LIFFが使えるならLIFFで開く
  if (liff.id && liff.isInClient()) {
    await liff.openWindow({ url, external: true })
  } else {
    // LIFFが使えない場合は通常リンクとして開く（Android等で有効）
    window.open(url, '_system')
    // またはユーザーにコピーを促す
    prompt('以下のURLをブラウザ(Chrome/Safari)で開いてください', url)
  }
}

// 🔵 Googleログイン処理
const loginWithGoogle = async () => {
  loading.value = true
  message.value = ''

  try {
    // A. LINEアプリ内なら強制的に外部ブラウザへ誘導
    if (isLineApp.value) {
      await openExternalBrowser()
      loading.value = false
      return
    }

    const provider = new GoogleAuthProvider()

    // B. ローカル (localhost) -> ポップアップ
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      await signInWithPopup(auth, provider)
      router.push('/')
    }
    // C. 本番スマホ (Chrome/Safari) -> リダイレクト
    else {
      await signInWithRedirect(auth, provider)
    }

  } catch (error: any) {
    console.error(error)
    message.value = `Googleログイン失敗: ${error.message}`
    loading.value = false
  }
}

const handleAuth = async () => {
  loading.value = true
  message.value = ''
  try {
    const pseudoEmail = `${phoneNumber.value}${PSEUDO_DOMAIN}`
    if (isLoginMode.value) {
      await signInWithEmailAndPassword(auth, pseudoEmail, password.value)
      router.push('/')
    } else {
      await createUserWithEmailAndPassword(auth, pseudoEmail, password.value)
      message.value = '登録完了！自動的にログインしました。'
      router.push('/')
    }
  } catch (error: any) {
    console.error(error)
    message.value = `エラー: ${error.message}`
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-container">
    <h2>{{ isLoginMode ? 'ログイン' : '新規会員登録' }}</h2>

    <div v-if="liffLoading" class="loading-text">LINE連携を確認中...</div>

    <div class="social-login">
      <button class="google-btn" @click="loginWithGoogle" :disabled="loading">
        <span class="g-icon">G</span>
        <span v-if="isLineApp">外部ブラウザでGoogleログイン</span>
        <span v-else>Googleでログイン</span>
      </button>

      <div v-if="isLineApp" class="sub-action">
        <p class="hint-text">※うまく開かない場合はこちら↓</p>
        <button class="link-btn" @click="openExternalBrowser">ブラウザ起動</button>
      </div>
    </div>

    <div class="divider"><span>または 電話番号</span></div>

    <form @submit.prevent="handleAuth" class="auth-form">
      <div class="form-group">
        <label>電話番号 (ハイフンなし)</label>
        <input type="tel" v-model="phoneNumber" placeholder="09012345678" required pattern="[0-9]*" />
      </div>
      <div class="form-group">
        <label>パスワード</label>
        <input type="password" v-model="password" placeholder="6文字以上" required minlength="6" />
      </div>
      <button type="submit" class="submit-btn" :disabled="loading">
        {{ loading ? '処理中...' : (isLoginMode ? 'ログイン' : '登録する') }}
      </button>
    </form>

    <p v-if="message" class="message">{{ message }}</p>

    <p class="toggle-mode">
      {{ isLoginMode ? '初めての方はこちら' : 'すでにアカウントをお持ちの方' }}
      <a href="#" @click.prevent="isLoginMode = !isLoginMode">
        {{ isLoginMode ? '新規登録' : 'ログイン' }}
      </a>
    </p>

    <div class="debug-info">
      <details>
        <summary>デバッグ情報</summary>
        <pre>{{ debugInfo }}</pre>
      </details>
    </div>

    <div class="dev-tools">
      <p class="dev-label">開発用ツール</p>
      <button @click="seedDatabase" class="seed-btn">初期データをDBに投入</button>
    </div>
  </div>
</template>

<style scoped>
/* CSSは変更なし */
.auth-container {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #fff;
}

h2 {
  text-align: center;
  margin-bottom: 1.5rem;
}

.loading-text {
  text-align: center;
  color: #666;
  font-size: 0.8rem;
  margin-bottom: 1rem;
}

.social-login {
  margin-bottom: 1.5rem;
}

.google-btn {
  width: 100%;
  background-color: #fff;
  color: #757575;
  border: 1px solid #ddd;
  padding: 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: background 0.2s;
}

.google-btn:hover {
  background-color: #f8f9fa;
}

.g-icon {
  font-weight: 900;
  color: #4285F4;
  font-family: sans-serif;
  font-size: 1.2rem;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin-bottom: 1.5rem;
  color: #999;
  font-size: 0.85rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #ddd;
}

.divider span {
  padding: 0 10px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  text-align: left;
}

label {
  font-weight: bold;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

input {
  padding: 0.8rem;
  font-size: 1.1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.submit-btn {
  background-color: #42b883;
  color: white;
  border: none;
  padding: 0.8rem;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 0.5rem;
  border-radius: 4px;
  font-weight: bold;
}

.submit-btn:disabled {
  background-color: #ccc;
}

.message {
  margin-top: 1rem;
  color: red;
  font-size: 0.9rem;
  text-align: center;
}

.toggle-mode {
  margin-top: 1.5rem;
  font-size: 0.9rem;
  text-align: center;
}

.toggle-mode a {
  color: #3498db;
  font-weight: bold;
  margin-left: 0.5rem;
  text-decoration: none;
}

.toggle-mode a:hover {
  text-decoration: underline;
}

.dev-tools {
  margin-top: 3rem;
  border-top: 1px dashed #ccc;
  padding-top: 1rem;
  text-align: center;
}

.dev-label {
  font-size: 0.8rem;
  color: #999;
  margin-bottom: 0.5rem;
}

.seed-btn {
  background: #666;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.seed-btn:hover {
  background: #444;
}

/* デバッグ用 */
.debug-info {
  margin-top: 1rem;
  font-size: 0.7rem;
  color: #666;
  background: #eee;
  padding: 0.5rem;
  border-radius: 4px;
  overflow-x: auto;
}

.sub-action {
  text-align: center;
  margin-top: 0.5rem;
}

.hint-text {
  font-size: 0.8rem;
  color: #e67e22;
  margin-bottom: 0.2rem;
}

.link-btn {
  background: none;
  border: 1px solid #3498db;
  color: #3498db;
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.8rem;
}
</style>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../lib/firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,      // 👈 追加
  signInWithRedirect,   // 👈 追加
  getRedirectResult     // 👈 追加
} from 'firebase/auth'
import liff from '@line/liff'
import { seedDatabase } from '../lib/seed' // 開発用ツール

const router = useRouter()

// モード切替 (ログイン / 新規登録)
const isLoginMode = ref(true)

// 入力値
const phoneNumber = ref('')
const password = ref('')

// 状態
const loading = ref(false)
const message = ref('')
const liffLoading = ref(true) // LIFF初期化中フラグ

// 擬似メールドメイン
const PSEUDO_DOMAIN = '@local.booking-system'

// 🟢 初期化処理 (リダイレクト復帰 & LIFF初期化)
onMounted(async () => {
  // 1. Googleリダイレクトログインからの帰還チェック
  try {
    const result = await getRedirectResult(auth)
    if (result) {
      console.log('Google Login Success (Redirect):', result.user)
      router.push('/')
      return
    }
  } catch (error: any) {
    console.error('Google Redirect Error:', error)
    // ユーザーキャンセルなどは無視して良いが、エラーなら表示
    if (error.code !== 'auth/popup-closed-by-user') {
      message.value = `ログインエラー: ${error.message}`
    }
  }

  // 2. LIFF初期化
  try {
    const liffId = import.meta.env.VITE_LIFF_ID
    if (liffId) {
      await liff.init({ liffId })

      // LINEブラウザ内ならメールアドレス自動入力などの補助
      if (liff.isLoggedIn()) {
        const decoded = liff.getDecodedIDToken()
        if (decoded && decoded.email) {
          console.log('LINE Email:', decoded.email)
          // 必要ならここに自動入力ロジックを記述
        }
      }
    }
  } catch (error) {
    console.error('LIFF init failed', error)
  } finally {
    liffLoading.value = false
  }
})

// 🔵 Googleログイン処理 (ハイブリッド版)
const loginWithGoogle = async () => {
  loading.value = true
  message.value = ''
  try {
    const provider = new GoogleAuthProvider()

    // 🏠 localhost (開発中) ならポップアップを使う
    // (ローカルでのリダイレクトはCookie設定などでエラーになりやすいため)
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      await signInWithPopup(auth, provider)
      router.push('/')
    }
    // 🚀 本番環境 (LIFF/スマホ) ならリダイレクトを使う
    else {
      // LIFF内なら外部ブラウザへ (Googleのセキュリティポリシー対策)
      if (liff.isInClient()) {
        await liff.openWindow({
          url: window.location.href,
          external: true
        })
        loading.value = false
        return
      }
      // 通常ブラウザならリダイレクト認証
      await signInWithRedirect(auth, provider)
      // ※リダイレクトするため、ここから下の行は実行されません
    }
  } catch (error: any) {
    console.error(error)
    message.value = `Googleログイン失敗: ${error.message}`
    loading.value = false
  }
}

// 📞 電話番号認証処理 (既存)
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
    if (error.code === 'auth/invalid-email') message.value = '電話番号の形式が正しくありません'
    else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') message.value = '電話番号またはパスワードが違います'
    else if (error.code === 'auth/email-already-in-use') message.value = 'この電話番号は既に登録されています'
    else if (error.code === 'auth/weak-password') message.value = 'パスワードは6文字以上で設定してください'
    else message.value = `エラー: ${error.message}`
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
        <span class="g-icon">G</span> Googleでログイン
      </button>
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

    <div class="dev-tools">
      <p class="dev-label">開発用ツール</p>
      <button @click="seedDatabase" class="seed-btn">
        初期データをDBに投入
      </button>
    </div>

  </div>
</template>

<style scoped>
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

/* Googleボタン */
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

/* 開発用ツール */
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
</style>
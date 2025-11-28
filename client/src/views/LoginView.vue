<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '../lib/firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,     // 👈 追加
  browserLocalPersistence // 👈 追加
} from 'firebase/auth'
import { doc, setDoc, Timestamp } from 'firebase/firestore'
import liff from '@line/liff'
// import { seedDatabase } from '../lib/seed' // 開発ツールは不要なら削除

const router = useRouter()

const isLoginMode = ref(true)
const phoneNumber = ref('')
const password = ref('')
const loading = ref(false)
const message = ref('')
const liffLoading = ref(true)
const isLineApp = ref(false)

const PSEUDO_DOMAIN = '@local.booking-system'
const LINE_DOMAIN = '@line.booking-system'

onMounted(async () => {
  // 1. LINEアプリ判定
  if (/Line/i.test(navigator.userAgent)) {
    isLineApp.value = true
  }

  // 2. Googleリダイレクト復帰チェック (ブラウザ用)
  try {
    const result = await getRedirectResult(auth)
    if (result) {
      router.push('/')
      return
    }
  } catch (error: any) {
    if (error.code !== 'auth/popup-closed-by-user') {
      console.error(error)
    }
  }

  // 3. LIFF初期化
  try {
    const liffId = import.meta.env.VITE_LIFF_ID
    if (liffId) {
      await liff.init({ liffId })
      if (liff.isInClient()) {
        isLineApp.value = true
      }
    }
  } catch (error) {
    console.error('LIFF init failed', error)
  } finally {
    liffLoading.value = false
  }
})

// 🟢 LINEアカウントでログイン (LIFF専用: 擬似アカウント)
const loginWithLine = async () => {
  if (!liff.isLoggedIn()) {
    liff.login()
    return
  }

  loading.value = true
  message.value = 'LINEアカウントを確認中...'

  try {
    // 🔒 まず永続化設定を強制する
    await setPersistence(auth, browserLocalPersistence)

    // LINEユーザー情報取得
    const profile = await liff.getProfile()
    const lineUserId = profile.userId
    const lineName = profile.displayName

    // 擬似メールアドレス/パスワード生成
    const firebaseEmail = `line_${lineUserId}${LINE_DOMAIN}`
    const firebasePassword = `line_pass_${lineUserId}` // ユーザーには見せない固定パスワード

    try {
      // A. 既存ユーザーとしてログイン
      await signInWithEmailAndPassword(auth, firebaseEmail, firebasePassword)
    } catch (error: any) {
      // B. ユーザーがいなければ新規登録
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        const userCredential = await createUserWithEmailAndPassword(auth, firebaseEmail, firebasePassword)

        // 顧客データを作成
        await setDoc(doc(db, 'customers', userCredential.user.uid), {
          name_kana: lineName, // 仮の名前としてLINE名を入れる
          phone_number: '',    // 電話番号は後で設定
          line_user_id: lineUserId,
          is_existing_customer: false,
          preferred_category: 'barber',
          created_at: Timestamp.now(),
          updated_at: Timestamp.now()
        })
      } else {
        throw error
      }
    }

    // ログイン成功
    router.push('/')

  } catch (error: any) {
    console.error(error)
    message.value = `LINEログイン失敗: ${error.message}`
    loading.value = false
  }
}

// 🔵 Googleログイン処理 (ブラウザ用)
const loginWithGoogle = async () => {
  loading.value = true
  try {
    await setPersistence(auth, browserLocalPersistence)
    const provider = new GoogleAuthProvider()

    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      await signInWithPopup(auth, provider)
      router.push('/')
    } else {
      await signInWithRedirect(auth, provider)
    }
  } catch (error: any) {
    console.error(error)
    message.value = `Googleログイン失敗: ${error.message}`
    loading.value = false
  }
}

// 📞 電話番号認証処理 (共通)
const handleAuth = async () => {
  loading.value = true
  message.value = ''
  try {
    await setPersistence(auth, browserLocalPersistence)
    const pseudoEmail = `${phoneNumber.value}${PSEUDO_DOMAIN}`

    if (isLoginMode.value) {
      await signInWithEmailAndPassword(auth, pseudoEmail, password.value)
      router.push('/')
    } else {
      await createUserWithEmailAndPassword(auth, pseudoEmail, password.value)
      message.value = '登録完了'
      router.push('/')
    }
  } catch (error: any) {
    // エラーハンドリング (省略)
    message.value = `エラー: ${error.message}`
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-container">
    <h2>{{ isLoginMode ? 'ログイン' : '新規会員登録' }}</h2>

    <div v-if="liffLoading" class="loading-text">LINE連携を確認中...</div>

    <div class="social-login">
      <button v-if="isLineApp" class="line-login-btn" @click="loginWithLine" :disabled="loading">
        <span class="line-icon">L</span> LINEアカウントでログイン
      </button>

      <button v-else class="google-btn" @click="loginWithGoogle" :disabled="loading">
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
  </div>
</template>

<style scoped>
/* (スタイルは変更なし) */
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

.line-login-btn {
  width: 100%;
  background-color: #06C755;
  color: #fff;
  border: none;
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
  transition: opacity 0.2s;
}

.line-login-btn:hover {
  opacity: 0.9;
}

.line-icon {
  font-weight: 900;
  font-family: sans-serif;
  font-size: 1.2rem;
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
</style>
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
  setPersistence,
  browserLocalPersistence,
  type User
} from 'firebase/auth'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import liff from '@line/liff'
import { useDialogStore } from '../stores/dialog' // ダイアログ利用

const dialog = useDialogStore()
const router = useRouter()

const isLoginMode = ref(true)
const phoneNumber = ref('')
const password = ref('')
const loading = ref(false)
const message = ref('')
const liffLoading = ref(true)
const isLineApp = ref(false)
const liffError = ref('') // LIFFエラー情報

const PSEUDO_DOMAIN = '@local.booking-system'
const LINE_DOMAIN = '@line.booking-system'

const createCustomerData = async (user: User, provider: 'google' | 'line' | 'phone', name?: string) => {
  try {
    const docRef = doc(db, 'customers', user.uid)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) {
      await setDoc(docRef, {
        name_kana: name || user.displayName || 'ゲスト',
        phone_number: provider === 'phone' ? user.email?.split('@')[0] : '',
        email: user.email || '',
        is_existing_customer: false,
        preferred_category: 'barber',
        provider: provider,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      })
    }
  } catch (e) { console.error('顧客データ作成エラー:', e) }
}

onMounted(async () => {
  // 1. UA判定 (表示のチラつき防止)
  if (/Line/i.test(navigator.userAgent)) {
    isLineApp.value = true
  }

  // 2. Googleリダイレクト復帰
  try {
    const result = await getRedirectResult(auth)
    if (result) {
      await createCustomerData(result.user, 'google')
      router.push('/')
      return
    }
  } catch (error: any) {
    if (error.code !== 'auth/popup-closed-by-user') {
      message.value = `ログインエラー: ${error.message}`
    }
  }

  // 3. LIFF初期化 (エラーハンドリング強化)
  try {
    const liffId = import.meta.env.VITE_LIFF_ID
    if (!liffId) {
      throw new Error('VITE_LIFF_ID が設定されていません')
    }

    await liff.init({ liffId })

    // 初期化成功
    if (liff.isInClient()) {
      isLineApp.value = true
      liffError.value = '' // エラーなし
    }
  } catch (error: any) {
    console.error('LIFF init failed', error)
    // エラーを画面表示用変数に入れる
    liffError.value = error.message || 'LIFF初期化不明エラー'

    // 開発中はアラートでも出す
    dialog.alert(`LIFF初期化エラー:\n${liffError.value}\n\n設定を見直してください。`, 'システムエラー')
  } finally {
    liffLoading.value = false
  }
})

// 🟢 LINEログイン
const loginWithLine = async () => {
  // LIFF初期化に失敗している場合
  if (liffError.value) {
    dialog.alert(`LIFFが正常に動作していません。\n原因: ${liffError.value}`, 'エラー')
    return
  }

  if (!liff.isInClient()) {
    // ここに来るのは「UAはLINEだがLIFFとして認識されていない」場合
    const currentUrl = window.location.href
    dialog.alert(
      `LINEアプリ内ブラウザとして認識されませんでした。\n\n正しいLIFF URLから開いていますか？\n現在のURL: ${currentUrl}`,
      'エラー'
    )
    return
  }

  if (!liff.isLoggedIn()) {
    liff.login()
    return
  }

  loading.value = true
  message.value = 'LINEアカウントを確認中...'

  try {
    await setPersistence(auth, browserLocalPersistence)
    const profile = await liff.getProfile()
    const lineUserId = profile.userId
    const lineName = profile.displayName

    const firebaseEmail = `line_${lineUserId}${LINE_DOMAIN}`
    const firebasePassword = `line_pass_${lineUserId}`

    let user: User
    try {
      const cred = await signInWithEmailAndPassword(auth, firebaseEmail, firebasePassword)
      user = cred.user
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        const cred = await createUserWithEmailAndPassword(auth, firebaseEmail, firebasePassword)
        user = cred.user
      } else {
        throw error
      }
    }
    await createCustomerData(user, 'line', lineName)
    router.push('/')

  } catch (error: any) {
    console.error(error)
    dialog.alert(`LINEログイン失敗:\n${error.message}`, 'エラー')
    loading.value = false
  }
}

// 🔵 Googleログイン (スマホはリダイレクト)
const loginWithGoogle = async () => {
  loading.value = true
  try {
    await setPersistence(auth, browserLocalPersistence)
    const provider = new GoogleAuthProvider()
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    if (isMobile) {
      await signInWithRedirect(auth, provider)
    } else {
      const result = await signInWithPopup(auth, provider)
      if (result.user) {
        await createCustomerData(result.user, 'google')
        router.push('/')
      }
    }
  } catch (error: any) {
    console.error(error)
    message.value = `Googleログイン失敗: ${error.message}`
    loading.value = false
  }
}

// 📞 電話番号認証
const handleAuth = async () => {
  loading.value = true
  message.value = ''
  try {
    await setPersistence(auth, browserLocalPersistence)
    const pseudoEmail = `${phoneNumber.value}${PSEUDO_DOMAIN}`
    let user: User

    if (isLoginMode.value) {
      const cred = await signInWithEmailAndPassword(auth, pseudoEmail, password.value)
      user = cred.user
    } else {
      const cred = await createUserWithEmailAndPassword(auth, pseudoEmail, password.value)
      user = cred.user
    }
    await createCustomerData(user, 'phone')
    router.push('/')
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
      <button v-if="isLineApp" class="line-login-btn" @click="loginWithLine" :disabled="loading">
        <span class="line-icon">L</span> LINEアカウントでログイン
      </button>

      <button v-else class="google-btn" @click="loginWithGoogle" :disabled="loading">
        <span class="g-icon">G</span> Googleでログイン
      </button>
    </div>

    <p v-if="liffError" class="error-note">⚠️ LINE連携エラー: {{ liffError }}</p>

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
/* 既存スタイル */
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

.error-note {
  color: #e74c3c;
  font-size: 0.8rem;
  background: #fff0f0;
  padding: 0.5rem;
  border-radius: 4px;
  text-align: center;
  margin-bottom: 1rem;
}
</style>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '../lib/firebase' // 👈 dbを追加
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth'
import { doc, setDoc, Timestamp } from 'firebase/firestore' // 👈 追加
import liff from '@line/liff'
import { seedDatabase } from '../lib/seed'

const router = useRouter()

const isLoginMode = ref(true)
const phoneNumber = ref('')
const password = ref('')
const preferredCategory = ref('barber') // 👈 追加: デフォルトは理容

const loading = ref(false)
const message = ref('')
const liffLoading = ref(true)

const PSEUDO_DOMAIN = '@local.booking-system'

onMounted(async () => {
  try {
    const liffId = import.meta.env.VITE_LIFF_ID
    if (liffId) {
      await liff.init({ liffId })
      if (liff.isLoggedIn()) {
        const decoded = liff.getDecodedIDToken()
        if (decoded && decoded.email) {
          console.log('LINE Email:', decoded.email)
        }
      }
    }
  } catch (error) {
    console.error('LIFF init failed', error)
  } finally {
    liffLoading.value = false
  }
})

const loginWithGoogle = async () => {
  loading.value = true
  message.value = ''
  try {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
    router.push('/')
  } catch (error: any) {
    console.error(error)
    message.value = `Googleログイン失敗: ${error.message}`
  } finally {
    loading.value = false
  }
}

const handleAuth = async () => {
  loading.value = true
  message.value = ''

  try {
    const pseudoEmail = `${phoneNumber.value}${PSEUDO_DOMAIN}`

    if (isLoginMode.value) {
      // ログイン
      await signInWithEmailAndPassword(auth, pseudoEmail, password.value)
      router.push('/')
    } else {
      // 新規登録
      const userCredential = await createUserWithEmailAndPassword(auth, pseudoEmail, password.value)

      // 🆕 顧客プロファイルを同時に作成する
      await setDoc(doc(db, 'customers', userCredential.user.uid), {
        phone_number: phoneNumber.value,
        preferred_category: preferredCategory.value, // 👈 選択したカテゴリを保存
        is_existing_customer: false, // 新規なのでfalse
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      })

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

      <div v-if="!isLoginMode" class="form-group">
        <label>よく利用するメニュー <span class="required">必須</span></label>
        <div class="radio-group">
          <label class="radio-item">
            <input type="radio" value="barber" v-model="preferredCategory">
            💈 理容
          </label>
          <label class="radio-item">
            <input type="radio" value="beauty" v-model="preferredCategory">
            💇‍♀️ 美容
          </label>
        </div>
        <p class="hint">※ ログイン時の初期表示に使用します（後で変更可能）</p>
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

.required {
  color: #e74c3c;
  font-size: 0.8rem;
  margin-left: 0.3rem;
}

input[type="tel"],
input[type="password"] {
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

/* ラジオボタン */
.radio-group {
  display: flex;
  gap: 1.5rem;
  padding: 0.5rem;
  border: 1px solid #eee;
  border-radius: 4px;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.hint {
  font-size: 0.8rem;
  color: #999;
  margin-top: 0.5rem;
}
</style>
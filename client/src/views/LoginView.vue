<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../lib/firebase'
import
{
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth'
import liff from '@line/liff'

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

// 🟢 1. LIFF初期化 (LINEから開いた時の準備)
onMounted(async () =>
{
  try
  {
    // .env に設定した LIFF ID を読み込み
    const liffId = import.meta.env.VITE_LIFF_ID
    if (liffId)
    {
      await liff.init({ liffId })
      // 必要に応じてここでLINEのユーザー情報を取得できます
    }
  } catch (error)
  {
    console.error('LIFF init failed', error)
  } finally
  {
    liffLoading.value = false
  }
})

// 🔵 2. Googleログイン処理
const loginWithGoogle = async () =>
{
  loading.value = true
  message.value = ''
  try
  {
    const provider = new GoogleAuthProvider()
    // ポップアップでGoogle認証
    await signInWithPopup(auth, provider)
    router.push('/')
  } catch (error: any)
  {
    console.error(error)
    message.value = `Googleログイン失敗: ${error.message}`
  } finally
  {
    loading.value = false
  }
}

// 📞 3. 電話番号認証処理
const handleAuth = async () =>
{
  loading.value = true
  message.value = ''

  try
  {
    const pseudoEmail = `${phoneNumber.value}${PSEUDO_DOMAIN}`

    if (isLoginMode.value)
    {
      await signInWithEmailAndPassword(auth, pseudoEmail, password.value)
      router.push('/')
    } else
    {
      await createUserWithEmailAndPassword(auth, pseudoEmail, password.value)
      message.value = '登録完了！自動的にログインしました。'
      router.push('/')
    }

  } catch (error: any)
  {
    console.error(error)
    if (error.code === 'auth/invalid-email') message.value = '電話番号の形式が正しくありません'
    else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') message.value = '電話番号またはパスワードが違います'
    else if (error.code === 'auth/email-already-in-use') message.value = 'この電話番号は既に登録されています'
    else if (error.code === 'auth/weak-password') message.value = 'パスワードは6文字以上で設定してください'
    else message.value = `エラー: ${error.message}`
  } finally
  {
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
        <input
          type="tel"
          v-model="phoneNumber"
          placeholder="09012345678"
          required
          pattern="[0-9]*" />
      </div>

      <div class="form-group">
        <label>パスワード</label>
        <input
          type="password"
          v-model="password"
          placeholder="6文字以上"
          required
          minlength="6" />
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
</style>
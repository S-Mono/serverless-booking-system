<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useRouter } from 'vue-router'

const email = ref('')
const password = ref('')
const loading = ref(false)
const message = ref('')
const isLoginMode = ref(true) // ログインモードか登録モードかの切り替えフラグ

const router = useRouter()

// 認証処理
const handleAuth = async () => {
  loading.value = true
  message.value = ''

  try {
    if (isLoginMode.value) {
      // ログイン処理
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      })
      if (error) throw error
      router.push('/') // 成功したらトップページへ移動
    } else {
      // 新規登録処理
      const { error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
      })
      if (error) throw error
      message.value = '登録が完了しました！ログインしてください。'
      isLoginMode.value = true // 登録完了後はログインモードに戻す
    }
  } catch (error) {
    if (error instanceof Error) {
      message.value = `エラー: ${error.message}`
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-container">
    <h2>{{ isLoginMode ? 'ログイン' : '新規会員登録' }}</h2>
    
    <form @submit.prevent="handleAuth" class="auth-form">
      <div class="form-group">
        <label>メールアドレス</label>
        <input type="email" v-model="email" required placeholder="email@example.com" />
      </div>

      <div class="form-group">
        <label>パスワード</label>
        <input type="password" v-model="password" required minlength="6" placeholder="6文字以上" />
      </div>

      <button type="submit" :disabled="loading">
        {{ loading ? '処理中...' : (isLoginMode ? 'ログイン' : '登録する') }}
      </button>
    </form>

    <p v-if="message" class="message">{{ message }}</p>

    <p class="toggle-mode">
      {{ isLoginMode ? 'アカウントをお持ちでない方は' : 'すでにアカウントをお持ちの方は' }}
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
}

input {
  padding: 0.5rem;
  font-size: 1rem;
}

button {
  background-color: #42b883;
  color: white;
  border: none;
  padding: 0.75rem;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 1rem;
}

button:disabled {
  background-color: #ccc;
}

.message {
  margin-top: 1rem;
  color: red;
  font-size: 0.9rem;
}

.toggle-mode {
  margin-top: 1.5rem;
  font-size: 0.9rem;
}
</style>
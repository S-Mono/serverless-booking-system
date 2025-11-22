<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterView } from 'vue-router'

// 💡 Supabaseのテーブル構造に合わせた型定義
interface Service {
  id: number
  name: string
  price: number
  duration_minutes: number
}

// サービス一覧を格納する変数 (初期値は空の配列)
const services = ref<Service[]>([])
const loading = ref<boolean>(true)
const errorMessage = ref<string>('')

// 【重要】ここに先ほどの「get-services」のURLを貼り付けてください
const API_URL = 'https://get-services-799586295685.asia-northeast1.run.app'

onMounted(async () => {
  try {
    const response = await fetch(API_URL)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    // 取得したJSONをService型の配列として格納
    const data = await response.json()
    services.value = data
  } catch (error) {
    if (error instanceof Error) {
      errorMessage.value = `データの取得に失敗しました: ${error.message}`
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <header>
    <div class="container">
      <h1>💈 美理容予約システム</h1>
    </div>
  </header>

  <main class="container">
    <h2>メニュー一覧</h2>

    <p v-if="loading">読み込み中...</p>

    <p v-else-if="errorMessage" class="error">{{ errorMessage }}</p>

    <ul v-else class="service-list">
      <li v-for="service in services" :key="service.id" class="service-item">
        <div class="service-info">
          <span class="service-name">{{ service.name }}</span>
          <span class="service-duration">⏱ {{ service.duration_minutes }}分</span>
        </div>
        <div class="service-price">
          ¥{{ service.price.toLocaleString() }}
        </div>
      </li>
    </ul>

    <RouterView />
  </main>
</template>

<style scoped>
/* シンプルで見やすいスタイル */
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 0 1rem;
}

header {
  background-color: #333;
  color: white;
  padding: 1rem 0;
  margin-bottom: 2rem;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
}

h2 {
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.service-list {
  list-style: none;
  padding: 0;
}

.service-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
  transition: background-color 0.2s;
}

.service-item:hover {
  background-color: #f9f9f9;
}

.service-name {
  font-weight: bold;
  font-size: 1.1rem;
  display: block;
}

.service-duration {
  font-size: 0.85rem;
  color: #666;
}

.service-price {
  font-weight: bold;
  color: #2c3e50;
  font-size: 1.2rem;
}

.error {
  color: red;
  font-weight: bold;
}
</style>
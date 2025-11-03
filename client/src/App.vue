<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { RouterView } from 'vue-router'

  // フロント側はTypeScriptなので型定義は残す
  interface ApiResponse {
    message: string
    timestamp: string
  }

  const apiMessage = ref<string>('APIからデータを取得中...')
  // 【ここにPart 3-2で取得したCloud FunctionsのURLを貼り付けます】
  const API_URL: string = '【Cloud FunctionsのURL】'

  onMounted(async () => {
    try {
      const response = await fetch(API_URL)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data: ApiResponse = await response.json()
      apiMessage.value = `APIからのメッセージ: ${data.message} (時刻: ${data.timestamp})`
    } catch (error) {
      if (error instanceof Error) {
        apiMessage.value = `API通信エラー: ${error.message}`
      } else {
        apiMessage.value = `不明なエラーが発生しました`
      }
      console.error(error)
    }
  })
</script>

<template>
 <header>
    <h1>美理容予約システム (開発中)</h1>
    <p>{{ apiMessage }}</p>
  </header>

  <RouterView />
</template>

<style scoped>
  /* 簡単なスタイリング */
  header {
    line-height: 1.5;
    padding: 1rem;
    border-bottom: 1px solid #ccc;
  }
  h1 {
    font-weight: bold;
  }
</style>

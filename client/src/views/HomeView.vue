<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '../stores/user' // ユーザー情報を取得するため
import { useRouter } from 'vue-router'

// ---------------------------------------------------------
// 型定義
// ---------------------------------------------------------
interface Service {
  id: number
  name: string
  price: number
  duration_minutes: number
}

// ---------------------------------------------------------
// 定数・変数
// ---------------------------------------------------------
// 1. メニュー取得用API (前回と同じ)
const GET_SERVICES_URL = 'https://get-services-799586295685.asia-northeast1.run.app'
// 2. 予約作成用API (今回作ったもの)
const CREATE_RESERVATION_URL = 'https://create-reservation-799586295685.asia-northeast1.run.app'

const userStore = useUserStore()
const router = useRouter()

const services = ref<Service[]>([])
const loading = ref<boolean>(true)
const errorMessage = ref<string>('')

// 予約モーダル用の状態
const showModal = ref(false)
const selectedService = ref<Service | null>(null)
const reservationDate = ref('') // 日時入力用 (例: 2023-11-23T10:00)
const reserving = ref(false)    // 予約処理中フラグ

// ---------------------------------------------------------
// 処理ロジック
// ---------------------------------------------------------

// 初期化：メニュー一覧を取得
onMounted(async () => {
  try {
    const response = await fetch(GET_SERVICES_URL)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    services.value = await response.json()
  } catch (error) {
    if (error instanceof Error) errorMessage.value = `データの取得に失敗: ${error.message}`
  } finally {
    loading.value = false
  }
})

// 「予約する」ボタンを押した時
const openBookingModal = (service: Service) => {
  // ログインしていなければログイン画面へ飛ばす
  if (!userStore.user) {
    alert('予約するにはログインが必要です')
    router.push('/login')
    return
  }
  selectedService.value = service
  showModal.value = true
}

// 「確定」ボタンを押した時
const submitReservation = async () => {
  if (!selectedService.value || !reservationDate.value || !userStore.user) return

  reserving.value = true
  errorMessage.value = ''

  try {
    // APIに送るデータ
    const payload = {
      user_id: userStore.user.id,        // 誰が
      service_id: selectedService.value.id, // どのメニューを
      start_time: new Date(reservationDate.value).toISOString() // いつ
    }

    const response = await fetch(CREATE_RESERVATION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      // APIから返ってきたエラーメッセージを表示 (例: 重複しています)
      const errData = await response.json()
      throw new Error(errData.error || '予約に失敗しました')
    }

    alert('予約が完了しました！')
    showModal.value = false // モーダルを閉じる
    reservationDate.value = '' // 入力をリセット

  } catch (error) {
    if (error instanceof Error) errorMessage.value = error.message
  } finally {
    reserving.value = false
  }
}
</script>

<template>
  <div class="home-container">
    <h2>メニュー一覧</h2>
    
    <p v-if="loading">読み込み中...</p>
    <p v-else-if="errorMessage" class="error">{{ errorMessage }}</p>
    
    <ul v-else class="service-list">
      <li v-for="service in services" :key="service.id" class="service-item">
        <div class="service-info">
          <span class="service-name">{{ service.name }}</span>
          <span class="service-duration">⏱ {{ service.duration_minutes }}分</span>
          <div class="service-price">¥{{ service.price.toLocaleString() }}</div>
        </div>
        <button class="book-btn" @click="openBookingModal(service)">予約する</button>
      </li>
    </ul>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <h3>予約情報の入力</h3>
        <p><strong>メニュー:</strong> {{ selectedService?.name }}</p>
        
        <div class="form-group">
          <label>日時を選択:</label>
          <input type="datetime-local" v-model="reservationDate" />
        </div>

        <div class="modal-actions">
          <button @click="showModal = false" :disabled="reserving">キャンセル</button>
          <button class="primary" @click="submitReservation" :disabled="!reservationDate || reserving">
            {{ reserving ? '予約中...' : '確定する' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container { max-width: 600px; margin: 0 auto; padding-bottom: 2rem; }
h2 { border-bottom: 2px solid #eee; padding-bottom: 0.5rem; margin-bottom: 1rem; }
.error { color: red; font-weight: bold; padding: 1rem; background: #fee; border-radius: 4px; }

.service-list { list-style: none; padding: 0; }
.service-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid #eee; }
.service-info { display: flex; flex-direction: column; gap: 0.2rem; }
.service-name { font-weight: bold; font-size: 1.1rem; }
.service-duration { font-size: 0.85rem; color: #666; }
.service-price { font-weight: bold; color: #2c3e50; }

.book-btn {
  background-color: #3498db; color: white; border: none; padding: 0.5rem 1rem;
  border-radius: 4px; cursor: pointer; transition: background 0.2s;
}
.book-btn:hover { background-color: #2980b9; }

/* モーダル用スタイル */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
}
.modal-content {
  background: white; padding: 2rem; border-radius: 8px; width: 90%; max-width: 400px;
}
.form-group { margin: 1.5rem 0; display: flex; flex-direction: column; gap: 0.5rem;}
input[type="datetime-local"] { padding: 0.5rem; font-size: 1rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; }
button { padding: 0.5rem 1rem; cursor: pointer; }
button.primary { background-color: #42b883; color: white; border: none; border-radius: 4px; }
button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
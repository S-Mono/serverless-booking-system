<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../stores/user'

// データ型の定義 (Supabaseからの返却値に合わせる)
interface Reservation {
  id: number
  start_time: string
  services: {
    name: string
    price: number
  }
}

const userStore = useUserStore()
const reservations = ref<Reservation[]>([])
const loading = ref(true)

// 予約一覧を取得する関数
const fetchReservations = async () => {
  if (!userStore.user) return

  loading.value = true
  try {
    // 自分の予約を取得 (開始時間が新しい順)
    // select('*, services(*)') で、紐付いているメニュー情報も一緒に取ってくる
    const { data, error } = await supabase
      .from('reservations')
      .select('*, services(*)')
      .eq('user_id', userStore.user.id)
      .order('start_time', { ascending: true })

    if (error) throw error
    
    // 型キャスト (any回避のため簡易的に)
    reservations.value = data as any 
  } catch (error) {
    console.error('予約の取得に失敗:', error)
    alert('予約情報の取得に失敗しました')
  } finally {
    loading.value = false
  }
}

// 予約をキャンセル(削除)する関数
const cancelReservation = async (id: number) => {
  if (!confirm('本当にこの予約をキャンセルしますか？')) return

  try {
    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', id)

    if (error) throw error

    alert('予約をキャンセルしました')
    // リストを再読み込みして表示を更新
    fetchReservations()
  } catch (error) {
    console.error('キャンセル失敗:', error)
    alert('キャンセルに失敗しました')
  }
}

// 画面表示時にデータを取得
onMounted(() => {
  fetchReservations()
})

// 日付を見やすく整形する関数
const formatDate = (isoString: string) => {
  return new Date(isoString).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short'
  })
}
</script>

<template>
  <div class="mypage-container">
    <h2>マイページ (予約確認)</h2>

    <p v-if="loading">読み込み中...</p>

    <div v-else>
      <p v-if="reservations.length === 0">現在の予約はありません。</p>

      <ul v-else class="reservation-list">
        <li v-for="res in reservations" :key="res.id" class="reservation-card">
          <div class="card-header">
            <span class="date">{{ formatDate(res.start_time) }}</span>
            <span class="status">予約確定</span>
          </div>
          <div class="card-body">
            <h3>{{ res.services.name }}</h3>
            <p class="price">¥{{ res.services.price.toLocaleString() }}</p>
          </div>
          <div class="card-footer">
            <button class="cancel-btn" @click="cancelReservation(res.id)">キャンセル</button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.mypage-container { max-width: 600px; margin: 0 auto; }
h2 { border-bottom: 2px solid #eee; padding-bottom: 0.5rem; margin-bottom: 1rem; }

.reservation-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 1rem; }
.reservation-card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

.card-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem; color: #666; }
.status { color: #42b883; font-weight: bold; }

.card-body h3 { margin: 0 0 0.5rem 0; font-size: 1.2rem; }
.price { font-weight: bold; font-size: 1.1rem; color: #333; margin: 0; }

.card-footer { margin-top: 1rem; text-align: right; }
.cancel-btn { background: #fff; border: 1px solid #e74c3c; color: #e74c3c; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
.cancel-btn:hover { background: #e74c3c; color: #fff; }
</style>
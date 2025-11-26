<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { db, auth } from '../lib/firebase'
import { collection, query, where, getDocs, deleteDoc, doc, orderBy, Timestamp } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

// データ型の定義
interface Reservation
{
  id: string
  start_at: Timestamp
  menu_items: { title: string; price: number }[]
}

const reservations = ref<Reservation[]>([])
const loading = ref(true)

// 予約一覧を取得する関数
const fetchReservations = async (userId: string) =>
{
  loading.value = true
  try
  {
    // Firestoreから自分の予約を取得
    // customer_id が自分のIDと一致するものを検索
    const q = query(
      collection(db, 'reservations'),
      where('customer_id', '==', userId),
      orderBy('start_at', 'asc')
    )

    const querySnapshot = await getDocs(q)

    reservations.value = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Reservation[]

  } catch (error)
  {
    console.error('予約取得エラー:', error)
    // インデックス未作成エラーが出る場合があるためコンソールを確認できるように
  } finally
  {
    loading.value = false
  }
}

// 予約をキャンセル(削除)する関数
const cancelReservation = async (id: string) =>
{
  if (!confirm('本当にこの予約をキャンセルしますか？')) return

  try
  {
    await deleteDoc(doc(db, 'reservations', id))
    alert('予約をキャンセルしました')

    // リストから削除したものを除外して更新
    reservations.value = reservations.value.filter(res => res.id !== id)
  } catch (error)
  {
    console.error('キャンセル失敗:', error)
    alert('キャンセルに失敗しました')
  }
}

// ログイン状態を監視してデータを取得
onMounted(() =>
{
  onAuthStateChanged(auth, (user) =>
  {
    if (user)
    {
      fetchReservations(user.uid)
    } else
    {
      loading.value = false
    }
  })
})

// 日付を見やすく整形
const formatDate = (ts: Timestamp) =>
{
  const d = ts.toDate()
  return d.toLocaleString('ja-JP', {
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

    <p v-if="loading" class="loading">読み込み中...</p>

    <div v-else>
      <p v-if="reservations.length === 0" class="no-data">現在の予約はありません。</p>

      <ul v-else class="reservation-list">
        <li v-for="res in reservations" :key="res.id" class="reservation-card">
          <div class="card-header">
            <span class="date">{{ formatDate(res.start_at) }}</span>
            <span class="status">予約確定</span>
          </div>
          <div class="card-body">
            <div v-for="(item, index) in res.menu_items" :key="index">
              <h3>{{ item.title }}</h3>
              <p v-if="item.price" class="price">¥{{ item.price.toLocaleString() }}</p>
            </div>
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
.mypage-container {
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: 2rem;
}

h2 {
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 1.5rem;
}

.loading,
.no-data {
  text-align: center;
  color: #666;
  margin-top: 2rem;
}

.reservation-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.reservation-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.card-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #666;
  border-bottom: 1px dashed #eee;
  padding-bottom: 0.5rem;
}

.status {
  color: #42b883;
  font-weight: bold;
}

.date {
  font-weight: bold;
  color: #333;
}

.card-body h3 {
  margin: 0.5rem 0 0.2rem 0;
  font-size: 1.2rem;
}

.price {
  font-weight: bold;
  font-size: 1.1rem;
  color: #2c3e50;
  margin: 0;
}

.card-footer {
  margin-top: 1rem;
  text-align: right;
}

.cancel-btn {
  background: #fff;
  border: 1px solid #e74c3c;
  color: #e74c3c;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #e74c3c;
  color: #fff;
}
</style>
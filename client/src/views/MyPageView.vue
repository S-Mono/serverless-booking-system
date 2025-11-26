<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { db, auth } from '../lib/firebase'
import { collection, query, where, getDocs, deleteDoc, doc, setDoc, Timestamp, orderBy } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

interface Reservation
{
  id: string
  start_at: Timestamp
  menu_items: { title: string; price: number }[]
  status: string
}

const reservations = ref<Reservation[]>([])
const loading = ref(true)
const currentUser = ref<any>(null)
const nameKana = ref('')
const isSavingProfile = ref(false)

// 予約一覧の取得
const fetchReservations = async (userId: string) =>
{
  loading.value = true
  try
  {
    const q = query(
      collection(db, 'reservations'),
      where('customer_id', '==', userId)
    )

    const querySnapshot = await getDocs(q)
    const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Reservation[]

    // クライアント側ソート
    reservations.value = results.sort((a, b) => a.start_at.seconds - b.start_at.seconds)

    // プロフィール取得
    const phone = currentUser.value.email?.split('@')[0]
    if (phone)
    {
      const custQ = query(collection(db, 'customers'), where('phone_number', '==', phone))
      const custSnap = await getDocs(custQ)
      if (!custSnap.empty)
      {
        nameKana.value = custSnap.docs[0].data().name_kana
      }
    }
  } catch (error)
  {
    console.error('Error fetching reservations:', error)
  } finally
  {
    loading.value = false
  }
}

// プロフィールの保存
const saveProfile = async () =>
{
  if (!currentUser.value || !nameKana.value) return
  isSavingProfile.value = true
  try
  {
    const phone = currentUser.value.email?.split('@')[0] || ''
    await setDoc(doc(db, 'customers', currentUser.value.uid), {
      name_kana: nameKana.value,
      phone_number: phone,
      is_existing_customer: true,
      updated_at: Timestamp.now()
    }, { merge: true })
    alert('プロフィールを保存しました')
  } catch (error)
  {
    console.error(error)
    alert('保存失敗')
  } finally
  {
    isSavingProfile.value = false
  }
}

// 予約キャンセル
const cancelReservation = async (id: string) =>
{
  if (!confirm('キャンセルしますか？')) return
  try
  {
    await deleteDoc(doc(db, 'reservations', id))
    alert('予約をキャンセルしました')
    reservations.value = reservations.value.filter(res => res.id !== id)
  } catch (error)
  {
    console.error(error)
    alert('キャンセル失敗')
  }
}

// 初期化
onMounted(() =>
{
  onAuthStateChanged(auth, (user) =>
  {
    currentUser.value = user
    if (user) fetchReservations(user.uid)
    else loading.value = false
  })
})

// 日付整形
const formatDate = (ts: Timestamp) =>
{
  const d = ts.toDate()
  return d.toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short'
  })
}
</script>

<template>
  <div class="mypage-container">
    <h2 class="page-title">マイページ</h2>

    <div class="content-grid">
      <aside class="profile-column">
        <div class="card profile-card">
          <h3>お客様情報</h3>
          <div class="form-group">
            <label>お名前 (カナ)</label>
            <div class="input-row">
              <input type="text" v-model="nameKana" placeholder="例: ヤマダ タロウ" />
            </div>
            <p class="hint">※ 予約時に自動入力されます。</p>
            <button @click="saveProfile" :disabled="isSavingProfile" class="save-btn">
              {{ isSavingProfile ? '保存中...' : '保存する' }}
            </button>
          </div>
        </div>
      </aside>

      <main class="reservation-column">
        <div class="card reservation-container">
          <h3>予約状況</h3>

          <p v-if="loading" class="loading">読み込み中...</p>

          <div v-else>
            <div v-if="reservations.length === 0" class="no-data">
              <p>現在の予約はありません。</p>
              <router-link to="/" class="book-link">予約を入れる</router-link>
            </div>

            <ul v-else class="reservation-list">
              <li v-for="res in reservations" :key="res.id" class="reservation-item">
                <div class="res-header">
                  <span class="date">{{ formatDate(res.start_at) }}</span>
                  <span class="status-badge">予約確定</span>
                </div>
                <div class="res-body">
                  <div v-for="(item, index) in res.menu_items" :key="index" class="menu-item">
                    <span class="menu-title">{{ item.title }}</span>
                    <span v-if="item.price" class="menu-price">¥{{ item.price.toLocaleString() }}</span>
                  </div>
                </div>
                <div class="res-footer">
                  <button class="cancel-btn" @click="cancelReservation(res.id)">キャンセル</button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.mypage-container {
  max-width: 1024px;
  /* 👈 幅を広げました */
  margin: 0 auto;
  padding: 2rem 1rem;
}

.page-title {
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 2rem;
  font-size: 1.5rem;
  color: #333;
}

/* --- グリッドレイアウト --- */
.content-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  /* 左300px, 右残り全部 */
  gap: 2rem;
  align-items: start;
}

/* 共通カードスタイル */
.card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.card h3 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
  color: #2c3e50;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
}

/* --- プロフィールエリア --- */
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.input-row input {
  width: 100%;
  padding: 0.7rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
  /* はみ出し防止 */
}

.hint {
  font-size: 0.8rem;
  color: #666;
  margin: 0.5rem 0 1rem 0;
}

.save-btn {
  width: 100%;
  background: #2c3e50;
  color: white;
  border: none;
  padding: 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.2s;
}

.save-btn:hover {
  background: #34495e;
}

.save-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* --- 予約リストエリア --- */
.loading,
.no-data {
  text-align: center;
  color: #666;
  padding: 2rem 0;
}

.book-link {
  color: #3498db;
  font-weight: bold;
  text-decoration: none;
}

.book-link:hover {
  text-decoration: underline;
}

.reservation-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.reservation-item {
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 1rem;
  background: #fcfcfc;
}

.res-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed #eee;
}

.res-header .date {
  font-weight: bold;
  font-size: 1.1rem;
  color: #333;
}

.status-badge {
  background: #42b883;
  color: white;
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 12px;
}

.res-body {
  margin-bottom: 1rem;
}

.menu-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.3rem;
}

.menu-title {
  font-size: 1rem;
}

.menu-price {
  font-weight: bold;
  color: #555;
}

.res-footer {
  text-align: right;
}

.cancel-btn {
  background: white;
  border: 1px solid #e74c3c;
  color: #e74c3c;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #e74c3c;
  color: white;
}

/* --- 📱 スマホ対応 (レスポンシブ) --- */
@media (max-width: 768px) {
  .content-grid {
    grid-template-columns: 1fr;
    /* 縦1列に変更 */
    gap: 1.5rem;
  }

  /* スマホではプロフィールを下に、予約を上にしても良いかも（今回は順序そのまま） */
}
</style>
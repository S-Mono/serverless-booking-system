<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db, auth } from '../lib/firebase'
import { collection, getDocs, addDoc, query, where, Timestamp } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

// --- 型定義 ---
interface Menu
{
  id: string
  title: string
  price: number
  duration_min: number
  available_staff_ids: string[]
  description?: string
}

const router = useRouter()
const menus = ref<Menu[]>([])
const loading = ref(true)
const processing = ref(false) // 予約処理中フラグ
const errorMessage = ref('')
const currentUser = ref<any>(null)

// --- モーダル用データ ---
const showModal = ref(false)
const selectedMenu = ref<Menu | null>(null)
const reservationDate = ref('') // 入力された日時文字列

// 1. 初期化 (ユーザー監視 & メニュー取得)
onMounted(async () =>
{
  onAuthStateChanged(auth, (user) =>
  {
    currentUser.value = user
  })

  try
  {
    const querySnapshot = await getDocs(collection(db, 'menus'))
    menus.value = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Menu[]
  } catch (error)
  {
    console.error(error)
    errorMessage.value = 'メニューの読み込みに失敗しました'
  } finally
  {
    loading.value = false
  }
})

// 2. モーダルを開く
const openBookingModal = (menu: Menu) =>
{
  if (!currentUser.value)
  {
    alert('予約するにはログインが必要です')
    router.push('/login')
    return
  }
  selectedMenu.value = menu
  showModal.value = true
  errorMessage.value = ''
}

// 3. 予約確定処理 (メインロジック)
const submitReservation = async () =>
{
  if (!selectedMenu.value || !reservationDate.value || !currentUser.value) return

  processing.value = true
  errorMessage.value = ''

  try
  {
    // 時間計算
    const startDate = new Date(reservationDate.value)
    const duration = selectedMenu.value.duration_min
    const endDate = new Date(startDate.getTime() + duration * 60000)

    const startTimestamp = Timestamp.fromDate(startDate)
    const endTimestamp = Timestamp.fromDate(endDate)

    // -----------------------------------------------------
    // 🧠 スタッフ自動割当ロジック (テトリス判定)
    // -----------------------------------------------------

    // A. このメニューを担当できるスタッフ一覧
    const candidateStaffIds = selectedMenu.value.available_staff_ids

    // B. 指定された時間帯に「すでに予約が入っている」予約データを取得
    // (開始時間が希望終了時間より前 かつ 終了時間が希望開始時間より後)
    const q = query(
      collection(db, 'reservations'),
      where('start_at', '<', endTimestamp),
      where('end_at', '>', startTimestamp)
    )
    const snapshot = await getDocs(q)

    // C. 予約が入っているスタッフIDをリストアップ
    const busyStaffIds = new Set<string>()
    snapshot.forEach(doc =>
    {
      const data = doc.data()
      // キャンセルされていない予約のスタッフを除外対象にする
      if (data.status !== 'cancelled' && data.staff_id)
      {
        busyStaffIds.add(data.staff_id)
      }
    })

    // D. 「担当可能」かつ「忙しくない」スタッフを探す
    const availableStaffId = candidateStaffIds.find(id => !busyStaffIds.has(id))

    if (!availableStaffId)
    {
      throw new Error('申し訳ありません。指定された日時は満席です。')
    }

    // -----------------------------------------------------
    // 📝 予約データの作成
    // -----------------------------------------------------

    // DBスキーマ定義に合わせてデータを作成
    const reservationData = {
      customer_id: currentUser.value.uid, // 簡易的にAuthIDを使用（本来はusersテーブル参照）
      customer_phone: currentUser.value.email?.replace('@local.booking-system', '') || 'unknown',
      staff_id: availableStaffId,

      start_at: startTimestamp,
      end_at: endTimestamp,

      // メニューのスナップショット保存
      menu_items: [{
        id: selectedMenu.value.id,
        title: selectedMenu.value.title,
        price: selectedMenu.value.price,
        duration: selectedMenu.value.duration_min
      }],
      total_price: selectedMenu.value.price,
      total_duration_min: selectedMenu.value.duration_min,

      source: 'web', // WEB予約判別用

      status: 'confirmed',
      created_at: Timestamp.now()
    }

    // Firestoreに書き込み
    await addDoc(collection(db, 'reservations'), reservationData)

    alert('予約が完了しました！')
    showModal.value = false
    reservationDate.value = ''

  } catch (error: any)
  {
    console.error(error)
    errorMessage.value = error.message
  } finally
  {
    processing.value = false
  }
}
</script>

<template>
  <div class="home-container">
    <h2>メニュー一覧</h2>

    <p v-if="loading" class="loading">読み込み中...</p>

    <ul v-else class="menu-list">
      <li v-for="menu in menus" :key="menu.id" class="menu-item">
        <div class="menu-info">
          <span class="menu-title">{{ menu.title }}</span>
          <div class="menu-meta">
            <span class="menu-duration">⏱ {{ menu.duration_min }}分</span>
            <span class="menu-price">¥{{ menu.price.toLocaleString() }}</span>
          </div>
        </div>
        <button class="book-btn" @click="openBookingModal(menu)">予約する</button>
      </li>
    </ul>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <h3>予約情報の入力</h3>
        <p class="modal-menu-name">{{ selectedMenu?.title }}</p>

        <div class="form-group">
          <label>日時を選択:</label>
          <input type="datetime-local" v-model="reservationDate" />
        </div>

        <p v-if="errorMessage" class="error-msg">{{ errorMessage }}</p>

        <div class="modal-actions">
          <button class="cancel-btn" @click="showModal = false" :disabled="processing">キャンセル</button>
          <button class="confirm-btn" @click="submitReservation" :disabled="!reservationDate || processing">
            {{ processing ? '処理中...' : '確定する' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: 2rem;
}

h2 {
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 1.5rem;
}

.loading {
  text-align: center;
  color: #666;
}

/* メニューリスト */
.menu-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.menu-info {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.menu-title {
  font-weight: bold;
  font-size: 1.1rem;
}

.menu-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-top: 0.2rem;
}

.menu-duration {
  font-size: 0.9rem;
  color: #555;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
}

.menu-price {
  font-weight: bold;
  color: #2c3e50;
  font-size: 1.1rem;
}

.book-btn {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  white-space: nowrap;
}

.book-btn:hover {
  background-color: #2980b9;
}

/* モーダル */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

.modal-menu-name {
  font-weight: bold;
  margin-bottom: 1.5rem;
  color: #333;
  border-left: 4px solid #3498db;
  padding-left: 10px;
}

.form-group {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

input[type="datetime-local"] {
  padding: 0.8rem;
  font-size: 1.1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.error-msg {
  color: #e74c3c;
  font-weight: bold;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.cancel-btn {
  background: #f0f0f0;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
}

.confirm-btn {
  background: #42b883;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

.confirm-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
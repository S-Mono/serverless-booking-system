<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
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

interface Staff
{
  id: string
  name: string
  roles: {
    accepts_new_customer: boolean
    accepts_free_booking: boolean
  }
  is_working: boolean
}

interface CustomerProfile
{
  id: string
  name_kana: string
  is_existing_customer: boolean
}

const router = useRouter()
const menus = ref<Menu[]>([])
const staffs = ref<Staff[]>([])
const loading = ref(true)
const processing = ref(false)
const errorMessage = ref('')
const currentUser = ref<any>(null)

const customerProfile = ref<CustomerProfile | null>(null)
const isNewUser = ref(false)

const showModal = ref(false)
const selectedMenus = ref<Menu[]>([])
const reservationDate = ref('')
const selectedStaffId = ref<string>('')
const customerNote = ref('') // 👈 追加: メモ入力用

// 現在時刻のISO文字列取得 (min属性用)
const minDateTime = computed(() =>
{
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
})

// --- 1. データ取得 & 名寄せ ---
const checkCustomerStatus = async (user: any) =>
{
  if (!user || !user.email) return
  const phoneNumber = user.email.split('@')[0]
  try
  {
    const q = query(collection(db, 'customers'), where('phone_number', '==', phoneNumber))
    const snapshot = await getDocs(q)
    if (!snapshot.empty)
    {
      const data = snapshot.docs[0].data()
      customerProfile.value = {
        id: snapshot.docs[0].id,
        name_kana: data.name_kana,
        is_existing_customer: data.is_existing_customer
      }
      isNewUser.value = !data.is_existing_customer
    } else
    {
      isNewUser.value = true
      customerProfile.value = null
    }
  } catch (error)
  {
    console.error('名寄せエラー:', error)
  }
}

onMounted(async () =>
{
  onAuthStateChanged(auth, async (user) =>
  {
    currentUser.value = user
    if (user)
    {
      await checkCustomerStatus(user)
      try
      {
        const menuSnap = await getDocs(collection(db, 'menus'))
        menus.value = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Menu[]

        const staffSnap = await getDocs(collection(db, 'staffs'))
        staffs.value = staffSnap.docs.map(doc =>
        {
          const d = doc.data()
          // is_workingがない古いデータはtrue扱い
          return { id: doc.id, ...d, is_working: d.is_working ?? true }
        }) as Staff[]
      } catch (error)
      {
        errorMessage.value = 'データの読み込みに失敗しました'
      } finally
      {
        loading.value = false
      }
    } else
    {
      loading.value = false
    }
  })
})

// --- 2. ロジック: 合計計算 ---
const totalAmount = computed(() =>
{
  return selectedMenus.value.reduce((sum, m) => sum + m.price, 0)
})
const totalDuration = computed(() =>
{
  return selectedMenus.value.reduce((sum, m) => sum + m.duration_min, 0)
})

// --- 3. ロジック: 担当可能スタッフの抽出 ---
const availableStaffs = computed(() =>
{
  if (selectedMenus.value.length === 0) return []
  const staffIdsPerMenu = selectedMenus.value.map(m => m.available_staff_ids)
  const commonStaffIds = staffIdsPerMenu.reduce((a, b) => a.filter(c => b.includes(c)))

  let candidates = staffs.value.filter(s => commonStaffIds.includes(s.id))
  candidates = candidates.filter(s => s.is_working !== false)

  if (isNewUser.value)
  {
    candidates = candidates.filter(s => s.roles.accepts_new_customer)
  }

  return candidates
})

// --- モーダル操作 ---
const openBookingModal = () =>
{
  if (selectedMenus.value.length === 0)
  {
    alert('メニューを選択してください')
    return
  }

  if (availableStaffs.value.length > 0)
  {
    selectedStaffId.value = availableStaffs.value[0].id
  } else
  {
    selectedStaffId.value = ''
  }

  customerNote.value = '' // 👈 メモをリセット
  showModal.value = true
  errorMessage.value = ''
}

const toggleMenu = (menu: Menu) =>
{
  const index = selectedMenus.value.findIndex(m => m.id === menu.id)
  if (index === -1)
  {
    selectedMenus.value.push(menu)
  } else
  {
    selectedMenus.value.splice(index, 1)
  }
}

const isSelected = (menu: Menu) => selectedMenus.value.some(m => m.id === menu.id)

// --- 4. 予約確定処理 ---
const submitReservation = async () =>
{
  if (!reservationDate.value || !currentUser.value || !selectedStaffId.value) return

  processing.value = true
  errorMessage.value = ''

  try
  {
    const startDate = new Date(reservationDate.value)
    const now = new Date()

    if (startDate < now)
    {
      throw new Error('過去の日時は選択できません。未来の日時を指定してください。')
    }

    const duration = totalDuration.value
    const endDate = new Date(startDate.getTime() + duration * 60000)
    const startTimestamp = Timestamp.fromDate(startDate)
    const endTimestamp = Timestamp.fromDate(endDate)

    // 予約数制限チェック
    const limitQ = query(
      collection(db, 'reservations'),
      where('customer_id', '==', currentUser.value.uid),
      where('start_at', '>=', Timestamp.now()),
      where('status', '!=', 'cancelled')
    )
    const limitSnapshot = await getDocs(limitQ)

    if (limitSnapshot.size >= 3)
    {
      throw new Error('予約数の上限(3件)に達しています。\nマイページから既存の予約を確認してください。')
    }

    // 重複チェック
    const q = query(
      collection(db, 'reservations'),
      where('start_at', '<', endTimestamp),
      where('end_at', '>', startTimestamp)
    )
    const snapshot = await getDocs(q)

    let isBusy = false
    snapshot.forEach(doc =>
    {
      const data = doc.data()
      if (data.status !== 'cancelled' && data.staff_id === selectedStaffId.value)
      {
        isBusy = true
      }
    })

    if (isBusy)
    {
      throw new Error('申し訳ありません。指定された日時は担当者が満席です。')
    }

    // 予約登録
    await addDoc(collection(db, 'reservations'), {
      customer_id: customerProfile.value?.id || currentUser.value.uid,
      customer_name: customerProfile.value?.name_kana || 'WEB予約ゲスト',
      customer_phone: currentUser.value.email?.split('@')[0] || 'unknown',

      staff_id: selectedStaffId.value,
      start_at: startTimestamp,
      end_at: endTimestamp,

      menu_items: selectedMenus.value.map(m => ({
        title: m.title,
        price: m.price,
        duration: m.duration_min
      })),
      total_price: totalAmount.value,
      total_duration_min: totalDuration.value,

      source: 'web',
      status: 'pending',
      note: customerNote.value || '', // 👈 メモを保存
      created_at: Timestamp.now()
    })

    alert('予約リクエストを送信しました！\nお店からの確定をお待ちください。')
    showModal.value = false
    reservationDate.value = ''
    selectedMenus.value = []

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

    <p v-if="loading" class="loading">読み込み中...</p>

    <div v-else-if="currentUser">
      <h2>メニュー選択</h2>

      <div class="user-status">
        <p v-if="customerProfile" class="existing">
          ようこそ <strong>{{ customerProfile.name_kana }}</strong> 様
        </p>
        <p v-else class="new">
          ようこそ ゲスト 様 (新規)
        </p>
      </div>

      <ul class="menu-list">
        <li
          v-for="menu in menus"
          :key="menu.id"
          class="menu-item"
          :class="{ active: isSelected(menu) }"
          @click="toggleMenu(menu)">
          <div class="check-icon">{{ isSelected(menu) ? '✅' : '⬜' }}</div>
          <div class="menu-info">
            <span class="menu-title">{{ menu.title }}</span>
            <div class="menu-meta">
              <span class="menu-duration">⏱ {{ menu.duration_min }}分</span>
              <span class="menu-price">¥{{ menu.price.toLocaleString() }}</span>
            </div>
          </div>
        </li>
      </ul>

      <div class="bottom-action" v-if="selectedMenus.length > 0">
        <div class="summary">
          <span>合計: <strong>{{ totalDuration }}分</strong></span>
          <span class="total-price">¥{{ totalAmount.toLocaleString() }}</span>
        </div>
        <button class="book-btn" @click="openBookingModal">
          予約へ進む
        </button>
      </div>
    </div>

    <div v-else class="login-prompt">
      <div class="prompt-card">
        <h2>ようこそ！</h2>
        <p>WEB予約を利用するにはログイン（または会員登録）が必要です。</p>
        <button class="go-login-btn" @click="router.push('/login')">ログイン / 新規登録</button>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <h3>予約内容の確認</h3>

        <div class="selected-list">
          <p v-for="m in selectedMenus" :key="m.id">・{{ m.title }}</p>
        </div>

        <div class="form-group">
          <label>担当スタッフ指名</label>
          <select v-model="selectedStaffId">
            <option v-for="s in availableStaffs" :key="s.id" :value="s.id">
              {{ s.name }} ({{ s.display_name }})
            </option>
          </select>
          <p v-if="availableStaffs.length === 0" class="warn-text">
            ※ 選択されたメニューの組み合わせを担当できるスタッフがいません。<br>
            (または新規のお客様に対応できるスタッフがいません)
          </p>
        </div>

        <div class="form-group">
          <label>日時を選択:</label>
          <input type="datetime-local" v-model="reservationDate" :min="minDateTime" />
        </div>

        <div class="form-group">
          <label>ご要望・メモ (任意)</label>
          <textarea v-model="customerNote" placeholder="髪型の希望や、伝えたいことがあれば入力してください"></textarea>
        </div>

        <p v-if="errorMessage" class="error-msg">{{ errorMessage }}</p>

        <div class="modal-actions">
          <button class="cancel-btn" @click="showModal = false" :disabled="processing">キャンセル</button>
          <button class="confirm-btn" @click="submitReservation"
            :disabled="!reservationDate || !selectedStaffId || processing">
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
  padding-bottom: 6rem;
}

h2 {
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
  text-align: center;
}

.loading {
  text-align: center;
  color: #666;
  margin-top: 2rem;
}

/* 未ログイン時の表示 */
.login-prompt {
  padding: 2rem 1rem;
  text-align: center;
}

.prompt-card {
  background: #f8f9fa;
  padding: 2rem;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.go-login-btn {
  background: #42b883;
  color: white;
  border: none;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: bold;
  border-radius: 30px;
  cursor: pointer;
  margin-top: 1.5rem;
  box-shadow: 0 4px 6px rgba(66, 184, 131, 0.3);
}

.go-login-btn:hover {
  background: #3aa876;
  transform: translateY(-2px);
}

.user-status {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  border: 1px solid #eee;
  font-size: 0.9rem;
}

.existing {
  color: #2c3e50;
}

.new {
  color: #27ae60;
  font-weight: bold;
}

.menu-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #eee;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.menu-item.active {
  border-color: #42b883;
  background-color: #f0fff9;
}

.check-icon {
  font-size: 1.5rem;
}

.menu-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
}

.menu-title {
  font-weight: bold;
  font-size: 1rem;
}

.menu-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  color: #555;
}

.menu-price {
  font-weight: bold;
  color: #2c3e50;
}

.bottom-action {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background: white;
  border-top: 1px solid #ddd;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  display: flex;
  justify-content: center;
  gap: 2rem;
  align-items: center;
  z-index: 50;
}

.summary {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
}

.total-price {
  font-size: 1.2rem;
  font-weight: bold;
  color: #e74c3c;
}

.book-btn {
  background-color: #42b883;
  color: white;
  border: none;
  padding: 0.8rem 2rem;
  border-radius: 30px;
  font-weight: bold;
  font-size: 1.1rem;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(66, 184, 131, 0.3);
}

.book-btn:hover {
  background-color: #3aa876;
  transform: translateY(-2px);
}

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
  max-height: 90vh;
  overflow-y: auto;
}

.selected-list {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
}

.selected-list p {
  margin: 0.2rem 0;
  font-weight: bold;
}

.form-group {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.warn-text {
  color: #e74c3c;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

input,
select {
  padding: 0.8rem;
  font-size: 1.1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

/* テキストエリアのスタイル */
textarea {
  padding: 0.8rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: vertical;
  min-height: 80px;
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
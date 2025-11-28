<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { db, auth } from '../lib/firebase'
import { collection, getDocs, addDoc, query, where, Timestamp, orderBy, getDoc, doc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { useDialogStore } from '../stores/dialog'

const dialog = useDialogStore()
const router = useRouter()

interface Menu { id: string; title: string; price: number; duration_min: number; available_staff_ids: string[]; description?: string; category?: string; }
interface Staff { id: string; name: string; display_name: string; roles: { accepts_new_customer: boolean; accepts_free_booking: boolean }; is_working: boolean; }
interface CustomerProfile { id: string; name_kana: string; is_existing_customer: boolean; preferred_category?: string; } // 👈 preferred_category追加
interface ShopConfig { business_hours: { start: string; end: string }; time_slot_interval: number; tax_rate: number; }

const menus = ref<Menu[]>([])
const staffs = ref<Staff[]>([])
const shopConfig = ref<ShopConfig>({ business_hours: { start: '09:00', end: '19:00' }, time_slot_interval: 30, tax_rate: 10 })
const loading = ref(true)
const processing = ref(false)
const currentUser = ref<any>(null)

const customerProfile = ref<CustomerProfile | null>(null)
const isNewUser = ref(false)

const showModal = ref(false)
const selectedMenus = ref<Menu[]>([])
const reservationDate = ref('')
const selectedStaffId = ref<string>('')
const customerNote = ref('')
const availableSlots = ref<Date[]>([])

// 🟢 タブ管理 (3つに分割)
const activeTab = ref<'barber' | 'beauty' | 'chiro'>('barber')

const minDateTime = computed(() => {
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 16)
})

// --- 表示メニューの切り替え ---
const displayedMenus = computed(() => {
  return menus.value.filter(m => {
    // 互換性: category未設定はbarber扱い
    const cat = m.category || 'barber'
    return cat === activeTab.value
  })
})

const getTaxPrice = (price: number) => Math.ceil(price * (1 + shopConfig.value.tax_rate / 100))
const totalAmount = computed(() => selectedMenus.value.reduce((sum, m) => sum + getTaxPrice(m.price), 0))
const totalDuration = computed(() => selectedMenus.value.reduce((sum, m) => sum + m.duration_min, 0))

const availableStaffs = computed(() => {
  if (selectedMenus.value.length === 0) return []
  const staffIdsPerMenu = selectedMenus.value.map(m => m.available_staff_ids)
  const commonStaffIds = staffIdsPerMenu.reduce((a, b) => a.filter(c => b.includes(c)))
  let candidates = staffs.value.filter(s => commonStaffIds.includes(s.id))
  candidates = candidates.filter(s => (s as any).is_working !== false)
  if (isNewUser.value) candidates = candidates.filter(s => s.roles.accepts_new_customer)
  return candidates
})

const checkCustomerStatus = async (user: any) => {
  // 1. UIDで直接検索 (LoginViewで作成したデータ)
  try {
    const docRef = doc(db, 'customers', user.uid)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      customerProfile.value = {
        id: docSnap.id,
        name_kana: data.name_kana,
        is_existing_customer: data.is_existing_customer,
        preferred_category: data.preferred_category
      }
      isNewUser.value = !data.is_existing_customer

      // 🟢 初期タブの設定
      if (data.preferred_category && ['barber', 'beauty', 'chiro'].includes(data.preferred_category)) {
        activeTab.value = data.preferred_category as any
      }
      return
    }
  } catch (e) { console.error(e) }

  // 2. UIDで見つからない場合、電話番号で名寄せ (レガシーデータ)
  if (!user.email) return
  const phoneNumber = user.email.split('@')[0]
  if (!phoneNumber) return
  try {
    const q = query(collection(db, 'customers'), where('phone_number', '==', phoneNumber))
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data()
      customerProfile.value = {
        id: snapshot.docs[0].id,
        name_kana: data.name_kana,
        is_existing_customer: data.is_existing_customer,
        preferred_category: data.preferred_category
      }
      isNewUser.value = !data.is_existing_customer
      // 初期タブ設定
      if (data.preferred_category) activeTab.value = data.preferred_category as any
    } else {
      isNewUser.value = true
      customerProfile.value = null
    }
  } catch (error) { console.error('名寄せエラー:', error) }
}

onMounted(async () => {
  onAuthStateChanged(auth, async (user) => {
    currentUser.value = user
    if (user) {
      await checkCustomerStatus(user)
      try {
        const menuSnap = await getDocs(collection(db, 'menus'))
        menus.value = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Menu[]
        const staffSnap = await getDocs(collection(db, 'staffs'))
        staffs.value = staffSnap.docs.map(doc => { const d = doc.data(); return { id: doc.id, ...d, is_working: d.is_working ?? true } }) as Staff[]
        const configSnap = await getDoc(doc(db, 'shop_config', 'default_config'))
        if (configSnap.exists()) {
          const data = configSnap.data()
          shopConfig.value = {
            business_hours: data.business_hours || { start: '09:00', end: '19:00' },
            time_slot_interval: data.time_slot_interval || 30,
            tax_rate: data.tax_rate ?? 10
          }
        }
      } catch (error) { dialog.alert('データの読み込みに失敗しました', 'エラー') } finally { loading.value = false }
    } else { loading.value = false }
  })
})

const fetchAvailableSlots = async () => {
  availableSlots.value = []
  if (!selectedStaffId.value || !reservationDate.value || selectedMenus.value.length === 0) return
  try {
    const targetDate = new Date(reservationDate.value)
    const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate); endOfDay.setDate(endOfDay.getDate() + 1); endOfDay.setHours(0, 0, 0, 0)
    const q = query(collection(db, 'reservations'), where('staff_id', '==', selectedStaffId.value), where('start_at', '>=', Timestamp.fromDate(startOfDay)), where('start_at', '<', Timestamp.fromDate(endOfDay)), orderBy('start_at', 'asc'))
    const snapshot = await getDocs(q)
    const busySlots = snapshot.docs.map(doc => doc.data()).filter(d => d.status !== 'cancelled').map(d => ({ start: d.start_at.toDate().getTime(), end: d.end_at.toDate().getTime() }))

    const openTime = parseInt(shopConfig.value.business_hours.start.split(':')[0], 10)
    const closeTime = parseInt(shopConfig.value.business_hours.end.split(':')[0], 10)
    const interval = shopConfig.value.time_slot_interval || 30
    const requiredDuration = totalDuration.value
    let current = new Date(targetDate); current.setHours(openTime, 0, 0, 0)
    const closeDate = new Date(targetDate); closeDate.setHours(closeTime, 0, 0, 0)
    const slots: Date[] = []
    const now = new Date().getTime()
    while (current.getTime() + (requiredDuration * 60000) <= closeDate.getTime()) {
      const slotStart = current.getTime(); const slotEnd = slotStart + (requiredDuration * 60000)
      const isOverlap = busySlots.some(busy => slotStart < busy.end && slotEnd > busy.start)
      const isPast = slotStart < now
      if (!isOverlap && !isPast) slots.push(new Date(current))
      current = new Date(current.getTime() + interval * 60000)
    }
    availableSlots.value = slots
  } catch (e) { console.error('空き状況計算エラー:', e) }
}
watch([reservationDate, selectedStaffId, selectedMenus], () => { fetchAvailableSlots() })

const openBookingModal = () => {
  if (selectedMenus.value.length === 0) return dialog.alert('メニューを選択してください')
  if (availableStaffs.value.length > 0) selectedStaffId.value = availableStaffs.value[0].id; else selectedStaffId.value = ''
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  reservationDate.value = now.toISOString().slice(0, 16)
  customerNote.value = ''; showModal.value = true; fetchAvailableSlots()
}
const selectTime = (time: Date) => {
  const pad = (n: number) => n < 10 ? '0' + n : n
  const str = time.getFullYear() + '-' + pad(time.getMonth() + 1) + '-' + pad(time.getDate()) + 'T' + pad(time.getHours()) + ':' + pad(time.getMinutes())
  reservationDate.value = str
}
const toggleMenu = (menu: Menu) => {
  const index = selectedMenus.value.findIndex(m => m.id === menu.id)
  if (index === -1) selectedMenus.value.push(menu)
  else selectedMenus.value.splice(index, 1)
}
const isSelected = (menu: Menu) => selectedMenus.value.some(m => m.id === menu.id)
const formatTime = (date: Date) => `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
const formatDateJP = (dateStr: string) => { if (!dateStr) return ''; const d = new Date(dateStr); return `${d.getMonth() + 1}月${d.getDate()}日` }

const submitReservation = async () => {
  if (!reservationDate.value || !currentUser.value || !selectedStaffId.value) return
  processing.value = true
  try {
    const startDate = new Date(reservationDate.value); const now = new Date()
    if (startDate < now) throw new Error('過去の日時は選択できません。')
    const duration = totalDuration.value
    const endDate = new Date(startDate.getTime() + duration * 60000)
    const startTimestamp = Timestamp.fromDate(startDate); const endTimestamp = Timestamp.fromDate(endDate)
    const email = currentUser.value?.email || ''; const customerPhone = email.split('@')[0] || 'unknown'; const uid = currentUser.value?.uid || 'unknown'
    const limitQ = query(collection(db, 'reservations'), where('customer_id', '==', customerProfile.value?.id || uid), where('start_at', '>=', Timestamp.now()), where('status', '!=', 'cancelled'))
    const limitSnapshot = await getDocs(limitQ)
    if (limitSnapshot.size >= 3) throw new Error('予約数の上限(3件)に達しています。')
    const q = query(collection(db, 'reservations'), where('start_at', '<', endTimestamp), where('end_at', '>', startTimestamp))
    const snapshot = await getDocs(q)
    let isBusy = false
    snapshot.forEach(doc => { const data = doc.data(); if (data.status !== 'cancelled' && data.staff_id === selectedStaffId.value) isBusy = true })
    if (isBusy) throw new Error('申し訳ありません。指定された日時は担当者が満席です。')
    await addDoc(collection(db, 'reservations'), {
      customer_id: customerProfile.value?.id || uid, customer_name: customerProfile.value?.name_kana || 'WEB予約ゲスト',
      customer_phone: customerPhone, staff_id: selectedStaffId.value, start_at: startTimestamp, end_at: endTimestamp,
      menu_items: selectedMenus.value.map(m => ({ title: m.title, price: getTaxPrice(m.price), duration: m.duration_min })),
      total_price: totalAmount.value, total_duration_min: totalDuration.value, source: 'web', status: 'pending', note: customerNote.value || '', created_at: Timestamp.now()
    })

    // 通知API呼び出し
    try {
      // const NOTIFY_API_URL = '...'; 
      // fetch(NOTIFY_API_URL, ...);
    } catch (e) { }

    await dialog.alert('予約リクエストを送信しました！\nお店からの確定をお待ちください。')
    showModal.value = false; reservationDate.value = ''; selectedMenus.value = []
  } catch (error: any) { console.error(error); await dialog.alert(error.message, 'エラー') } finally { processing.value = false }
}
</script>

<template>
  <div class="home-container">
    <p v-if="loading" class="loading">読み込み中...</p>

    <div v-else-if="currentUser" class="main-content">
      <div class="sticky-tabs">
        <div class="tab-container">
          <button class="tab-btn" :class="{ active: activeTab === 'barber' }" @click="activeTab = 'barber'">💈
            理容</button>
          <button class="tab-btn" :class="{ active: activeTab === 'beauty' }" @click="activeTab = 'beauty'">💇‍♀️
            美容</button>
          <button class="tab-btn" :class="{ active: activeTab === 'chiro' }" @click="activeTab = 'chiro'">💆‍♂️
            カイロ</button>
        </div>
      </div>

      <div class="menu-section-wrapper">
        <div class="menu-header">
          <h2 class="section-title">
            {{ activeTab === 'barber' ? '理容メニュー' : (activeTab === 'beauty' ? '美容メニュー' : 'カイロプラクティック') }}
          </h2>
          <p class="section-desc">
            {{ activeTab === 'chiro' ? '身体のメンテナンスメニューです' : 'ご希望のメニューを選択してください' }}
          </p>
        </div>

        <ul class="menu-list">
          <li v-for="menu in displayedMenus" :key="menu.id" class="menu-item" :class="{ active: isSelected(menu) }"
            @click="toggleMenu(menu)">
            <div class="check-icon">{{ isSelected(menu) ? '✅' : '⬜' }}</div>
            <div class="menu-info">
              <span class="menu-title">{{ menu.title }}</span>
              <div class="menu-meta"><span class="menu-duration">⏱ {{ menu.duration_min }}分</span><span
                  class="menu-price">¥{{ getTaxPrice(menu.price).toLocaleString() }}</span></div>
            </div>
          </li>
        </ul>
        <p v-if="displayedMenus.length === 0" class="no-menu-msg">メニューがありません</p>
      </div>

      <div class="bottom-action" v-if="selectedMenus.length > 0">
        <div class="summary"><span>合計: <strong>{{ totalDuration }}分</strong></span><span class="total-price">¥{{
          totalAmount.toLocaleString() }}</span></div>
        <button class="book-btn" @click="openBookingModal">予約へ進む</button>
      </div>
    </div>

    <div v-else class="login-prompt">
      <div class="prompt-card">
        <h2>ようこそ！</h2>
        <p>WEB予約を利用するにはログイン（または会員登録）が必要です。</p><button class="go-login-btn" @click="router.push('/login')">ログイン /
          新規登録</button>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <h3>予約内容の確認</h3>
        <div class="selected-list">
          <p v-for="m in selectedMenus" :key="m.id">・{{ m.title }}</p>
        </div>
        <div class="form-group"><label>担当スタッフ指名</label><select v-model="selectedStaffId">
            <option v-for="s in availableStaffs" :key="s.id" :value="s.id">{{ s.name }} ({{ s.display_name }})</option>
          </select>
          <p v-if="availableStaffs.length === 0" class="warn-text">※ 対応できるスタッフがいません</p>
        </div>
        <div class="form-group"><label>日時を選択:</label><input type="datetime-local" v-model="reservationDate"
            :min="minDateTime" /></div>
        <div v-if="selectedStaffId && reservationDate" class="availability-section">
          <h4>📅 {{ formatDateJP(reservationDate) }} の空き状況</h4>
          <p class="avail-desc">ご希望の時間を選択してください（所要時間: {{ totalDuration }}分）</p>
          <div v-if="availableSlots.length > 0" class="slot-grid"><button v-for="time in availableSlots"
              :key="time.getTime()" class="slot-btn"
              :class="{ selected: new Date(reservationDate).getTime() === time.getTime() }" @click="selectTime(time)">{{
                formatTime(time) }}</button></div>
          <p v-else class="no-slots-msg">❌ この日の空き枠はありません</p>
        </div>
        <div class="form-group"><label>ご要望・メモ (任意)</label><textarea v-model="customerNote"
            placeholder="髪型の希望など"></textarea></div>
        <div class="modal-actions"><button class="cancel-btn" @click="showModal = false"
            :disabled="processing">キャンセル</button><button class="confirm-btn" @click="submitReservation"
            :disabled="!reservationDate || !selectedStaffId || processing">{{ processing ? '処理中...' : '確定する' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* --- 全体レイアウト --- */
.home-container {
  max-width: 1024px;
  margin: 0 auto;
  padding-bottom: 8rem;
  padding-left: 1rem;
  padding-right: 1rem;
  min-height: 100%;
}

/* --- タブナビゲーション (フォルダ風) --- */
.sticky-tabs {
  position: sticky;
  top: 60px;
  /* ヘッダーの下 */
  z-index: 90;
  background-color: #f4f5f7;
  /* 背景色と合わせる */
  padding-top: 1.5rem;
  margin-bottom: 0;
  /* 下のコンテンツとくっつける */
}

.tab-container {
  display: flex;
  max-width: 1024px;
  margin: 0 auto;
  /* 下線を引いて、アクティブなタブだけその上に乗せる */
  border-bottom: 1px solid #ddd;
}

.tab-btn {
  flex: 1;
  padding: 1rem;
  border: 1px solid transparent;
  border-bottom: none;
  background: #e0e0e0;
  /* 未選択はグレー */
  color: #666;
  font-weight: bold;
  font-size: 1.1rem;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  /* 上だけ丸く */
  transition: all 0.2s;
  margin-right: 4px;
  /* タブ同士の隙間 */
}

.tab-btn:last-child {
  margin-right: 0;
}

.tab-btn:hover {
  background-color: #d5d5d5;
  color: #333;
}

/* アクティブなタブのデザイン */
.tab-btn.active {
  background: #fff;
  /* 白背景 */
  color: #333;
  border-color: #ddd;
  /* 枠線を表示 */
  border-bottom: 1px solid #fff;
  /* 下線を白にしてコンテンツと繋げる */
  margin-bottom: -1px;
  /* 1px下にずらして線を隠す */
  position: relative;
  z-index: 1;
  /* アクセントカラーの帯 */
  border-top: 4px solid #3498db;
}

/* カイロのタブだけ色を変える場合 */
.tab-btn.active:nth-child(2) {
  border-top-color: #27ae60;
}

/* --- コンテンツエリア (枠で囲む) --- */
.menu-section-wrapper {
  background: #fff;
  border: 1px solid #ddd;
  border-top: none;
  /* 上の線はタブに任せる */
  border-radius: 0 0 8px 8px;
  /* 下だけ丸く */
  padding: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  margin-bottom: 2rem;
}

.section-title {
  text-align: center;
  margin-bottom: 0.5rem;
  font-size: 1.5rem;
  color: #333;
  margin-top: 1rem;
}

.section-desc {
  text-align: center;
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 2rem;
}

/* --- ユーザー情報 --- */
.user-status {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 2rem;
  border: 1px solid #eee;
  font-size: 0.95rem;
  text-align: center;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.existing {
  color: #2c3e50;
}

.new {
  color: #27ae60;
  font-weight: bold;
}

/* --- メニューリスト (グリッド) --- */
.menu-list {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid #eee;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.menu-item:hover {
  border-color: #bbb;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.menu-item.active {
  border-color: #42b883;
  background-color: #f0fff9;
  box-shadow: 0 0 0 2px #42b883;
}

.check-icon {
  font-size: 1.5rem;
}

.menu-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.menu-title {
  font-weight: bold;
  font-size: 1.1rem;
}

.menu-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.95rem;
  color: #555;
}

.menu-price {
  font-weight: bold;
  color: #2c3e50;
}

.no-menu-msg {
  text-align: center;
  padding: 4rem;
  color: #999;
  font-size: 1.1rem;
  border: 2px dashed #eee;
  border-radius: 8px;
  background: #fafafa;
}

/* --- その他 --- */
.loading {
  text-align: center;
  color: #666;
  margin-top: 4rem;
}

.login-prompt {
  padding: 4rem 1rem;
  text-align: center;
}

.prompt-card {
  background: #f8f9fa;
  padding: 3rem;
  border-radius: 8px;
  border: 1px solid #ddd;
  max-width: 600px;
  margin: 0 auto;
}

.go-login-btn {
  background: #42b883;
  color: white;
  border: none;
  padding: 1rem 3rem;
  font-size: 1.2rem;
  font-weight: bold;
  border-radius: 30px;
  cursor: pointer;
  margin-top: 2rem;
  box-shadow: 0 4px 6px rgba(66, 184, 131, 0.3);
  transition: transform 0.2s;
}

.go-login-btn:hover {
  transform: translateY(-2px);
  background: #3aa876;
}

/* 下部アクションバー */
.bottom-action {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid #ddd;
  backdrop-filter: blur(5px);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  display: flex;
  justify-content: center;
  gap: 3rem;
  align-items: center;
  z-index: 100;
}

.summary {
  display: flex;
  flex-direction: column;
  font-size: 1rem;
  text-align: right;
}

.total-price {
  font-size: 1.5rem;
  font-weight: bold;
  color: #e74c3c;
}

.book-btn {
  background-color: #42b883;
  color: white;
  border: none;
  padding: 1rem 4rem;
  border-radius: 30px;
  font-weight: bold;
  font-size: 1.2rem;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(66, 184, 131, 0.4);
  transition: background 0.2s, transform 0.2s;
}

.book-btn:hover {
  background-color: #3aa876;
  transform: translateY(-2px);
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
  padding: 2.5rem;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  max-height: 90vh;
  overflow-y: auto;
}

.selected-list {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
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
select,
textarea {
  padding: 0.8rem;
  font-size: 1.1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

textarea {
  resize: vertical;
  min-height: 100px;
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

.availability-section {
  margin-bottom: 1.5rem;
  background: #e8f5e9;
  padding: 1.5rem;
  border-radius: 6px;
  border: 1px solid #c8e6c9;
}

.availability-info h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  color: #2e7d32;
  text-align: center;
}

.avail-desc {
  font-size: 0.9rem;
  color: #555;
  margin-bottom: 1rem;
  text-align: center;
}

.slot-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.8rem;
}

.slot-btn {
  background: white;
  border: 1px solid #4caf50;
  color: #4caf50;
  padding: 0.8rem 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.slot-btn:hover {
  background: #e8f5e9;
  transform: translateY(-1px);
}

.slot-btn.selected {
  background: #4caf50;
  color: white;
  font-weight: bold;
  border-color: #388e3c;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.no-slots-msg {
  text-align: center;
  color: #e65100;
  font-weight: bold;
  font-size: 1rem;
}

/* --- 📱 スマホ対応 --- */
@media (max-width: 768px) {
  .home-container {
    padding-left: 0;
    padding-right: 0;
  }

  /* スマホではタブを少し小さく、横スクロール対応にしても良い */
  .tab-btn {
    font-size: 1rem;
    padding: 0.8rem;
    margin-right: 2px;
    border-radius: 4px 4px 0 0;
  }

  /* コンテンツエリアの角をスマホでは直角に戻して幅いっぱいにする */
  .menu-section-wrapper {
    border-radius: 0;
    border-left: none;
    border-right: none;
    padding: 1.5rem 1rem;
  }

  .menu-list {
    grid-template-columns: 1fr;
    gap: 0.8rem;
  }

  .menu-item {
    padding: 1rem;
  }

  .bottom-action {
    padding: 1rem;
    gap: 1rem;
    flex-direction: column;
  }

  .book-btn {
    width: 100%;
  }

  .summary {
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .modal-content {
    padding: 1.5rem;
  }

  .slot-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
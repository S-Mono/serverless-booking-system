<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { db } from '../lib/firebase'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, Timestamp, onSnapshot, getDoc, type Unsubscribe } from 'firebase/firestore'

interface Staff { id: string; name: string }
interface Reservation
{
  id: string; start_at: Timestamp; end_at: Timestamp; staff_id: string
  customer_name?: string; customer_phone?: string; menu_items: { title: string; duration: number }[]; status: string; source?: 'web' | 'phone'; note?: string
}
interface Menu { id: string; title: string; duration_min: number }
interface ShopConfig { holiday_weekdays: number[]; closed_dates: string[]; business_hours: { start: string; end: string } }

const staffs = ref<Staff[]>([])
const reservations = ref<Reservation[]>([])
const menus = ref<Menu[]>([])
const shopConfig = ref<ShopConfig>({ holiday_weekdays: [], closed_dates: [], business_hours: { start: '09:00', end: '19:00' } })
const loading = ref(true)

const isSidebarOpen = ref(true)
const selectedDate = ref(new Date())
const openHour = ref(9)
const closeHour = ref(19)

let unsubscribe: Unsubscribe | null = null

const isDragging = ref(false)
const dragStaffId = ref<string | null>(null)
const dragStartTime = ref<Date | null>(null)
const dragEndTime = ref<Date | null>(null)
const dragStartX = ref(0)

const showModal = ref(false)
const showDetailModal = ref(false)
const showDeleteModal = ref(false)

const selectedReservation = ref<Reservation | null>(null)
const deleteTargetId = ref<string | null>(null)

const isEditing = ref(false)
const editingId = ref<string | null>(null)

const newReservation = ref({
  staff_id: '', start_time: '', customer_name: '', customer_phone: '', menu_id: '', note: ''
})

const timeLabels = computed(() =>
{
  const labels = []
  for (let i = openHour.value; i < closeHour.value; i++) labels.push(`${i}:00`)
  return labels
})

const changeDate = (diff: number) =>
{
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + diff)
  selectedDate.value = d
}

watch(selectedDate, () => { initData(false) })

const initData = async (fetchMaster = true) =>
{
  loading.value = true
  try
  {
    if (fetchMaster)
    {
      const staffSnap = await getDocs(collection(db, 'staffs'))
      staffs.value = staffSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((s: any) => s.is_working !== false)
        .sort((a: any, b: any) => a.order_priority - b.order_priority) as Staff[]

      const menuSnap = await getDocs(collection(db, 'menus'))
      menus.value = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Menu[]

      const configSnap = await getDoc(doc(db, 'shop_config', 'default_config'))
      if (configSnap.exists())
      {
        shopConfig.value = configSnap.data() as ShopConfig
        // 🔒 安全なアクセスに修正
        const hours = shopConfig.value.business_hours || { start: '09:00', end: '19:00' }
        openHour.value = parseInt(hours.start.split(':')[0], 10)
        closeHour.value = parseInt(hours.end.split(':')[0], 10)
      }
    }

    const startOfDay = new Date(selectedDate.value); startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(selectedDate.value); endOfDay.setDate(endOfDay.getDate() + 1); endOfDay.setHours(0, 0, 0, 0)

    if (unsubscribe) unsubscribe()

    const q = query(
      collection(db, 'reservations'),
      where('start_at', '>=', Timestamp.fromDate(startOfDay)),
      where('start_at', '<', Timestamp.fromDate(endOfDay)),
      orderBy('start_at', 'asc')
    )

    unsubscribe = onSnapshot(q, (snapshot) =>
    {
      reservations.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Reservation[]
      loading.value = false
    })
  } catch (e) { console.error(e); loading.value = false }
}

// ... (submitReservation, deleteReservation, approveReservation などは変更なし) ...
const submitReservation = async () =>
{
  if (!newReservation.value.menu_id) return
  const menu = menus.value.find(m => m.id === newReservation.value.menu_id)
  if (!menu) return
  const startDate = new Date(newReservation.value.start_time)
  const endDate = new Date(startDate.getTime() + menu.duration_min * 60000)
  const payload = {
    staff_id: newReservation.value.staff_id,
    start_at: Timestamp.fromDate(startDate),
    end_at: Timestamp.fromDate(endDate),
    customer_name: newReservation.value.customer_name || '電話予約',
    customer_phone: newReservation.value.customer_phone || '',
    menu_items: [{ title: menu.title, duration: menu.duration_min }],
    source: 'phone',
    note: newReservation.value.note || '',
    status: 'confirmed'
  }
  try
  {
    if (isEditing.value && editingId.value)
    {
      await updateDoc(doc(db, 'reservations', editingId.value), payload)
      alert('予約を更新しました')
    } else
    {
      await addDoc(collection(db, 'reservations'), { ...payload, created_at: Timestamp.now() })
      alert('予約を追加しました')
    }
    showModal.value = false
  } catch (e) { console.error(e); alert('処理失敗') }
}
const confirmDelete = (id: string) => { deleteTargetId.value = id; showDeleteModal.value = true; showDetailModal.value = false }
const executeDelete = async () => { if (!deleteTargetId.value) return; try { await deleteDoc(doc(db, 'reservations', deleteTargetId.value)); showDeleteModal.value = false; deleteTargetId.value = null } catch (e) { alert('削除失敗') } }
const openReservationDetail = (res: Reservation) => { selectedReservation.value = res; showDetailModal.value = true }
const approveReservation = async (id: string) => { try { await updateDoc(doc(db, 'reservations', id), { status: 'confirmed' }); alert('確定しました'); showDetailModal.value = false } catch (e) { alert('失敗') } }
const openEditModal = (res: Reservation) =>
{
  const matchedMenu = menus.value.find(m => m.title === res.menu_items[0].title)
  newReservation.value = {
    staff_id: res.staff_id,
    start_time: toLocalISOString(res.start_at.toDate()),
    customer_name: res.customer_name || '',
    customer_phone: res.customer_phone || '',
    menu_id: matchedMenu ? matchedMenu.id : '',
    note: res.note || ''
  }
  isEditing.value = true; editingId.value = res.id; showDetailModal.value = false; showModal.value = true
}

const getLeftPosition = (startTs: Timestamp) =>
{
  const date = startTs.toDate()
  let minutesFromOpen = (date.getHours() - openHour.value) * 60 + date.getMinutes()
  if (minutesFromOpen < 0) minutesFromOpen = 0
  const totalOpenMinutes = (closeHour.value - openHour.value) * 60
  return (minutesFromOpen / totalOpenMinutes) * 100
}
const getWidth = (startTs: Timestamp, endTs: Timestamp) =>
{
  let start = startTs.toDate().getTime(); const end = endTs.toDate().getTime()
  const openTime = new Date(startTs.toDate()); openTime.setHours(openHour.value, 0, 0, 0)
  if (start < openTime.getTime()) start = openTime.getTime()
  const durationMinutes = (end - start) / 60000
  const totalOpenMinutes = (closeHour.value - openHour.value) * 60
  return (durationMinutes / totalOpenMinutes) * 100
}
const onMouseDown = (e: MouseEvent, staffId: string) =>
{
  isDragging.value = true; dragStaffId.value = staffId
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left; dragStartX.value = (x / rect.width) * 100
  const totalMinutes = (closeHour.value - openHour.value) * 60
  const minutes = Math.floor(totalMinutes * (x / rect.width)); const roundedMinutes = Math.floor(minutes / 15) * 15
  const date = new Date(selectedDate.value); date.setHours(openHour.value, roundedMinutes, 0, 0)
  dragStartTime.value = date; dragEndTime.value = new Date(date.getTime() + 15 * 60000)
}
const onMouseMove = (e: MouseEvent) =>
{
  if (!isDragging.value || !dragStartTime.value) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left
  const minutes = Math.floor(((closeHour.value - openHour.value) * 60) * (x / rect.width))
  const date = new Date(selectedDate.value); date.setHours(openHour.value, minutes, 0, 0)
  const roundedDate = new Date(Math.ceil(date.getTime() / (900000)) * 900000)
  if (roundedDate > dragStartTime.value) dragEndTime.value = roundedDate
}
const onMouseUp = () =>
{
  if (!isDragging.value || !dragStaffId.value || !dragStartTime.value || !dragEndTime.value) { isDragging.value = false; return }
  isEditing.value = false; editingId.value = null
  newReservation.value = {
    staff_id: dragStaffId.value,
    start_time: toLocalISOString(dragStartTime.value),
    customer_name: '', customer_phone: '', menu_id: '', note: ''
  }
  showModal.value = true; isDragging.value = false; dragStaffId.value = null
}
const formatTime = (ts: Timestamp) => { const d = ts.toDate(); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` }
const getStaffName = (id: string) => staffs.value.find(s => s.id === id)?.name || '未定'
const toLocalISOString = (date: Date) =>
{
  const pad = (n: number) => n < 10 ? '0' + n : n
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes())
}
const formatDateJP = (d: Date) => { const days = ['日', '月', '火', '水', '木', '金', '土']; return `${d.getFullYear()}年 ${d.getMonth() + 1}月 ${d.getDate()}日 (${days[d.getDay()]})` }
const getDragBarStyle = computed(() =>
{
  if (!dragStartTime.value || !dragEndTime.value) return {}
  const start = dragStartTime.value.getTime(); const end = dragEndTime.value.getTime()
  const totalOpenMinutes = (closeHour.value - openHour.value) * 60 * 60000
  const openTime = new Date(dragStartTime.value); openTime.setHours(openHour.value, 0, 0, 0)
  const left = ((start - openTime.getTime()) / totalOpenMinutes) * 100
  const width = ((end - start) / totalOpenMinutes) * 100
  return { left: `${left}%`, width: `${width}%` }
})
const getTooltipText = (res: Reservation) =>
{
  const sourceType = res.source === 'phone' ? '【電話】' : '【WEB】'
  const statusText = res.status === 'pending' ? '【仮予約】' : ''
  let text = `${statusText}${sourceType}\n${formatTime(res.start_at)} - ${formatTime(res.end_at)}\n${res.menu_items[0]?.title}\n${res.customer_name || '名称未設定'}`
  if (res.note) text += `\n📝 ${res.note}`
  return text
}
const getReservationClass = (res: Reservation) =>
{
  if (res.status === 'pending') return 'res-pending'
  return res.source === 'phone' ? 'res-phone' : 'res-web'
}
const calendarDays = computed(() =>
{
  const year = selectedDate.value.getFullYear(); const month = selectedDate.value.getMonth()
  const firstDay = new Date(year, month, 1); const lastDay = new Date(year, month + 1, 0)
  const days = []
  for (let i = 0; i < firstDay.getDay(); i++) days.push({ day: '', isCurrentMonth: false })
  for (let d = 1; d <= lastDay.getDate(); d++)
  {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dateObj = new Date(year, month, d)
    const isHoliday = shopConfig.value.holiday_weekdays?.includes(dateObj.getDay()) || shopConfig.value.closed_dates?.includes(dateStr)
    days.push({ day: d, dateStr, isCurrentMonth: true, isHoliday, isSelected: d === selectedDate.value.getDate() })
  }
  return days
})
const selectCalendarDate = (day: any) => { if (!day.isCurrentMonth) return; const newDate = new Date(selectedDate.value); newDate.setDate(day.day); selectedDate.value = newDate }

onMounted(() => { initData() })
onUnmounted(() => { if (unsubscribe) unsubscribe() })
</script>

<template>
  <div class="admin-container">
    <header class="admin-header">
      <div class="header-left">
        <h2>予約管理ダッシュボード</h2>
      </div>
      <div class="header-right">
        <div class="status-badge">🟢 リアルタイム接続中</div>
        <button @click="$router.push('/admin/settings')" class="settings-link-btn">⚙ 設定</button>
      </div>
    </header>
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else class="admin-body">
      <div class="panel-left" :class="{ collapsed: !isSidebarOpen }">
        <div class="panel-header">
          <template v-if="isSidebarOpen">
            <h3>予約リスト</h3><button class="toggle-btn" @click="isSidebarOpen = false">◀</button>
          </template>
          <div v-else class="collapsed-content" @click="isSidebarOpen = true"><button
              class="toggle-btn open">▶</button><span
              class="vertical-text">予約リスト</span></div>
        </div>
        <div v-if="isSidebarOpen" class="kanban-list-container">
          <div class="kanban-list">
            <transition-group name="list">
              <div v-for="res in reservations" :key="res.id" class="kanban-card" :class="getReservationClass(res)"
                @click="openReservationDetail(res)">
                <div class="card-left">
                  <div class="time-box"><span class="time">{{ formatTime(res.start_at) }}</span><span
                      v-if="res.status === 'pending'" class="status-icon-pending">未</span><span v-else
                      class="source-icon">{{
                        res.source === 'phone' ? '📞' : '🌐' }}</span></div>
                </div>
                <div class="details">
                  <div class="menu-title">{{ res.menu_items[0]?.title }}</div>
                  <div class="customer-info">
                    <div v-if="res.customer_name" class="c-row"><span class="icon">👤</span> {{ res.customer_name }}
                    </div>
                  </div>
                  <div class="staff-badge">担当: {{ getStaffName(res.staff_id) }}</div>
                </div>
              </div>
            </transition-group>
            <p v-if="reservations.length === 0" class="no-data">予約はありません</p>
          </div>
        </div>
      </div>
      <div class="panel-right">
        <div class="calendar-bar">
          <button class="date-nav-btn" @click="changeDate(-1)">◀ 前日</button>
          <div class="calendar-dropdown-wrapper">
            <div class="current-date"><span class="date-text">{{ formatDateJP(selectedDate) }}</span></div>
            <div class="mini-calendar-popup">
              <div class="calendar-grid">
                <div class="day-label" v-for="d in ['日', '月', '火', '水', '木', '金', '土']" :key="d">{{ d }}</div>
                <div v-for="(day, idx) in calendarDays" :key="idx" class="day-cell"
                  :class="{ 'is-holiday': day.isHoliday, 'is-selected': day.isSelected, 'empty': !day.isCurrentMonth }"
                  @click="selectCalendarDate(day)">{{ day.day }}</div>
              </div>
            </div>
          </div>
          <button class="date-nav-btn" @click="changeDate(1)">翌日 ▶</button>
          <button class="today-btn" @click="selectedDate = new Date()">今日</button>
        </div>
        <div class="timeline-container">
          <div class="timeline-header">
            <div class="staff-header-cell"></div>
            <div class="time-scale">
              <div v-for="label in timeLabels" :key="label" class="time-label-cell">{{ label }}</div>
            </div>
          </div>
          <div class="timeline-body" @mouseleave="isDragging = false">
            <div v-for="staff in staffs" :key="staff.id" class="staff-row">
              <div class="staff-cell">{{ staff.name }}</div>
              <div class="timeline-cell" @mousedown="onMouseDown($event, staff.id)" @mousemove="onMouseMove"
                @mouseup="onMouseUp">
                <div class="grid-lines">
                  <div v-for="label in timeLabels" :key="label" class="grid-line"></div>
                </div>
                <transition-group name="fade">
                  <template v-for="res in reservations" :key="res.id">
                    <div v-if="res.staff_id === staff.id" class="reservation-bar" :class="getReservationClass(res)"
                      :style="{ left: `${getLeftPosition(res.start_at)}%`, width: `${getWidth(res.start_at, res.end_at)}%` }"
                      :title="getTooltipText(res)" @mousedown.stop @click.stop="openReservationDetail(res)">
                      <span class="bar-text"><span v-if="res.status === 'pending'">【未】</span>{{ res.menu_items[0]?.title
                      }} <span v-if="res.customer_name">/ {{ res.customer_name }}</span></span>
                    </div>
                  </template>
                </transition-group>
                <div v-if="isDragging && dragStaffId === staff.id" class="drag-preview-bar" :style="getDragBarStyle">
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <div class="modal-header-row">
          <h3>{{ isEditing ? '予約の編集' : '新規予約 (電話受付)' }}</h3><button class="close-x-btn"
            @click="showModal = false">×</button>
        </div>
        <div class="form-group"><label>担当スタッフ</label><select v-model="newReservation.staff_id" disabled>
            <option v-for="s in staffs" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select></div>
        <div class="form-group"><label>開始日時</label><input type="datetime-local" v-model="newReservation.start_time">
        </div>
        <div class="form-group"><label>メニュー</label><select v-model="newReservation.menu_id">
            <option value="" disabled>選択してください</option>
            <option v-for="m in menus" :key="m.id" :value="m.id">{{ m.title }} ({{ m.duration_min }}分)</option>
          </select></div>
        <div class="form-group"><label>顧客名 (任意)</label><input type="text" v-model="newReservation.customer_name"
            placeholder="例: 山田様"></div>
        <div class="form-group"><label>電話番号 (任意)</label><input type="tel" v-model="newReservation.customer_phone"
            placeholder="09012345678"></div>
        <div class="form-group"><label>メモ</label><textarea v-model="newReservation.note"
            placeholder="特記事項..."></textarea>
        </div>
        <div class="modal-actions right-align"><button class="save-btn" @click="submitReservation">{{ isEditing ? '更新する'
          :
          '登録する' }}</button></div>
      </div>
    </div>
    <div v-if="showDetailModal && selectedReservation" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal-content detail-modal">
        <div class="modal-header-row">
          <h3>予約詳細</h3><button class="close-x-btn" @click="showDetailModal = false">×</button>
        </div>
        <div v-if="selectedReservation.status === 'pending'" class="pending-alert">
          <p>⚠️ <strong>WEBからの仮予約です</strong></p><button class="approve-btn"
            @click="approveReservation(selectedReservation.id)">✅ 予約を確定する</button>
        </div>
        <div class="detail-body">
          <div class="detail-row"><span class="label">日時:</span> {{ formatTime(selectedReservation.start_at) }} - {{
            formatTime(selectedReservation.end_at) }}</div>
          <div class="detail-row"><span class="label">メニュー:</span> {{ selectedReservation.menu_items[0]?.title }}</div>
          <div class="detail-row"><span class="label">顧客名:</span> {{ selectedReservation.customer_name || '名称未設定' }}
          </div>
          <div class="detail-row"><span class="label">電話:</span> {{ selectedReservation.customer_phone || 'なし' }}</div>
          <div class="detail-row"><span class="label">担当:</span> {{ getStaffName(selectedReservation.staff_id) }}</div>
          <div class="detail-row"><span class="label">状態:</span> <span
              :class="selectedReservation.status === 'pending' ? 'status-pending' : 'status-confirmed'">{{
                selectedReservation.status === 'pending' ? '仮予約' : '確定済み' }}</span></div>
          <div class="detail-note">
            <div class="label">メモ:</div>
            <div class="note-content">{{ selectedReservation.note || '（なし）' }}</div>
          </div>
        </div>
        <div class="modal-actions split">
          <button class="delete-confirm-btn" @click="confirmDelete(selectedReservation.id)">🗑️ 削除</button>
          <button class="edit-btn" @click="openEditModal(selectedReservation)">✏️ 編集</button>
        </div>
      </div>
    </div>
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal-content delete-modal">
        <h3>予約の削除</h3>
        <p class="delete-msg">この予約を本当に削除しますか？<br>この操作は取り消せません。</p>
        <div class="modal-actions">
          <button class="cancel-btn" @click="showDeleteModal = false">キャンセル</button>
          <button class="delete-confirm-btn" @click="executeDelete">削除する</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* (CSSは前回提示したcompact & full-width版をそのまま使用しています) */
.admin-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f4f5f7;
  width: 100%;
}

.admin-header {
  background: #2c3e50;
  color: white;
  padding: 0 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 45px;
  flex-shrink: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-badge {
  background: #27ae60;
  color: white;
  font-size: 0.7rem;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-weight: bold;
  white-space: nowrap;
}

.settings-link-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}

.settings-link-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.admin-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  width: 100%;
  position: relative;
}

.panel-left {
  width: 35%;
  min-width: 300px;
  background: #ebecf0;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.3s ease, min-width 0.3s ease;
}

.panel-left.collapsed {
  width: 40px;
  min-width: 40px;
  align-items: center;
  cursor: pointer;
  background: #dcdde1;
}

.panel-left.collapsed:hover {
  background: #d0d1d6;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  min-height: 35px;
  padding: 0.5rem 1rem;
  box-sizing: border-box;
  flex-shrink: 0;
}

.panel-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #333;
  white-space: nowrap;
}

.toggle-btn {
  background: transparent;
  border: none;
  font-size: 1rem;
  color: #666;
  cursor: pointer;
  padding: 0 5px;
}

.collapsed-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  height: 100%;
  width: 100%;
  padding-top: 0.5rem;
}

.vertical-text {
  writing-mode: vertical-rl;
  text-orientation: upright;
  font-weight: bold;
  color: #555;
  letter-spacing: 3px;
  margin-top: 0.5rem;
  white-space: nowrap;
  font-size: 0.9rem;
}

.kanban-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 0 0.8rem 0.8rem 0.8rem;
}

.kanban-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-end;
  width: 100%;
}

.no-data {
  text-align: center;
  color: #999;
  margin-top: 2rem;
  font-size: 0.9rem;
}

.kanban-card {
  background: white;
  padding: 0.6rem;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 0.8rem;
  align-items: flex-start;
  border-left: 4px solid #ccc;
  transition: all 0.3s ease;
  width: 100%;
  max-width: 450px;
  position: relative;
  cursor: pointer;
}

.kanban-card:hover {
  transform: translateX(-2px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.kanban-card.res-web {
  border-left-color: #3498db;
}

.kanban-card.res-phone {
  border-left-color: #e67e22;
}

.kanban-card.res-pending {
  border-left-color: #9b59b6;
  background-color: #fbfaff;
}

.status-icon-pending {
  color: #9b59b6;
  font-weight: bold;
  font-size: 0.8rem;
  border: 1px solid #9b59b6;
  padding: 1px 3px;
  border-radius: 4px;
}

.status-pending {
  color: #9b59b6;
  font-weight: bold;
}

.status-confirmed {
  color: #27ae60;
  font-weight: bold;
}

.time-box {
  min-width: 45px;
  border-right: 1px solid #eee;
  padding-right: 0.6rem;
  text-align: center;
  font-weight: bold;
  color: #333;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.time {
  font-size: 1rem;
}

.source-icon {
  font-size: 1rem;
  margin-top: 3px;
}

.details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.menu-title {
  font-weight: bold;
  font-size: 0.9rem;
  line-height: 1.2;
}

.customer-info {
  font-size: 0.8rem;
  color: #444;
  line-height: 1.2;
}

.c-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon {
  font-size: 0.7rem;
}

.staff-badge {
  font-size: 0.75rem;
  background: #e0e0e0;
  padding: 1px 6px;
  border-radius: 10px;
  display: inline-block;
  color: #555;
  align-self: flex-start;
  margin-top: 2px;
}

.note-preview {
  font-size: 0.75rem;
  color: #e67e22;
  font-weight: bold;
}

.delete-res-btn {
  display: none;
}

.panel-right {
  flex: 1;
  overflow-x: auto;
  padding: 0.5rem;
  background: white;
  user-select: none;
  display: flex;
  flex-direction: column;
}

.calendar-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
  background: #f9f9f9;
  padding: 0.4rem;
  border-radius: 6px;
  border: 1px solid #eee;
  position: relative;
  z-index: 20;
  flex-shrink: 0;
}

.current-date .date-text {
  font-size: 1rem;
  font-weight: bold;
  color: #333;
}

.date-nav-btn,
.today-btn {
  padding: 0.2rem 0.8rem;
  font-size: 0.85rem;
  border-radius: 4px;
  cursor: pointer;
}

.date-nav-btn {
  background: white;
  border: 1px solid #ccc;
}

.today-btn {
  background: #34495e;
  color: white;
  border: none;
}

.calendar-dropdown-wrapper {
  position: relative;
  cursor: pointer;
  padding: 0 1rem;
}

.mini-calendar-popup {
  display: none;
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  padding: 10px;
  z-index: 30;
  width: 240px;
}

.calendar-dropdown-wrapper:hover .mini-calendar-popup {
  display: block;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.day-label {
  text-align: center;
  font-size: 0.7rem;
  color: #666;
}

.day-cell {
  text-align: center;
  font-size: 0.85rem;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
}

.day-cell:hover {
  background: #eee;
}

.day-cell.is-holiday {
  background-color: #ffebee;
  color: #c0392b;
}

.day-cell.is-selected {
  background-color: #3498db;
  color: white;
  font-weight: bold;
}

.day-cell.empty {
  visibility: hidden;
}

.timeline-container {
  min-width: 100%;
  border: 1px solid #ddd;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.timeline-header {
  display: flex;
  height: 30px;
  background: #f9f9f9;
  border-bottom: 1px solid #ddd;
  flex-shrink: 0;
}

.staff-header-cell {
  width: 80px;
  flex-shrink: 0;
  border-right: 1px solid #ddd;
}

.time-scale {
  flex: 1;
  display: flex;
}

.time-label-cell {
  flex: 1;
  border-right: 1px solid transparent;
  font-size: 0.7rem;
  color: #666;
  padding-left: 2px;
  display: flex;
  align-items: center;
}

.timeline-body {
  flex: 1;
  overflow-y: auto;
}

.staff-row {
  display: flex;
  height: 60px;
  border-bottom: 1px solid #eee;
}

.staff-cell {
  width: 80px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  background: #f9f9f9;
  border-right: 1px solid #ddd;
  font-size: 0.85rem;
}

.timeline-cell {
  flex: 1;
  position: relative;
  background: #fff;
  cursor: crosshair;
}

.grid-lines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  pointer-events: none;
}

.grid-line {
  flex: 1;
  border-right: 1px dashed #eee;
  height: 100%;
}

.reservation-bar {
  position: absolute;
  top: 6px;
  bottom: 6px;
  border-radius: 3px;
  color: white;
  font-size: 0.7rem;
  padding: 2px 6px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.2s;
  z-index: 1;
  opacity: 0.9;
}

.reservation-bar:hover {
  z-index: 10;
  opacity: 1;
  transform: scale(1.01);
}

.reservation-bar.res-web {
  background-color: #3498db;
}

.reservation-bar.res-phone {
  background-color: #e67e22;
}

.drag-preview-bar {
  position: absolute;
  top: 6px;
  bottom: 6px;
  background-color: rgba(52, 152, 219, 0.5);
  border: 2px dashed #3498db;
  border-radius: 3px;
  pointer-events: none;
  z-index: 5;
}

.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-10px);
  background-color: #fff3cd;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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
  padding: 1.5rem;
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.modal-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.modal-header-row h3 {
  margin: 0;
  font-size: 1.1rem;
}

.close-x-btn {
  background: transparent;
  border: none;
  font-size: 1.4rem;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-x-btn:hover {
  color: #333;
}

.form-group {
  margin-bottom: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.form-row {
  display: flex;
  gap: 0.8rem;
}

.form-row .form-group {
  flex: 1;
}

input,
select {
  padding: 0.4rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.95rem;
}

textarea {
  padding: 0.4rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.95rem;
  resize: none;
  min-height: 80px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
}

.modal-actions.right-align {
  justify-content: flex-end;
}

.modal-actions.split {
  justify-content: space-between;
}

.save-btn {
  background: #42b883;
  color: white;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

.cancel-btn {
  background: #eee;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.detail-row {
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 0.3rem;
  font-size: 0.9rem;
}

.detail-row .label {
  font-weight: bold;
  color: #666;
  display: inline-block;
  width: 70px;
}

.detail-note {
  background: #fff9e6;
  padding: 0.8rem;
  border-radius: 4px;
  border-left: 3px solid #f39c12;
  margin-top: 0.5rem;
}

.detail-note .label {
  font-weight: bold;
  color: #d35400;
  margin-bottom: 0.2rem;
  display: block;
  font-size: 0.8rem;
}

.note-content {
  white-space: pre-wrap;
  color: #333;
  font-size: 0.9rem;
}

.pending-alert {
  background: #f3e5f5;
  border: 1px solid #e1bee7;
  border-radius: 4px;
  padding: 0.8rem;
  margin-bottom: 0.8rem;
  text-align: center;
}

.approve-btn {
  background: #8e44ad;
  color: white;
  border: none;
  padding: 0.4rem 1.2rem;
  border-radius: 20px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 0.5rem;
  display: inline-block;
  font-size: 0.9rem;
}

.delete-confirm-btn {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.5rem 1.2rem;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  font-size: 0.9rem;
}

.delete-confirm-btn:hover {
  background: #c0392b;
}

.edit-btn {
  background: #f39c12;
  color: white;
  border: none;
  padding: 0.5rem 1.2rem;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  font-size: 0.9rem;
}

.edit-btn:hover {
  background: #e67e22;
}

.delete-modal {
  max-width: 350px;
  text-align: center;
}

.delete-msg {
  margin: 1.5rem 0;
  line-height: 1.5;
  color: #555;
  font-size: 0.9rem;
}

.delete-modal .modal-actions {
  gap: 0.5rem;
  justify-content: center;
}

@media (max-width: 768px) {
  .modal-body {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
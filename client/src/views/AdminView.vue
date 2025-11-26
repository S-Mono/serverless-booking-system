<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { db } from '../lib/firebase'
import { collection, getDocs, addDoc, query, orderBy, Timestamp, onSnapshot, type Unsubscribe } from 'firebase/firestore'

interface Staff { id: string; name: string }
interface Reservation
{
  id: string; start_at: Timestamp; end_at: Timestamp; staff_id: string
  customer_name?: string; customer_phone?: string; menu_items: { title: string; duration: number }[]; status: string; source?: 'web' | 'phone'; note?: string
}
interface Menu { id: string; title: string; duration_min: number }

const staffs = ref<Staff[]>([])
const reservations = ref<Reservation[]>([])
const menus = ref<Menu[]>([])
const loading = ref(true)

const isSidebarOpen = ref(true)

const OPEN_HOUR = 9
const CLOSE_HOUR = 19
let unsubscribe: Unsubscribe | null = null

const isDragging = ref(false)
const dragStaffId = ref<string | null>(null)
const dragStartTime = ref<Date | null>(null)
const dragEndTime = ref<Date | null>(null)
const dragStartX = ref(0)

const showModal = ref(false)
const newReservation = ref({
  staff_id: '', start_time: '', end_time: '', customer_name: '', customer_phone: '', menu_id: '', note: ''
})

const timeLabels = computed(() =>
{
  const labels = []
  for (let i = OPEN_HOUR; i < CLOSE_HOUR; i++) labels.push(`${i}:00`)
  return labels
})

const initData = async () =>
{
  loading.value = true
  try
  {
    const staffSnap = await getDocs(collection(db, 'staffs'))
    staffs.value = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Staff[]
    const menuSnap = await getDocs(collection(db, 'menus'))
    menus.value = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Menu[]

    const q = query(collection(db, 'reservations'), orderBy('start_at', 'asc'))
    unsubscribe = onSnapshot(q, (snapshot) =>
    {
      reservations.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Reservation[]
      loading.value = false
    })
  } catch (e)
  {
    console.error(e); loading.value = false
  }
}

const submitReservation = async () =>
{
  if (!newReservation.value.menu_id) return
  const menu = menus.value.find(m => m.id === newReservation.value.menu_id)
  try
  {
    await addDoc(collection(db, 'reservations'), {
      staff_id: newReservation.value.staff_id,
      start_at: Timestamp.fromDate(new Date(newReservation.value.start_time)),
      end_at: Timestamp.fromDate(new Date(newReservation.value.end_time)),
      customer_name: newReservation.value.customer_name || '電話予約',
      customer_phone: newReservation.value.customer_phone || '',
      menu_items: [{ title: menu?.title, duration: menu?.duration_min }],
      source: 'phone',
      note: newReservation.value.note || '',
      status: 'confirmed',
      created_at: Timestamp.now()
    })
    alert('予約を追加しました'); showModal.value = false
  } catch (e) { console.error(e); alert('登録エラー') }
}

const getLeftPosition = (startTs: Timestamp) =>
{
  const date = startTs.toDate()
  let minutesFromOpen = (date.getHours() - OPEN_HOUR) * 60 + date.getMinutes()
  if (minutesFromOpen < 0) minutesFromOpen = 0
  const totalOpenMinutes = (CLOSE_HOUR - OPEN_HOUR) * 60
  return (minutesFromOpen / totalOpenMinutes) * 100
}

const getWidth = (startTs: Timestamp, endTs: Timestamp) =>
{
  let start = startTs.toDate().getTime()
  const end = endTs.toDate().getTime()
  const openTime = new Date(startTs.toDate())
  openTime.setHours(OPEN_HOUR, 0, 0, 0)
  if (start < openTime.getTime()) start = openTime.getTime()
  const durationMinutes = (end - start) / 60000
  const totalOpenMinutes = (CLOSE_HOUR - OPEN_HOUR) * 60
  return (durationMinutes / totalOpenMinutes) * 100
}

const onMouseDown = (e: MouseEvent, staffId: string) =>
{
  isDragging.value = true
  dragStaffId.value = staffId
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left
  dragStartX.value = (x / rect.width) * 100
  const totalMinutes = (CLOSE_HOUR - OPEN_HOUR) * 60
  const minutes = Math.floor(totalMinutes * (x / rect.width))
  const roundedMinutes = Math.floor(minutes / 15) * 15
  const date = new Date()
  date.setHours(OPEN_HOUR, roundedMinutes, 0, 0)
  dragStartTime.value = date
  dragEndTime.value = new Date(date.getTime() + 15 * 60000)
}

const onMouseMove = (e: MouseEvent) =>
{
  if (!isDragging.value || !dragStartTime.value) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left
  const minutes = Math.floor(((CLOSE_HOUR - OPEN_HOUR) * 60) * (x / rect.width))
  const date = new Date()
  date.setHours(OPEN_HOUR, minutes, 0, 0)
  const roundedDate = new Date(Math.ceil(date.getTime() / (900000)) * 900000)
  if (roundedDate > dragStartTime.value) dragEndTime.value = roundedDate
}

const onMouseUp = () =>
{
  if (!isDragging.value || !dragStaffId.value || !dragStartTime.value || !dragEndTime.value) { isDragging.value = false; return }
  newReservation.value = {
    staff_id: dragStaffId.value,
    start_time: toLocalISOString(dragStartTime.value),
    end_time: toLocalISOString(dragEndTime.value),
    customer_name: '', customer_phone: '', menu_id: '', note: ''
  }
  showModal.value = true; isDragging.value = false; dragStaffId.value = null
}

const formatTime = (ts: Timestamp) =>
{
  const d = ts.toDate()
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
const getStaffName = (id: string) => staffs.value.find(s => s.id === id)?.name || '未定'
const toLocalISOString = (date: Date) =>
{
  const pad = (n: number) => n < 10 ? '0' + n : n
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes())
}
const getDragBarStyle = computed(() =>
{
  if (!dragStartTime.value || !dragEndTime.value) return {}
  const start = dragStartTime.value.getTime(); const end = dragEndTime.value.getTime()
  const totalOpenMinutes = (CLOSE_HOUR - OPEN_HOUR) * 60 * 60000
  const openTime = new Date(dragStartTime.value); openTime.setHours(OPEN_HOUR, 0, 0, 0)
  const left = ((start - openTime.getTime()) / totalOpenMinutes) * 100
  const width = ((end - start) / totalOpenMinutes) * 100
  return { left: `${left}%`, width: `${width}%` }
})
const getTooltipText = (res: Reservation) =>
{
  const sourceType = res.source === 'phone' ? '【電話予約】' : '【WEB予約】'
  let text = `${sourceType}\n${formatTime(res.start_at)} - ${formatTime(res.end_at)}\n${res.menu_items[0]?.title}\n${res.customer_name || '名称未設定'}`
  if (res.note) text += `\n📝 ${res.note}`
  return text
}
const getReservationClass = (res: Reservation) => { return res.source === 'phone' ? 'res-phone' : 'res-web' }

onMounted(() => { initData() })
onUnmounted(() => { if (unsubscribe) unsubscribe() })
</script>

<template>
  <div class="admin-container">
    <header class="admin-header">
      <div class="header-left">
        <h2>予約管理ダッシュボード</h2>
      </div>
      <div class="status-badge">🟢 リアルタイム接続中</div>
    </header>

    <div v-if="loading" class="loading">Loading...</div>

    <div v-else class="admin-body">

      <div class="panel-left" :class="{ collapsed: !isSidebarOpen }">

        <div class="panel-header">
          <template v-if="isSidebarOpen">
            <h3>予約リスト</h3>
            <button class="toggle-btn" @click="isSidebarOpen = false" title="閉じる">◀</button>
          </template>

          <div v-else class="collapsed-content" @click="isSidebarOpen = true">
            <button class="toggle-btn open">▶</button>
            <span class="vertical-text">予約リスト</span>
          </div>
        </div>

        <div v-if="isSidebarOpen" class="kanban-list">
          <transition-group name="list">
            <div v-for="res in reservations" :key="res.id" class="kanban-card" :class="getReservationClass(res)">
              <div class="time-box">
                <span class="time">{{ formatTime(res.start_at) }}</span>
                <span class="source-icon">{{ res.source === 'phone' ? '📞' : '🌐' }}</span>
              </div>
              <div class="details">
                <div class="menu-title">{{ res.menu_items[0]?.title }}</div>
                <div class="customer-info">
                  <div v-if="res.customer_name" class="c-row"><span class="icon">👤</span> {{ res.customer_name }}</div>
                  <div v-if="res.customer_phone" class="c-row"><span class="icon">📞</span> {{ res.customer_phone }}
                  </div>
                </div>
                <div v-if="res.note" class="note-preview" :title="res.note">📝 メモあり</div>
                <div class="staff-badge">担当: {{ getStaffName(res.staff_id) }}</div>
              </div>
            </div>
          </transition-group>
        </div>
      </div>

      <div class="panel-right">
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
                      :title="getTooltipText(res)">
                      <span class="bar-text">{{ res.menu_items[0]?.title }} <span v-if="res.customer_name">/ {{
                        res.customer_name }}</span></span>
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
        <h3>新規予約 (電話受付)</h3>
        <div class="modal-body">
          <div class="modal-left">
            <div class="form-group"><label>担当スタッフ</label><select v-model="newReservation.staff_id" disabled>
                <option v-for="s in staffs" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select></div>
            <div class="form-row">
              <div class="form-group"><label>開始</label><input type="datetime-local" v-model="newReservation.start_time">
              </div>
              <div class="form-group"><label>終了</label><input type="datetime-local" v-model="newReservation.end_time">
              </div>
            </div>
            <div class="form-group"><label>メニュー</label><select v-model="newReservation.menu_id">
                <option value="" disabled>選択してください</option>
                <option v-for="m in menus" :key="m.id" :value="m.id">{{ m.title }} ({{ m.duration_min }}分)</option>
              </select></div>
            <div class="form-group"><label>顧客名 (任意)</label><input type="text" v-model="newReservation.customer_name"
                placeholder="例: 山田様"></div>
            <div class="form-group"><label>電話番号 (任意)</label><input type="tel" v-model="newReservation.customer_phone"
                placeholder="09012345678"></div>
          </div>
          <div class="modal-right">
            <div class="form-group full-height"><label>メモ</label><textarea v-model="newReservation.note"
                placeholder="特記事項..."></textarea></div>
          </div>
        </div>
        <div class="modal-actions"><button class="cancel-btn" @click="showModal = false">キャンセル</button><button
            class="save-btn" @click="submitReservation">登録する</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  padding: 0.5rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 50px;
}

.header-left h2 {
  font-size: 1.2rem;
  margin: 0;
}

.status-badge {
  background: #27ae60;
  color: white;
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-weight: bold;
}

.admin-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  width: 100%;
  position: relative;
}

/* --- 左パネル --- */
.panel-left {
  width: 35%;
  min-width: 320px;
  /* 開いている時の幅 */
  background: #ebecf0;
  border-right: 1px solid #ddd;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  flex-shrink: 0;
  transition: width 0.3s ease, padding 0.3s ease, min-width 0.3s ease;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 閉じた状態 */
.panel-left.collapsed {
  width: 40px;
  min-width: 40px;
  /* 閉じた時の幅 */
  padding: 1rem 0;
  /* 左右パディングなし */
  align-items: center;
  /* 中央寄せ */
  background: #dcdde1;
  cursor: pointer;
}

.panel-left.collapsed:hover {
  background: #d0d1d6;
}

/* パネルヘッダー */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  min-height: 30px;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
  white-space: nowrap;
}

/* 閉じた時の中身 */
.collapsed-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  height: 100%;
  width: 100%;
}

.vertical-text {
  writing-mode: vertical-rl;
  /* 縦書き */
  text-orientation: upright;
  /* 日本語を正立 */
  font-weight: bold;
  color: #555;
  letter-spacing: 3px;
  margin-top: 1rem;
  white-space: nowrap;
}

/* トグルボタン */
.toggle-btn {
  background: transparent;
  border: none;
  font-size: 1rem;
  color: #666;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.toggle-btn:hover {
  background: rgba(0, 0, 0, 0.1);
}

.toggle-btn.open {
  margin-bottom: 0.5rem;
  font-size: 1.2rem;
}

/* リストコンテナ */
.kanban-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-end;
  width: 100%;
  opacity: 1;
  transition: opacity 0.2s ease;
}

/* 閉じたときはリストを非表示 */
.panel-left.collapsed .kanban-list {
  opacity: 0;
  pointer-events: none;
  position: absolute;
}

/* --- 以下、既存のCSS --- */
.kanban-card {
  background: white;
  padding: 0.8rem;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 1rem;
  align-items: center;
  border-left: 5px solid #ccc;
  transition: all 0.3s ease;
  width: 100%;
  max-width: 450px;
}

.kanban-card.res-web {
  border-left-color: #3498db;
}

.kanban-card.res-phone {
  border-left-color: #e67e22;
}

.time-box {
  min-width: 50px;
  border-right: 1px solid #eee;
  padding-right: 0.8rem;
  text-align: center;
  font-weight: bold;
  color: #333;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.source-icon {
  font-size: 1.2rem;
  margin-top: 5px;
}

.details {
  flex: 1;
}

.menu-title {
  font-weight: bold;
  font-size: 0.9rem;
  margin-bottom: 0.3rem;
}

.customer-info {
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
  color: #444;
}

.c-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
}

.icon {
  font-size: 0.8rem;
}

.staff-badge {
  font-size: 0.8rem;
  background: #e0e0e0;
  padding: 2px 8px;
  border-radius: 12px;
  display: inline-block;
  color: #555;
}

.note-preview {
  font-size: 0.8rem;
  color: #e67e22;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.panel-right {
  flex: 1;
  overflow-x: auto;
  padding: 1rem;
  background: white;
  user-select: none;
}

.timeline-container {
  min-width: 100%;
  border: 1px solid #ddd;
}

.timeline-header {
  display: flex;
  height: 40px;
  background: #f9f9f9;
  border-bottom: 1px solid #ddd;
}

.staff-header-cell {
  width: 100px;
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
  font-size: 0.75rem;
  color: #666;
  padding-left: 4px;
  display: flex;
  align-items: center;
}

.staff-row {
  display: flex;
  height: 80px;
  border-bottom: 1px solid #eee;
}

.staff-cell {
  width: 100px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  background: #f9f9f9;
  border-right: 1px solid #ddd;
  font-size: 0.9rem;
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
  top: 10px;
  bottom: 10px;
  border-radius: 4px;
  color: white;
  font-size: 0.75rem;
  padding: 4px 8px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.2s;
  z-index: 1;
  opacity: 0.9;
}

.reservation-bar:hover {
  z-index: 10;
  opacity: 1;
  transform: scale(1.02);
}

.reservation-bar.res-web {
  background-color: #3498db;
}

.reservation-bar.res-phone {
  background-color: #e67e22;
}

.drag-preview-bar {
  position: absolute;
  top: 10px;
  bottom: 10px;
  background-color: rgba(52, 152, 219, 0.5);
  border: 2px dashed #3498db;
  border-radius: 4px;
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
  transform: translateX(-20px);
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
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  max-height: 90vh;
  overflow-y: auto;
}

.modal-body {
  display: flex;
  gap: 2rem;
}

.modal-left {
  flex: 1;
}

.modal-right {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.form-group {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.full-height {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-row .form-group {
  flex: 1;
}

input,
select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

textarea {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  resize: none;
  min-height: 150px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
}

.cancel-btn {
  background: #eee;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
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

@media (max-width: 768px) {
  .modal-body {
    flex-direction: column;
    gap: 0;
  }

  .modal-right textarea {
    min-height: 100px;
  }
}
</style>
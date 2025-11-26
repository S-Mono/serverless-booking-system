<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../lib/firebase'
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { seedDatabase } from '../lib/seed'

// --- 型定義 ---
interface ShopConfig
{
  holiday_weekdays: number[]
  closed_dates: string[]
  business_hours: { start: string; end: string }
}

interface Staff
{
  id: string; name: string; display_name: string; order_priority: number;
  roles: { accepts_new_customer: boolean; accepts_free_booking: boolean };
  is_working: boolean;
}

const router = useRouter()
const staffs = ref<Staff[]>([])
const loading = ref(true)

// 店舗設定データ
const config = ref<ShopConfig>({
  holiday_weekdays: [],
  closed_dates: [],
  business_hours: { start: '09:00', end: '19:00' }
})

// 新規スタッフ用
const newStaff = ref({
  name: '', display_name: '', order_priority: 99,
  roles: { accepts_new_customer: true, accepts_free_booking: true }, is_working: true
})

// 曜日ラベル
const weekdays = ['日', '月', '火', '水', '木', '金', '土']
const tempClosedDate = ref('')

// --- データ取得 ---
const fetchData = async () =>
{
  loading.value = true
  try
  {
    const snap = await getDocs(collection(db, 'staffs'))
    staffs.value = snap.docs.map(doc =>
    {
      const d = doc.data()
      return { id: doc.id, ...d, is_working: d.is_working ?? true }
    })
      .sort((a: any, b: any) => a.order_priority - b.order_priority) as Staff[]

    const configSnap = await getDoc(doc(db, 'shop_config', 'default_config'))
    if (configSnap.exists())
    {
      const data = configSnap.data() as any
      config.value = {
        holiday_weekdays: data.holiday_weekdays || [],
        closed_dates: data.closed_dates || [],
        business_hours: data.business_hours || { start: '09:00', end: '19:00' }
      }
    }
  } catch (e) { console.error(e) } finally { loading.value = false }
}

// --- 保存・更新系 ---
const saveConfig = async () =>
{
  try
  {
    await updateDoc(doc(db, 'shop_config', 'default_config'), {
      holiday_weekdays: config.value.holiday_weekdays,
      closed_dates: config.value.closed_dates,
      business_hours: config.value.business_hours
    })
    alert('店舗設定を保存しました')
  } catch (e) { console.error(e); alert('保存失敗') }
}

const addClosedDate = () =>
{
  if (tempClosedDate.value && !config.value.closed_dates.includes(tempClosedDate.value))
  {
    config.value.closed_dates.push(tempClosedDate.value)
    config.value.closed_dates.sort()
    tempClosedDate.value = ''
  }
}
const removeClosedDate = (date: string) =>
{
  config.value.closed_dates = config.value.closed_dates.filter(d => d !== date)
}

const saveStaff = async (staff: Staff) =>
{
  await updateDoc(doc(db, 'staffs', staff.id), { ...staff })
  alert(`"${staff.name}" を更新しました`)
}
const addStaff = async () =>
{
  if (!newStaff.value.name) return
  await addDoc(collection(db, 'staffs'), { ...newStaff.value })
  alert('追加しました')
  fetchStaffs()
}
const removeStaff = async (id: string) =>
{
  if (confirm('削除しますか？'))
  {
    await deleteDoc(doc(db, 'staffs', id))
    fetchStaffs()
  }
}
const fetchStaffs = fetchData

const handleSeed = async () =>
{
  if (confirm('データがリセットされます。よろしいですか？'))
  {
    await seedDatabase()
    fetchData()
  }
}
const goBack = () => router.push('/admin')

onMounted(() => { fetchData() })
</script>

<template>
  <div class="settings-container">
    <header class="settings-header">
      <button @click="goBack" class="back-btn">◀ ダッシュボード</button>
      <h2>システム設定</h2>
    </header>

    <main class="settings-body">
      <div class="content-wrapper">

        <div class="setting-card">
          <h3>📅 カレンダー・休日設定</h3>

          <div class="config-section">
            <h4>定休日 (毎週)</h4>
            <div class="weekdays-group">
              <label v-for="(day, index) in weekdays" :key="index" class="checkbox-label">
                <input type="checkbox" :value="index" v-model="config.holiday_weekdays">
                {{ day }}
              </label>
            </div>
          </div>

          <div class="config-section">
            <h4>臨時休業日 (特定の日)</h4>
            <div class="date-input-row">
              <input type="date" v-model="tempClosedDate" />
              <button @click="addClosedDate" class="add-mini-btn">追加</button>
            </div>
            <div class="tags-list">
              <span v-for="date in config.closed_dates" :key="date" class="date-tag">
                {{ date }}
                <button @click="removeClosedDate(date)" class="tag-close">×</button>
              </span>
            </div>
          </div>

          <div class="action-row">
            <button @click="saveConfig" class="save-main-btn">カレンダー設定を保存</button>
          </div>
        </div>

        <div class="setting-card">
          <h3>⏰ タイムライン設定</h3>
          <p class="desc">管理画面のガントチャートに表示する時間範囲を設定します。</p>
          <div class="staff-grid">
            <div class="input-group">
              <label>開始時間 (例: 09:00)</label>
              <input type="time" v-model="config.business_hours.start" />
            </div>
            <div class="input-group">
              <label>終了時間 (例: 19:00)</label>
              <input type="time" v-model="config.business_hours.end" />
            </div>
          </div>
          <div class="action-row">
            <button @click="saveConfig" class="save-main-btn">時間を保存</button>
          </div>
        </div>

        <div class="setting-card">
          <h3>スタッフ管理</h3>
          <div v-if="loading">読み込み中...</div>
          <div v-else class="staff-list">
            <div v-for="staff in staffs" :key="staff.id" class="staff-item" :class="{ inactive: !staff.is_working }">
              <div class="staff-header">
                <span class="staff-id">ID: {{ staff.id }}</span>
                <button class="delete-btn" @click="removeStaff(staff.id)">削除</button>
              </div>
              <div class="staff-grid">
                <div class="input-group"><label>略称</label><input type="text" v-model="staff.name" /></div>
                <div class="input-group"><label>表示名</label><input type="text" v-model="staff.display_name" /></div>
              </div>
              <div class="roles-grid">
                <label><input type="checkbox" v-model="staff.is_working"> 🟢 出勤中</label>
                <label><input type="checkbox" v-model="staff.roles.accepts_new_customer"> 新規OK</label>
              </div>
              <div class="action-row"><button @click="saveStaff(staff)" class="update-btn">保存</button></div>
            </div>
          </div>

          <div class="add-staff-area">
            <h4>➕ スタッフ追加</h4>
            <div class="staff-grid">
              <input type="text" v-model="newStaff.name" placeholder="略称" />
              <input type="text" v-model="newStaff.display_name" placeholder="表示名" />
            </div>
            <button @click="addStaff" class="add-btn">追加</button>
          </div>
        </div>

        <div class="setting-card danger-zone">
          <h3>⚡ 開発者用</h3>
          <button @click="handleSeed" class="seed-btn">初期データをリセット (Seed)</button>
        </div>

      </div>
    </main>
  </div>
</template>

<style scoped>
/* 👇 レイアウト修正箇所: 画面いっぱいに広げて内部スクロール */
.settings-container {
  height: 100%;
  /* 100vh ではなく 100% (App.vueの設定に従う) */
  display: flex;
  flex-direction: column;
  background-color: #f4f5f7;
  overflow: hidden;
  /* 外側のはみ出し防止 */
}

.settings-header {
  background: #2c3e50;
  color: white;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
  /* ヘッダーは縮めない */
}

.settings-body {
  flex: 1;
  /* 残りの高さを埋める */
  overflow-y: auto;
  /* 縦スクロール有効化 */
  padding: 2rem;
  width: 100%;
  box-sizing: border-box;
}

.content-wrapper {
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 2rem;
  /* 下部の余白確保 */
}

/* --- 以下、既存のデザイン --- */
.settings-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.back-btn {
  background: transparent;
  border: 1px solid #fff;
  color: #fff;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.setting-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.setting-card h3 {
  margin-top: 0;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}

.desc {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 1.5rem;
}

.config-section {
  margin-bottom: 1.5rem;
}

.config-section h4 {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.weekdays-group {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.checkbox-label {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.date-input-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.add-mini-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.date-tag {
  background: #f0f0f0;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 5px;
}

.tag-close {
  background: #ccc;
  border: none;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  font-size: 10px;
  cursor: pointer;
  line-height: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
}

.save-main-btn {
  background: #27ae60;
  color: white;
  border: none;
  padding: 0.8rem 2rem;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  width: 100%;
}

.staff-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.staff-item {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  transition: background 0.3s;
}

.staff-item.inactive {
  background: #f0f0f0;
  border-style: dashed;
  opacity: 0.8;
}

.staff-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #999;
  margin-bottom: 0.5rem;
}

.staff-grid {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.input-group {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.input-group input,
.date-input-row input {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.roles-grid {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.action-row {
  text-align: right;
}

.update-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.delete-btn {
  background: transparent;
  border: none;
  color: #e74c3c;
  cursor: pointer;
  font-size: 0.8rem;
  text-decoration: underline;
}

.add-staff-area {
  background: #e8f6f3;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #a2d9ce;
}

.add-btn {
  margin-top: 1rem;
  width: 100%;
  background: #16a085;
  color: white;
  border: none;
  padding: 0.6rem;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

.danger-zone {
  border-left: 5px solid #e74c3c;
}

.seed-btn {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.8rem;
  border-radius: 4px;
  cursor: pointer;
}
</style>
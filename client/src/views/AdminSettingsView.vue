<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../lib/firebase'
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { seedDatabase } from '../lib/seed'
import { useDialogStore } from '../stores/dialog'
const dialog = useDialogStore() // 👈 ストア利用

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

const config = ref<ShopConfig>({
  holiday_weekdays: [],
  closed_dates: [],
  business_hours: { start: '09:00', end: '19:00' }
})

const newStaff = ref({
  name: '', display_name: '', order_priority: 99,
  roles: { accepts_new_customer: true, accepts_free_booking: true }, is_working: true
})

const weekdays = ['日', '月', '火', '水', '木', '金', '土']
const tempClosedDate = ref('')

// --- データ操作 ---
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

const saveConfig = async () =>
{
  try
  {
    await updateDoc(doc(db, 'shop_config', 'default_config'), {
      holiday_weekdays: config.value.holiday_weekdays,
      closed_dates: config.value.closed_dates,
      business_hours: config.value.business_hours
    })
    dialog.alert('店舗設定を保存しました')
  } catch (e) { console.error(e); dialog.alert('保存失敗') }
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
  dialog.alert(`"${staff.name}" を更新しました`)
}
const addStaff = async () =>
{
  if (!newStaff.value.name) return
  await addDoc(collection(db, 'staffs'), { ...newStaff.value })
  dialog.alert('追加しました')
  fetchStaffs()
}
const removeStaff = async (id: string) =>
{
  const dlg = await dialog.confirm('本当に削除しますか？', '削除確認', 'danger')
  if (!dlg) return
  try
  {
    await deleteDoc(doc(db, 'staffs', id))
    fetchStaffs()
  } catch (error)
  {
    dialog.alert('削除に失敗しました', 'エラー')
  }

}
const fetchStaffs = fetchData

// ⚡ 開発者用シード (パスワード保護付き)
const handleSeed = async () =>
{
  const password = prompt('開発者用パスワードを入力してください')

  if (password === null) return // キャンセル時

  if (password === 'rukario1109')
  {
    const dlg = await dialog.confirm('【警告】\n現在のデータがすべて消去され、初期状態に戻ります。\n本当によろしいですか？', '初期データ投入確認', 'danger')
    if (dlg)
    {
      await seedDatabase()
      fetchData() // 画面を再読み込み
    }
  } else
  {
    dialog.alert('パスワードが違います。操作はキャンセルされました。')
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
      <div class="layout-grid">

        <aside class="settings-sidebar">
          <div class="side-card nav-card">
            <h3>設定メニュー</h3>
            <p class="side-desc">メニューの追加・編集はこちらから行えます。</p>
            <button @click="router.push('/admin/settings/menus')" class="menu-link-btn">
              📋 メニュー・担当設定
            </button>
          </div>
        </aside>

        <div class="settings-main">
          <div class="cards-grid">

            <div class="setting-card calendar-card">
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
                <h4>臨時休業日</h4>
                <div class="date-input-row">
                  <input type="date" v-model="tempClosedDate" />
                  <button @click="addClosedDate" class="add-mini-btn">追加</button>
                </div>
                <div class="tags-list">
                  <span v-for="date in config.closed_dates" :key="date" class="date-tag">
                    {{ date }} <button @click="removeClosedDate(date)" class="tag-close">×</button>
                  </span>
                </div>
              </div>
              <div class="action-row">
                <button @click="saveConfig" class="save-main-btn">保存</button>
              </div>
            </div>

            <div class="setting-card time-card">
              <h3>⏰ タイムライン設定</h3>
              <div class="config-section">
                <div class="input-row">
                  <div class="input-group">
                    <label>開始</label>
                    <input type="time" v-model="config.business_hours.start" />
                  </div>
                  <div class="input-group">
                    <label>終了</label>
                    <input type="time" v-model="config.business_hours.end" />
                  </div>
                </div>
              </div>
              <div class="action-row">
                <button @click="saveConfig" class="save-main-btn">保存</button>
              </div>
            </div>

            <div class="setting-card full-width">
              <h3>スタッフ管理</h3>
              <div v-if="loading">読み込み中...</div>
              <div v-else class="staff-list">
                <div v-for="staff in staffs" :key="staff.id" class="staff-item"
                  :class="{ inactive: !staff.is_working }">
                  <div class="staff-header">
                    <span class="staff-id">ID: {{ staff.id }}</span>
                    <button class="delete-btn" @click="removeStaff(staff.id)">削除</button>
                  </div>
                  <div class="staff-grid">
                    <div class="input-group"><label>略称</label><input type="text" v-model="staff.name" /></div>
                    <div class="input-group"><label>表示名</label><input type="text" v-model="staff.display_name" /></div>
                  </div>
                  <div class="roles-grid">
                    <label><input type="checkbox" v-model="staff.is_working"> 🟢 出勤</label>
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

            <div class="setting-card danger-zone full-width">
              <h3>⚡ 開発者用</h3>
              <button @click="handleSeed" class="seed-btn">初期データをリセット (Seed)</button>
            </div>

          </div>
        </div>

      </div>
    </main>
  </div>
</template>

<style scoped>
/* 全体レイアウト */
.settings-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f4f5f7;
  overflow: hidden;
}

.settings-header {
  background: #2c3e50;
  color: white;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

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

/* ボディ部分 (スクロールあり) */
.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  width: 100%;
  box-sizing: border-box;
}

/* 📐 レイアウトグリッド (左サイドバー + 右メイン) */
.layout-grid {
  display: grid;
  grid-template-columns: 260px 1fr;
  /* 左固定幅、右可変 */
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

/* サイドバー */
.settings-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.side-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.nav-card {
  border-left: 5px solid #3498db;
}

.side-card h3 {
  margin-top: 0;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.side-desc {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 1rem;
}

.menu-link-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.8rem 1rem;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  width: 100%;
  font-size: 0.95rem;
  transition: background 0.2s;
}

.menu-link-btn:hover {
  background: #2980b9;
}

/* メインエリア (カードグリッド) */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  /* 自動で列数を調整 */
  gap: 1.5rem;
  align-items: start;
}

/* 各カード共通 */
.setting-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.setting-card h3 {
  margin-top: 0;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  color: #333;
}

/* 横幅いっぱい使うカード (スタッフ管理など) */
.full-width {
  grid-column: 1 / -1;
}

/* 個別スタイル */
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
  gap: 0.8rem;
  flex-wrap: wrap;
}

.checkbox-label {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.9rem;
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
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
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
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
}

.save-main-btn {
  background: #27ae60;
  color: white;
  border: none;
  padding: 0.6rem 1.5rem;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  width: 100%;
}

.input-row {
  display: flex;
  gap: 1rem;
}

.input-group {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.input-group label {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 2px;
}

.input-group input {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

/* スタッフリスト */
.staff-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.staff-item {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.staff-item.inactive {
  background: #f9f9f9;
  border-style: dashed;
  opacity: 0.7;
}

.staff-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #999;
}

.staff-grid {
  display: flex;
  gap: 0.5rem;
}

.roles-grid {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  margin-top: 0.2rem;
}

.action-row {
  text-align: right;
  margin-top: auto;
}

.update-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.3rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
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

.add-staff-area h4 {
  margin: 0 0 0.5rem 0;
  color: #16a085;
  font-size: 1rem;
}

.add-btn {
  margin-top: 0.5rem;
  width: 100%;
  background: #16a085;
  color: white;
  border: none;
  padding: 0.5rem;
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

/* 📱 スマホ対応 */
@media (max-width: 768px) {
  .layout-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .settings-sidebar {
    order: -1;
    /* サイドバーを上に */
  }

  .staff-list {
    grid-template-columns: 1fr;
  }
}
</style>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../lib/firebase'
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { useDialogStore } from '../stores/dialog'

const dialog = useDialogStore()
const router = useRouter()

interface Staff { id: string; name: string }
interface Menu {
  id: string
  title: string
  price: number // 税抜
  duration_min: number
  available_staff_ids: string[]
  description?: string
  category: 'barber' | 'beauty' | 'chiro'
}

const menus = ref<Menu[]>([])
const staffs = ref<Staff[]>([])
const loading = ref(true)
const taxRate = ref(10)

const showModal = ref(false)
const isEditing = ref(false)
const editTargetId = ref<string | null>(null)

// 編集フォーム (税込価格も持たせる)
const editForm = ref({
  id: '',
  title: '',
  price: 0,       // 税抜
  priceWithTax: 0, // 税込 (入力用)
  duration_min: 30,
  available_staff_ids: [] as string[],
  description: '',
  category: 'barber' as 'barber' | 'beauty' | 'chiro'
})

const categories = [
  { id: 'barber', label: '💈 理容' },
  { id: 'beauty', label: '💇‍♀️ 美容' },
  { id: 'chiro', label: '💆‍♂️ カイロプラクティック' }
]

const menusByCategory = computed(() => {
  return {
    barber: menus.value.filter(m => m.category === 'barber' || !m.category),
    beauty: menus.value.filter(m => m.category === 'beauty'),
    chiro: menus.value.filter(m => m.category === 'chiro')
  }
})

// 💰 計算ロジック
// 税抜 -> 税込
const calcTaxIncluded = (price: number) => Math.ceil(price * (1 + taxRate.value / 100))
// 税込 -> 税抜
const calcTaxExcluded = (priceWithTax: number) => Math.ceil(priceWithTax / (1 + taxRate.value / 100))

// 入力ハンドラ
const updateInclusive = () => {
  // 税抜が入力されたら税込を計算
  editForm.value.priceWithTax = calcTaxIncluded(editForm.value.price)
}
const updateExclusive = () => {
  // 税込が入力されたら税抜を計算
  editForm.value.price = calcTaxExcluded(editForm.value.priceWithTax)
}

const fetchData = async () => {
  loading.value = true
  try {
    const [menuSnap, staffSnap, configSnap] = await Promise.all([
      getDocs(collection(db, 'menus')),
      getDocs(collection(db, 'staffs')),
      getDoc(doc(db, 'shop_config', 'default_config'))
    ])

    menus.value = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Menu[]
    staffs.value = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Staff[]

    if (configSnap.exists()) {
      const data = configSnap.data()
      taxRate.value = data.tax_rate ?? 10
    }
  } catch (e) {
    console.error(e);
    dialog.alert('読み込みエラー')
  } finally {
    loading.value = false
  }
}

const openEditModal = (menu?: Menu) => {
  if (menu) {
    isEditing.value = true
    editTargetId.value = menu.id
    // 既存データをコピーし、税込価格を計算してセット
    editForm.value = {
      ...JSON.parse(JSON.stringify(menu)),
      priceWithTax: calcTaxIncluded(menu.price)
    }
    if (!editForm.value.category) editForm.value.category = 'barber'
  } else {
    isEditing.value = false
    editTargetId.value = null
    // 新規
    editForm.value = {
      id: '', title: '',
      price: 4000, priceWithTax: calcTaxIncluded(4000),
      duration_min: 60,
      available_staff_ids: staffs.value.map(s => s.id),
      description: '',
      category: 'barber'
    }
  }
  showModal.value = true
}

const saveMenu = async () => {
  if (!editForm.value.title) return dialog.alert('メニュー名を入力してください')
  try {
    const payload = {
      title: editForm.value.title,
      price: editForm.value.price, // 保存するのは税抜のみ
      duration_min: editForm.value.duration_min,
      available_staff_ids: editForm.value.available_staff_ids,
      description: editForm.value.description || '',
      category: editForm.value.category
    }

    if (isEditing.value && editTargetId.value) {
      await updateDoc(doc(db, 'menus', editTargetId.value), payload)
    } else {
      await addDoc(collection(db, 'menus'), payload)
    }

    dialog.alert('保存しました')
    showModal.value = false
    fetchData()
  } catch (e) { console.error(e); dialog.alert('保存失敗') }
}

const deleteMenu = async (id: string) => {
  const ok = await dialog.confirm('本当に削除しますか？', '削除確認', 'danger')
  if (!ok) return
  try { await deleteDoc(doc(db, 'menus', id)); fetchData() } catch (e) { dialog.alert('削除失敗') }
}

const goBack = () => router.push('/admin/settings')
const getStaffName = (id: string) => staffs.value.find(s => s.id === id)?.name || id

onMounted(() => { fetchData() })
</script>

<template>
  <div class="settings-container">
    <header class="settings-header">
      <button @click="goBack" class="back-btn">◀ 設定一覧に戻る</button>
      <h2>メニュー設定</h2>
    </header>

    <main class="settings-body">
      <div class="content-wrapper">
        <div class="top-actions">
          <span class="tax-info">消費税率: <strong>{{ taxRate }}%</strong></span>
          <button @click="openEditModal()" class="add-btn">＋ 新規メニュー追加</button>
        </div>

        <div v-if="loading">Loading...</div>

        <div v-else class="category-sections">
          <div v-for="cat in categories" :key="cat.id" class="category-section">
            <h3 class="cat-title">{{ cat.label }}</h3>

            <div v-if="menusByCategory[cat.id as keyof typeof menusByCategory].length === 0" class="no-item">
              メニューがありません
            </div>

            <div class="menu-list">
              <div v-for="menu in menusByCategory[cat.id as keyof typeof menusByCategory]" :key="menu.id"
                class="menu-card">
                <div class="card-header">
                  <h3>{{ menu.title }}</h3>
                  <div class="card-actions">
                    <button @click="openEditModal(menu)" class="edit-icon">✏️</button>
                    <button @click="deleteMenu(menu.id)" class="delete-icon">🗑️</button>
                  </div>
                </div>
                <div class="card-details">
                  <div class="detail-row">
                    <span class="label">価格:</span>
                    <span>
                      ¥{{ menu.price.toLocaleString() }}
                      <small class="tax-text">(税込 ¥{{ calcTaxIncluded(menu.price).toLocaleString() }})</small>
                    </span>
                  </div>
                  <div class="detail-row"><span class="label">時間:</span> {{ menu.duration_min }}分</div>
                  <div class="detail-row">
                    <span class="label">担当:</span>
                    <div class="staff-tags">
                      <span v-for="staffId in menu.available_staff_ids" :key="staffId" class="staff-tag">{{
                        getStaffName(staffId) }}</span>
                      <span v-if="menu.available_staff_ids.length === 0" class="no-staff">担当者なし</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <h3>{{ isEditing ? 'メニュー編集' : '新規メニュー' }}</h3>

        <div class="form-group">
          <label>カテゴリ</label>
          <div class="radio-group">
            <label v-for="cat in categories" :key="cat.id" class="radio-item">
              <input type="radio" :value="cat.id" v-model="editForm.category">
              {{ cat.label }}
            </label>
          </div>
        </div>

        <div class="form-group"><label>メニュー名</label><input type="text" v-model="editForm.title"
            placeholder="例: カット＆カラー" /></div>

        <div class="form-row">
          <div class="form-group">
            <label>税抜価格 (円)</label>
            <input type="number" v-model="editForm.price" @input="updateInclusive" />
          </div>
          <div class="form-group">
            <label>税込価格 (円)</label>
            <input type="number" v-model="editForm.priceWithTax" @input="updateExclusive" />
          </div>
        </div>

        <div class="form-group"><label>所要時間 (分)</label><input type="number" v-model="editForm.duration_min" /></div>

        <div class="form-group"><label>担当可能スタッフ</label>
          <div class="checkbox-group">
            <label v-for="staff in staffs" :key="staff.id" class="checkbox-item">
              <input type="checkbox" :value="staff.id" v-model="editForm.available_staff_ids"> {{ staff.name }}
            </label>
          </div>
        </div>
        <div class="form-group"><label>説明 (任意)</label><textarea v-model="editForm.description"></textarea></div>

        <div class="modal-actions">
          <button @click="showModal = false" class="cancel-btn">キャンセル</button>
          <button @click="saveMenu" class="save-btn">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 既存CSS */
.settings-container {
  min-height: 100vh;
  background-color: #f4f5f7;
  display: flex;
  flex-direction: column;
  height: 100%;
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

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  width: 100%;
  box-sizing: border-box;
}

.content-wrapper {
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 2rem;
}

.top-actions {
  text-align: right;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 1rem;
}

.tax-info {
  color: #666;
  font-size: 0.9rem;
}

.add-btn {
  background: #42b883;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

.category-section {
  margin-bottom: 3rem;
}

.cat-title {
  border-left: 5px solid #2c3e50;
  padding-left: 1rem;
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.3rem;
}

.no-item {
  color: #999;
  padding: 1rem;
  background: #fff;
  border-radius: 8px;
  text-align: center;
  border: 1px dashed #ccc;
}

.menu-list {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

.menu-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-top: 3px solid #ddd;
}

.category-section:nth-child(1) .menu-card {
  border-top-color: #3498db;
}

.category-section:nth-child(2) .menu-card {
  border-top-color: #e91e63;
}

.category-section:nth-child(3) .menu-card {
  border-top-color: #27ae60;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
}

.card-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #2c3e50;
}

.card-actions button {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.2rem;
}

.detail-row {
  display: flex;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.detail-row .label {
  font-weight: bold;
  color: #666;
  width: 50px;
  flex-shrink: 0;
}

.tax-text {
  color: #e74c3c;
  font-weight: bold;
  margin-left: 0.5rem;
  font-size: 0.85rem;
}

.staff-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.staff-tag {
  background: #e0f7fa;
  color: #006064;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.no-staff {
  color: #e74c3c;
  font-weight: bold;
  font-size: 0.8rem;
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
  max-width: 500px;
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
  font-size: 1.2rem;
}

.close-x-btn {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-x-btn:hover {
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-row .form-group {
  flex: 1;
}

input,
textarea {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

.checkbox-group,
.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  border: 1px solid #eee;
  padding: 0.8rem;
  border-radius: 4px;
}

.checkbox-item,
.radio-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
}

.save-btn {
  background: #42b883;
  color: white;
  border: none;
  padding: 0.6rem 2rem;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

.cancel-btn {
  background: #eee;
  border: none;
  padding: 0.6rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}
</style>
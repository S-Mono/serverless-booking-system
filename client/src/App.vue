<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router'
import { auth, db } from './lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { useUserStore } from './stores/user'
import ConfirmDialog from './components/ConfirmDialog.vue'

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

const isMenuOpen = ref(false)
const isAdminPage = computed(() => route.path.startsWith('/admin'))
const customerName = ref('') // 👈 顧客名保持用

// ユーザー名取得ロジック
const fetchCustomerName = async (user: any) =>
{
  if (!user)
  {
    customerName.value = ''
    return
  }

  // 管理画面の時はID表示のままで良い場合、ここで分岐も可能
  // 今回は顧客名があればそれを優先表示します

  try
  {
    // 1. UIDで検索
    let q = query(collection(db, 'customers'), where('id', '==', user.uid)) // ※SeedではID=phoneだったりするので注意が必要ですが、MyPageで保存したデータはUID=DocIDになっています
    // 念のため電話番号(擬似メアド)でも検索
    const phone = user.email?.split('@')[0]
    if (phone)
    {
      q = query(collection(db, 'customers'), where('phone_number', '==', phone))
    }

    const snapshot = await getDocs(q)
    if (!snapshot.empty)
    {
      customerName.value = snapshot.docs[0]!.data().name_kana
    } else
    {
      // 未登録ならゲスト
      customerName.value = 'ゲスト'
    }
  } catch (e)
  {
    console.error(e)
    customerName.value = 'ゲスト'
  }
}

onMounted(() =>
{
  onAuthStateChanged(auth, async (user) =>
  {
    if (user)
    {
      userStore.setUser(user)
      await fetchCustomerName(user)
    } else
    {
      userStore.setUser(null)
      customerName.value = ''
    }
  })
})

const toggleMenu = () => isMenuOpen.value = !isMenuOpen.value
const closeMenu = () => isMenuOpen.value = false

const handleLogout = async () =>
{
  try
  {
    await signOut(auth)
    closeMenu()
    customerName.value = ''
    router.push('/login')
  } catch (error)
  {
    console.error('Logout failed:', error)
  }
}
</script>

<template>
  <div class="app-layout" :class="{ 'admin-mode': isAdminPage }">
    <ConfirmDialog />
    <header>
      <div :class="['header-inner', isAdminPage ? 'container-fluid' : 'container']">
        <h1>
          <RouterLink to="/" class="logo-link" @click="closeMenu">💈 美理容予約システム</RouterLink>
        </h1>

        <button class="hamburger-btn" @click="toggleMenu" :class="{ active: isMenuOpen }">
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </button>

        <nav class="nav-menu" :class="{ open: isMenuOpen }">
          <div v-if="userStore.user" class="menu-group">
            <span class="user-welcome">ようこそ {{ customerName || 'ゲスト' }} 様</span>

            <button @click="handleLogout" class="logout-btn">ログアウト</button>
            <RouterLink to="/mypage" class="nav-item mypage-btn" @click="closeMenu">マイページ</RouterLink>
          </div>
          <RouterLink v-else to="/login" class="nav-item login-btn" @click="closeMenu">ログイン / 登録</RouterLink>
        </nav>

        <div v-if="isMenuOpen" class="menu-overlay" @click="closeMenu"></div>
      </div>
    </header>

    <main :class="[isAdminPage ? 'container-fluid' : 'container']">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
/* ... (レイアウト系のCSSは前回と同じ) ... */
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

header {
  background-color: #333;
  color: white;
  height: 60px;
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
}

main {
  flex: 1;
  width: 100%;
}

.app-layout.admin-mode {
  height: 100vh;
  overflow: hidden;
}

.app-layout.admin-mode header {
  position: relative;
}

.app-layout.admin-mode main {
  overflow: hidden;
  height: calc(100vh - 60px);
}

.container {
  max-width: 1024px;
  margin: 0 auto;
  padding: 0;
  width: 100%;
}

.container-fluid {
  width: 100%;
  padding: 0;
  margin: 0;
  height: 100%;
}

.header-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 2rem;
  box-sizing: border-box;
}

.logo-link {
  color: white;
  text-decoration: none;
  font-weight: bold;
  font-size: 1.2rem;
  white-space: nowrap;
}

.nav-menu {
  display: flex;
  align-items: center;
}

.menu-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* 👇 修正: ユーザー名表示のスタイル */
.user-welcome {
  font-size: 0.9rem;
  color: #fff;
  margin-right: 1rem;
  border-right: 1px solid #555;
  padding-right: 1.5rem;
  white-space: nowrap;
  font-weight: bold;
}

.mypage-btn {
  background-color: #42b883;
  color: white;
  text-decoration: none;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: bold;
  white-space: nowrap;
}

.mypage-btn:hover {
  background-color: #3aa876;
}

.logout-btn {
  background: transparent;
  border: 1px solid #fff;
  color: #fff;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.login-btn {
  background: #42b883;
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  white-space: nowrap;
}

.login-btn:hover {
  background: #3aa876;
}

.hamburger-btn {
  display: none;
}

@media (max-width: 768px) {
  .header-inner {
    padding: 0 1rem;
  }

  .hamburger-btn {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    width: 30px;
    height: 25px;
    background: transparent;
    border: none;
    cursor: pointer;
    z-index: 102;
  }

  .bar {
    width: 100%;
    height: 3px;
    background-color: white;
    transition: all 0.3s;
  }

  .hamburger-btn.active .bar:nth-child(1) {
    transform: rotate(45deg) translate(5px, 6px);
  }

  .hamburger-btn.active .bar:nth-child(2) {
    opacity: 0;
  }

  .hamburger-btn.active .bar:nth-child(3) {
    transform: rotate(-45deg) translate(5px, -6px);
  }

  .nav-menu {
    position: fixed;
    top: 0;
    right: 0;
    width: 280px;
    height: 100vh;
    background-color: #222;
    padding: 80px 2rem 2rem 2rem;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out;
    z-index: 101;
    box-shadow: -4px 0 10px rgba(0, 0, 0, 0.3);
  }

  .nav-menu.open {
    transform: translateX(0);
  }

  .menu-group {
    flex-direction: column;
    width: 100%;
    align-items: stretch;
    gap: 0;
  }

  .logout-btn {
    order: 1;
    width: 100%;
    padding: 0.8rem;
    background-color: #444;
    border: none;
    margin-bottom: 0.5rem;
  }

  /* スマホ版の表示調整 */
  .user-welcome {
    order: 2;
    display: block;
    text-align: center;
    font-size: 1rem;
    font-weight: bold;
    color: #aaa;
    margin-bottom: 2rem;
    margin-right: 0;
    border-right: none;
    border-bottom: 1px solid #444;
    padding-bottom: 0.5rem;
  }

  .mypage-btn {
    order: 3;
    display: block;
    text-align: center;
    background-color: #3498db;
    padding: 1rem;
    font-size: 1.1rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  }
}

.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}
</style>
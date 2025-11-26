<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router'
import { auth } from './lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useUserStore } from './stores/user'

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

const isMenuOpen = ref(false)

// 管理画面かどうか判定
const isAdminPage = computed(() => route.path.startsWith('/admin'))

// ユーザーIDの表示整形 (メールアドレスの @ 以降をカット)
const formatUserId = (email: string | null | undefined) =>
{
  if (!email) return ''
  // 電話番号ログイン(擬似メアド)の場合、@の前だけを表示
  return email.split('@')[0]
}

onMounted(() =>
{
  onAuthStateChanged(auth, (user) =>
  {
    if (user) userStore.setUser(user)
    else userStore.setUser(null)
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
    router.push('/login')
  } catch (error)
  {
    console.error('Logout failed:', error)
  }
}
</script>

<template>
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
          <span class="user-email">{{ formatUserId(userStore.user.email || userStore.user.phoneNumber) }}</span>

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
</template>

<style scoped>
/* ベース設定 */
.container {
  max-width: 1024px;
  margin: 0 auto;
  padding: 0 1rem;
}

/* 管理画面用フル幅コンテナ */
.container-fluid {
  width: 100%;
  margin: 0;
  /* padding: 0;  <-- ここで0にするとヘッダーも0になってしまうので削除 */
}

header {
  background-color: #333;
  color: white;
  height: 60px;
  position: relative;
  z-index: 100;
}

/* ヘッダー内部のレイアウト */
.header-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  box-sizing: border-box;
  /* 重要: パディングを含めて幅100%にする */
  padding: 0 2rem;
  /* 常に左右に余白を持たせる */
}

/* もし container クラスがついた場合の上書き (念のため) */
.header-inner.container {
  padding: 0 1rem;
}

/* メインコンテンツの調整 */
main.container-fluid {
  padding: 0;
  /* メインコンテンツは余白なしでOK（内部のパネルで余白をとるため） */
}

main.container {
  padding: 1rem;
}

.logo-link {
  color: white;
  text-decoration: none;
  font-weight: bold;
  font-size: 1.2rem;
  white-space: nowrap;
}

/* --- デスクトップ用メニュー設定 --- */
.nav-menu {
  display: flex;
  align-items: center;
}

.menu-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-email {
  font-size: 0.9rem;
  color: #ccc;
  margin-right: 1rem;
  border-right: 1px solid #555;
  padding-right: 1.5rem;
  white-space: nowrap;
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

/* --- 📱 スマホ対応 (768px以下) --- */
@media (max-width: 768px) {
  .header-inner {
    padding: 0 1rem;
  }

  /* スマホでは少し狭く */

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

  .user-email {
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

  .user-email::before {
    content: "Login ID:";
    display: block;
    font-size: 0.7rem;
    color: #666;
    margin-bottom: 0.2rem;
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
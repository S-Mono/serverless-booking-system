<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { supabase } from './lib/supabase'
import { useUserStore } from './stores/user'

const userStore = useUserStore()
const router = useRouter()
const isMenuOpen = ref(false)

// ログイン状態の監視
onMounted(() => {
  supabase.auth.getSession().then(({ data }) => {
    userStore.setUser(data.session?.user ?? null)
  })

  supabase.auth.onAuthStateChange((_, session) => {
    userStore.setUser(session?.user ?? null)
  })
})

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenu = () => {
  isMenuOpen.value = false
}

const handleLogout = async () => {
  await supabase.auth.signOut()
  closeMenu()
  router.push('/login')
}
</script>

<template>
  <header>
    <div class="container header-inner">
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
          
          <span class="user-email">{{ userStore.user.email }}</span>
          
          <button @click="handleLogout" class="logout-btn">ログアウト</button>

          <RouterLink to="/mypage" class="nav-item mypage-btn" @click="closeMenu">マイページ</RouterLink>
        </div>

        <RouterLink v-else to="/login" class="nav-item login-btn" @click="closeMenu">ログイン / 登録</RouterLink>
      </nav>

      <div v-if="isMenuOpen" class="menu-overlay" @click="closeMenu"></div>
    </div>
  </header>

  <main class="container">
    <RouterView />
  </main>
</template>

<style scoped>
/* --- 全体設定 --- */
.container {
  max-width: 1024px;
  margin: 0 auto;
  padding: 0 1rem;
}

header {
  background-color: #333;
  color: white;
  height: 60px;
  position: relative;
  z-index: 100;
}

.header-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.logo-link {
  color: white;
  text-decoration: none;
  font-weight: bold;
  font-size: 1.2rem;
  white-space: nowrap;
}

/* --- PC版 (769px以上) の設定 --- */
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
  margin-right: 0.5rem;
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
.logout-btn:hover { background: rgba(255, 255, 255, 0.2); }

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
.mypage-btn:hover { background-color: #3aa876; }

.login-btn {
  background: #42b883;
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  white-space: nowrap;
}

.hamburger-btn { display: none; } /* PCでは隠す */


/* --- 📱 スマホ版 (768px以下) の設定 --- */
@media (max-width: 768px) {
  /* ハンバーガーアイコン表示 */
  .hamburger-btn {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    width: 30px;
    height: 25px;
    background: transparent;
    border: none;
    cursor: pointer;
    z-index: 102; /* メニューより手前 */
  }

  .bar {
    width: 100%;
    height: 3px;
    background-color: white;
    transition: all 0.3s;
  }

  /* アニメーション */
  .hamburger-btn.active .bar:nth-child(1) { transform: rotate(45deg) translate(5px, 6px); }
  .hamburger-btn.active .bar:nth-child(2) { opacity: 0; }
  .hamburger-btn.active .bar:nth-child(3) { transform: rotate(-45deg) translate(5px, -6px); }

  /* スライドメニュー本体 */
  .nav-menu {
    position: fixed;
    top: 0;
    right: 0;           /* 右端に配置 */
    width: 280px;       /* 幅指定 */
    height: 100vh;
    background-color: #2a2a2a;
    padding: 80px 1.5rem 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    
    /* 隠すロジック: 自分の幅の分(100%)だけ右に移動させる */
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out;
    
    z-index: 101;
    box-shadow: -2px 0 8px rgba(0,0,0,0.5);
    box-sizing: border-box; /* パディングを含めた幅計算にする */
  }

  /* 開いた状態: 元の位置(0)に戻す */
  .nav-menu.open {
    transform: translateX(0);
  }

  /* コンテンツを縦並びに */
  .menu-group {
    flex-direction: column;
    width: 100%;
    align-items: stretch; /* 幅いっぱいに広げる */
    gap: 0;
  }

  /* --- 並び順の変更 (order) --- */

  /* 1. ログアウトボタン (一番上) */
  .logout-btn {
    order: 1;
    margin-bottom: 2rem; /* 下に間隔 */
    background: #444;
    border: none;
    padding: 1rem;
    font-size: 1rem;
  }

  /* 2. ユーザーID (真ん中) */
  .user-email {
    order: 2;
    margin: 0 0 2rem 0; /* 下に間隔 */
    text-align: center;
    color: #aaa;
    font-size: 1rem;
    border-bottom: 1px solid #444;
    padding-bottom: 0.5rem;
  }
  .user-email::before {
    content: 'Login as:';
    display: block;
    font-size: 0.7rem;
    color: #666;
    margin-bottom: 0.2rem;
  }

  /* 3. マイページボタン (一番下) */
  .mypage-btn {
    order: 3;
    background-color: #3498db; /* 青色で目立たせる */
    text-align: center;
    padding: 1rem;
    font-size: 1.1rem;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  }
}

/* 背景を暗くするオーバーレイ */
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background: rgba(0,0,0,0.5);
  z-index: 100;
}
</style>
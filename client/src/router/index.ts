import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import MyPageView from '../views/MyPageView.vue'
import AdminView from '../views/AdminView.vue'
import AdminSettingsView from '../views/AdminSettingsView.vue'
import AdminMenuSettingsView from '../views/AdminMenuSettingsView.vue'
import AdminLoginView from '../views/AdminLoginView.vue'
import { auth } from '../lib/firebase'

// 環境変数から鍵を取得
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/mypage', name: 'mypage', component: MyPageView },
    
    // 管理画面ルート群
    {
      path: '/admin-login',
      name: 'admin-login',
      component: AdminLoginView
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { requiresAdmin: true }
    },
    {
      path: '/admin/settings',
      name: 'admin-settings',
      component: AdminSettingsView,
      meta: { requiresAdmin: true }
    },
    {
      path: '/admin/settings/menus',
      name: 'admin-menu-settings',
      component: AdminMenuSettingsView,
      meta: { requiresAdmin: true }
    },
    {
      path: '/admin/customers',
      name: 'admin-customers',
      component: () => import('../views/AdminCustomerView.vue'),
      meta: { requiresAdmin: true }
    },
    // 👇 追加: 顧客の論理削除一覧
    {
      path: '/admin/customers/trash',
      name: 'admin-customers-trash',
      component: () => import('../views/AdminDeletedCustomersView.vue'),
      meta: { requiresAdmin: true }
    }
  ]
})

// 🔒 ナビゲーションガード (門番)
router.beforeEach(async (to, from, next) => {
  // 1. URLパラメータによる「隠し扉」チェック
  // '/admin' で始まるパスにアクセスする場合
  if (to.path.startsWith('/admin')) {
    const queryKey = to.query.key
    const savedKey = sessionStorage.getItem('adminKeyVerified')

    // A. URLに正しいキーがついている場合 -> 通過＆記憶
    if (queryKey === ADMIN_KEY) {
      sessionStorage.setItem('adminKeyVerified', 'true')
    }
    // B. URLにキーがないが、記憶（セッション）にある場合 -> 通過
    else if (savedKey === 'true') {
      // OK (何もしない)
    }
    // C. どちらもない場合 -> トップページへ強制送還
    else {
      console.warn('不正なアクセス: キーがありません')
      return next('/')
    }
  }

  // 2. 認証チェック (requiresAdmin)
  if (to.meta.requiresAdmin) {
    // Firebaseの初期化待ち
    await new Promise<void>(resolve => {
      const unsubscribe = auth.onAuthStateChanged(() => {
        unsubscribe()
        resolve()
      })
    })

    const user = auth.currentUser
    // ログインしていない場合は、管理者ログイン画面へ
    // (ログイン画面にもキーが必要なので付与してリダイレクト)
    if (!user) {
      return next(`/admin-login?key=${ADMIN_KEY}`)
    }
  }

  next()
})

export default router
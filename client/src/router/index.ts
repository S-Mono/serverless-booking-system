import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import MyPageView from '../views/MyPageView.vue'
import AdminView from '../views/AdminView.vue'
import AdminSettingsView from '../views/AdminSettingsView.vue'
import AdminMenuSettingsView from '../views/AdminMenuSettingsView.vue'
import AdminLoginView from '../views/AdminLoginView.vue' // 👈 追加
import { auth } from '../lib/firebase'

// 環境変数から鍵を取得
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/mypage', name: 'mypage', component: MyPageView },

    // 👇 管理画面ルート群
    {
      path: '/admin-login',
      name: 'admin-login',
      component: AdminLoginView
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { requiresAdmin: true } // 管理者専用フラグ
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
    }
  ]
})

// 🔒 ナビゲーションガード (門番)
router.beforeEach(async (to, from, next) =>
{
  // 1. URLパラメータによる「隠し扉」チェック
  // '/admin' で始まるパス、または '/admin-login' にアクセスする場合
  if (to.path.startsWith('/admin'))
  {
    const queryKey = to.query.key

    // キーが合わない場合はトップページへ強制送還
    if (queryKey !== ADMIN_KEY)
    {
      console.warn('不正なアクセス: キーが一致しません')
      return next('/')
    }
  }

  // 2. 認証チェック (requiresAdmin)
  if (to.meta.requiresAdmin)
  {
    // Firebaseの初期化待ち
    await new Promise<void>(resolve =>
    {
      const unsubscribe = auth.onAuthStateChanged(() =>
      {
        unsubscribe()
        resolve()
      })
    })

    const user = auth.currentUser
    // ログインしていない場合は、管理者ログイン画面へ (キーを維持してリダイレクト)
    if (!user)
    {
      return next(`/admin-login?key=${ADMIN_KEY}`)
    }

    // ※本来はここで「user.email」が管理者アドレスかどうかのチェックも推奨
    // 今回は「キーを知っていて」かつ「ログインできた」ならOKとします
  }

  next()
})

export default router
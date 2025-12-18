import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
// 👇 追加
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

// 👇 修正: LINEブラウザではMessagingをサポートしないため、条件付きで初期化
export let messaging: Messaging | null = null

// Service Workerがサポートされている環境のみでmessagingを初期化
// LIFFアプリ（LINE内ブラウザ）では初期化しない
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app)
  } catch (error) {
    console.warn('Firebase Messaging is not supported in this environment:', error)
    messaging = null
  }
}

// VAPIDキー (Firebaseコンソール > プロジェクト設定 > Cloud Messaging > ウェブ設定 で生成した鍵)
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

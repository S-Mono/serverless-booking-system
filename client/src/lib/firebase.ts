import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Firebase Consoleで取得したconfigを貼り付け
const firebaseConfig = {
    apiKey: "AIzaSyCJWmgozIBHbzEmtJq1EH6aAa1g5gQtGf4",
    authDomain: "booking-system-firebase-764d2.firebaseapp.com",
    projectId: "booking-system-firebase-764d2",
    storageBucket: "booking-system-firebase-764d2.firebasestorage.app",
    messagingSenderId: "829906230754",
    appId: "1:829906230754:web:6b51fa2c7f184e8788edbb"
};

// 初期化
const app = initializeApp(firebaseConfig)

// 機能をエクスポート（他で使い回すため）
export const auth = getAuth(app)
export const db = getFirestore(app)
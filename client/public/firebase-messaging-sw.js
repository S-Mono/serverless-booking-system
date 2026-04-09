// Service Worker内でFirebaseライブラリを読み込む
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Configは本体と同じものを使用（本番環境）
const firebaseConfig = {
  apiKey: "AIzaSyCJWmgozIBHbzEmtJq1EH6aAa1g5gQtGf4",
  authDomain: "booking-system-firebase-764d2.firebaseapp.com",
  projectId: "booking-system-firebase-764d2",
  storageBucket: "booking-system-firebase-764d2.firebasestorage.app",
  messagingSenderId: "829906230754",
  appId: "1:829906230754:web:6b51fa2c7f184e8788edbb"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// バックグラウンドでの受信処理
messaging.onBackgroundMessage(function(payload) {
  console.log('Received background message ', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'お知らせ';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/favicon.png',
    tag: 'reservation-alert'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

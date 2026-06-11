import { writeFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore'

const app = initializeApp({
  apiKey: 'AIzaSyCJWmgozIBHbzEmtJq1EH6aAa1g5gQtGf4',
  authDomain: 'booking-system-firebase-764d2.firebaseapp.com',
  projectId: 'booking-system-firebase-764d2',
  storageBucket: 'booking-system-firebase-764d2.firebasestorage.app',
  messagingSenderId: '829906230754',
  appId: '1:829906230754:web:6b51fa2c7f184e8788edbb'
})

const db = getFirestore(app)

const [menuSnap, staffSnap, configSnap] = await Promise.all([
  getDocs(collection(db, 'menus')),
  getDocs(collection(db, 'staffs')),
  getDoc(doc(db, 'shop_config', 'default_config'))
])

const menus = menuSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .sort((a, b) => (a.order_priority ?? 999) - (b.order_priority ?? 999))

const staffs = staffSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .sort((a, b) => (a.order_priority ?? 999) - (b.order_priority ?? 999))

const config = configSnap.exists() ? configSnap.data() : null

const output = { menus, staffs, config }
writeFileSync('seed-source-prod.json', JSON.stringify(output, null, 2), 'utf8')
console.log(`menus=${menus.length}, staffs=${staffs.length}, config=${config ? 'yes' : 'no'}`)

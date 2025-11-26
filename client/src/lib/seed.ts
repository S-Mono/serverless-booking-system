import { db } from './firebase'
import { doc, setDoc, collection } from 'firebase/firestore'

export const seedDatabase = async () =>
{
    console.log('データ投入を開始します...')

    try
    {
        // 1. 店舗設定 (shop_config)
        await setDoc(doc(db, 'shop_config', 'default_config'), {
            time_slot_interval: 30, // 30分刻み
            business_hours: { start: '09:00', end: '19:00' },
            holiday_weekdays: [1, 2], // 月・火 定休
            max_future_booking_months: 2
        })
        console.log('✅ 店舗設定 完了')

        // 2. スタッフマスタ (staffs)
        const staffs = [
            {
                id: 'father',
                name: '父',
                display_name: 'オーナー',
                roles: { accepts_new_customer: false, accepts_free_booking: true }, // 新規NG
                order_priority: 1
            },
            {
                id: 'brother',
                name: '弟',
                display_name: '店長',
                roles: { accepts_new_customer: true, accepts_free_booking: true },
                order_priority: 2
            },
            {
                id: 'mother',
                name: '母',
                display_name: 'スタッフ',
                roles: { accepts_new_customer: true, accepts_free_booking: false }, // フリー割り当て除外
                order_priority: 3
            }
        ]

        for (const staff of staffs)
        {
            await setDoc(doc(db, 'staffs', staff.id), staff)
        }
        console.log('✅ スタッフデータ 完了')

        // 3. メニューマスタ (menus)
        // 自動IDで作成するため doc() ではなく collection() を使用するケースもありますが、
        // 管理しやすいように今回は固定ID風にします。
        const menus = [
            {
                id: 'cut_standard',
                title: 'メンズカット（顔剃り込）',
                price: 4500,
                duration_min: 60,
                available_staff_ids: ['father', 'brother', 'mother']
            },
            {
                id: 'cut_color',
                title: 'カット＆カラー',
                price: 8500,
                duration_min: 120,
                available_staff_ids: ['brother', 'mother'] // 父はカラーやらない設定(仮)
            },
            {
                id: 'shaving_only',
                title: '顔剃り単品',
                price: 2000,
                duration_min: 30,
                available_staff_ids: ['father', 'brother', 'mother']
            }
        ]

        for (const menu of menus)
        {
            await setDoc(doc(db, 'menus', menu.id), menu)
        }
        console.log('✅ メニューデータ 完了')

        alert('初期データの投入が完了しました！')

    } catch (error)
    {
        console.error('データ投入エラー:', error)
        alert('エラーが発生しました。コンソールを確認してください。')
    }
}
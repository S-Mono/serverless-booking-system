import { db } from './firebase'
import { doc, setDoc, collection } from 'firebase/firestore'
import { useDialogStore } from '../stores/dialog'

export const seedDatabase = async () =>
{
    console.log('データ投入を開始します...')
    const dialog = useDialogStore() // 👈 ストア利用
    try
    {
        // 1. 店舗設定 (shop_config)
        await setDoc(doc(db, 'shop_config', 'default_config'), {
            time_slot_interval: 30,
            business_hours: { start: '09:00', end: '19:00' },
            holiday_weekdays: [1, 2], // 月・火 定休 (0:日, 1:月...)
            closed_dates: [], // 👈 追加: 臨時休業日 (例: ['2025-01-01'])
            max_future_booking_months: 2
        })
        console.log('✅ 店舗設定 完了')

        // 2. スタッフマスタ
        const staffs = [
            {
                id: 'father',
                name: '父',
                display_name: 'オーナー',
                roles: { accepts_new_customer: false, accepts_free_booking: true },
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
                roles: { accepts_new_customer: true, accepts_free_booking: false },
                order_priority: 3
            }
        ]
        for (const staff of staffs)
        {
            await setDoc(doc(db, 'staffs', staff.id), staff)
        }
        console.log('✅ スタッフデータ 完了')

        // 3. メニューマスタ
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
                available_staff_ids: ['brother', 'mother']
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

        // 4. 顧客データ (NEW!)
        // テスト用に、あなたがログインに使っている電話番号を「既存客」として登録します
        const customers = [
            {
                id: 'cust_001',
                name_kana: 'テスト タロウ',
                phone_number: '09012345678', // 👈 あなたのテスト用番号
                is_existing_customer: true,  // 既存客フラグ
                visit_count: 10,
                memo: 'いつもの'
            },
            {
                id: 'cust_002',
                name_kana: 'シンキ ハナコ',
                phone_number: '08011112222',
                is_existing_customer: false, // 新規客フラグ（来店回数0扱い）
                visit_count: 0,
                memo: ''
            }
        ]
        for (const cust of customers)
        {
            await setDoc(doc(db, 'customers', cust.id), cust)
        }
        console.log('✅ 顧客データ 完了')

        dialog.alert('初期データの投入が完了しました！')

    } catch (error)
    {
        console.error('データ投入エラー:', error)
        dialog.alert('エラーが発生しました。コンソールを確認してください。')
    }
}
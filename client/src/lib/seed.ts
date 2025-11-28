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
            holiday_weekdays: [2], // 火 定休 (0:日, 1:月...)
            closed_dates: ['2025-01-01','2025-01-02','2025-01-03','2025-12-31'], // 👈 追加: 臨時休業日 (例: ['2025-01-01'])
            max_future_booking_months: 2
        })
        console.log('✅ 店舗設定 完了')

        // 2. スタッフマスタ
        const staffs = [
            {
                id: 'ft',
                name: '賢治（理容専門）',
                display_name: 'オーナー・店長',
                roles: { accepts_new_customer: false, accepts_free_booking: true },
                order_priority: 3
            },
            {
                id: 'mt',
                name: 'ユミコ（美容専門）',
                display_name: 'スタッフ',
                roles: { accepts_new_customer: true, accepts_free_booking: false },
                order_priority: 2
            },
            {
                id: 'bt',
                name: 'ヒロユキ（理美容兼任）',
                display_name: 'スタッフ',
                roles: { accepts_new_customer: true, accepts_free_booking: true },
                order_priority: 1
            },
            {
                id: 'st',
                name: 'カオリ（カイロ専門）',
                display_name: 'スタッフ',
                roles: { accepts_new_customer: true, accepts_free_booking: true },
                order_priority: 4
            },
        ]
        for (const staff of staffs)
        {
            await setDoc(doc(db, 'staffs', staff.id), staff)
        }
        console.log('✅ スタッフデータ 完了')

        // 3. メニューマスタ
        // テンプレート
        //     {
        //         id: '',                              //メニューID 自動生成推奨
        //         title: '',                           //メニュー名
        //         category:'',                         //カテゴリー  'barber' | 'beauty' | 'chiro' 
        //         price: ,                             //料金
        //         duration_min: ,                      //所要時間（分）
        //         available_staff_ids: ['bt', 'mt'],   //対応スタッフID配列 ft（父） | bt（兄） | mt（母） | st（義姉）
        //         discription:''                       //メニュー説明
        //     },
        const menus = [
            {
                id: '',
                title: 'メンズカット（顔剃り込）',
                category:'',
                price: 4500,
                duration_min: 60,
                available_staff_ids: ['ft', 'bt', 'mt'],
                discription:''
            },
            {
                id: '',
                title: 'カット＆カラー',
                category:'',
                price: 4500,
                duration_min: 60,
                available_staff_ids: ['bt', 'mt'],
                discription:''
            },
            {
                id: '',
                title: '顔剃り単品',
                category:'',
                price: 4500,
                duration_min: 60,
                available_staff_ids: ['ft', 'bt', 'mt'],
                discription:''
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
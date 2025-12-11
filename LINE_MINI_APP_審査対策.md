# LINEミニアプリ審査対策 - 修正内容

## 審査却下の理由と対策

### ❌ 問題1: 名称の不統一

**却下理由**: 
> プロバイダー名/サービス事業主名/プラポリ主体企業名の3つを、公的機関届け出の屋号に統一してください。

**公的機関届出の屋号**: `ヘアーサロン ジョイス`

**実施した修正**:
1. ✅ プライバシーポリシーに事業者情報セクションを追加
2. ✅ 利用規約に事業者情報セクションを追加
3. ✅ 「当サービス運営者」「当社」の定義を「ヘアーサロン ジョイス」に明確化

**修正箇所**:
- `client/src/views/PrivacyPolicyView.vue`
- `client/src/views/TermsOfServiceView.vue`

**追加した事業者情報**:
```
事業者名: ヘアーサロン ジョイス
所在地: 北海道札幌市
電話番号: 011-694-5449
メールアドレス: monou1222@icloud.com
```

**LINEデベロッパーコンソールで要確認・修正**:
1. **プロバイダー名**を「ヘアーサロン ジョイス」に変更
2. **LINEミニアプリ設定 > サービス情報**:
   - サービス名: ヘアーサロン ジョイス 予約システム（または ヘアーサロン ジョイス）
   - サービス提供者名: ヘアーサロン ジョイス
   - サービス事業主名: ヘアーサロン ジョイス

---

### ❌ 問題2: 審査用LIFF URLが真っ白

**却下理由**:
> 審査用LIFF URLが真っ白な画面のまま開けませんでした。

**考えられる原因**:

#### 1. 環境変数の設定ミス
**現在の設定**:
```env
# 審査環境
VITE_MINI_APP_ID=2000207130-jq8XNWKo
```

**確認事項**:
- ✅ 審査用LIFF IDが正しいか
- ❓ 審査環境用にビルド・デプロイされているか
- ❓ LIFF ID と デプロイURLの組み合わせが正しいか

#### 2. LIFF設定の確認

**LINEデベロッパーコンソールで確認が必要な項目**:

##### LIFF設定画面:
1. **LIFF ID**: `2000207130-jq8XNWKo`（審査用）
2. **LIFF URL（エンドポイントURL）**:
   - 正しいVercelデプロイ先URLが設定されているか
   - 例: `https://serverless-booking-system-seven.vercel.app`（実際のVercel URLに置き換え）
3. **スコープ設定**:
   - `profile` (必須)
   - `openid` (推奨)
4. **Botプロンプト表示**: ON推奨
5. **モジュールモード**: OFF（ミニアプリの場合）

##### LINEミニアプリ設定:
1. **審査用URL**: 上記のLIFF URLと一致しているか
2. **本番用URL**: 別のLIFF IDを使用

#### 3. デプロイ確認（Vercel使用）

**注意**: このプロジェクトはVercelでデプロイされています（Firebase Hostingではありません）

**確認すべきこと**:
```bash
# Vercelのデプロイ状況を確認
vercel ls

# 特定のURLで動作確認（実際のVercel URLに置き換えてください）
curl -I https://serverless-booking-system-seven.vercel.app
```

**ビルド・デプロイ手順（審査用環境）**:
```bash
cd /home/s_monou/booking-app/serverless-booking-system

# 審査用の環境変数を設定（client/.envファイルで）
# VITE_MINI_APP_ID=2000207130-jq8XNWKo に変更

# Vercelでデプロイ
vercel --prod

# または、GitHubにプッシュして自動デプロイ
git add .
git commit -m "審査用: 事業者情報を追加"
git push origin main
```

**Vercel環境変数の設定**:
Vercelダッシュボードで環境変数を設定している場合:
1. Vercel ダッシュボード > プロジェクト > Settings > Environment Variables
2. `VITE_MINI_APP_ID` を審査用 `2000207130-jq8XNWKo` に設定
3. 本番環境（Production）に適用
4. Redeploy

#### 4. 初期化エラーのデバッグ

**lineAuth.ts の init() メソッドで考えられる問題**:
- `VITE_MINI_APP_ID` が undefined
- LIFF SDK の初期化に失敗
- ネットワークエラー

**対策: エラーハンドリングの改善**:

現在のコード:
```typescript
const miniAppId = import.meta.env.VITE_MINI_APP_ID
if (!miniAppId) {
  console.warn('VITE_MINI_APP_ID is not defined')
  return
}
```

**改善案**: 審査環境でエラーが明示的にわかるように：

```typescript
const miniAppId = import.meta.env.VITE_MINI_APP_ID
if (!miniAppId) {
  const errorMsg = 'VITE_MINI_APP_ID is not defined. Please check .env file.'
  console.error(errorMsg)
  error.value = errorMsg
  // 画面に表示（開発・審査時のみ）
  if (import.meta.env.DEV || import.meta.env.MODE === 'staging') {
    alert(errorMsg)
  }
  return
}
```

#### 5. ローディング画面の追加

**問題**: 初期化中に真っ白な画面が表示される可能性

**対策**: App.vue にローディング表示を追加

```vue
<template>
  <div v-if="lineAuthStore.isInitializing" class="app-loading">
    <div class="loading-spinner"></div>
    <p>読み込み中...</p>
  </div>
  <div v-else class="app-layout">
    <!-- 既存のコンテンツ -->
  </div>
</template>
```

---

## 審査再申請前のチェックリスト

### 必須確認事項

#### LINEデベロッパーコンソール設定
- [ ] プロバイダー名を「ヘアーサロン ジョイス」に変更
- [ ] サービス事業主名を「ヘアーサロン ジョイス」に変更
- [ ] プライバシーポリシーURLが正しいか確認
- [ ] 利用規約URLが正しいか確認

#### LIFF設定
- [ ] 審査用LIFF ID: `2000207130-jq8XNWKo` が設定されている
- [ ] LIFF エンドポイントURLが正しいデプロイ先を指している
- [ ] スコープに `profile`, `openid` が含まれている
- [ ] ブラウザでLIFF URLを直接開いて動作確認

#### アプリケーション
- [ ] プライバシーポリシーに「ヘアーサロン ジョイス」の記載あり
- [ ] 利用規約に「ヘアーサロン ジョイス」の記載あり
- [ ] 審査用環境変数でビルド・デプロイ済み
- [ ] 実際にLINEアプリ内で開いて動作確認

#### その他
- [ ] LINEミニアプリポリシーを再確認
  - https://developers.line.biz/ja/docs/line-mini-app/submit/submission-guide/
- [ ] スクリーンショットを準備
- [ ] テストアカウント情報を準備（必要に応じて）

---

## デプロイ手順（審査環境 - Vercel）

### 1. 環境変数の設定

**方法A: ローカルの.envファイル（Git管理外）**

`client/.env` を審査用に設定:
```env
VITE_MINI_APP_ID=2000207130-jq8XNWKo
# Firebase設定は本番環境のまま
```

**方法B: Vercelダッシュボード（推奨）**

1. Vercel ダッシュボード > プロジェクト > Settings > Environment Variables
2. `VITE_MINI_APP_ID` の値を `2000207130-jq8XNWKo` に変更
3. Environment: `Production` を選択
4. Save

### 2. ビルド（ローカルで確認する場合のみ）

```bash
cd /home/s_monou/booking-app/serverless-booking-system/client
npm run build
```

### 3. デプロイ

**方法A: Vercel CLIでデプロイ**
```bash
cd /home/s_monou/booking-app/serverless-booking-system
vercel --prod
```

**方法B: GitHubプッシュで自動デプロイ（推奨）**
```bash
git add .
git commit -m "審査対応: 事業者情報追加とプライバシーポリシー更新"
git push origin main
```

Vercelが自動的にビルド・デプロイを実行します。

### 4. 動作確認

1. ブラウザで直接アクセス:
   ```
   https://your-project.vercel.app
   ```
   （実際のVercel URLで確認）

2. LINEアプリ内で開く:
   - LINEデベロッパーコンソール > LIFF > エンドポイントURL
   - QRコードまたはリンクから開く

3. 確認項目:
   - [ ] 画面が正しく表示される
   - [ ] プライバシーポリシーに事業者情報が表示される
   - [ ] 利用規約に事業者情報が表示される
   - [ ] 予約機能が動作する（実際に予約テスト）

---

## トラブルシューティング

### 真っ白な画面が表示される場合

1. **ブラウザのコンソールを確認**:
   - F12 > Console タブ
   - エラーメッセージを確認

2. **よくあるエラー**:
   - `VITE_MINI_APP_ID is not defined` → 環境変数が読み込まれていない
   - `LIFF init failed` → LIFF IDが間違っている、またはネットワークエラー
   - `Firebase error` → Firebase設定が間違っている

3. **デバッグ方法**:
   ```javascript
   // ブラウザのコンソールで実行
   console.log(import.meta.env.VITE_MINI_APP_ID)
   ```

### デプロイが反映されない場合

1. Vercelのデプロイログを確認:
   - Vercelダッシュボード > Deployments
   - 最新のデプロイが成功しているか確認
   - ビルドログでエラーがないか確認

2. 環境変数の確認:
   ```bash
   # ブラウザのコンソールで実行
   console.log(import.meta.env.VITE_MINI_APP_ID)
   ```
   正しいLIFF IDが表示されるか確認

3. キャッシュをクリア:
   - Vercel: Redeploy（Bypass Cache）
   - ブラウザ: キャッシュクリア（Ctrl + Shift + Delete）
   - LINE: アプリのキャッシュクリア（設定 > トーク > データの削除）

4. 別のブランチでテスト:
   ```bash
   git checkout -b test-review
   git push origin test-review
   ```
   Vercelで preview デプロイを確認

---

## 次回審査での注意点

### LINEミニアプリポリシーの主要チェック項目

1. **名称の統一**: 全て「ヘアーサロン ジョイス」で統一
2. **プライバシーポリシー**: 
   - 事業者名を明記
   - 収集する情報を明記
   - LINE連携について記載
3. **利用規約**:
   - 事業者名を明記
   - サービス内容を明確に
4. **動作確認**:
   - 審査用URLが正しく動作すること
   - エラーなく画面が表示されること
5. **コンテンツ**:
   - 公序良俗に反しない
   - ガイドライン違反なし

### 審査期間

- 通常: 3-5営業日
- 修正後の再審査: 時間がかかる可能性あり

---

## 本番環境への反映

審査通過後、本番環境でも同様の修正を適用:

1. プライバシーポリシー・利用規約は既に修正済み ✅
2. 本番用LIFF IDに切り替えてデプロイ:
   ```env
   VITE_MINI_APP_ID=2000207131-6onpDmb9
   ```
3. LINEデベロッパーコンソールの本番設定も「ヘアーサロン ジョイス」に統一

---

## まとめ

### 実施済みの修正
✅ プライバシーポリシーに事業者情報追加
✅ 利用規約に事業者情報追加
✅ 開発環境にも同様の修正を適用

### 次に実施すべきこと
1. ⚠️ LINEデベロッパーコンソールでプロバイダー名等を「ヘアーサロン ジョイス」に統一
2. ⚠️ 審査用環境変数でビルド・デプロイ
3. ⚠️ LIFF URLの動作確認（ブラウザ・LINEアプリ両方）
4. ⚠️ 問題なければ再審査申請

審査が通過するまで本番環境へのデプロイは控えてください。

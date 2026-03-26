# LINEミニアプリ 審査棄却原因分析レポート

作成日: 2026年3月26日  
調査方法: Gitコミット履歴の差分解析 + 審査対策ドキュメントの照合

---

## 概要

審査は複数回棄却された。原因は単一ではなく、**書類上の問題**と**技術的な問題**が重なっていた。
開発環境では動作するにもかかわらず審査環境（LINEアプリ内）でのみ不具合が発生するため、
事前の再現・検証が事実上不可能だったことが、棄却の長期化を招いた。

---

## 棄却原因の分類

### 問題① 書類上の不備（1回目の棄却）

**関連コミット**: `f13c150` `LINEミニアプリ審査結果の対応`（2025年12月11日）

#### 棄却理由（LINE審査担当者より）
> プロバイダー名/サービス事業主名/プラポリ主体企業名の3つを、  
> 公的機関届け出の屋号に統一してください。

#### Before / After

| 対象 | 棄却時 | 修正後 |
|------|--------|--------|
| プライバシーポリシー 事業者名 | 「当サービス運営者」のみ | ヘアーサロン ジョイス（所在地・電話・メール付き）|
| 利用規約 事業者名 | 「当サービス運営者」のみ | ヘアーサロン ジョイス |
| `client/.env` MINI_APP_ID | 本番ID `2000207131-6onpDmb9` | 審査用ID `2000207130-jq8XNWKo` |

#### 補足
`.env` に審査用IDではなく本番IDが設定されたままデプロイ・審査申請していたため、
審査担当者がアクセスしたURLと異なるLIFF IDが動作していた可能性がある。
これはコードの問題ではなく、**デプロイ手順のチェックリスト不備**が本質的原因。

---

### 問題② ローディング中の真っ白画面（2回目の棄却）

**関連コミット**: `62b01c0` `ローディング画面で真っ白画面になることを回避`

#### 原因コード

```typescript
// 棄却時（Before）
const isInitializing = ref(false)  // ← falseスタート

// 修正後（After）
const isInitializing = ref(true)   // ← trueスタート ※コメントに明示
// 「初期値trueで真っ白画面を防ぐ」
```

#### 発生メカニズム

```
1. App.vue が isInitializing を参照してローディングスピナーを制御
2. isInitializing = false（初期値）のため、起動直後はスピナーが表示されない
3. liff.init() の非同期処理が完了する前（数百ms〜数秒）の間、
   コンテンツが描画されず真っ白な画面になる
4. 開発環境：ブラウザ上で liff.isInClient() = false のため
   LIFF初期化をスキップ → 白画面状態が発生しない
5. 審査環境：LINEアプリ内で liff.isInClient() = true のため
   LIFF初期化が実行 → 初期化完了まで白画面になる
```

#### なぜ開発環境で再現しなかったか
開発環境（ブラウザ）では `liff.isInClient() = false` となりLIFF初期化パスが変わるため、
この問題が表面化しなかった。LINEアプリ内でのみ発生する典型的な環境依存バグ。

---

### 問題③ Firebase Messaging の初期化エラー（繰り返し棄却の一因）

**関連コミット**: `d38fa9f` `Fix: Skip Firebase Messaging in LINE app to prevent errors`

#### 原因コード

```typescript
// 棄却時（Before）
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  messaging = getMessaging(app)  // LINEブラウザでも無条件に実行
}

// 修正後（After）
const isLineApp = () => /Line\/\d+\.\d+\.\d+/.test(navigator.userAgent)

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !isLineApp()) {
  messaging = getMessaging(app)  // LINEブラウザではスキップ
}
```

#### 発生メカニズム
LINE内ブラウザは Service Worker の挙動が通常ブラウザと異なるため、
`getMessaging()` の初期化が例外またはサイレントエラーを引き起こし、
後続の処理（認証・画面描画）が止まることがあった。

---

### 問題④ `liff.permission` API 未対応（繰り返し棄却の一因）

**関連コミット**: `283c6cf` `Fix: チャネル同意の簡略化対応 - liff.permission APIを使用`

#### 原因コード

```typescript
// 棄却時（Before）
profile.value = await liff.getProfile()  // 権限確認なしで直接呼び出し

// 修正後（After）
const permissionStatus = await liff.permission.query('profile')
if (permissionStatus.state === 'granted') {
  profile.value = await liff.getProfile()
} else if (permissionStatus.state === 'prompt') {
  await liff.permission.requestAll()
  profile.value = await liff.getProfile()
}
```

#### 発生メカニズム
LINEミニアプリの「チャネル同意の簡略化」ポリシーにより、
ユーザーが明示的に `profile` スコープを許可していない場合、
`liff.getProfile()` が例外を投げてログイン処理全体が失敗する。
この仕様変更はLIFF通常利用では発生せず、ミニアプリ固有の挙動。

---

### 問題⑤ LIFF 2重初期化（断続的エラーの原因）

**関連コミット**: `5d6ba28` `Fix: LIFF 2重初期化を修正`

Vue の reactivity システムや画面遷移により `liff.init()` が複数回呼ばれると、
2回目以降は LIFF SDK がエラーを返すことがある。
初期化済みチェックを入れることで解消。

---

## 棄却の時系列

```
1回目の棄却
  └─ 書類不備（屋号の統一）
  └─ 環境変数の切り替え忘れ（本番IDのまま審査提出）

2回目の棄却
  └─ isInitializing = false による白画面
     （LINEアプリ内でのみ発生）

3回目以降の棄却
  └─ Firebase Messaging の初期化エラー（LINEブラウザ固有）
  └─ liff.permission 未対応（チャネル同意の簡略化ポリシー）
  └─ LIFF 2重初期化による断続的エラー
```

---

## 根本的な原因

技術的な問題すべてに共通していた本質：

> **「LINEミニアプリの環境（LINEアプリ内ブラウザ）でしか再現しない問題を、
> 開発環境（通常ブラウザ）ではテストできなかった」**

LINEミニアプリは以下の点で通常ブラウザと動作が異なる：

| 項目 | 通常ブラウザ（開発環境） | LINEアプリ内（審査環境） |
|------|------------------------|------------------------|
| `liff.isInClient()` | `false` → LIFF初期化スキップ | `true` → LIFF初期化実行 |
| `liff.permission` | 不要（権限は常に付与状態） | 必要（明示的な権限確認が必要） |
| Firebase Messaging | 正常初期化 | Service Worker挙動が異なりエラー |
| LIFF初期化時間 | ほぼ0ms（スキップ） | 数百ms〜数秒（実際にAPIコール） |

---

## 再発防止策（次回審査申請時のチェックリスト）

### デプロイ前
- [ ] `client/.env` の `VITE_MINI_APP_ID` を**審査用ID**に変更してビルドしたか
- [ ] Vercelの環境変数も審査用IDになっているか
- [ ] プライバシーポリシー・利用規約に「ヘアーサロン ジョイス」の記載があるか
- [ ] LINE Developers コンソールのプロバイダー名・サービス事業主名が屋号と一致しているか

### コード品質
- [ ] `isInitializing` の初期値は `true` になっているか
- [ ] LINEアプリ内では Firebase Messaging を無効化しているか
- [ ] `liff.getProfile()` の前に `liff.permission.query()` を実行しているか
- [ ] `liff.init()` が2重に呼ばれないようにガードがあるか

---

## 参照ファイル

- `LINE_MINI_APP_審査対策.md` — 棄却理由と対策の詳細
- `MINI_APP_MIGRATION.md` — LIFF → LINEミニアプリ移行の経緯
- `VERIFICATION_CHECKLIST.md` — 審査提出前の確認チェックリスト
- `client/src/stores/lineAuth.ts` — LIFF初期化・権限管理の実装
- `client/src/App.vue` — ローディング・エラー画面の制御
- `client/src/lib/firebase.ts` — Firebase Messaging の条件付き初期化

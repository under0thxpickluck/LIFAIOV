# LIFAI バグ・問題点レポート

最終更新: 2026-05-25

凡例: ✅ 修正済み / 🔴 クリティカル / 🟠 高 / 🟡 中 / 🔵 低

---

## 🔴 クリティカル

### ✅ C-1: IPN Webhook のテストモードが本番で有効
**ファイル:** `app/api/nowpayments/ipn/route.ts`
`x-test-ipn: 1` ヘッダーを付けるだけで署名検証がスキップされ、誰でも偽の支払い完了通知を送信できた。
**修正:** `isTest` 条件に `NODE_ENV !== "production"` を追加。

### ✅ C-2: 環境変数の未定義チェックなし（`auth/reset`）
**ファイル:** `app/api/auth/reset/route.ts`
`GAS_WEBAPP_URL` / `GAS_API_KEY` を `!` で黙らせていたが実行時に `undefined` になり `"undefined?..."` というURLに fetch していた。
**修正:** `if (!url || !key)` チェックを追加。

### ✅ C-3: `GAS_ADMIN_KEY` が未チェックのままURLに結合
**ファイル:** `app/api/apply/status/route.ts`
`&adminKey=${process.env.GAS_ADMIN_KEY}` で未設定時に `&adminKey=undefined` がGASに送信されていた。
**修正:** 変数に取り出し、未定義時はURLに含めない。

### 🔴 C-4: GAS の `SECRET_KEY` デフォルト値がハードコード
**ファイル:** `gas/Code.gs` (`getSecrets_` 関数)
ScriptProperties に `SECRET_KEY` が未設定の場合、`"LIFAITOMAKEMONEY"` がそのまま使われる。この値は `.env.local` にも平文で記載されており、実質公開状態になりうる。
**対策:** GAS の ScriptProperties に必ず独自の値を設定し、デフォルト値を削除する。

---

## 🟠 高優先度

### ✅ H-1: ログイン画面のローディングが固着する
**ファイル:** `app/login/page.tsx`
`fetch().then(r => r.json())` が失敗した場合にユーザーへのエラー表示がなく画面が無反応になった。
**修正:** `.catch(() => null)` を追加し、`null` 時にエラーメッセージを表示。

### ✅ H-2: `admin/list` の JSON パース失敗でクラッシュ
**ファイル:** `app/api/admin/list/route.ts`
`res.json()` に try/catch がなく、GAS が不正 JSON を返した場合に管理画面が壊れた。
**修正:** `res.text()` + `JSON.parse()` + try/catch に変更し、502 を返すように修正。

### ✅ H-3: `WalletBadge` の残高がログイン後も更新されない
**ファイル:** `components/WalletBadge.tsx`
`useEffect` の依存配列が `[]` で、`getLoginId()` の変化を検知しなかった。
**修正:** `loginId` をレンダー時に取得し、`[loginId]` を依存配列に追加。

### 🟠 H-4: `login` action が全 non-approved ステータスを `"pending"` 扱い
**ファイル:** `gas/Code.gs` (`login` action)
`approved` 以外は `status` の値（`pending_payment` / `pending_error` / `paid` / `pending`）に関わらず全て `{ ok: false, reason: "pending" }` を返す。フロントエンド側で状態を区別できず、支払い済み (`paid`) なのに「審査待ち」と表示される可能性がある。

---

## 🟡 中優先度

### ✅ M-1: メールアドレスの正規表現が不十分
**ファイル:** `app/apply/page.tsx`
TLD が1文字でも通る (`a@b.c`) 正規表現だった。
**修正:** `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` に変更。

### ✅ M-2: 入力フィールドに `maxLength` なし
**ファイル:** `components/Field.tsx`, `app/apply/page.tsx`
全テキスト入力に上限がなく、極端に長い文字列を送信可能だった。
**修正:** `Field` に `maxLength` prop を追加。各フィールドに上限設定（メール: 254 / 名前: 50 / Discord ID: 100 / 市町村: 50 / 紹介者ID: 20）。

### 🟡 M-3: リセットメールの URL がハードコード
**ファイル:** `gas/Code.gs` (`sendResetMail_` 関数)
`"https://lifai.vercel.app/reset?token=..."` に固定されており、ステージング環境やローカルでは届いたURLが動作しない。
**対策:** GAS の ScriptProperties に `SITE_URL` を追加し動的に差し替える。

### 🟡 M-4: プラン金額がGASとフロントエンドで二重管理
**ファイル:** `gas/Code.gs` (`planToGrant_`) と `app/purchase/page.tsx` の `PLANS` 配列
`34 / 57 / 114 / 567 / 1134` (USDT) とBP付与量がGAS側にハードコードされており、フロント側のプラン定義と手動で一致させる必要がある。ズレても警告が出ない。

### 🟡 M-5: TypeScript の `strict` モードが無効
**ファイル:** `tsconfig.json`
`"strict": false` により `null` / `undefined` チェックや暗黙的 `any` が全体的に無効化されている。有効化すると多数のエラーが出るため、計画的に対応する必要がある。

---

## 🔵 低優先度

### 🔵 L-1: CSRF 対策なし
全 POST エンドポイントに CSRF トークン検証がない。

### 🔵 L-2: レート制限なし
`/api/auth/login` などのエンドポイントにレート制限がなく、ブルートフォース攻撃に対して無防備。

### 🔵 L-3: IPN ログに機密情報
**ファイル:** `app/api/nowpayments/ipn/route.ts`
`console.log` で IPN の生ボディや署名を出力しており、本番ログに残る。

### 🔵 L-4: `getValuesSafe_` と `getSheetValuesSafe_` が重複定義
**ファイル:** `gas/Code.gs`
同一処理の関数が2つ存在する（2030行・2065行）。`getValuesSafe_` を使うこと。

### 🔵 L-5: テスト関数に実メールアドレスがハードコード
**ファイル:** `gas/Code.gs` (`__testSendMailOnce` 関数)
`unitegawa@outlook.jp` が直書きされており、誤実行すると実際にメールが送信される。

### 🔵 L-6: `useMemo` の依存配列が広すぎる
**ファイル:** `app/purchase/page.tsx`
`useMemo(() => ..., [draft])` は `draft` 全体を依存にしており、プラン以外の変更でも再計算が走る。`[draft?.plan]` が適切。

### 🔵 L-7: `applyId` の衝突可能性
**ファイル:** `app/purchase/page.tsx`
`applyId = "lifai_" + Date.now()` は同ミリ秒に複数リクエストが来た場合に衝突する可能性がある（極低確率）。

---

---

## 🟠 実装タスク（2026-05-25追加）

### T-1: 承認メールに月額リンクとOVトップリンクを追加

**背景**
`manual_review` 状態（partially_paid後の手動承認ケース等）で管理者が承認ボタンを押すと `approveRowCore5000_` → `sendResetMail_` が呼ばれる。
現在のメール本文はパスワードリセットリンクのみで、月額サブスク申し込みリンクとOVトップへのログインリンクが欠けている。

**変更ファイル**
`gas/Code.gs` — `sendResetMail_` 関数（5112行〜）

**現在のメール構成**
```
LIFAIへのご登録ありがとうございます。

初回パスワード設定はこちら（72時間有効）：
https://lifaiov.vercel.app/reset?plan=5000&token=...

ログインID：
5k_XXXXXX

このURLは1回のみ利用できます。

パスワード設定後はこちらからログインできます：
https://lifaiov.vercel.app/5000/login

もしパスワードの設定がうまくできなかった場合は...
LINE: https://lin.ee/VPo2xOn

LIFAI公式
[紹介コード]
```

**変更後のメール構成（3セクション）**
```
件名: 【LIFAI】アカウント承認のご案内

{name} 様

LIFAIへのご参加ありがとうございます。アカウントが承認されました。

■ STEP 1：月額サポート契約のお手続き（¥9,800/月）
LIFAIのご利用には月額契約が必要です。下記よりお手続きください。

  https://square.link/u/JM500LiD

■ STEP 2：初回パスワード設定（72時間有効・1回限り）
  https://lifaiov.vercel.app/reset?plan=5000&token=...

ログインID：5k_XXXXXX

■ STEP 3：ログイン
パスワード設定後は下記よりログインしてください。

  https://lifaiov.vercel.app/5000/login

ご不明な点は公式LINEへ：https://lin.ee/VPo2xOn

LIFAI公式
[紹介コードセクション（あれば）]
```

**実装上の注意点**
- `sendResetMail_` は `plan === "5000"` 判定があるが、5000フロー以外（通常フロー）からも呼ばれる可能性がある。月額リンクはすでに `is5000` フラグがあるので、それを活用して5000プラン専用セクションとして出し分ける
- 件名も現状の `「初回パスワード設定のご案内」` から `「アカウント承認のご案内」` へ変更して意図を明確にする
- `reset_sent_at` による二重送信防止はそのまま維持する

---

### T-2: 管理画面の `manual_review` 行に承認ボタンを追加

**背景**
`app/5000/admin/page.tsx` では `pending` ステータスのみ承認ボタンが表示される。
`manual_review`（partially_paid → 手動対応が必要なケース）は `other` セクションに流れ、承認ボタンがなく管理者が操作できない。

**変更ファイル**
`app/5000/admin/page.tsx`

**現在の挙動**
```
pending    → 承認ボタンあり
approved   → 承認済み一覧に表示
manual_review / pending_error / その他 → "other" セクション（ボタンなし、表示のみ）
```

**変更後の挙動**
```
pending        → 承認ボタンあり（変更なし）
manual_review  → "その他" セクションに承認ボタンを追加
approved       → 変更なし
pending_error  → 変更なし（操作不可のまま）
```

**実装上の注意点**
- `manual_review` のみボタンを出す（`pending_error` は支払い失敗・署名エラーなので意図的にボタンなし）
- 承認ロジックは既存の `approve()` 関数を流用（API `POST /api/5000/admin/approve` は共通）
- ボタンのUI・`approving` / `messages` ステートは既存のものをそのまま使用

---

## サマリー

| 重要度 | 総数 | 修正済み | 未対応 |
|--------|------|----------|--------|
| 🔴 クリティカル | 4 | 3 | 1 (C-4) |
| 🟠 高 | 4 | 3 | 1 (H-4) |
| 🟡 中 | 5 | 2 | 3 (M-3〜M-5) |
| 🔵 低 | 7 | 0 | 7 |
| 🟠 実装タスク | 2 | 2 | 0 |
| **合計** | **22** | **8** | **14** |

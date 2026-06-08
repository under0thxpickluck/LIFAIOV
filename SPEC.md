# LIFAI システム仕様書

> 作成日: 2026-03-08  
> 更新日: 2026-05-29  
> 対象ブランチ: main  
> フレームワーク: Next.js 14 (App Router)

---

## ⚠️ 【絶対厳守】リポジトリ混合禁止

> **これは LIFAIOV 専用リポジトリ（`lifaiov`）の仕様書です。`aisalon`（LIFAI 本家）と絶対に混合しないこと。**
>
> 何かを実装・移植する前に、必ずセクション 30「LIFAI本家 vs LIFAIOV 実装差分」を確認してから作業を開始すること。
>
> - OV 専用の変更（5000 メインフロー、`/login`→`/5000/login` リダイレクト、LINE URL 等）を本家に入れない
> - 本家専用機能（Ultra Music Mode、`isUltraAdmin`、`lyricsOverride` 等）を OV に誤って追加しない
> - 共通バグ修正は必ず両リポジトリに適用する
> - 疑問があればコードを書く前に必ずユーザーに確認すること

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [ディレクトリ構造](#2-ディレクトリ構造)
3. [環境変数](#3-環境変数)
4. [設定ファイル](#4-設定ファイル)
5. [ミドルウェア](#5-ミドルウェア)
6. [レイアウト](#6-レイアウト)
7. [ページ一覧](#7-ページ一覧)
8. [API ルート一覧](#8-api-ルート一覧)
9. [コンポーネント一覧](#9-コンポーネント一覧)
10. [ライブラリ・ユーティリティ](#10-ライブラリユーティリティ)
11. [状態管理・ストレージ](#11-状態管理ストレージ)
12. [認証フロー](#12-認証フロー)
13. [ユーザー申請フロー](#13-ユーザー申請フロー)
14. [決済フロー（NOWPayments）](#14-決済フローnowpayments)
15. [音楽・曲生成フロー](#15-音楽曲生成フロー)
16. [GAS バックエンド連携](#16-gas-バックエンド連携)
17. [マーケットプレイス](#17-マーケットプレイス)
18. [ミニゲーム（LIFAI Arcade）](#18-ミニゲームlifai-arcade)
19. [ギフトシステム](#19-ギフトシステム)
20. [楽曲売却申請](#20-楽曲売却申請)
21. [LIFAI ラジオ](#21-lifai-ラジオ)
22. [Narasu Agency（パートナープログラム）](#22-narasu-agencyパートナープログラム)
23. [5000プログラム](#23-5000プログラム)
24. [ギャラリー・作品ページ](#24-ギャラリー作品ページ)
25. [LifaiCat（AIアシスタント）](#25-lifaicataiアシスタント)
26. [テーマシステム（ダーク/ライト）](#26-テーマシステムダークライト)
27. [管理者機能](#27-管理者機能)
28. [セキュリティ設計](#28-セキュリティ設計)
29. [データフロー図](#29-データフロー図)
30. [LIFAI本家 vs LIFAIOV 実装差分](#30-lifai本家-vs-lifaiov-実装差分)

---

## 1. プロジェクト概要

**LIFAI** は日本のAI教育オンラインサロン向けのWebプラットフォームです。

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 14 (App Router) |
| バックエンド | Google Apps Script (GAS) + Sheets |
| 決済 | NOWPayments (USDT/TRC20) |
| 音楽生成 | Replicate (Minimax music-01) + OpenAI GPT-4o-mini |
| 画像生成 | OpenAI (準備中) |
| デプロイ | Vercel |
| 認証（ユーザー） | localStorage + sessionStorage |
| 認証（管理者） | HTTP Basic Auth (middleware) |

### 基本的なユーザーフロー

```
ホーム → プラン購入 → 申請フォーム → 審査待ち → 管理者承認 → ログイン → ダッシュボード
```

### 主要機能一覧

| 機能 | 状態 |
|---|---|
| 音楽生成（旧/新）| 有効（ユーザー毎3時間5回レート制限あり） |
| Music Boost（月額EP契約） | 有効 |
| ノート記事生成 | 有効 |
| マーケットプレイス | 有効 |
| ミニゲーム（Rumble Arena / Tap Mining） | 有効 |
| GiftEP システム | 有効（初回チュートリアルあり） |
| LifaiCat AIアシスタント | 有効（全ページ） |
| 画像生成 | 準備中（disabled） |
| ガチャ（LIFASLOT） | 有効 |
| ステーキング | 有効（固定利率: 30日+10% / 60日+25% / 90日+50%） |
| デイリーログインボーナス | 有効 |
| 毎日占い | 有効 |
| BP月次回復 | 有効（30日に1回、cap×50%回復） |

---

## 2. ディレクトリ構造

```
aisalon/
├── app/
│   ├── layout.tsx                      # グローバルレイアウト
│   ├── globals.css                     # グローバルスタイル
│   ├── page.tsx                        # ホームページ (/)
│   ├── login/page.tsx                  # ログイン
│   ├── top/page.tsx                    # ダッシュボード (認証後)
│   ├── start/page.tsx                  # オンボーディング
│   ├── purchase/
│   │   └── page.tsx                    # Step 1: プラン選択（OVでは /5000 にリダイレクト）
│   ├── apply/page.tsx                  # Step 2: 申請フォーム
│   ├── confirm/page.tsx                # Step 3: 確認・送信
│   ├── pending/page.tsx                # 審査待ち画面
│   ├── reset/page.tsx                  # パスワードリセット
│   ├── admin/page.tsx                  # 管理者ダッシュボード
│   ├── market/
│   │   ├── page.tsx                    # マーケット一覧
│   │   ├── [item_id]/page.tsx          # 商品詳細
│   │   ├── create/page.tsx             # 商品出品
│   │   └── orders/page.tsx             # 購入履歴
│   ├── music/
│   │   ├── page.tsx                    # 音楽生成ハブ（旧）
│   │   ├── standard/page.tsx           # スタンダード生成
│   │   └── pro/page.tsx                # プロ生成
│   ├── music2/page.tsx                 # 音楽生成 2.0 (Beta/新)
│   ├── music-boost/page.tsx            # Music Boost（EP月額契約）
│   ├── music-release-guide/page.tsx    # 音楽リリースガイド
│   ├── mini-games/
│   │   ├── page.tsx                    # LIFAI Arcade ハブ
│   │   ├── rumble/page.tsx             # Rumble Arena
│   │   └── tap/page.tsx                # Tap Mining
│   ├── gift/
│   │   ├── page.tsx                    # GiftEP メイン
│   │   ├── send/page.tsx               # ギフト送信
│   │   ├── use/page.tsx                # ギフト使用
│   │   └── history/page.tsx            # ギフト履歴
│   ├── note-generator/page.tsx         # ノート記事生成
│   ├── image/page.tsx                  # 画像生成（準備中）
│   ├── chat/page.tsx                   # チャット
│   ├── fortune/page.tsx                # 毎日占い (+10BP)
│   ├── gacha/route.ts                  # ガチャ
│   ├── membership/page.tsx             # メンバーシップアップグレード
│   ├── narasu-agency/
│   │   ├── page.tsx                    # Narasu Agency パートナープログラム
│   │   ├── form/page.tsx               # 申請フォーム
│   │   ├── confirm/page.tsx            # 確認
│   │   ├── complete/page.tsx           # 完了
│   │   └── terms/page.tsx              # 規約
│   ├── 5000/
│   │   ├── page.tsx                    # 5000プログラムLP
│   │   ├── login/page.tsx              # 5000ログイン
│   │   ├── apply/page.tsx              # 5000申請
│   │   ├── confirm/page.tsx            # 5000確認
│   │   ├── admin/page.tsx              # 5000管理（申請承認 + 財務ゲートウェイ + 音楽売却管理）
│   │   └── purchase-status/page.tsx    # 支払い状況確認
│   ├── column/
│   │   ├── page.tsx                    # コラム一覧
│   │   ├── [id]/page.tsx               # コラム詳細
│   │   └── posts/
│   │       └── 2026-01-31-design-win/page.tsx
│   ├── apply-sell/page.tsx             # 売却申請
│   ├── referral/page.tsx               # 紹介プログラム
│   ├── invest/page.tsx                 # 投資家・広告主情報
│   ├── vision/page.tsx                 # ビジョン
│   ├── rule/page.tsx                   # 利用規約
│   ├── privacy/page.tsx                # プライバシーポリシー
│   ├── tokushoho/page.tsx              # 特定商取引法に基づく表記
│   ├── lib/
│   │   ├── auth.ts                     # 認証ヘルパー
│   │   ├── useTheme.ts                 # ダーク/ライトモード管理
│   │   ├── bp-config.ts                # BP設定・価格
│   │   ├── presale.ts                  # プレセール計算
│   │   └── image/                      # 画像生成ライブラリ（準備中）
│   │       ├── image_types.ts
│   │       ├── chat_state.ts
│   │       ├── cost_calculator.ts
│   │       ├── image_client.ts
│   │       ├── image_guard.ts
│   │       └── prompt_builder.ts
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts          # ログイン
│       │   ├── reset/route.ts          # パスワードリセット
│       │   ├── forgot-id/route.ts      # ID問い合わせ
│       │   └── forgot-password/route.ts# パスワード問い合わせ
│       ├── apply/
│       │   ├── create/route.ts         # 申請作成
│       │   ├── route.ts                # 申請状況
│       │   └── status/route.ts         # 支払い状況確認
│       ├── me/route.ts                 # ログインユーザー情報
│       ├── daily-login/route.ts        # デイリーログインボーナス
│       ├── missions/route.ts           # ミッション一覧・管理
│       ├── nowpayments/
│       │   ├── create/route.ts         # インボイス作成
│       │   └── ipn/route.ts            # 決済Webhook
│       ├── admin/
│       │   ├── list/route.ts           # 申請一覧
│       │   ├── approve/route.ts        # 承認
│       │   ├── pending/route.ts        # 承認待ち一覧
│       │   ├── grant-bp/route.ts       # BP付与
│       │   ├── sell-requests/route.ts  # 売却申請一覧
│       │   ├── members/route.ts        # 会員一覧
│       │   ├── dashboard/route.ts      # 統計
│       │   ├── music-review/route.ts   # 音楽審査
│       │   ├── rumble-force-start/route.ts # Rumble強制開始
│       │   ├── rumble-reward/route.ts  # Rumble報酬設定
│       │   ├── rumble-run-now/route.ts # Rumble即時実行
│       │   └── apply/create/route.ts   # 管理者申請作成
│       ├── market/
│       │   ├── create/route.ts         # 商品出品
│       │   ├── list/route.ts           # 商品一覧
│       │   ├── item/route.ts           # 商品詳細
│       │   ├── buy/route.ts            # 購入
│       │   ├── confirm/route.ts        # 購入確定
│       │   ├── refund/route.ts         # 返金申請
│       │   ├── sell-request/route.ts   # 売却申請
│       │   ├── report/route.ts         # 通報
│       │   ├── my-orders/route.ts      # 購入履歴
│       │   └── orders/route.ts         # 購入履歴（別エンドポイント）
│       ├── user/
│       │   ├── pending-bp/route.ts     # 未受取BP確認
│       │   └── claim-bp/route.ts       # BP受取
│       ├── wallet/
│       │   ├── balance/route.ts        # 残高確認（bp_cap フィールドも返す）
│       │   └── recover/route.ts        # 月次BP回復チェック
│       ├── music-boost/
│       │   ├── status/route.ts         # Music Boost状態取得
│       │   ├── subscribe/route.ts      # Music Boost契約
│       │   ├── cancel/route.ts         # Music Boost解約
│       │   └── admin/route.ts          # 管理者用一覧
│       ├── music/
│       │   ├── generate/route.ts       # 音楽生成開始
│       │   ├── status/route.ts         # 音楽生成状況
│       │   ├── history/route.ts        # 音楽生成履歴（サーバー管理）
│       │   └── _cache.ts               # 音楽生成キャッシュ
│       ├── bgm/
│       │   ├── generate/route.ts       # BGM生成開始
│       │   └── status/route.ts         # BGM生成状況
│       ├── song/
│       │   ├── start/route.ts          # 曲作成開始
│       │   ├── structure/route.ts      # 曲構造確定
│       │   ├── lyrics/route.ts         # 歌詞確定
│       │   ├── status/route.ts         # 曲作成状況
│       │   ├── cancel/route.ts         # キャンセル
│       │   ├── result/route.ts         # 完成楽曲取得
│       │   ├── approve-structure/route.ts # 構成承認
│       │   ├── approve-lyrics/route.ts # 歌詞承認
│       │   └── _jobStore.ts            # 曲作成ジョブストア
│       ├── note/
│       │   ├── plan/route.ts           # 記事プラン生成
│       │   └── generate/route.ts       # 記事本文生成
│       ├── image/
│       │   ├── generate/route.ts       # 画像生成
│       │   ├── chat/route.ts           # チャット型生成
│       │   ├── edit/route.ts           # 画像編集
│       │   ├── preview-cost/route.ts   # コスト試算
│       │   ├── history/route.ts        # 生成履歴
│       │   └── jacket/route.ts         # アルバムジャケット生成
│       ├── gift/
│       │   ├── balance/route.ts        # ギフト残高・期限
│       │   ├── send/route.ts           # ギフト送信
│       │   ├── use/route.ts            # ギフト使用
│       │   └── history/route.ts        # ギフト履歴
│       ├── minigames/
│       │   ├── rumble/
│       │   │   ├── entry/route.ts      # 参加登録
│       │   │   ├── force-entry/route.ts# 強制参加（管理者）
│       │   │   ├── status/route.ts     # 状況取得
│       │   │   ├── ranking/route.ts    # 週間ランキング・報酬
│       │   │   ├── equipment/route.ts  # 装備一覧
│       │   │   ├── equip/route.ts      # 装備
│       │   │   ├── gacha/route.ts      # 装備ガチャ
│       │   │   ├── enhance/route.ts    # 強化
│       │   │   ├── dismantle/route.ts  # 解体
│       │   │   ├── set-name/route.ts   # バトル名設定
│       │   │   ├── my-rank-context/route.ts # 自分のランク状況
│       │   │   ├── shard-status/route.ts # シャード在庫
│       │   │   ├── spectator/route.ts  # 観戦
│       │   │   └── daily-result/route.ts # 日次バトル結果
│       │   └── tap/
│       │       ├── play/route.ts       # 単タップ処理
│       │       ├── batch-play/route.ts # バッチタップ処理
│       │       ├── status/route.ts     # 状況取得
│       │       ├── ranking/route.ts    # ランキング
│       │       └── ticker/route.ts     # グローバルイベントティッカー
│       ├── cat-chat/route.ts           # LifaiCat チャット
│       ├── cat-feedback/route.ts       # LifaiCat フィードバック
│       ├── cat-recommendation/route.ts # LifaiCat おすすめ
│       ├── fortune-bp/route.ts         # 占いBP付与
│       ├── fortune/result/route.ts     # 占い結果（サーバー管理）
│       ├── gacha/
│       │   ├── route.ts                # ガチャ実行
│       │   ├── daily/route.ts          # デイリーガチャ
│       │   └── daily/status/route.ts   # デイリーガチャ状況
│       ├── staking/route.ts            # ステーキング操作
│       ├── narasu-agency/
│       │   ├── submit/route.ts         # 申請送信
│       │   ├── pay-bp/route.ts         # BP支払い
│       │   └── pay-ep/route.ts         # EP支払い
│       ├── 5000/
│       │   ├── apply/route.ts
│       │   ├── admin/approve/route.ts
│       │   ├── admin/list/route.ts
│       │   ├── nowpayments/create/route.ts
│       │   ├── nowpayments/ipn/route.ts
│       │   ├── purchase-status/route.ts
│       │   └── reset/resend/route.ts
│       ├── music-release-guide/route.ts
│       ├── radio/route.ts              # ラジオ配信
│       └── debug/env/route.ts          # 環境変数確認（開発用）
├── components/
│   ├── Field.tsx                       # テキスト入力
│   ├── Select.tsx                      # セレクトボックス
│   ├── StepHeader.tsx                  # ステップ表示ヘッダー
│   ├── PlanPicker.tsx                  # プラン選択UI
│   ├── WalletBadge.tsx                 # BP/EP残高バッジ
│   ├── BPGrantModal.tsx                # BP受取モーダル
│   ├── LoginBonusModal.tsx             # ログインボーナスモーダル
│   ├── GachaModal.tsx                  # ガチャモーダル
│   ├── StakingModal.tsx                # ステーキングモーダル
│   ├── AppSidebar.tsx                  # サイドバーナビ
│   ├── GameTile.tsx                    # ゲームタイル表示
│   ├── MissionCard.tsx                 # ミッションカード
│   ├── RadioCard.tsx                   # ラジオカード
│   ├── CopyField.tsx                   # コピー用フィールド
│   ├── ThemeToggle.tsx                 # ダーク/ライト切替ボタン
│   ├── Toast.tsx                       # トースト通知
│   ├── useToast.ts                     # トーストhook
│   ├── storage.ts                      # sessionStorage操作
│   ├── auth.ts                         # 認証ユーティリティ
│   ├── GiftEPTutorial.tsx              # GiftEP チュートリアルモーダル（3ページ）
│   ├── LifaiCat.tsx                    # LifaiCat UIコンポーネント
│   ├── LifaiCatGlobal.tsx              # LifaiCat グローバルインスタンス
│   └── image/                          # 画像生成コンポーネント（準備中）
│       ├── ImageChatPanel.tsx
│       ├── ImageGenerateButton.tsx
│       ├── ImageEditPanel.tsx
│       ├── ImagePreviewCard.tsx
│       ├── ImageHistoryGrid.tsx
│       ├── ImageStateChips.tsx
│       ├── ImageStylePicker.tsx
│       └── ImageCostBox.tsx
├── middleware.ts                       # Basic Auth ガード
├── vercel.json                         # Vercelタイムアウト設定
└── package.json
```

---

## 3. 環境変数

`.env.local` で管理。

| 変数名 | 用途 | 必須 |
|---|---|---|
| `GAS_WEBAPP_URL` | GAS WebApp デプロイURL | ○ |
| `GAS_API_KEY` | GAS APIキー（全リクエストに付加） | ○ |
| `GAS_ADMIN_KEY` | GAS 管理者専用キー | ○ |
| `ADMIN_USER` | Basic Auth ユーザー名 | ○ |
| `ADMIN_PASS` | Basic Auth パスワード | ○ |
| `NOWPAYMENTS_API_KEY` | NOWPayments API キー | ○ |
| `NOWPAYMENTS_IPN_SECRET` | IPN HMAC-SHA512 署名検証用シークレット | ○ |
| `NEXT_PUBLIC_SITE_URL` | 公開URL（IPN callback等に使用） | ○ |
| `OPENAI_API_KEY` | 歌詞・記事生成 | 任意 |
| `REPLICATE_API_TOKEN` | 音楽生成 | 任意 |
| `MERGE_SERVER_URL` | 音声マージサーバURL | 任意 |
| `CLOUDFLARE_R2_ACCOUNT_ID` | BGM音声の R2 永続保存 | 任意 |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 アクセスキー | 任意 |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 シークレット | 任意 |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 バケット名 | 任意 |
| `CLOUDFLARE_R2_PUBLIC_URL` | R2 公開URL（`https://...`） | 任意 |

---

## 4. 設定ファイル

### `package.json`

| パッケージ | バージョン | 用途 |
|---|---|---|
| next | 14.2.5 | App Router |
| react / react-dom | 18.3.1 | UI |
| next-pwa | 5.6.0 | PWA対応 |
| sonner | 2.0.7 | トースト通知 |
| tailwindcss | 3.4.10 | スタイリング |
| framer-motion | 12.38.0 | アニメーション |
| openai | 6.32.0 | OpenAI SDK |
| @aws-sdk/client-s3 | 3.x | S3連携 |
| fluent-ffmpeg | 2.1.3 | 音声処理 |
| ffmpeg-static | 5.2.0 | ffmpegバイナリ |

スクリプト:
```bash
npm run dev    # 開発サーバー起動 (http://localhost:3000)
npm run build  # 本番ビルド
npm start      # 本番サーバー起動 (port 3000)
npm test       # Jest テスト実行
```

### `vercel.json`

```json
{
  "functions": {
    "app/api/music/**":                    { "maxDuration": 300 },
    "app/api/bgm/**":                      { "maxDuration": 120 },
    "app/api/song/approve-structure/**":   { "maxDuration": 300 },
    "app/api/song/start/**":               { "maxDuration": 60 },
    "app/api/song/approve-lyrics/**":      { "maxDuration": 60 }
  }
}
```

音楽・曲生成は2〜3分かかるため、Vercel の実行時間を延長している。

---

## 5. ミドルウェア

**ファイル:** `middleware.ts`

### 役割

以下パスに HTTP Basic Auth を強制する。

| 保護パス | 説明 |
|---|---|
| `/admin/*` | メイン管理者画面 |
| `/api/admin/*` | メイン管理者API |
| `/5000/admin/*` | 5000プログラム管理画面 |
| `/api/5000/admin/*` | 5000プログラム管理API |

### リダイレクトルール（OV専用）

| アクセス先 | リダイレクト先 | 理由 |
|---|---|---|
| `/login` | `/5000/login` | OVは5000専用サイトのため |
| `/purchase`, `/purchase/*` | `/5000` | OVでは通常購入フロー非使用 |
| `/purchase/jam`, `/purchase/jam/*` | `/5000` | JAMDAOルート廃止（安全装置として維持） |

### 処理フロー

1. リクエストパスが対象かチェック
2. `Authorization` ヘッダーを確認
3. Base64 デコードして `user:pass` を検証
4. 環境変数 `ADMIN_USER` / `ADMIN_PASS` と比較
5. 不一致 → `401 Unauthorized` + `WWW-Authenticate: Basic realm="Admin"` 返却
6. 一致 → リクエストを通過させる

---

## 6. レイアウト

**ファイル:** `app/layout.tsx`

### メタデータ設定

| 項目 | 値 |
|---|---|
| title | LIFAI |
| description | AI教育サロン |
| themeColor | `#0b1022` |
| OGP / Twitter Card | 設定済み |
| PWA アイコン | `/icon-192.png`, `/icon-512.png` |

### 主要要素

- `<LifaiCatGlobal>` — 全ページに表示されるAIアシスタント（新）
- `<ToastHost>` — トースト表示ホスト
- フォント: 日本語対応フォント設定

### グローバルスタイル (`globals.css`)

- Body 背景色: `#070A12`（非常に濃いネイビー）
- グリッドパターン背景（24×24px、透明度6%）
- Tailwind ディレクティブ設定

---

## 7. ページ一覧

### `app/page.tsx` — ホームページ (`/`)

**用途:** プレセール情報の表示・ユーザー導線

| 要素 | 内容 |
|---|---|
| カウントダウン | `endAtISO = "2026-05-01T23:59:59+09:00"` |
| 調達バー | `raised` / `goal` USDT（`app/lib/presale.ts` の `computeRaised` で計算） |
| CTA | 権利購入 / ログイン / ビジョン確認 |
| フッター | 利用規約 / 紹介プログラム / プライバシーポリシー / 特定商取引法 / LINE問い合わせ |
| PWA案内 | ホーム画面追加を促す |

---

### `app/top/page.tsx` — ダッシュボード (`/top`)

**用途:** ログイン後のメインダッシュボード

**主要コンポーネント:**

| コンポーネント | 説明 |
|---|---|
| `BalanceBadge`（インライン） | BP/EP残高をWALLETバッジで表示（BP/EP縦2段レイアウト） |
| `NoticeBoard`（インライン） | お知らせ一覧（空の場合「最新のお知らせはありません」） |
| `MissionCard` | アクティブミッション表示 |
| `RadioCard` | ラジオカード |
| `LoginBonusModal` | デイリーログインボーナス（`/api/daily-login`） |
| `BPGrantModal` | 未受取BP受取 |
| `GachaModal` | ガチャモーダル |
| `StakingModal` | ステーキングモーダル |

**ヘッダー構成:**
- 左: `LIFAI APP HOME` バッジ + `LIFAIへようこそ`（同一行）
- 右: Walletバッジ（BP/EP縦2段） + `LOGOUT` ボタン
- 下: `NoticeBoard`（折りたたみ式お知らせ）

**機能タイル一覧（4列グリッド）:**

| タイル ID | 表示名 | リンク先 | 状態 |
|---|---|---|---|
| fortune | 団子占い | /fortune | 有効（デイリー+10BP） |
| market | マーケット | /market | 有効 |
| gacha | LIFASLOT | モーダル | 有効 |
| staking | ステーキング | モーダル | 有効 |
| member | メンバーシップ | /membership | 有効 |
| music2 | MUSICCREATE | /music2 | 有効（Beta） |
| music-boost | Music Boost | /music-boost | 有効（New） |
| note | ノート生成 | /note-generator | 有効（New） |
| workflow | ワークフロー | /workflow | 準備中 |
| minigames | LIFAI Arcade | /mini-games | 有効（New） |
| gift | GiftEP | /gift | 有効 |
| gift-exchange | Gift交換 | — | 準備中 |
| image | 画像生成 | — | 準備中 |

**useEffect 処理順（ページ表示時）:**
1. 認証チェック → 未ログインなら `/login` へ
2. 未受取BPチェック（`/api/user/pending-bp`） → `BPGrantModal`
3. デイリーログインボーナス（`/api/daily-login`） → `LoginBonusModal`
4. 月次BP回復チェック（`/api/wallet/recover`） → 回復があれば残高更新

**未受取BP通知:**
1. `/api/user/pending-bp` で確認
2. BP がある場合 → `BPGrantModal` 表示
3. 受取後 → `/api/user/claim-bp` で確定

---

### `app/purchase/page.tsx` — プラン選択 (`/purchase`, Step 1)

**プラン定義:**

| ID | 実価格 | 表示価格（15%OFF） | タイトル | バッジ |
|---|---|---|---|---|
| `30` | 34 USDT | 40 USDT | Starter | — |
| `50` | 57 USDT | 67 USDT | Builder | 人気 |
| `100` | 114 USDT | 134 USDT | Automation | おすすめ |
| `500` | 567 USDT | 667 USDT | Core | — |
| `1000` | 1,134 USDT | 1,334 USDT | Infra | — |

**フロー:**
1. プラン選択 → `saveDraft()` でsessionStorageに保存
2. `applyId` 自動生成: `lifai_{Date.now()}`
3. `POST /api/apply/create` → GASに仮申請行を作成
4. `POST /api/nowpayments/create` → インボイスURL取得
5. NOWPaymentsポータルへ外部リダイレクト
6. 支払い完了チェック → "次へ" ボタン有効化

---

### `app/apply/page.tsx` — 申請フォーム (`/apply`, Step 2)

**必須入力項目:**

| フィールド | 説明 |
|---|---|
| email | メールアドレス |
| name | 氏名 |
| nameKana | 氏名（カナ） |
| discordId | Discord ID |
| ageBand | 年代 |
| prefecture | 都道府県 |
| city | 市区町村 |
| job | 職業 |

**任意入力項目:** `refName`（紹介者名）、`refId`（紹介者ID）

**refCode 自動補完:** URL パラメータ `?refCode=R-xxxx` が付いている場合、`refId` フィールドに自動セット（既入力は維持）。`/purchase?refCode=...` 経由でも draft 経由で引き継ぎ可能。

**自動保存:** `addval_apply_draft_v1`（sessionStorage）

---

### `app/confirm/page.tsx` — 確認・送信 (`/confirm`, Step 3)

**フロー:**
1. Step 2 の入力内容をsessionStorageから読み込み表示
2. `GET /api/apply/status?applyId=...` で支払い状況確認
3. "支払い完了しました" チェックボックス
4. 送信: `POST /api/apply`
5. 成功時: `/pending` へリダイレクト + Draft クリア

---

### `app/music2/page.tsx` — 音楽生成 2.0 (`/music2`, Beta)

**用途:** 3ステップで楽曲を完成させる新フロー

**ステップ:**
1. テーマ・ジャンル・ムード入力 → 歌詞生成 (`/api/song/start`)
2. 歌詞確認・編集 → 曲構成生成 (`/api/song/structure`)
3. 構成確認 → 音源生成 (`/api/song/approve-structure`)

**入力オプション:** BPM、ボーカルスタイル（女性/男性/混合/なし）

---

### `app/music-boost/page.tsx` — Music Boost (`/music-boost`)

**用途:** EP を消費して楽曲の配信優先度を高める月額ブーストサービス

**認証:** なし（パスワードロック廃止済み）

**プラン一覧（PLANS）:**

| id | label | percent | price（USD） | slots |
|---|---|---|---|---|
| starter | Starter | 2% | $9 | 10 |
| light | Light | 5% | $29 | 25 |
| basic | Basic | 10% | $59 | 50 |
| growth | Growth | 15% | $99 | 75 |
| pro | Pro | 20% | $149 | 100 |
| advanced | Advanced | 25% | $199 | 125 |
| premium | Premium | 30% | $299 | 150 |
| elite | Elite | 35% | $499 | 175 |
| master | Master | 40% | $699 | 200 |
| legend | Legend | 45% | $1000 | 225 |

**EP換算:** `price_usd × 100 EP`（例: $9 → 900 EP）

**機能:**
- EP残高表示 (`GET /api/wallet/balance`)
- ブースト状況確認 (`GET /api/music-boost/status`)
- EP決済 (`POST /api/music-boost/subscribe`)
- 解約 (`POST /api/music-boost/cancel`)
- チュートリアル（`localStorage: musicboost_tutorial_seen`、初回のみ）

**自動更新:** GAS 時間ベーストリガー（毎日深夜0時）が期限切れブーストを自動更新。EP不足時は失効 + メール通知。

---

### `app/mini-games/page.tsx` — LIFAI Arcade (`/mini-games`)

**用途:** ミニゲームハブ。各ゲームへの導線を提供。

**ゲーム一覧:**
- Rumble Arena（週次PvPトーナメント）
- Tap Mining（デイリータップゲーム）

---

### `app/mini-games/rumble/page.tsx` — Rumble Arena (`/mini-games/rumble`)

**用途:** 週次PvPバトルトーナメント

**ゲームシステム:**

| 要素 | 詳細 |
|---|---|
| 通貨 | シャード（装備ガチャ・強化に使用） |
| 装備 | ガチャで入手、強化・解体が可能 |
| バトル | 週次ランキング制。金曜18:50 JST に報酬発表 |
| 報酬 | EP（参加者数に応じて変動） |
| 観戦モード | 他ユーザーのバトルを閲覧可能 |
| バトルログ | モーダルでリプレイ表示 |

**API:**
- `/api/minigames/rumble/entry` — 参加登録
- `/api/minigames/rumble/status` — 状況取得
- `/api/minigames/rumble/ranking` — ランキング・報酬
- `/api/minigames/rumble/equipment` — 装備一覧
- `/api/minigames/rumble/gacha` — 装備ガチャ
- `/api/minigames/rumble/enhance` — 強化
- `/api/minigames/rumble/dismantle` — 解体
- `/api/minigames/rumble/spectator` — 観戦

---

### `app/mini-games/tap/page.tsx` — Tap Mining (`/mini-games/tap`)

**用途:** デイリータップゲーム。BP/EP報酬を獲得。

**ゲームシステム:**

| 要素 | 詳細 |
|---|---|
| 1日の上限 | 500タップ |
| コンボシステム | 50ヒット以上でフィーバーモード（10秒間） |
| バッチ最適化 | 10タップごと or 2秒ごとにバッチAPIへフラッシュ |
| フロートアニメーション | レアリポートが画面上に浮遊表示 |
| マイニングログ | 直近15件の活動ログ表示 |
| デスクトップ | サイドバーにログ表示 |

**API:**
- `/api/minigames/tap/batch-play` — バッチタップ処理（主要）
- `/api/minigames/tap/status` — 状況取得
- `/api/minigames/tap/ranking` — ランキング
- `/api/minigames/tap/ticker` — グローバルイベントティッカー

---

### `app/gift/page.tsx` — GiftEP (`/gift`)

**用途:** GiftEP（ギフトポイント）の管理・送受信

**認証:** パスワード保護（`"nagoya01@"`）

**チュートリアル:** 初回訪問時に3ページのモーダルチュートリアルを自動表示。ヘッダーの `?` ボタンで再表示可能。
- Page 1: GiftEPとは？（基本スペック）
- Page 2: 使い道（贈る / サービスで使う / 履歴）
- Page 3: 利用ルール（換金禁止・再送不可・30日期限）
- 既読管理: `localStorage: gift_ep_tutorial_seen`

**サブページ:**
- `/gift/send` — 他ユーザーへのギフト送信
- `/gift/use` — ギフト使用・交換
- `/gift/history` — ギフト取引履歴

**機能:**
- ギフト残高表示 + 期限アラート
- ユーザーへのギフト送信
- ギフト使用・引き換え

---

### `app/note-generator/page.tsx` — ノート記事生成 (`/note-generator`)

**用途:** note.com 向け記事をAIで3ステップ生成

**ステップ:**
1. テーマ・ターゲット・スタイル・専門レベル入力
2. AI生成プラン・タイトル候補確認（売れやすさスコア付き）
3. 完全な記事（マークダウン形式、有料/無料パート区分）

**生成物:**
- タイトル候補（売れやすさスコア付き）
- 推奨販売価格（JPY）
- SNSコピー（X, LINE用）
- 本文（セクション区分、有料/無料マーキング）

---

### `app/fortune/page.tsx` — 毎日占い (`/fortune`)

**用途:** デイリー占い + 10BP報酬

- 結果はサーバー側で管理（`/api/fortune/result`）
- 1日1回、占い結果取得で10BP付与（`/api/fortune-bp`）

---

### `app/admin/page.tsx` — 管理者ダッシュボード (`/admin`)

**アクセス:** HTTP Basic Auth 必須

**機能:**
- 申請一覧・承認・BP付与
- 売却申請管理
- 会員一覧（ページング・ソート・Music Boost表示）
- Rumble Arena 管理（強制開始・報酬設定・即時実行）
- 音楽審査

---

## 8. API ルート一覧

### 認証

#### `POST /api/auth/login`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ id: string, code: string }` |
| GAS action | `login` |
| 成功レスポンス | `{ ok: true, status, id, token, plan, ... }` |
| 失敗レスポンス | `{ ok: false, reason: "pending" \| "invalid" }` |

#### `POST /api/auth/reset`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ token: string, password: string }` |
| GAS action | `reset_password` |
| 成功レスポンス | `{ ok: true }` |

---

### 申請

#### `POST /api/apply/create`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ plan: string, applyId: string, ...フォームデータ }` |
| GAS action | `apply_create` (初回) / `apply` (フォーム送信時) |

#### `GET /api/apply/status`

| 項目 | 内容 |
|---|---|
| クエリパラメータ | `applyId: string` |
| GAS action | `admin_list` |
| 成功レスポンス | `{ ok: true, status: "pending" \| "paid" \| "approved" }` |

---

### ユーザー情報

#### `POST /api/me`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ id: string, code: string }` |
| GAS action | `me` |
| タイムアウト | 15秒 |
| 成功レスポンス | `{ ok: true, me: { login_id, email, status, plan, my_ref_code, ref_path, referrer_login_id, referrer_2_login_id, referrer_3_login_id, referrer_4_login_id, referrer_5_login_id, ... } }` |

#### `POST /api/daily-login`

| 項目 | 内容 |
|---|---|
| 用途 | デイリーログインボーナス付与 |
| GAS action | `daily_login` |
| 成功レスポンス | `{ ok: true, bonus_bp, streak, total_count }` |

---

### 決済（NOWPayments）

#### `POST /api/nowpayments/create`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ amount: number, plan: string, applyId: string }` |
| 外部API | `POST https://api.nowpayments.io/v1/invoice` |
| 成功レスポンス | `{ ok: true, invoice_url: string }` |

**NOWPayments リクエストペイロード:**
```json
{
  "price_amount": "<金額>",
  "price_currency": "usd",
  "pay_currency": "usdttrc20",
  "order_id": "lifai_{applyId}",
  "ipn_callback_url": "{NEXT_PUBLIC_SITE_URL}/api/nowpayments/ipn",
  "success_url": "/apply?applyId={applyId}&plan={plan}",
  "cancel_url": "/purchase"
}
```

#### `POST /api/nowpayments/ipn`

| 項目 | 内容 |
|---|---|
| 署名検証 | `x-nowpayments-sig` ヘッダーの HMAC-SHA512 検証 |
| テストモード | `x-test-ipn: 1` ヘッダーで署名チェック回避 |
| GAS action | `payment_update` |

---

### 管理者 (Basic Auth 必須)

#### `GET /api/admin/list`
GAS `admin_list` → `{ ok: true, items: ApplyRow[] }`

#### `POST /api/admin/approve`
| リクエスト | `{ rowIndex: number }` |
GAS `admin_approve` → `{ ok: true, loginId, tempPassword }` または `{ ok: true, oneTimeCode }`

#### `GET /api/admin/members`

| クエリパラメータ | 説明 |
|---|---|
| `page` | ページ番号 |
| `pageSize` | 1ページの件数 |
| `sortKey` | ソートキー |
| `sortOrder` | `asc` \| `desc` |

**MemberRow 型:**
```typescript
{
  login_id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  created_at: string;
  bp_balance: number;
  ep_balance: number;
  login_streak: number;
  total_login_count: number;
  subscription_plan: string;
  last_login_at: string;
  music_boost_plan?: string | null;
  music_boost_expires_at?: string | null;
}
```

**ソートキー (`ALLOWED_SORT_KEYS`):** `created_at` / `ep_balance` / `bp_balance` / `login_streak` / `total_login_count` / `last_login_at`

---

### Music Boost

#### `GET /api/music-boost/status`

| クエリパラメータ | `userId: string` |
| GAS action | `music_boost_status` |
| 成功レスポンス | `{ ok: true, current_boost, total_slots, used_slots, available_slots, plans }` |

#### `POST /api/music-boost/subscribe`

| リクエスト | `{ userId, planId, paymentMethod?: "ep" }` |
| GAS action | `music_boost_subscribe` |
| 成功レスポンス | `{ ok: true, boost_id, plan_id, percent, price_usd, slots_used, started_at, expires_at, ep_cost? }` |
| エラー | `no_slots_available` / `insufficient_ep` / `ep_deduct_failed` |

**EP換算:** `paymentMethod="ep"` の場合、`price_usd × 100 EP` を差し引く。

#### `POST /api/music-boost/cancel`

| リクエスト | `{ userId: string }` |
| GAS action | `music_boost_cancel` |
| 成功レスポンス | `{ ok: true, canceled_at }` |

---

### ミニゲーム - Rumble Arena

#### `POST /api/minigames/rumble/entry`
参加登録。`{ userId, code }` → `{ ok: true, entry_id, battle_name }`

#### `GET /api/minigames/rumble/status`
現在の状況取得。ランク・シャード数・装備情報を返す。

#### `GET /api/minigames/rumble/ranking`
週間ランキング + 報酬額（参加者数に応じて変動、金曜18:50 JST 発表）。

#### `POST /api/minigames/rumble/gacha`
装備ガチャ実行。シャードを消費。

#### `POST /api/minigames/rumble/enhance`
装備強化。シャードを消費。

#### `POST /api/minigames/rumble/dismantle`
装備解体。シャードを返還。

---

### ミニゲーム - Tap Mining

#### `POST /api/minigames/tap/batch-play`
バッチタップ処理（10タップ or 2秒ごとにフラッシュ）。
`{ userId, code, count, session_id }` → `{ ok: true, rewards, total_taps_today, remaining_taps }`

#### `GET /api/minigames/tap/status`
今日のタップ数・残り・コンボ状態などを返す。

#### `GET /api/minigames/tap/ticker`
グローバルイベントティッカー（他ユーザーの活動含む）。

---

### ギフトシステム

#### `GET /api/gift/balance`
ギフト残高 + 期限情報。`{ ok: true, balance, expires_at }`

#### `POST /api/gift/send`
`{ sender_id, code, receiver_id, amount, message }` → `{ ok: true }`

#### `POST /api/gift/use`
`{ user_id, code, amount }` → `{ ok: true, new_balance }`

---

### ノート記事生成

#### `POST /api/note/plan`
`{ theme, target, style, expertise }` → `{ ok: true, title_candidates, suggested_price, sns_copy }`

#### `POST /api/note/generate`
`{ plan_id, selected_title, ... }` → `{ ok: true, article_markdown }`

---

### マーケット

#### `GET /api/market/list`
```
?page=1&limit=50&item_type=...&currency=...&q=...
```
500ms debounce で検索対応。

#### `POST /api/market/create`
| 認証 | `{ id, code }` |
| リクエスト | `{ title, desc, item_type, asset_count, currency, price, delivery_mode, delivery_ref, stock_total }` |
| GAS action | `market_create` |

---

### 音楽生成

#### `POST /api/music/generate`
**maxDuration:** 300秒

| リクエスト | `{ prompt, mode: "standard"\|"pro", bpm?, waveform?, vocal?, userId? }` |
| 成功レスポンス | `{ ok: true, predictionId, lyrics }` |
| レート制限エラー | `{ ok: false, error: "rate_limited" }` （HTTP 429） |

**レート制限:** `userId` が指定された場合、3時間ウィンドウ内で最大5回。超過時はHTTP 429 + `{ ok: false, error: "rate_limited" }` を返す。フロントは「現在ジョブが込み合っております。しばらくたってからお試しください。」と表示。

**処理フロー:**
1. OpenAI GPT-4o-mini で歌詞生成（オプション）
2. 日本語→英語キーワード変換
3. Replicate Minimax music-01 で3セクション並列生成（Verse/Chorus/Bridge）
4. メモリキャッシュ保存（TTL 4時間）

#### `GET /api/music/status`
**maxDuration:** 300秒

| クエリパラメータ | `id: string`（predictionId） |

| stage | 説明 | progress |
|---|---|---|
| `verse` | Verse生成中 | 0.0〜0.33 |
| `chorus` | Chorus生成中 | 0.33〜0.66 |
| `bridge` | Bridge生成中 | 0.66〜0.9 |
| `merging` | マージ中 | 0.9〜1.0 |
| `done` | 完成 | 1.0 |

#### `GET /api/music/history`（新）
ユーザーの音楽生成履歴（サーバー側管理）。

---

### BGM生成

BGMはボーカルなしのインストゥルメンタル音楽を生成するフロー。音楽生成（`/api/music`）とは独立したAPI。

## BGM Loop Engine アーキテクチャ

| モード    | Replicate 生成時間 | 後処理                              | 最終出力   |
|----------|-------------------|-------------------------------------|-----------|
| Standard | 45 秒固定          | loudnorm + ループベイク              | ~45 秒（ブラウザで無限ループ） |
| Pro      | 45〜90 秒（指定可） | loudnorm + ループベイク + EQ/リバーブ + 180 秒拡張 | 約 3 分 |

#### `POST /api/bgm/generate`
**maxDuration:** 120秒

| 項目 | 内容 |
|---|---|
| 認証 | `{ id: string, code: string }` 必須 |
| リクエスト | `{ id, code, theme, genre, mood, duration?, bpm?, isPro?, key? }` |
| BP コスト | 通常: 80 BP（`BP_COSTS.music_bgm`）/ Pro: 150 BP（`BP_COSTS.music_bgm_pro`） |
| duration | Standard は 45 秒固定、Pro は 45〜90 秒（ユーザー指定） |
| key | string（省略可）。KEY指定（例: `"C_major"`, `"A_minor"`）。省略時はプロンプト任せ |
| 成功レスポンス | `{ ok: true, predictionId: string, bpUsed: number, mode: "standard_loop" \| "pro_loop" }` |
| mode（レスポンス） | `"standard_loop"` \| `"pro_loop"` — フロントが status route の後処理を切り替えるために使用 |
| Replicate model | `671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb`（minimax music-01） |

**処理フロー:**
1. BP残高チェック（GAS `get_balance`）
2. BP差し引き（GAS `deduct_bp` + `adminKey`）← 生成**前**に確定
3. GPT-4o-mini でムード雰囲気の英語説明生成（失敗時はフォールバック）
4. Replicate に投げて predictionId を返す

**GENRE_MAP / MOOD_MAP:**
- 日本語ジャンル・ムードを英語キーワードに変換
- 例: ポップ→`"pop"`、壮大→`"epic, grand, majestic, orchestral"`

**プロンプト末尾固定サフィックス:** `"instrumental only, no vocals, no singing, background music, BGM, high quality, studio quality, clear mix"`

#### `GET /api/bgm/status`
**maxDuration:** 120秒

`?id={predictionId}&mode={mode}` — Replicate の予測状況をポーリング。完了時に後処理を行い音声URLを返す。

| クエリパラメータ | 内容 |
|---|---|
| id | predictionId（必須） |
| mode | `"standard_loop"` \| `"pro_loop"` — 後処理の種類を指定（省略時は `"standard_loop"`） |

**完了時の後処理（`app/lib/bgm-processor.ts`）:**
1. Replicate URL からダウンロード → tmpdir に保存
2. EBU R128 loudness 正規化（-16 LUFS、loudnorm フィルター）
3. ループベイク（crossfade 4 秒、tail/head 重ね合わせ）
   - xfade 領域を先頭に配置してブラウザの `<audio loop>` でシームレスに聴こえるよう加工
4. Pro のみ: EQ 加工（120Hz +2dB warmth、8kHz +2dB air）+ aecho リバーブ
5. Pro のみ: 180 秒尺にループ拡張（extendLoop）
6. R2 にアップロード → 永続 URL を返す。失敗時は Replicate URL にフォールバック

**R2 環境変数（任意、未設定時はフォールバック）:**

| 変数名 | 用途 |
|---|---|
| `CLOUDFLARE_R2_ACCOUNT_ID` | R2 アカウントID |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 アクセスキー |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 シークレット |
| `CLOUDFLARE_R2_BUCKET_NAME` | バケット名 |
| `CLOUDFLARE_R2_PUBLIC_URL` | 公開URL（`https://...`） |

---

### 曲作成（Song）

#### `POST /api/song/start`
**maxDuration:** 60秒

| 認証 | `{ id, code }` |
| リクエスト | `{ theme, genre, mood }` |
| 必要BP | 最低 10BP |
| 成功レスポンス | `{ ok: true, jobId, status: "lyrics_generating", bpLocked: 10 }` |

処理フロー:
1. ユーザー認証
2. BP残高確認（10BP以上）
3. JobID生成: `song_{YYYYMMDD}_{RANDOM}`
4. バックグラウンドで歌詞生成（fire-and-forget）

#### `POST /api/song/approve-structure`
**maxDuration:** 300秒

構成承認後、音源生成を開始。

---

### ステーキング

#### `GET /api/staking`

| クエリパラメータ | `loginId: string` |
| GAS action | `get_stakes` |
| 成功レスポンス | `{ ok: true, stakes: StakeItem[], bp_balance: number }` |

**StakeItem 型:**
```typescript
{
  stake_id:    string;
  staked_bp:   number;
  rate:        number;
  interest_bp: number;
  total_bp:    number;
  started_at:  string;
  expires_at:  string;
  status:      "active" | "matured" | "claimed";
  claimable:   boolean;
}
```

#### `POST /api/staking`

| リクエスト | `{ loginId, amount, days }` |
| GAS action | `stake_bp` |
| 成功レスポンス | `{ ok: true, stake_id }` |
| エラー | `{ ok: false, reason: "insufficient_bp" }` |

#### `PATCH /api/staking`

| リクエスト | `{ loginId, stake_id }` |
| GAS action | `claim_stake` |
| 成功レスポンス | `{ ok: true, total_bp }` |

---

### ウォレット

#### `POST /api/wallet/balance`

| リクエスト | `{ id, group? }` |
| GAS action | `get_balance` |
| 成功レスポンス | `{ ok: true, bp, ep, plan, bp_cap }` |

`bp_cap` はプランに応じた BP 月次回復の上限値。

#### `POST /api/wallet/recover`

| リクエスト | `{ loginId, group? }` |
| GAS action | `monthly_bp_recover` |
| 成功（回復あり） | `{ ok: true, bp_recovered: N, bp_balance: M }` |
| 成功（期限内） | `{ ok: false, reason: "already_recovered" }` |

30日に1回、`bp_cap × 50%` を上限に BP を回復。`/top` 表示時に自動呼び出し。

---

### LifaiCat

#### `POST /api/cat-chat`
LifaiCat AI との会話。`{ userId, message, context }` → `{ ok: true, reply }`

#### `POST /api/cat-feedback`
フィードバック送信。

#### `GET /api/cat-recommendation`
ユーザーへのパーソナライズされたおすすめ。

---

## 9. コンポーネント一覧

### `components/Field.tsx`

```typescript
{
  label: string;
  required?: boolean;
  type?: string;         // デフォルト: "text"
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  maxLength?: number;
}
```

### `components/Select.tsx`

```typescript
{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
}
```

### `components/StepHeader.tsx`

```typescript
{
  step: number;
  total?: number;   // デフォルト: 3
  title: string;
  subtitle?: string;
}
```

### `components/PlanPicker.tsx`

```typescript
{
  value?: Plan;
  onChange: (p: Plan) => void;
}
```

2列グリッド（モバイル対応）、選択時ハイライト。

### `components/WalletBadge.tsx`

- `login_id` を localStorage から取得
- `GET /api/wallet/balance` を呼び出し
- BP・EP残高を表示

### `components/BPGrantModal.tsx`

```typescript
{
  amount: number;
  onClose: () => void;
}
```

### `components/LoginBonusModal.tsx`

デイリーログインボーナスモーダル。`/api/daily-login` を呼び出して streak と bonus_bp を表示。

### `components/GachaModal.tsx`

ガチャ実行モーダル。BP消費でアイテム抽選。

### `components/GiftEPTutorial.tsx`（新）

GiftEP チュートリアルモーダル（3ページ）。

```typescript
// コンポーネント
<GiftEPTutorial open={bool} onClose={() => void} />

// カスタムフック（初回表示判定）
const { open, openTutorial, closeTutorial } = useGiftEPTutorial();
```

- `localStorage: gift_ep_tutorial_seen` で既読管理
- ページインジケーター（ドット）でナビゲーション
- 最後のページで「はじめる」ボタン → localStorage に記録して閉じる

### `components/StakingModal.tsx`

BP ステーキングモーダル。固定利率モデルで完全有効化済み。

```typescript
{
  loginId:     string;
  onClose:     () => void;
  onBpChanged: () => void;
}
```

**機能:**
- `GET /api/staking?loginId=...` でステーク一覧 + BP残高を取得
- ロック期間（30/60/90日）を選択し、BPを預け入れ（最低100BP）
- 満期ステークを「受け取る」ボタンで回収（元本＋利息まとめて）
- ステーク中・受取可能を分けてリスト表示

**連携 GAS action:** `stake_bp` / `get_stakes` / `claim_stake`

### `components/ThemeToggle.tsx`（新）

- 固定位置（右上、z-index 30）
- ☀️（ダーク時）/ 🌙（ライト時）
- `useTheme()` フック連携

### `components/LifaiCat.tsx`（新）

LifaiCat UI コンポーネント + Context Provider。

### `components/LifaiCatGlobal.tsx`（新）

全ページで表示されるグローバル LifaiCat インスタンス（`app/layout.tsx` でインジェクション）。

### `components/Toast.tsx` / `components/useToast.ts`

- 固定位置: 画面上部中央
- z-index: 9999
- TTL: 2.2秒で自動消滅
- 背景: 黒/60%透明度 + blur

---

## 10. ライブラリ・ユーティリティ

### `app/lib/auth.ts`

**AuthState 型:**
```typescript
type AuthState = {
  status: "approved" | "pending";
  id: string;
  token?: string;
  plan?: string;
  updatedAt: number;
}
```

| 関数 | 説明 |
|---|---|
| `getAuth()` | localStorage `addval_auth_v1` から読み込み |
| `setAuth(next)` | localStorage に保存（`updatedAt` 自動追加） |
| `setAuthSecret(secret)` | sessionStorage `addval_auth_secret_v1` にパスワード保存 |
| `getAuthSecret()` | sessionStorage からパスワード取得 |
| `clearAuthSecret()` | sessionStorage のパスワードのみ削除 |
| `clearAuth()` | localStorage・sessionStorage 両方削除 |

---

### `app/lib/useTheme.ts`（新）

**用途:** ダーク/ライトモード管理

```typescript
const { isDark, toggleTheme } = useTheme();
```

- localStorage キー: `"lifai_theme_v1"`
- デフォルト: ダークモード
- 対応ページ: ミニゲームハブ、Tap Mining、Rumble Arena、Music Boost

---

### `components/storage.ts`

申請フォームのDraft管理

**Draft 型:**
```typescript
type Plan = "30" | "50" | "100" | "500" | "1000";
type Draft = {
  version?: number;
  plan?: Plan;
  email?: string;
  name?: string;
  nameKana?: string;
  discordId?: string;
  refName?: string;
  refId?: string;
  ageBand?: string;
  prefecture?: string;
  city?: string;
  job?: string;
  applyId?: string;
  updatedAt?: number;
}
```

| 関数 | 説明 |
|---|---|
| `loadDraft()` | sessionStorage から読み込み（バージョンチェックあり） |
| `saveDraft(next)` | 既存Draftにマージして保存 |
| `clearDraft()` | 削除 |
| `updateDraftField(field, value)` | 単一フィールドのみ更新 |
| `hasDraft()` | 存在確認 |
| `getRawDraft()` | デバッグ用: 生データを返す |

---

### `app/api/music/_cache.ts`

**JobState 型:**
```typescript
type JobState = {
  verseId: string;
  chorusId: string;
  bridgeId: string;
  stage: "verse" | "chorus" | "bridge" | "merging" | "done" | "failed";
  lyrics: string;
  verseUrl?: string;
  chorusUrl?: string;
  bridgeUrl?: string;
  outputUrl?: string;
}
```

| 関数 | TTL | 説明 |
|---|---|---|
| `cacheLyrics(predictionId, lyrics)` | 2時間 | 歌詞をキャッシュ |
| `getCachedLyrics(predictionId)` | — | キャッシュから歌詞取得 |
| `cacheJob(jobId, job)` | 4時間 | ジョブ状態をキャッシュ |
| `getJob(jobId)` | — | ジョブ状態取得 |
| `updateJob(jobId, update)` | — | ジョブ状態を部分更新 |

---

### `app/api/song/_jobStore.ts`

**SongJob 型:**
```typescript
type SongStatus =
  | "lyrics_generating"
  | "lyrics_done"
  | "structure_generating"
  | "structure_done"
  | "audio_generating"
  | "done"
  | "failed";

type SongJob = {
  jobId: string;
  userId: string;
  status: SongStatus;
  bpLocked: number;
  bpFinal: number | null;
  prompt: { theme: string; genre: string; mood: string };
  lyricsData?: { title, lyrics, editedByUser, version };
  structureData?: { bpm, key, sections, hookSummary, title };
  audioUrl: string | null;
  downloadUrl: string | null;
  rightsLog: {
    lyricsApproved: boolean;
    structureApproved: boolean;
    humanEditedLyrics: boolean;
  };
  error: string | null;
  createdAt: number;
  updatedAt: number;
}
```

| 関数 | 説明 |
|---|---|
| `createJob(params)` | 新規ジョブ作成（TTL 4時間） |
| `getJob(jobId)` | ジョブ取得 |
| `updateJob(jobId, update)` | ジョブ部分更新（`updatedAt` 自動更新） |
| `listUserJobs(userId)` | ユーザーの全ジョブ一覧 |

グローバル変数 `__jobMap__` を使用（Next.js ホットリロード対策）。

---

## 11. 状態管理・ストレージ

### localStorage

| キー | 型 | 用途 | 永続性 |
|---|---|---|---|
| `addval_auth_v1` | AuthState | ログイン状態 | ブラウザ再起動後も保持 |
| `login_id` | string | WalletBadge用ユーザーID | ブラウザ再起動後も保持 |
| `lifai_theme_v1` | `"dark"` \| `"light"` | テーマ設定 | ブラウザ再起動後も保持 |
| `TUTORIAL_KEY` | boolean | マーケットチュートリアル表示済み | ブラウザ再起動後も保持 |
| `musicboost_tutorial_seen` | boolean | Music Boostチュートリアル表示済み | ブラウザ再起動後も保持 |
| `gift_ep_tutorial_seen` | `"1"` | GiftEP チュートリアル表示済み | ブラウザ再起動後も保持 |

### sessionStorage

| キー | 型 | 用途 | 永続性 |
|---|---|---|---|
| `addval_auth_secret_v1` | string | ログインパスワード | ブラウザ終了時に消滅 |
| `addval_apply_draft_v1` | Draft | 申請フォームの入力途中データ | ブラウザ終了時に消滅 |
| `music_boost_authed` | `"1"` | Music Boostページ認証フラグ（廃止済み・参照のみ残留） | ブラウザ終了時に消滅 |
| `gift_ep_authed` | `"1"` | GiftEPページ認証フラグ | ブラウザ終了時に消滅 |

### メモリキャッシュ（サーバーサイド）

| キャッシュ | TTL | 用途 |
|---|---|---|
| 歌詞キャッシュ | 2時間 | 音楽生成の歌詞 |
| 音楽ジョブ | 4時間 | Replicate 予測ジョブ状態 |
| 曲作成ジョブ | 4時間 | 曲作成全体のジョブ状態 |

---

## 12. 認証フロー

### ユーザー認証（クライアントサイド）

```
[ログインページ]
   │
   ├─ POST /api/auth/login { id, code }
   │      │
   │      └─ GAS action=login → HMAC-SHA256検証
   │
   ├─ 成功 → localStorage addval_auth_v1 に保存
   │          sessionStorage addval_auth_secret_v1 に保存
   │          → /top へリダイレクト
   │
   └─ 失敗 → { reason: "pending" } → /pending へリダイレクト
```

**パスワード照合:** GAS側で `HMAC-SHA256(SECRET_KEY, loginId + ":" + password)` のハッシュと比較

**初回パスワード:** リセットトークン（UUID+ランダム16文字、72時間有効・1回限り）をメール送信

---

### 管理者認証（サーバーサイド）

```
リクエスト → middleware.ts
   │
   ├─ パス /admin/* /api/admin/* /5000/admin/* /api/5000/admin/* ?
   │
   ├─ YES → Authorization ヘッダー確認
   │         Base64デコード → user:pass 検証
   │         ADMIN_USER / ADMIN_PASS と比較
   │
   ├─ 一致 → 通過
   └─ 不一致 → 401 Unauthorized
```

---

## 13. ユーザー申請フロー

```
[Step 0] ホーム (/)
   └─ "権利購入" ボタン

[Step 1] プラン選択 (/purchase)
   ├─ プランを選択
   ├─ applyId 生成: lifai_{Date.now()}
   ├─ POST /api/apply/create → GAS: apply_create（仮申請行作成）
   ├─ POST /api/nowpayments/create → インボイスURL取得
   └─ NOWPayments ポータルへリダイレクト（USDT支払い）

[支払い] NOWPayments
   └─ 支払い完了 → POST /api/nowpayments/ipn（Webhook）
                      └─ GAS: payment_update
                               └─ 条件満たせば自動承認
                                  (expected_paid の -2% まで許容)

[Step 2] 申請フォーム (/apply)
   ├─ 個人情報入力（email, name, nameKana, discordId, etc.）
   └─ sessionStorage に自動保存

[Step 3] 確認・送信 (/confirm)
   ├─ 入力内容確認
   ├─ GET /api/apply/status → 支払い状況確認
   ├─ POST /api/apply → GAS: apply（フォームデータ保存）
   └─ /pending へリダイレクト

[審査] 管理者 (/admin)
   ├─ GET /api/admin/list → 申請一覧確認
   └─ POST /api/admin/approve → GAS: admin_approve
                                  └─ ログイン情報生成
                                  └─ リセットメール送信

[ログイン] (/login)
   ├─ メール受信 → パスワード設定 (/reset?token=...)
   └─ ログイン → /top
```

---

## 14. 決済フロー（NOWPayments）

```
フロント → POST /api/nowpayments/create
              │
              └─ NOWPayments API: POST /v1/invoice
                    │
                    └─ { invoice_url }
                         │
                         └─ フロント → invoice_url へリダイレクト

NOWPayments → 支払い完了 → POST /api/nowpayments/ipn
                                │
                                ├─ HMAC-SHA512 署名検証
                                │   (x-nowpayments-sig ヘッダー)
                                │
                                └─ GAS: payment_update
                                         │
                                         └─ 自動承認判定
                                            (TOLERANCE_PCT = 2%)
```

**テスト方法:**
```bash
curl -X POST /api/nowpayments/ipn \
  -H "x-test-ipn: 1" \
  -H "Content-Type: application/json" \
  -d '{ ...IPNデータ... }'
```

---

## 15. 音楽・曲生成フロー

### 音楽生成フロー（`/api/music/generate`）

```
POST /api/music/generate { prompt, mode, bpm, waveform, vocal }
   │
   ├─ [オプション] OpenAI GPT-4o-mini で歌詞生成
   ├─ プロンプト構築（日本語→英語変換）
   ├─ Replicate minimax/music-01 で3セクション並列生成
   │   ├─ Verse  予測開始
   │   ├─ Chorus 予測開始
   │   └─ Bridge 予測開始
   │
   └─ { ok: true, predictionId: "music_{timestamp}", lyrics }

GET /api/music/status?id={predictionId}  (ポーリング、MAX_TICKS=150、2秒×150=5分)
   │
   ├─ stage: verse   → Verse  完了待ち
   ├─ stage: chorus  → Chorus 完了待ち
   ├─ stage: bridge  → Bridge 完了待ち
   ├─ stage: merging → MERGE_SERVER_URL に POST してマージ
   └─ stage: done    → { outputUrl, lyrics, progress: 1.0 }
```

### 曲作成フロー（`/api/song/start`、3ステップ新フロー）

```
[Step 1] POST /api/song/start { id, code, theme, genre, mood }
   ├─ ユーザー認証 + BP残高確認 (>=10BP)
   ├─ JobID生成: song_{YYYYMMDD}_{RANDOM}
   └─ バックグラウンド: OpenAI 歌詞生成（fire-and-forget）

[Step 2] ユーザーが歌詞確認・編集後
   POST /api/song/structure → 曲構成生成

[Step 3] ユーザーが構成確認後
   POST /api/song/approve-structure (maxDuration: 300秒) → 音源生成
```

---

## 16. GAS バックエンド連携

### GAS WebApp への共通リクエスト形式

```
GET/POST {GAS_WEBAPP_URL}?key={GAS_API_KEY}&action={action}&...params
```

### GAS Action 一覧

| action | HTTP | 呼び元 | 内容 |
|---|---|---|---|
| `apply_create` | POST | `/api/apply/create` | 購入時に申請行を仮作成 |
| `payment_update` | POST | `/api/nowpayments/ipn` | IPN受信→支払い更新→自動承認 |
| `apply` | POST | `/api/apply/create` | フォーム送信時に行を更新 |
| `admin_list` | GET | `/api/admin/list` | 全申請一覧を返す |
| `admin_approve` | POST | `/api/admin/approve` | 手動承認→リセットメール送信 |
| `login` | POST | `/api/auth/login` | HMAC-SHA256でパスワード照合 |
| `me` | POST | `/api/me` | ログイン済みユーザーの紹介情報 |
| `get_balance` | GET/POST | `/api/wallet/balance` | BP/EP残高を返す（`bp_cap` フィールドを含む） |
| `monthly_bp_recover` | POST | `/api/wallet/recover` | 30日に1回BP回復（`bp_last_reset_at` で制御） |
| `reset_password` | POST | `/api/auth/reset` | トークン検証→パスワードハッシュ保存 |
| `reset_resend` | — | 管理者直呼び | リセットメール再送 |
| `ref_tree_build` | — | 管理者メニュー | 紹介ツリーシートを再生成 |
| `market_create` | POST | `/api/market/create` | 商品出品 |
| `get_sell_requests` | GET | `/api/admin/sell-requests` | 売却申請一覧 |
| `grant_bp_for_sell` | POST | `/api/admin/grant-bp` | 売却申請へBP付与 |
| `pending_bp` | GET | `/api/user/pending-bp` | 未受取BP確認 |
| `claim_bp` | POST | `/api/user/claim-bp` | BP受取確定 |
| `daily_login` | POST | `/api/daily-login` | デイリーログインボーナス付与 |
| `admin_get_members` | POST | `/api/admin/members` | 承認済み会員一覧（ページング・ソート・Music Boost結合） |
| `music_boost_status` | GET | `/api/music-boost/status` | ユーザーの現在ブースト状況 |
| `music_boost_subscribe` | POST | `/api/music-boost/subscribe` | Music Boost 新規契約・プラン変更（EP差引） |
| `music_boost_cancel` | POST | `/api/music-boost/cancel` | Music Boost 解約 |
| `music_boost_admin_list` | — | 管理者直呼び | 全ブースト一覧 |
| `music_boost_get_info` | GET | `/api/music-boost/info` | アーティスト名・アルバム名取得 |
| `music_boost_update_info` | PATCH | `/api/music-boost/info` | アーティスト名・アルバム名更新 |
| `wallet_ledger_all` | GET | `/api/admin/wallet-ledger` | 全ユーザーのウォレット台帳取得（adminKey必須） |
| `ref_reassign` | POST | `/api/admin/ref-reassign` | 紹介者の再割当（adminKey必須） |
| `stake_bp` | POST | `/api/staking` (POST) | BP ステーキング開始 |
| `claim_stake` | POST | `/api/staking` (PATCH) | ステーク満期受取 |
| `get_stakes` | GET | `/api/staking` (GET) | ステーク一覧 + BP残高取得 |
| `deduct_bp` | POST | `/api/bgm/generate` | BGM生成前に BP を差し引く（`adminKey` 必須） |
| `gacha_spin` | POST | `/api/gacha` | ガチャ抽選（`is10: true` で10連） |
| `market_buy` | POST | `/api/market/buy` | 商品購入（BP消費）|
| `market_notify_purchase` | POST | `/api/market/buy`（fire-and-forget） | 購入通知（買い手に納品URL・売り手に通知） |
| `sell_request` | POST | `/api/market/sell-request` | 出品者自身による売却申請 |
| `music_sell_submit` | POST | `/api/apply-sell/submit` | 楽曲売却申請（EP価格・審査制） |
| `music_sell_delete` | DELETE | `/api/admin/music-sell-requests` | 承認済み楽曲売却申請を物理削除（`approved` 行のみ・adminKey必須） |
| `narasu_agency_submit` | POST | `/api/narasu-agency/submit` | Narasu Agency パートナー申請送信 |
| `narasu_pay_bp` | POST | `/api/narasu-agency/pay-bp` | Narasu Agency BP支払い |
| `narasu_pay_ep` | POST | `/api/narasu-agency/pay-ep` | Narasu Agency EP支払い |
| `get_radio_songs` | GET | `/api/radio?action=songs` | ラジオ楽曲一覧取得 |
| `get_radio_status` | GET | `/api/radio?action=status` | ユーザーのラジオ受聴状況取得 |
| `radio_start` | POST | `/api/radio` | ラジオ楽曲の視聴開始記録 |
| `radio_submit` | POST | `/api/radio` | ラジオ視聴完了 + EP報酬付与 |
| `rumble_status` | GET | `/api/minigames/rumble/status` | Rumble Arena 状況取得 |
| `tap_batch_play` | POST | `/api/minigames/tap/batch-play` | タップバッチ処理（BP/EP報酬計算） |
| `music_boost_set_tracks` | PATCH | `/api/music-boost/info` | 楽曲リスト（`tracks` 配列）を全置換保存 |
| `my_referral_dashboard` | POST | `/api/referral/dashboard` | 自分が紹介した人リスト＋報酬履歴・合計を返す |
| `user_reset_request` | POST | `/api/auth/forgot-password` | ユーザー自身によるPW再設定申請→トークン再発行＋メール送信（approved限定・列挙攻撃対策で常にok:true返却） |
| `ref_backfill_from_refcode` | POST | `/api/admin/ref-backfill` | ref_codeが入っていてreferrer_login_idが空の行を一括バックフィル（既存設定は上書きしない）。レスポンス: `{ updated, skipped, unmatched }` |
| `affiliate_monthly_summary` | POST | `/api/admin/affiliate-summary` | 月次アフィリエイト集計（読み取り専用）。`month=YYYY-MM` を受け取り、紹介者別EP集計を返す |

### ステーキング仕様

**GAS action:** `stake_bp` / `get_stakes` / `claim_stake`  
**最小ステーク量:** 100BP  
**利率（固定）:**

| 期間 | 利率 |
|---|---|
| 30日 | +10% |
| 60日 | +25% |
| 90日 | +50% |

**計算:** `interest_bp = floor(staked_bp × rate)` / `total_bp = staked_bp + interest_bp`

**Stakingシートカラム:** `stake_id`, `login_id`, `staked_bp`, `rate`, `started_at`, `expires_at`, `status`, `claimed_at`, `interest_bp`, `total_bp`

**status の値:** `active` / `matured` / `claimed`

### GAS 自動実行

| 関数名 | トリガー | 内容 |
|---|---|---|
| `musicBoostAutoRenew_` | 毎日深夜0時（時間ベース） | 期限切れ Music Boost を自動更新。EP不足時は `expired` に変更 + メール通知 |
| `createRumbleAutoEntryTrigger` | 週次（月曜） | Rumble Arena の参加登録・バトル処理自動実行 |

### GAS Sheets 構造

| シート名 | 用途 |
|---|---|
| `applies` | メインデータ（全ユーザー・申請・支払い情報）。紹介チェーンは `referrer_login_id`〜`referrer_5_login_id`（最大5段） |
| `ref_tree` | 紹介ツリー表示用（`ref_tree_build` で全消し→再生成） |
| `ref_events` | 紹介紐づけの監査ログ（`ref_backfill_from_refcode` 実行時も記録） |
| `wallet_ledger` | 紹介配当などの金融取引履歴 |
| `music_boost` | Music Boost 契約履歴（id, user_id, plan_id, percent, price_usd, slots_used, status, started_at, expires_at, canceled_at, updated_at） |

**`music_boost.status` の値:** `active` / `canceled` / `expired`

### GAS 既知の仕様・注意事項

| 項目 | 内容 |
|---|---|
| プラン金額のハードコード | `planToGrant_()` 内で `34/57/114/567/1134` (USDT) とBP付与量が対応。Next.js側のPLANS配列と手動で一致させる必要あり |
| リセットメールURLのハードコード | `sendResetMail_()` の送信URLが `https://lifai.vercel.app/reset?token=...` に固定 |
| `login` actionのステータス | `approved` 以外は全て `{ reason: "pending" }` を返す（`pending_payment` / `pending_error` / `paid` も区別なし） |
| 自動承認の許容誤差 | `payment_update` での自動承認は `expected_paid` の -2% まで許容（`TOLERANCE_PCT = 2`） |
| 重複関数 | `getValuesSafe_()` と `getSheetValuesSafe_()` が同一処理で2つ存在（`getValuesSafe_()` を使うこと） |

### `POST /api/wallet/recover`

| 項目 | 内容 |
|---|---|
| リクエスト | `{ loginId: string, group?: string }` |
| GAS action | `monthly_bp_recover` |
| 成功（回復あり） | `{ ok: true, bp_recovered: N, bp_balance: M }` |
| 成功（期限内） | `{ ok: false, reason: "already_recovered" }` |
| エラー | `{ ok: false, reason: "unknown_plan" \| "not_found" }` |

**回復ルール:**
- `bp_last_reset_at` が空 or 30日以上経過した場合に回復
- 回復量 = `min(bp_cap × 50%, max(0, bp_cap - currentBp))`
- cap超えの場合は回復量0でも `bp_last_reset_at` を更新（次の30日サイクル開始）
- `wallet_ledger` に `kind: "monthly_recover"` で記録

**bp_cap マッピング（GAS 実値）:**

| group | plan | bp_cap |
|---|---|---|
| 通常 | "34" | 300 |
| 通常 | "57" | 600 |
| 通常 | "114" | 1,200 |
| 通常 | "567" | 6,000 |
| 通常 | "1134" | 12,000 |
| 5000 | "500" | 1,000 |
| 5000 | "2000" | 4,000 |
| 5000 | "3000" | 8,000 |
| 5000 | "5000" | 10,000 |

---

## 17. マーケットプレイス

**ファイル:** `app/market/page.tsx`

**スタイル:** ダークテーマ（背景 `#0B1220` / 文字 `#EAF0FF`、Radial glow 背景）

**機能:**

| 機能 | 詳細 |
|---|---|
| 商品検索 | 500ms debounce |
| フィルター | item_type / currency |
| ページング | PAGE_SIZE = 12 |
| 商品出品 | `POST /api/market/create` |
| チュートリアル | localStorage確認・初回のみ表示 |

**サブページ:**
- `/market/[item_id]` — 商品詳細・購入
- `/market/create` — 出品フォーム
- `/market/orders` — 購入履歴

---

## 18. ミニゲーム（LIFAI Arcade）

### アーキテクチャ概要

```
/mini-games           ← ハブ（ゲーム選択）
├── /rumble           ← Rumble Arena（週次PvPトーナメント）
└── /tap              ← Tap Mining（デイリータップゲーム）
```

### Rumble Arena システム

**週次サイクル:**
1. 月〜木: バトルフェーズ（デイリー結果更新）
2. 金曜18:50 JST: ランキング確定・EP報酬配布
3. 週末: 次週に向けた準備

**装備システム:**
- ガチャでランダム入手
- シャード（Shard）を消費して強化・解体
- 強さによってバトルに影響

**報酬計算:** 参加者数に応じてEP報酬が変動（金曜18:50 JST 発表）

### Tap Mining システム

**セッションフロー:**
1. 画面タップ → フロント側でバッファリング
2. 10タップ or 2秒ごとに `/api/minigames/tap/batch-play` へフラッシュ
3. サーバーがBP/EP報酬を計算して返す
4. コンボ50以上でフィーバーモード（10秒間、報酬UP）
5. 1日500タップ上限

---

## 19. ギフトシステム

**ページ:** `/gift`（パスワード保護: `"nagoya01@"`）

**機能フロー:**

```
[残高確認] GET /api/gift/balance
   └─ { balance, expires_at }

[送信] POST /api/gift/send
   ├─ 送信者認証（id + code）
   ├─ 受取者IDを指定
   └─ GAS側でギフト残高移動

[使用] POST /api/gift/use
   └─ ギフト残高を消費して特典に変換

[履歴] GET /api/gift/history
   └─ 送受信履歴一覧
```

**期限管理:** 残高に期限が設定されており、期限切れアラートを表示。

---

## 20. 楽曲売却申請

**ページ:** `/apply-sell`

**用途:** ユーザーが生成した楽曲をLIFAI運営に売却申請する。審査制。

**フォーム入力項目:**

| フィールド | 必須 | 説明 |
|---|---|---|
| 楽曲タイトル | ○ | 売却する楽曲の名前 |
| 音楽ファイルURL | ○ | 楽曲の配信URL |
| 希望売却価格（EP） | 任意 | デフォルト: 20 EP、現在相場: 20 EP |
| メモ・補足 | 任意 | 楽曲の特徴・使用イメージなど |

**API:** `POST /api/apply-sell/submit`

| リクエスト | `{ loginId, title, musicUrl, priceUsd（EP値）, memo }` |
|---|---|
| GAS action | `music_sell_submit` |
| GAS送信フィールド | `loginId`, `title`, `music_url`, `price_usdt`（フィールド名は内部的にUSDTのままだがEP値を渡す）, `memo` |
| 成功レスポンス | `{ ok: true }` |
| 審査結果 | 24〜48時間以内に可否を通知 |

**注意:** 申請後「ご利用ありがとうございます。24時間〜48時間以内に売却申請の可否の返答が行われます。今しばらくお待ちください。」と表示。

### 管理者側の操作

| 操作 | API | 説明 |
|---|---|---|
| 一覧取得 | `GET /api/admin/music-sell-requests` | GAS action: `music_sell_list` |
| 承認/却下 | `POST /api/admin/music-sell-requests` `{ requestId, status }` | GAS action: `music_sell_update`。承認時にEP付与 |
| 削除 | `DELETE /api/admin/music-sell-requests` `{ requestId }` | GAS action: `music_sell_delete`。`approved` 行のみ物理削除可 |

承認時: `applies` シートの `ep_balance` に `price_usdt` 分のEPを加算し `wallet_ledger` に `kind: "music_sell"` で記録。  
削除は承認済み（`approved`）行のみ可能。未承認行（`pending`）は削除不可。

---

## 21. LIFAI ラジオ

**コンポーネント:** `components/RadioCard.tsx`（`/top` ダッシュボードに表示）

**報酬:** `RADIO_REWARD_EP = 5 EP`（視聴1回あたり）

**最低視聴時間:** `RADIO_MIN_SECONDS = 120秒`（2分）

**1日の受聴上限（プラン別）:**

| プラン | 上限 |
|---|---|
| free / plus / pro / priority / partner | 1日 1〜5回（`RADIO_DAILY_LIMITS` 参照） |

**API: `GET /api/radio`**

| クエリ | GAS action | 説明 |
|---|---|---|
| `?action=songs` | `get_radio_songs` | 楽曲一覧取得 |
| `?action=status&loginId=xxx` | `get_radio_status` | ユーザーの受聴状況確認 |

**API: `POST /api/radio`**

| `action` フィールド | GAS action | 説明 |
|---|---|---|
| `"start"` + `{ loginId, song_id }` | `radio_start` | 楽曲の視聴開始を記録 |
| `"submit"` + `{ loginId, mission_id, screenshot_note }` | `radio_submit` | 視聴完了 → EP報酬付与 |

---

## 22. Narasu Agency（パートナープログラム）

**ページ:** `/narasu-agency`（ゲートページ → terms → form → confirm → complete）

**ゲート認証:** パスワード `"nagoya01@"`（`NARASU_GATE_PASSWORD`）

**ローカルストレージキー:**
- `lifai_narasu_agency_draft_v1` — 申請フォームのドラフト
- `lifai_narasu_gate_v1` — ゲート通過フラグ

**規約バージョン:** `v0.2-draft`（`NARASU_TERMS_VERSION`）

**フォーム入力項目:**

| フィールド | 説明 |
|---|---|
| narasuLoginId | Narasu アカウントのログインID |
| narasuPassword | Narasu アカウントのパスワード |
| audioUrls | 音楽ファイルURLリスト（複数可） |
| lyricsText | 歌詞テキスト（任意） |
| jacketImageUrl | ジャケット画像URL（任意） |
| jacketNote | ジャケット補足（任意） |
| artistName | アーティスト名 |
| note | 備考 |
| agreedTermsVersion | 規約バージョン（`NARASU_TERMS_VERSION`） |
| agreedAt | 同意日時 |

**API:** `POST /api/narasu-agency/submit`

| リクエスト | 上記フォームフィールド |
|---|---|
| GAS action | `narasu_agency_submit` |
| 検証 | `narasuLoginId`・`narasuPassword` 必須、`audioUrls` 最低1件必須 |

**支払いAPI:**
- `POST /api/narasu-agency/pay-bp` — GAS action: `narasu_pay_bp`
- `POST /api/narasu-agency/pay-ep` — GAS action: `narasu_pay_ep`

---

## 23. 5000プログラム

**ページ:** `/5000`（独立したLP・購入フロー）

**対象:** 別途5000プログラム参加者向けの入会フロー

**プラン定義:**

| PlanId | 金額（円） | 名称 | BP | EP換算 | ユニット数 | プール |
|---|---|---|---|---|---|---|
| `"500"` | 500 | Automation | 1,000 | 3EP=1円 | 0 | none |
| `"2000"` | 2,000 | Core | 4,000 | 2.5EP=1円 | 2 | credit |
| `"3000"` | 3,000 | Core | 8,000 | 2.5EP=1円 | 3 | credit |
| `"5000"` | 5,000 | Infra | 10,000 | 2EP=1円 | 5 | total |

**バッジ:** `"3000"` = RECOMMENDED / `"5000"` = MOST POPULAR

**bp_cap（GAS実値）:**

| plan | bp_cap |
|---|---|
| "500" | 1,000 |
| "2000" | 4,000 |
| "3000" | 8,000 |
| "5000" | 10,000 |

**関連API:**

| パス | 説明 |
|---|---|
| `POST /api/5000/apply` | 申請送信 |
| `POST /api/5000/nowpayments/create` | 決済インボイス作成 |
| `POST /api/5000/nowpayments/ipn` | 決済Webhook |
| `GET /api/5000/purchase-status` | 支払い状況確認 |
| `POST /api/5000/admin/approve` | 管理者承認 |
| `GET /api/5000/admin/list` | 申請一覧 |
| `POST /api/5000/reset/resend` | リセットメール再送 |

**ページ:**
- `/5000` — LP（プラン選択）
- `/5000/apply` — 申請フォーム
- `/5000/confirm` — 確認画面
- `/5000/login` — ログイン
- `/5000/purchase-status` — 支払い状況確認
- `/5000/admin` — 管理者画面（申請承認 + 財務ゲートウェイ + 音楽売却管理）

**`/5000/admin` 機能:**

| セクション | 内容 |
|---|---|
| 承認待ち | `/api/5000/admin/list` で取得。`/api/5000/admin/approve` で承認 |
| 承認済み | 承認済みユーザー一覧表示 |
| その他 | `manual_review` など手動承認が必要なケース |
| 財務管理ゲートウェイ | パスワード入力 → `POST /api/admin/finance-unlock` → `/admin/finance` へ遷移（本家財務ページと共用） |
| 楽曲売却申請管理 | `/api/admin/music-sell-requests` を使用（本家と共用API）。承認/却下/削除ボタン搭載 |

---

## 24. ギャラリー・作品ページ

### ギャラリー (`/gallery`)

**対象:** ログイン前のユーザー向け（認証不要）

**用途:** LIFAI の全サービス（音楽・画像・記事・占い・ゲーム）のサンプルをまとめて閲覧できるショーケースページ。入会前の検討材料。

**コンポーネント:**
- `app/gallery/page.tsx` — メインページ
- `app/gallery/WorksShowcase.tsx` — 作品一覧コンポーネント
- `components/GalleryNav.tsx` — スティッキーナビゲーション
- `components/WorkCard.tsx` — 個別作品カード
- `data/works.ts` — 作品データ（`WORKS` 配列）

**セクション（スティッキーナビ）:**

| セクションID | 内容 |
|---|---|
| `#music` | 音楽生成サンプル・説明 |
| `#image` | 画像生成サンプル（準備中） |
| `#article` | note記事サンプル |
| `#fortune` | 占いサンプル |
| `#game` | ゲームサンプル |

### 作品詳細 (`/works/[slug]`)

**対象:** ログイン前のユーザー向け（認証不要）

**データ:** `data/works.ts` の `WORKS` 配列から `slug` で特定

**`Work` 型の主要フィールド:**

| フィールド | 型 | 説明 |
|---|---|---|
| `slug` | string | URLパラメータ |
| `tab` | `"music" \| "image" \| "article"` | カテゴリ |
| `title` | string | 作品タイトル |
| `featured` | boolean? | 注目作品フラグ |
| `preview` | `{ type, src, alt?, excerpt? }` | プレビュー（audio/image/text） |
| `body` | string | 詳細本文 |
| `howTo` | string | 生成方法の説明 |
| `applications` | string[] | 活用シーン |
| `relatedSlugs` | string[] | 関連作品 |

**動的ルート:** `app/works/[slug]/page.tsx`

---

## 25. LifaiCat（AIアシスタント）

**コンポーネント:**
- `components/LifaiCat.tsx` — UIコンポーネント + Context Provider
- `components/LifaiCatGlobal.tsx` — グローバルインスタンス（全ページ表示）

**API:**
- `POST /api/cat-chat` — AI会話
- `POST /api/cat-feedback` — フィードバック送信
- `GET /api/cat-recommendation` — パーソナライズされたおすすめ

**用途:**
- 機能の使い方をAIが案内
- コンテキストに応じたおすすめを提示
- フィードバック収集

---

## 26. テーマシステム（ダーク/ライト）

### 実装方法

**フック:** `app/lib/useTheme.ts`
```typescript
const { isDark, toggleTheme } = useTheme();
```

- localStorage キー: `"lifai_theme_v1"`
- デフォルト: ダークモード
- トグルボタン: `components/ThemeToggle.tsx`（固定右上、z-30）

### テーマトークン（Tailwind クラス）

| 項目 | ダーク | ライト |
|---|---|---|
| 背景 | `bg-[#0a0a0a]` | `bg-gray-50` |
| テキスト | `text-white` | `text-gray-900` |
| カード | `bg-white/5` | `bg-white border border-gray-200` |
| ボーダー | `border-white/10` | `border-gray-200` |
| ミュート | `text-white/40` | `text-gray-500` |

### 対応ページ

- `/mini-games`（LIFAI Arcade ハブ）
- `/mini-games/tap`（Tap Mining）
- `/mini-games/rumble`（Rumble Arena）
- `/music-boost`（Music Boost）

---

## 27. 管理者機能

**アクセス:** Basic Auth (`ADMIN_USER` / `ADMIN_PASS`)

### 申請管理
1. `GET /api/admin/list` で申請一覧取得
2. `POST /api/admin/approve { rowIndex }` で承認
3. GASがログイン情報を生成し、リセットメール送信

### BP管理
1. `GET /api/admin/sell-requests` で売却申請一覧取得
2. `POST /api/admin/grant-bp { request_id, user_id, bp_amount }` でBP付与

### 会員一覧
1. `GET /api/admin/members?page=0&pageSize=20&sortKey=created_at&sortOrder=desc`
2. 1ページ20件・サーバーサイドソート対応
3. ソート可能列: BP残高 / EP残高 / 連続ログイン / 累計ログイン / 最終ログイン
4. Music Boost 列: 契約中プランIDと有効期限を表示

### Music Boost 管理
- `music_boost_admin_list` GAS action で全ブースト一覧を確認可能
- 自動更新は毎日深夜0時の GAS トリガーで実行（`musicBoostAutoRenew_`）

### Rumble Arena 管理
- `/api/admin/rumble-force-start` — トーナメント強制開始
- `/api/admin/rumble-reward` — 報酬設定
- `/api/admin/rumble-run-now` — スケジュール即時実行

### 音楽審査
- `/api/admin/music-review` — 提出された楽曲の審査・承認

### 楽曲売却申請管理（本家 `/admin`）
- 申請一覧: `GET /api/admin/music-sell-requests`
- 承認/却下: `POST /api/admin/music-sell-requests { requestId, status }`
- **削除（新規）**: `DELETE /api/admin/music-sell-requests { requestId }` — `approved` 行のみ削除可。承認済みが蓄積した場合のクリーンアップ用

### 財務管理 (`/admin/finance`)

**アクセス:** Basic Auth 通過後、さらに追加パスワード認証が必要（`FINANCE_UNLOCK_PASS`）

**認証フロー:**
1. `/admin` → 「財務管理」ボタン → パスワード入力
2. `POST /api/admin/finance-unlock` でHMACトークン生成 → `sessionStorage("finance_token")` に保存
3. `/admin/finance` ページ表示時に `POST /api/admin/verify-finance-token` でトークン検証（TTL: 24時間）

**タブ構成:**

| タブ | コンポーネント | 内容 |
|---|---|---|
| ユーザー詳細 | `UsersTab` | 会員のウォレット残高・取引履歴。EP/BP/USDフィルタトグル付き |
| アフィリエイト | `AffiliateTab` | 紹介関係のドラッグ＆ドロップ再割当 |
| 紹介ツリー | `TreeTab` | 紹介ツリー可視化。「🔗 refcodeから紹介者を更新」ボタンで一括バックフィル実行 |
| 月次集計 | `MonthlyTab` | 月次アフィリエイトEP集計（読み取り専用）。ページロード時に当月を自動集計。直近6ヶ月サマリカード表示（クリックで詳細切替）。末締め集計 |

**UsersTab — wallet_ledger の通貨分類:**

| 通貨 | kind 一覧 |
|---|---|
| EP | `music_sell`, `radio_ep`, `rumble_weekly_ep`, `deduct_ep` |
| BP | `gacha_cost`, `gacha_prize`, `login_bonus`, `deduct_bp`, `rumble_daily_bp`, `square_bp_purchase`, `monthly_recover`, `fortune_daily`, `stake_lock`, `stake_claim`, `market_confirm_fee`, `mission_*` |
| USD/その他 | `referral_bonus`, `referral_entry` など上記以外 |

フィルタトグル（全て/EP/BP/USD）で対象行を絞り込み表示。各行の `kind` セルに EP/BP/USD バッジを表示。

**関連API:**

| エンドポイント | GAS action | 説明 |
|---|---|---|
| `POST /api/admin/finance-unlock` | — | パスワード検証 → HMACトークン発行 |
| `POST /api/admin/verify-finance-token` | — | トークン有効性検証（TTL: 24時間） |
| `GET /api/admin/wallet-ledger` | `wallet_ledger_all` | 全ユーザーのウォレット台帳取得 |
| `POST /api/admin/ref-reassign` | `ref_reassign` | 紹介者の再割当（`targetLoginId`, `newReferrerLoginId`, `note`） |
| `POST /api/admin/ref-backfill` | `ref_backfill_from_refcode` | ref_codeから紹介者を一括バックフィル（referrer_login_idが空の行のみ・既存設定上書き不可） |
| `POST /api/admin/affiliate-summary` | `affiliate_monthly_summary` | 月次アフィリエイト集計。`{ month: "YYYY-MM" }` → `{ referrers[], summary }` |

**アフィリエイト月次集計 — 分配率（全ルート統一）:**

| 段 | 列名 | 初回入金報酬率 |
|---|---|---:|
| L1（直接紹介者） | `referrer_login_id` | 10% |
| L2 | `referrer_2_login_id` | 5% |
| L3 | `referrer_3_login_id` | 2% |
| L4 | `referrer_4_login_id` | 2% |
| L5 | `referrer_5_login_id` | 1% |

EP換算式（`system_settings` シートで変更可）:
```
amount_jpy = amount_usd × 145   (usd_to_jpy)
reward_ep  = floor(amount_jpy × rate_pct/100 × 4)  (ep_per_jpy)
```
例: $1,134プラン L1 → `1134 × 145 × 0.10 × 4 = 65,772 EP`

日付フォールバック: `approved_at` → `auto_approved_at` → `paid_at`（この順で最初に有効な日付を使用）

**環境変数（追加）:**

| 変数名 | 用途 |
|---|---|
| `FINANCE_UNLOCK_PASS` | 財務管理ページの追加パスワード |
| `FINANCE_HMAC_SECRET` | トークン署名用シークレット |

---

## 28. セキュリティ設計

### パスワード管理

- **保存:** `HMAC-SHA256(SECRET_KEY, loginId + ":" + password)` のハッシュ
- **SECRET_KEY:** GAS ScriptProperties で管理（デフォルト: `"LIFAITOMAKEMONEY"`）
- **クライアント保存:** パスワードは `sessionStorage` のみ（ブラウザ終了時消滅）

### 署名検証

| 検証対象 | アルゴリズム | ヘッダー |
|---|---|---|
| NOWPayments IPN | HMAC-SHA512 | `x-nowpayments-sig` |

### 認証ガード

| 対象パス | 認証方式 |
|---|---|
| `/admin/*` | HTTP Basic Auth (middleware) |
| `/api/admin/*` | HTTP Basic Auth (middleware) |
| `/5000/admin/*` | HTTP Basic Auth (middleware) |
| `/api/5000/admin/*` | HTTP Basic Auth (middleware) |
| `/api/market/create` | ユーザー認証（id + code） |
| `/api/song/start` | ユーザー認証（id + code） |
| `/api/gift/send` | ユーザー認証（id + code） |
| `/gift/*` | ページパスワード `"nagoya01@"`（sessionStorage確認） |
| `/narasu-agency/*` | ページパスワード `"nagoya01@"`（`lifai_narasu_gate_v1` フラグ） |
| `/music-boost` | なし（パスワードロック廃止済み） |
| `/admin/finance` | Basic Auth + HMACトークン（`FINANCE_UNLOCK_PASS` / `FINANCE_HMAC_SECRET`、TTL: 24時間） |
| `/gallery`, `/works/*` | なし（公開ページ、認証不要） |

### テスト・デバッグ用

| エンドポイント | 用途 |
|---|---|
| `GET /api/debug/env` | 環境変数の確認 |
| `POST /api/nowpayments/ipn` + `x-test-ipn: 1` | IPN署名チェック回避 |

### 監視・モニタリング API（`/api/monitor/`）

管理者向けの内部監視エンドポイント。

| エンドポイント | 用途 |
|---|---|
| `GET /api/monitor/health` | サービスヘルスチェック（バージョン・タイムスタンプ） |
| `GET /api/monitor/wallet` | ウォレット全体サマリー |
| `GET /api/monitor/wallet-details` | ウォレット詳細 |
| `GET /api/monitor/market` | マーケット統計 |
| `GET /api/monitor/music` | 音楽生成統計 |
| `GET /api/monitor/bgm` | BGM生成統計 |
| `GET /api/monitor/song` | 曲作成統計 |
| `GET /api/monitor/games` | ゲーム統計 |
| `GET /api/monitor/rumble-daily` | Rumble デイリー結果 |
| `GET /api/monitor/rumble-weekly` | Rumble 週次集計 |
| `GET /api/monitor/rumble-today` | Rumble 本日状況 |
| `GET /api/monitor/rumble-spectator` | Rumble 観戦データ |
| `GET /api/monitor/logs` | ログ一覧 |

---

## 29. データフロー図

```
┌─────────────────────────────────────────────────────────────────┐
│                         ユーザー                                 │
└─────────────────────────────────────────────────────────────────┘
         │                                │
    ブラウザ操作                      決済ポータル
         │                                │
┌────────▼────────────────────────────────────────────────────────┐
│                      Next.js (Vercel)                           │
│                                                                 │
│  Pages                         API Routes                       │
│  ├── /                         ├── /api/auth/*                  │
│  ├── /purchase                 ├── /api/apply/*                 │
│  ├── /apply                    ├── /api/me                      │
│  ├── /confirm                  ├── /api/daily-login             │
│  ├── /login                    ├── /api/nowpayments/* ←── IPN   │
│  ├── /top                      ├── /api/admin/*                 │
│  ├── /admin                    ├── /api/market/*                │
│  ├── /market                   ├── /api/music/*                 │
│  ├── /music2                   ├── /api/song/*                  │
│  ├── /music-boost              ├── /api/music-boost/*           │
│  ├── /mini-games               ├── /api/minigames/rumble/*      │
│  │   ├── /rumble               ├── /api/minigames/tap/*         │
│  │   └── /tap                  ├── /api/gift/*                  │
│  ├── /gift                     ├── /api/note/*                  │
│  ├── /note-generator           ├── /api/image/* (準備中)        │
│  ├── /fortune                  ├── /api/cat-chat                │
│  ├── /apply-sell               ├── /api/apply-sell/*            │
│  ├── /narasu-agency/*          ├── /api/narasu-agency/*         │
│  ├── /5000/*                   ├── /api/5000/*                  │
│  ├── /gallery                  ├── /api/bgm/*                   │
│  ├── /works/[slug]             ├── /api/radio                   │
│  └── /image (準備中)           ├── /api/music-boost/info        │
│                                └── /api/monitor/*               │
└──────────────────┬──────────────────────────────────────────────┘
                   │
      ┌────────────┼────────────────────┐
      │            │                    │
┌─────▼─────┐ ┌────▼─────┐ ┌───────────▼───────┐
│    GAS    │ │NOWPayments│ │  Replicate /      │
│ (Sheets)  │ │   API     │ │  OpenAI GPT-4o   │
└───────────┘ └──────────┘ └───────────────────┘
```

---

*この仕様書は `C:\Users\unitu\lifaiov` プロジェクトの全ファイルを解析して更新されました（2026-05-29）。*

---

## 30. LIFAI本家 vs LIFAIOV 実装差分

> ⚠️ **実装・移植前に必読。このセクションを確認してからコードを書くこと。**

---

### 30-1. リポジトリ識別

| 項目 | LIFAIOV（`lifaiov`） | LIFAI本家（`aisalon`） |
|---|---|---|
| 用途 | OV向けサブセット（5000プログラム特化） | メインサロン全機能 |
| 購入フロー入口 | `/5000`（middleware で `/purchase` → `/5000` にリダイレクト） | `/purchase` → NOWPayments |
| ログイン入口 | `/5000/login`（middleware で `/login` → リダイレクト） | `/login` |
| LINE 問い合わせ URL | `https://lin.ee/TZcMW09`（ページにハードコード） | aisalon 設定に準拠 |
| Ultra Music Mode | **なし** | **あり**（管理者限定） |

---

### 30-2. LIFAIOV（lifaiov）にしかない機能・挙動

#### `/5000/*` — メイン購入フロー

lifaiov では `/5000` が購入の入口。aisalon の `/5000` は「5000プログラム」という別サービスLP（役割が全く異なる）。

#### `middleware.ts` — OV専用リダイレクト

```typescript
// lifaiov のみ存在するリダイレクトルール
// /login         → /5000/login
// /purchase      → /5000
// /purchase/jam  → /5000
```

aisalon の `middleware.ts` にはこれらのリダイレクトが**一切存在しない**。

#### `/admin/finance/*` — 財務ゲートウェイ（lifaiov 専用）

lifaiov の管理画面には財務管理機能が含まれる（aisalon には存在しない）。

#### LINE URL のハードコード

lifaiov の以下のファイルに `https://lin.ee/TZcMW09` がハードコードされている:

- `app/page.tsx` — お問い合わせボタン
- `app/tokushoho/page.tsx` — 特定商取引法ページ
- `app/privacy/page.tsx` — プライバシーポリシーページ

aisalon ではこの URL は使用しない（異なる URL が使われている）。

#### `app/page.tsx` — メインCTA

lifaiov の「権利購入」リンク先は `/5000`。aisalon では `/purchase`。

---

### 30-3. 本家（aisalon）にしかない機能

#### Ultra Music Mode

aisalon の `app/music2/page.tsx` の第3モード。`ULTRA_ADMIN_LOGINS` に含まれる管理者のみアクセス可。**lifaiov には存在しない。移植・追加しないこと。**

| 要素 | 詳細 |
|---|---|
| BP消費 | 300 BP（`BP_COSTS.music_ultra`） |
| 歌詞持込 | `userLyrics` → `lyricsOverride` でGASをバイパスしてそのまま使用 |
| ボーカルタイプ | 女性 / 男性 / 混声 / なし（ElevenLabs プロンプト制御） |
| アクセス制御 | `ULTRA_ADMIN_LOGINS` env var（カンマ区切り loginId リスト） |

**aisalon のみに存在するファイル差分:**

| ファイル | aisalon専用の内容 |
|---|---|
| `app/music2/page.tsx` | Ultraタブ、`handleUltraStart`、ULTRA SETTINGS セクション、300BP表示 |
| `app/lib/bp-config.ts` | `music_ultra: 300` |
| `app/api/me/route.ts` | `isUltraAdmin`、`ep_notification` フィールド |
| `app/api/song/start/route.ts` | `isUltra`, `userLyrics` パラメータ |
| `app/api/song/approve-structure/route.ts` | `lyricsOverride` パラメータ + GAS永続化 |

#### `ULTRA_ADMIN_LOGINS` 環境変数

aisalon `.env.local` にのみ必要。lifaiov には**不要**。

```env
ULTRA_ADMIN_LOGINS=loginId1,loginId2
```

---

### 30-4. 共通だが実装が異なるファイル

#### `app/music2/page.tsx`

| 要素 | lifaiov | aisalon |
|---|---|---|
| 生成モード数 | 2（Standard / Pro） | 3（Standard / Pro / **Ultra**） |
| Ultraタブ UI | **なし** | あり |
| BP表示（Step 3） | `isProSettingsActive ? 250 : 100` | `isUltraMode ? 300 : isProSettingsActive ? 250 : 100` |
| 通常ボーカルタイプ表示条件 | `!isBgmMode && !isPro` | `!isBgmMode && !isUltraMode && !isPro` |

#### `app/api/me/route.ts`

| フィールド | lifaiov | aisalon |
|---|---|---|
| `isUltraAdmin` | **なし** | あり（`ULTRA_ADMIN_LOGINS` から算出） |
| `ep_notification` | **なし** | あり |

#### `app/api/song/start/route.ts`

| パラメータ | lifaiov | aisalon |
|---|---|---|
| `isUltra` | **なし** | あり |
| `userLyrics` | **なし** | あり |

#### `app/api/song/approve-structure/route.ts`

| 機能 | lifaiov | aisalon |
|---|---|---|
| `lyricsOverride` パラメータ | **なし** | あり（GAS永続化あり） |
| `isManualLyrics` ASRガード | あり（同一実装） | あり（同一実装） |
| `bpFinal` = `bpLocked` 修正 | あり（同一実装） | あり（同一実装） |

#### `app/lib/bp-config.ts`

| 定数 | lifaiov | aisalon |
|---|---|---|
| `music_ultra: 300` | **なし** | あり |

#### `middleware.ts`

| ルール | lifaiov | aisalon |
|---|---|---|
| `/admin/*` Basic Auth | あり | あり |
| `/api/admin/*` Basic Auth | あり | あり |
| `/5000/admin/*` Basic Auth | あり | あり |
| `/api/5000/admin/*` Basic Auth | あり | あり |
| `/login` → `/5000/login` リダイレクト | **あり** | **なし** |
| `/purchase` → `/5000` リダイレクト | **あり** | **なし** |

---

### 30-5. 実装時チェックリスト

何かを実装する前に以下を確認すること:

- [ ] 作業リポジトリが `lifaiov`（OV）であることを確認した
- [ ] 実装する機能が「OV専用」「本家専用」「共通」のどれか確認した
- [ ] OV 専用の変更（5000フロー・リダイレクト・LINE URL `lin.ee/TZcMW09`）は lifaiov のみに適用した
- [ ] Ultra Mode 関連（`isUltraAdmin`、`lyricsOverride`、`music_ultra` 等）は lifaiov に追加しない
- [ ] 共通バグ修正（`isManualLyrics` ガード、`bpFinal`修正等）は両リポジトリに適用した
- [ ] `middleware.ts` を変更する場合、lifaiov には OV 専用リダイレクトがあることを把握した
- [ ] `app/api/me/route.ts` を変更する場合、lifaiov には `isUltraAdmin` がなく aisalon にあることを把握した

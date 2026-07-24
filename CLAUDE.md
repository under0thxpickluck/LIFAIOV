# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm start        # Start production server on port 3000
```

No lint or test commands are configured.

## Architecture

**LIFAI** is a Next.js 14 (App Router) web app for a Japanese AI-education community/salon. Users pay via crypto → fill an application → get approved by an admin → receive login credentials.

### Backend: Google Apps Script (GAS)

All persistent data lives in a Google Sheets–backed GAS web app. Next.js API routes act as a thin proxy to GAS. The GAS URL and keys are in env vars:

- `GAS_WEBAPP_URL` — the deployed GAS script URL
- `GAS_API_KEY` — passed as a query param on every request
- `GAS_ADMIN_KEY` — used for admin actions

GAS actions (全一覧):

| action | 呼び元 | 内容 |
|---|---|---|
| `apply_create` | `/api/apply/create` | 購入時に申請行を仮作成 |
| `payment_update` | `/api/nowpayments/ipn` | IPN受信→支払い更新→条件を満たせば自動承認 |
| `apply` | `/api/apply/create` | フォーム送信時に行を更新 |
| `admin_list` | `/api/admin/list` | 全申請一覧を返す |
| `admin_approve` | `/api/admin/approve` | 管理者が手動承認→リセットメール送信 |
| `login` | `/api/auth/login` | HMAC-SHA256 でパスワード照合 |
| `me` | `/api/me` | ログイン済みユーザーの紹介情報を返す |
| `get_balance` | `/api/wallet/balance` | BP/EP残高を返す |
| `reset_password` | `/api/auth/reset` | トークン検証→新パスワードのハッシュ保存 |
| `reset_resend` | 管理者直呼び | リセットメール再送 |
| `ref_tree_build` | 管理者メニュー | 紹介ツリーシートを再生成 |
| `music_boost_get_info` | `/api/music-boost/info` (GET) | アーティスト・アルバム・tracksリストを返す |
| `music_boost_update_info` | `/api/music-boost/info` (PATCH) | アーティスト・アルバム単体更新（後方互換） |
| `music_boost_set_tracks` | `/api/music-boost/info` (PATCH) | 楽曲リスト（`tracks` 配列）を全置換保存 |
| `my_referral_dashboard` | `/api/referral/dashboard` (POST) | 自分が紹介した人リスト＋報酬履歴・合計を返す |
| `user_reset_request` | `/api/auth/forgot-password` (POST) | ユーザー自身によるPW再設定申請→トークン再発行＋メール送信（approved限定、列挙攻撃対策で常にok:true返却） |
| `affiliate_monthly_summary` | `/api/admin/affiliate-summary` (POST) | 月次アフィリエイト集計（理論値・読み取り専用） |
| `affiliate_grant_run` | `/api/admin/affiliate-grant` (POST) | 月次アフィリエイトEP付与。`dry_run:true`でプレビュー、`false`で本実行（行単位＋台帳単位の冪等ガード付き） |
| `affiliate_cutoff_mark` | `/api/admin/affiliate-cutoff` (POST) | 指定月より前の承認済み・未付与行を一括「対象外」マーク（EP付与なし・運用開始時の初期化用） |
| `auction_list` | `/api/market/auction/list` | live/scheduled オークションセッション一覧 |
| `auction_detail` | `/api/market/auction/[session_id]` | セッション詳細＋ランキング（上位20位まで＋自分の順位・スコア・還元EP） |
| `auction_bid` | `/api/market/auction/[session_id]/bid` (POST) | BP投入→BP消費＋EP即時還元（原子的）→`auction_bids`追記→ソフトクローズ判定→新スコア返却 |
| `auction_ranking` | 観戦用 | 公開ランキング（上位20位＋各ティアボーダー） |
| `auction_close` | 管理・トリガー | 終了判定→ティア割り当て→`status=closed`→当選者通知（メール/LINE） |
| `admin_auction_create` | `/api/admin/auction/create` | オークションセッション作成 |
| `admin_auction_cancel` | `/api/admin/auction/cancel` | 中止＋全投入返還＋EP取り消し |
| `admin_auction_fulfill` | `/api/admin/auction/fulfill` | 特典付与済みマーク（体験会/意見交換会招待送付記録） |

### GAS Sheets

| シート名 | 用途 |
|---|---|
| `applies` | メインデータ（全ユーザー・申請・支払い情報） |
| `ref_tree` | 紹介ツリー表示用（`ref_tree_build` で全消し→再生成） |
| `ref_events` | 紹介紐づけの監査ログ |
| `wallet_ledger` | 紹介配当などの金融取引履歴 |
| `auction_sessions` | オークションセッション管理（session_id, title, tiers_json, start_at, end_at, status等） |
| `auction_bids` | オークション投入記録（append-only: bid_id, session_id, login_id, amount, ep_returned, ts） |

### GAS 認証の仕組み

パスワードは `HMAC-SHA256(SECRET_KEY, loginId + ":" + password)` のハッシュで保存。初回パスワードはリセットトークン（UUID+ランダム16文字、72時間有効・1回限り）をメールで送付。`SECRET_KEY` は GAS の ScriptProperties で管理（未設定時のデフォルト: `"LIFAITOMAKEMONEY"`）。

### GAS 既知の仕様・注意点

- **プラン金額のハードコード対応**: `planToGrant_` 関数内で `34/57/114/567/1134` (USDT) とBP付与量が対応付けられている。Next.js 側の `PLANS` 配列と手動で一致させる必要がある。
- **リセットメールURLがハードコード**: `sendResetMail_` の送信先URLが `https://lifai.vercel.app/reset?token=...` に固定。
- **`login` action のステータス**: `approved` 以外は全て `{ reason: "pending" }` を返す（`pending_payment` / `pending_error` / `paid` も区別なし）。
- **自動承認の許容誤差**: `payment_update` での自動承認は `expected_paid` の -2% まで許容（`TOLERANCE_PCT = 2`）。
- **`getValuesSafe_` / `getSheetValuesSafe_`**: 同一処理の関数が2つ存在（`getValuesSafe_` を使うこと）。
- **login_id は永続不変**: `approveRowCore_` 内で一度発行された `login_id` は絶対に上書きしない（パスワードリセット・再承認・メール再送のいずれでも変わらない）。`if (!loginId)` の判定でのみ新規発行する。
- **Music Boost 楽曲データ**: `applies` シートの `music_boost_tracks_json` カラムに `[{"artist":"...","album":"..."}]` 形式のJSON文字列を保存。上限なし。`music_boost_artist` / `music_boost_album` カラムは後方互換のために残す。
- **アフィリエイト分配（2026-07〜）**: 旧 `grantReferralBonusOnce_`（1段・USD・`ref_share_pct` 20/40）は停止済み（関数先頭で早期return。旧コード・`ref_bonus_*` 列・過去の `referral_bonus` 台帳記録は残置）。分配は管理者が `/admin/finance` 月次タブから `affiliate_grant_run` で実行（プレビュー→人間確認→本実行）。冪等ガードは `applies` の `affiliate_granted_at` / `affiliate_batch_id`（行単位）＋ `wallet_ledger` の from×level 重複チェック（台帳単位）。`entry_source="5000"` の行はデフォルト除外、`ref_bonus_granted_at` 済み行はL1のみ自動除外。
- **`approved_at` の記録**: `approveRowCore_` は承認時に `approved_at` を記録する（空のときのみ・再承認では上書きしない）。月次アフィリエイト集計・付与の月判定は `approved_at → auto_approved_at → paid_at` のフォールバック。
- **アフィリエイトEPのミントレートは受取人プラン別**: EPの換金レートがプラン別（$500=3EP/円、$2,000・$3,000=2.5EP/円、$5,000=2EP/円）のため、付与時も受取人（紹介者）のプランのレートでミントして円建て価値を保存する（`epRateForPlan_`）。`system_settings` の `ep_rate_plan_500/2000/3000/5000` で上書き可、未知プランは `ep_per_jpy` にフォールバック。`affiliate_monthly_summary`（表示）と `affiliate_grant_run`（付与）は同一ロジック。

### Payments: NOWPayments

Crypto payments (USDT) are handled via NOWPayments:
- `/api/nowpayments/create` — creates an invoice, returns `invoice_url`
- `/api/nowpayments/ipn` — IPN webhook; verifies HMAC-SHA512 signature using `NOWPAYMENTS_IPN_SECRET`, then updates GAS

### User Flow

1. `/` → Presale homepage with countdown
2. `/purchase` → Plan selection (5 tiers); generates `applyId` stored in sessionStorage
3. External NOWPayments portal → payment
4. `/apply` → Demographics form (email, name, Discord, prefecture, referral, etc.)
5. `/confirm` → Review and POST to GAS via `/api/apply/create`
6. Admin at `/admin` (Basic Auth) approves → GAS creates login credentials
7. `/login` → User authenticates; auth state stored in localStorage
8. `/top` → User dashboard

### Auth: Two Layers

**User auth** (client-side):
- `localStorage` key `addval_auth_v1`: `{ status, id, token, updatedAt }` — persists across sessions
- `sessionStorage` key `addval_auth_secret_v1`: password — cleared on browser close
- Helper: `app/lib/auth.ts`

**Admin auth** (server-side):
- HTTP Basic Auth enforced in `middleware.ts` for `/admin` and `/api/admin/*`
- Env vars: `ADMIN_USER`, `ADMIN_PASS`

### Key Directories

- `app/api/` — API route handlers (Next.js route handlers)
- `app/pages/` — All page routes (purchase, apply, confirm, login, top, admin, etc.)
- `components/` — Shared UI components (`Field`, `Select`, `StepHeader`, `PlanPicker`, etc.)
- `middleware.ts` — Basic Auth for admin routes

### Storage Conventions

- `addval_apply_draft_v1` (sessionStorage) — form draft during the apply flow
- `addval_auth_v1` (localStorage) — persisted auth state
- `addval_auth_secret_v1` (sessionStorage) — password, session-only

### Environment Variables

Required in `.env.local`:
```
GAS_WEBAPP_URL=
GAS_API_KEY=
GAS_ADMIN_KEY=
ADMIN_USER=
ADMIN_PASS=
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
NEXT_PUBLIC_SITE_URL=
```

### 音楽生成 API のタイムアウト設定

音楽生成（MusicGen / Replicate）は2〜3分かかるため、以下でタイムアウトを延長している。

- `app/api/music/generate/route.ts` と `app/api/music/status/route.ts` に `export const maxDuration = 300;` を設定（Next.js / Vercel 両方に有効）
- `vercel.json` で `app/api/music/**` の `maxDuration: 300` を設定（Vercel デプロイ時に必要）
- フロント側ポーリングは `MAX_TICKS = 150`（2秒×150 = 5分）に設定

### Testing / Debugging

- `GET /api/debug/env` — inspect resolved env vars
- Test IPN locally by sending `POST /api/nowpayments/ipn` with header `x-test-ipn: 1` (bypasses signature verification)

### お知らせ運用ルール

ユーザーに見える更新（新機能・修正・仕様変更）をリリースする際は、必ず `data/notices.ts` にお知らせを1件追加する。日付（YYYY-MM-DD）、タイトル（【○○機能追加】等）、本文は専門用語を使わず一般ユーザーでもわかる説明にする（何が変わったか／ユーザーへの影響／必要なアクション。なければ「お手続きは不要です」と書く）。`/top` の NoticeBoard は最新3件を表示し、4件以上は「過去のお知らせを見る」で展開される。

### BP Auction（貢献度オークション）— 2026-08期間限定テスト

**目的**: BPシンク機能。ユーザーがBPを投入して排出し、確定でEPに交換。投入額1位の上位者が体験会・意見交換会の招待を獲得。

**開催期間**: 2026-08-01 00:00 〜 2026-08-14 23:59（2週間、ソフトクローズで延長される可能性あり）

**参加対象**: `approved` ステータスの全会員

**ルール**:
- 投入額: 1,000BP 単位、1人あたり上限 **1,000,000BP**
- EP還元: 確定 1000BP → 1EP（誰も"損"をしない）
- 乱数なし: 純粋に投入額で順位が確定
- 特典:
  - **Tier 1** (上位5名) — LIFAI新システム体験会優先参加権＋ベータテスター意見交換会参加券
  - **Tier 2** (6〜15位) — ベータテスター意見交換会参加券
- 体験会/意見交換会実施日時: 2026-08-25 〜 2026-09-07（別途日程調整）
- 当選通知: 2026-08-15 以降、メール＋公式LINE で送付

**フロント実装**:
- ログイン直後にポップアップ表示（期間限定・全approved会員対象）
  - 「オークション開催中」というメッセージ + 「詳細ページ」ボタン
  - ブラウザ sessionStorage に "auction_popup_shown_at" を記録し、セッション中は1回だけ表示
- `/market/auction` — オークション一覧・詳細ページ
  - 透明性ガード: ルール・特典・ボーダー・カウントダウンを常時明示
  - 投入前に規約同意チェック（既存 narasu terms チェックUI と同様）
  - 投入フォーム＋リアルタイムランキング（上位20位）

**GAS実装**:
- `LockService` でセッション単位ロック（投入の原子性）
- `auction_bids` に全投入を append-only で記録
- `wallet_ledger` に `kind="auction_bid"` / `kind="auction_ep_return"` で二重記帳
- `auction_close` トリガーで終了判定→ティア割り当て→当選者メール送付

**法務・透明性**: 設計書 `docs/superpowers/specs/2026-07-24-bp-auction-market-design.md` に詳細記載。賭博の構成要件（偶然性・喪失・経済価値）を構造的に外している。

## 絶対に守るルール
- 既存のコード・API・文章・構造を勝手に削除・変更・省略しない
- 修正は指示された箇所のみに限定する
- コードを省略して「// ...既存のコード」などと書かない
- 修正前に「何をどう変えるか」を必ず説明してから実行する
- 破壊的変更を行う前は必ず確認を取る

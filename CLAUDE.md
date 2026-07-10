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

### GAS Sheets

| シート名 | 用途 |
|---|---|
| `applies` | メインデータ（全ユーザー・申請・支払い情報） |
| `ref_tree` | 紹介ツリー表示用（`ref_tree_build` で全消し→再生成） |
| `ref_events` | 紹介紐づけの監査ログ |
| `wallet_ledger` | 紹介配当などの金融取引履歴 |

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

## 絶対に守るルール
- 既存のコード・API・文章・構造を勝手に削除・変更・省略しない
- 修正は指示された箇所のみに限定する
- コードを省略して「// ...既存のコード」などと書かない
- 修正前に「何をどう変えるか」を必ず説明してから実行する
- 破壊的変更を行う前は必ず確認を取る

# 財務管理強化 + 音楽売却削除 + OV対応 設計書

**Date:** 2026-05-29  
**Scope:** 財務管理4機能の追加。OVと本家の両方に対応し、コードを混合しない。

---

## 背景・目的

1. wallet_ledger の `amount` はBP/EP/USDが混在しており、EP単体の動きが追えない
2. MonthlyTab のアフィリエイト集計は手動実行のみで、月次一覧が自動表示されない
3. 音楽売却申請（music_sell_requests）が承認後も一覧に残り続けて大量になっている
4. OV管理（/5000/admin/）に財務管理へのアクセスと音楽売却管理がない

---

## 変更ファイル一覧（6件、混合なし）

| ファイル | 区分 | 内容 |
|---|---|---|
| `gas/Code.gs` | 共通 | `music_sell_delete` アクション追加 |
| `app/api/admin/music-sell-requests/route.ts` | 共通API | `DELETE` メソッド追加 |
| `app/admin/finance/UsersTab.tsx` | 本家+OV共用 | EP/BP/USDフィルタ + バッジ |
| `app/admin/finance/MonthlyTab.tsx` | 本家+OV共用 | 自動計算 + 直近6ヶ月一覧 |
| `app/admin/page.tsx` | 本家専用 | 承認済み音楽売却に削除ボタン |
| `app/5000/admin/page.tsx` | OV専用 | 財務ゲートウェイ + 音楽売却セクション |

**混合防止ルール:**
- OV専用コード: `app/5000/admin/page.tsx` のみ
- 本家専用コード: `app/admin/page.tsx` のみ
- 財務ページ（`app/admin/finance/`）はOV・本家が共用
- GASアクション・APIルートは共通（同一GASスプレッドシートを参照）
- OVからは既存の `/api/admin/music-sell-requests` を直接使用（新規ルート不要）

---

## 機能① EP動き追跡（UsersTab）

### 対象ファイル
`app/admin/finance/UsersTab.tsx`

### 変更内容

**EP/BP/USD の kind 定義（定数）:**
```ts
const EP_KINDS  = new Set(["music_sell", "radio_ep", "rumble_weekly_ep", "deduct_ep"]);
const BP_KINDS  = new Set([
  "gacha_cost", "gacha_prize", "login_bonus", "deduct_bp",
  "rumble_daily_bp", "square_bp_purchase", "monthly_recover",
  "fortune_daily", "stake_lock", "stake_claim", "market_confirm_fee",
]);
// それ以外（referral_bonus, referral_entry 等）は USD/その他
```

**UIの追加:**
- wallet履歴セクションのヘッダー付近に `[全て] [EP] [BP] [USD]` フィルタトグルを追加
- 各行の `kind` セルに EP / BP / USD の小バッジを表示（色分け: EP=emerald, BP=amber, USD=blue）
- フィルタ選択中は対象外の行を非表示

**既存構造の維持:**
- `userLedger` useMemo はそのまま（フィルタはその後の表示レイヤーのみ）
- table 構造・カラム定義は変更なし

---

## 機能② 月次アフィリエイト自動計算（MonthlyTab）

### 対象ファイル
`app/admin/finance/MonthlyTab.tsx`

### 変更内容

**自動集計:**
- `useEffect` でページロード時に当月を自動的に `load(currentMonth())` する
- 既存の手動「表示する」ボタンは維持（手動リフレッシュ用）

**直近6ヶ月サマリ一覧:**
- 月次集計の下部に「月別サマリ」セクションを追加
- `monthOptions()` の先頭6ヶ月分を並列 fetch して自動集計
- 各月を1行カード形式で表示: 月名、紹介者数、合計アフィリエイトEP
- クリックで当該月の詳細を上の既存テーブルに表示（`setMonth` + `load`）
- 末締め = `affiliate-summary` API の `month` パラメータが `YYYY-MM` で既に月単位集計済み

**既存構造の維持:**
- 既存の `SummaryData` 型・API呼び出し・テーブル表示は一切変更なし
- 月別サマリは完全に追加のみ

---

## 機能③ 音楽売却申請の承認済み削除

### GAS: `music_sell_delete` アクション（`gas/Code.gs`）

```
action: "music_sell_delete"
body: { adminKey, requestId }
```

- `request_id` で行を検索
- `status !== "approved"` の場合は `{ ok: false, error: "not_approved" }` を返す（承認済みのみ削除可）
- 該当行を `deleteRow()` で物理削除
- `{ ok: true }` を返す

### API: DELETE メソッド（`app/api/admin/music-sell-requests/route.ts`）

```ts
export async function DELETE(req: Request) {
  // body: { requestId }
  // GAS action: music_sell_delete
}
```

既存の GET（一覧取得）・POST（承認/却下更新）は変更なし。

### UI: 本家 `/admin/page.tsx`

- 承認済みの music sell request 行に「🗑」削除ボタンを追加
- 削除後は `loadMusicSellRequests()` でリロード
- `deletingMusicId` state を追加（ローディング管理）
- 新規 state: `deletingMusicId: string | null`
- 新規 handler: `handleMusicSellDelete(requestId: string)`

**UI: OV `/5000/admin/page.tsx`（下記④と合わせて追加）**

---

## 機能④ OV財務ゲートウェイ + 音楽売却セクション

### 対象ファイル
`app/5000/admin/page.tsx`

### 財務管理ゲートウェイ（本家と同じ実装を追加）

```tsx
// state追加
const [financePass, setFinancePass] = useState("");
const [financeBusy, setFinanceBusy] = useState(false);
const [financeErr,  setFinanceErr]  = useState<string | null>(null);

// handler追加（本家と同一ロジック）
async function handleFinanceUnlock() {
  // POST /api/admin/finance-unlock
  // → sessionStorage.setItem("finance_token", token)
  // → window.location.href = "/admin/finance"
}
```

UIは本家の財務ゲートウェイセクションと同じレイアウト（OVのダークテーマに合わせる）。

### 音楽売却セクション

以下を追加:
- 音楽売却申請一覧（`/api/admin/music-sell-requests` GET）
- 承認・却下ボタン（`/api/admin/music-sell-requests` POST）
- 承認済み行に削除ボタン（`/api/admin/music-sell-requests` DELETE）
- 本家と同一の state/handler パターン（`musicSellRequests`, `loadMusicSellRequests`, `handleMusicSellUpdate`, `handleMusicSellDelete`）
- ページロード時に自動取得

---

## エラーハンドリング

- GAS `music_sell_delete`: 存在しない `request_id` → `{ ok: false, error: "request_not_found" }`
- GAS `music_sell_delete`: 未承認行への削除試行 → `{ ok: false, error: "not_approved" }`
- API DELETE: `requestId` なし → 400
- UI: 削除中は `deletingMusicId` で二重クリック防止

---

## 制約・注意点

- **既存コード・API・GASアクションは一切削除・変更しない**
- `wallet_ledger_all` GASアクションへの変更なし（フロント側でkind分類するのみ）
- OVの音楽売却管理は `/api/admin/` ルートを共用（新規 `/api/5000/admin/` ルートは作らない）
- MonthlyTab の既存 `SummaryData` 型・テーブル・API定義は変更しない
- OVのスタイルはダーク（`#0A0A0A` ベース）、本家はzinc系。OVのゲートウェイはOVテーマで実装

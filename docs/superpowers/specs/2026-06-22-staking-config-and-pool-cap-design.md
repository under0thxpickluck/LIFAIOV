# ステーキング倍率の管理画面編集 ＋ プール上限ブロック 設計

**日付:** 2026-06-22
**対象:** LIFAIOV（本家 aisalon も同仕様だが本タスクでは LIFAIOV のみ）
**ステータス:** 承認済み

---

## 概要

2つの変更を行う。

1. **倍率・下限レートの管理画面編集**: 現在 GAS `calcStakeRate_` にハードコードされている期間倍率（30日1.0× / 60日2.5× / 90日5.0×）と下限レート（30日3% / 60日7.5% / 90日15%）を、財務管理画面から編集できるようにする。適用範囲は全体共通（グローバル）。
2. **プール上限ブロック**: 総アクティブステーク額がプールを超える預け入れを完全にブロックする。

---

## 機能1: 倍率・下限レートのグローバル編集

### データ構造: 新シート `staking_config`

| 列 | 型 | 内容 |
|---|---|---|
| `days` | number | ロック期間（30 / 60 / 90） |
| `multiplier` | number | 期間倍率 |
| `floor` | number | 下限レート（小数。例 0.03 = 3%） |
| `set_at` | datetime | 設定日時 |

- 3行（30 / 60 / 90）固定。
- **未設定（空シート）時のフォールバック**: 現行ハードコード値
  `{30: 倍率1.0/下限0.03, 60: 2.5/0.075, 90: 5.0/0.15}` を返す。
  → 移行時に挙動が変わらない。

### GAS

- `getOrCreateStakingConfigSheet_()` 追加。
- `getStakingConfig_()` 追加: `staking_config` を読み `{ multipliers: {30,60,90}, floors: {30,60,90} }` を返す。空ならデフォルト。
- `calcStakeRate_(pool, totalStaked, days, config)`: 第4引数 `config`（`{multipliers, floors}`）を受け取りそれを使う。省略時は `getStakingConfig_()` を内部で読む（後方互換）。呼び元（`stake_bp` / `get_stakes`）は config を1回読んで渡す。
- 新アクション `admin_set_staking_config`（adminKey 必須）:
  - 引数: `{ config: { "30": {multiplier, floor}, "60": {...}, "90": {...} } }`
  - 処理: 各 days 行を upsert。
  - 戻り値: `{ ok, config }`

### API

- 新規 `POST /api/admin/staking-config` — 既存 `/api/admin/staking-pool` と同型のプロキシ。body `{ config }` を `admin_set_staking_config` へ転送。

### 管理画面（`app/admin/finance/MonthlyTab.tsx` の `StakingPoolSection`）

- 既存プール設定の下に「倍率・下限レート設定」ブロックを追加。
- 30 / 60 / 90 日それぞれに **倍率** と **下限レート(%)** の入力欄（計6）。
- 現在値は `pool_info`（get_stakes 経由）の `multipliers` / `floors` からプリセット。
- 保存ボタン → `/api/admin/staking-config` POST → 成功時 `loadStats()` 再取得。

---

## 機能2: プール上限ブロック

### GAS `stake_bp`

- 預け入れ実行前に判定:
  - `remaining = pool - 現在の総アクティブステーク額`（`getActiveBpStakeStats_().total`）
  - `pool > 0 かつ amount > remaining` のとき → `{ ok: false, reason: "pool_exceeded", remaining }` を返し預け入れしない。
- **プール未設定（pool <= 0）のときは上限なし**（全員ブロックの事故防止。プール設定時のみ上限が効く）。

### `get_stakes` の `pool_info`

- `remaining: Math.max(0, pool - total_staked)` を追加（残量表示用）。
- 機能1の `multipliers` / `floors` も追加。

### フロント `components/StakingModal.tsx`

- `PoolInfo` 型に `remaining` / `multipliers` / `floors` を追加。
- 参加状況に「残り X BP まで預け入れ可能」を表示。
- 入力額が残量を超える場合はステークボタンを無効化（`canStake` にガード追加）。
- `pool_exceeded` 受信時のメッセージ:「プール残量を超えています（残り X BP まで）」。

---

## スコープ外（YAGNI）

- ロック期間（30/60/90日）自体の変更。
- 部分受付（残量までの自動調整）。完全ブロックのみ。
- 本家 aisalon への同期（別タスク）。

---

## 移行・互換

- `staking_config` 未作成でも従来値で動作。
- プール上限はプール設定（`pool > 0`）がある月のみ有効。既存ステークには遡及しない。

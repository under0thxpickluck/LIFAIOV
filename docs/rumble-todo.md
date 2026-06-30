# Rumble League 改善タスク整理

> 作成日: 2026-06-30
> ステータス: **整理のみ（実装は未着手）**
> 対象機能: ミニゲーム「Rumble League」

このドキュメントは、ランブル機能の現状調査でわかった問題点と、今後やるべきこと・確認すべきことを整理したものです。実装はこのドキュメントを元に後日着手します。

---

## 調査サマリ（2026-06-30 時点）

ユーザーから報告された3点を調査した結果：

| # | 報告内容 | 調査結果 | 対応方針 |
|---|---|---|---|
| 1 | 装備のロックができず、貯めたい装備が消える | **バグ確定**。`locked` 列もロック判定も存在するが、ロックを設定する手段が一切ない | **実装する**（下記タスク参照） |
| 2 | バトルログが出ない | コードは概ね正常。GASタイムトリガー未稼働 or タイムゾーン不正が原因の可能性大 | **本人がGAS側を確認** |
| 3 | 週次・日次報酬の自動付与 | コードは正常（冪等性も実装済み）。トリガー稼働が前提 | **本人がGAS側を確認** |

---

## タスク1: 装備ロック機能の実装（要実装）

### 背景・問題

- `rumble_equipment` シートには `locked` 列が既に存在する。
- ロック判定はすでに2か所で効いている:
  - `rumbleDismantle_`（`gas/Code.gs:9991`）→ ロック品は分解拒否（`item_locked`）
  - `rumbleGacha_` の自動破棄（`gas/Code.gs:9374`）→ `equipped || locked` はスキップ
- **しかし `locked` を `true`/`false` に切り替える手段がどこにも無い。**
  - GASに `rumble_lock` 系アクションが無い
  - `app/api/minigames/rumble/lock` 等のAPIルートが無い
  - フロント（`app/mini-games/rumble/page.tsx`）にロックボタン・トグルが無い（`page.tsx:1351` に「未ロック」という説明文だけある）
- 結果: 各部位10個の上限を超えると、装備中以外の最古の装備が自動分解される（`Code.gs:9364-9391`）。ユーザーがロックで守れないため、貯めたい装備が消える。

### やること（実装時）

- [ ] **GAS: ロック切替アクションを追加**
  - 新規関数 `rumbleToggleLock_(params)`（`userId`, `item_id`, `locked` を受け取り `rumble_equipment` の `locked` 列を更新）
  - `doPost` のディスパッチに `if (action === 'rumble_lock') return rumbleToggleLock_(body);` を追加（`Code.gs:7703` 付近の rumble アクション群に合わせる）
  - 本人の所有アイテムであることを検証（`user_id` 一致チェック）
- [ ] **Next.js: APIルートを追加**
  - `app/api/minigames/rumble/lock/route.ts`（POST）を新規作成。既存の `dismantle/route.ts` や `equip/route.ts` をひな型にしてGASへプロキシ
- [ ] **フロント: ロックUIを追加**
  - 装備タブの各アイテムカードに 🔒/🔓 トグルボタンを追加
  - ロック状態を `rumbleEquipment_` のレスポンスに含める必要がある場合は `locked` をAPI返却に追加（`rumbleEquipment_` は現状 `equipped` のみ返している → `Code.gs:9403` 付近を要確認・拡張）
  - ロック中アイテムは見た目で区別（枠色・アイコン）
- [ ] **動作確認**: ロック → ガチャで上限超過させても自動分解されないこと、ロック中は分解ボタンが弾かれること

### 注意点

- `rumbleEquipment_`（一覧取得）が現状 `locked` をフロントに返していない可能性が高い。返却フィールドの拡張も合わせて必要。
- 自動破棄ループ（`Code.gs:9372`）は「全部ロック済みなら何も消さない」挙動になる。全部ロックで上限超過した場合、上限を超えたまま保持される（クラッシュはしない）。仕様としてこれで良いか要検討。
- CLAUDE.md のルール遵守: 既存コード・APIを削除/変更せず、追加で対応する。

---

## タスク2: バトルログ表示の確認（本人がGAS側を確認）

### 仕組みのおさらい

- バトルログ生成（`rumbleSpectator_`）自体はオンデマンドで動作し、`saveBattleLog_`（`Code.gs:10495`）でシート保存される。
- フロントの「観戦」タブは `daily-result` の `status` で表示を出し分ける:
  - `pending`（18:50前 or 抽選未実行）→ 今日のログ再生UIは出ず、**前日の「前回バトル」だけ**表示（`page.tsx:1403, 1451`）
  - `ready`（抽選完了後）→ 今日のバトルログ再生UI表示（`page.tsx:1485`）
- `ready` になるのは日次抽選 `rumbleDailyLottery_` が走った後のみ。
- その抽選は GASタイムトリガー `rumbleDailyLotteryTrigger_`（18時・19時発火、18:50ガード）に依存。

### 確認チェックリスト（GAS編集画面）

- [ ] `setupRumbleTriggers_()` を一度実行済みか（トリガー一覧に下記3つが登録されているか）
  - `rumbleDailyLotteryTrigger_`（18時 / 19時の2本）
  - `rumbleWeeklyRewardTrigger_`（金曜23時）
  - `rumbleClearOldBattleLogsTrigger_`（18時）
- [ ] **GASプロジェクトのタイムゾーンが `Asia/Tokyo` か**（`Code.gs:11821` のコメント通り、トリガーはプロジェクトTZ基準で発火。ズレていると時刻がずれる）
- [ ] 実行ログ（`Logger.log`）で `rumbleDailyLotteryTrigger_` が毎日発火しているか
- [ ] `rumble_battle_log` シートに当日・前日のデータが書き込まれているか

### 補足

- `rumbleClearOldBattleLogsTrigger_`（`Code.gs:11784`）が昨日より古いログを毎日削除するため、ログは2日分しか残らない仕様。これは想定通り。

---

## タスク3: 報酬自動付与の確認（本人がGAS側を確認）

### 仕組みのおさらい

| 報酬 | トリガー | 実装状態 |
|---|---|---|
| 日次BP | `rumbleDailyLotteryTrigger_`（毎日18・19時） | 正常。重み付き抽選＋BP付与、冪等性あり（`distributed=true`） |
| 週次EP | `rumbleWeeklyRewardTrigger_`（毎週金曜23時） | 正常。付与＋**二重付与防止あり**（`Code.gs:9471` の `RUMBLE_WEEK_DISTRIBUTED_{weekId}`） |

### 確認チェックリスト（GAS編集画面）

- [ ] タスク2と同じく、トリガーが実際に登録・稼働しているか
- [ ] `wallet_ledger` シートに `rumble_daily_bp` / `rumble_weekly_ep` の記録が残っているか
- [ ] ScriptProperties に `RUMBLE_SALT`（日次抽選seed用）が設定されているか
- [ ] 週次の二重付与防止プロパティ `RUMBLE_WEEK_DISTRIBUTED_{weekId}` が金曜実行後に立っているか

### ドキュメント不整合メモ（任意修正）

- `RUMBLE_SPEC.md:475` に「週次報酬は二重付与防止なし」とあるが、**実コードは防止済み**。仕様書の記述が古いだけなので、気が向いたら仕様書を更新する。

---

## 優先順位（提案）

1. **タスク1（装備ロック実装）** — 機能未実装でユーザー資産が失われる影響大。最優先。
2. **タスク2・3（GAS確認）** — 本人が確認中。トリガー未設置/TZ不正が見つかれば設定するだけで解決する可能性が高い。

---

## 関連ファイル早見表

| 対象 | パス |
|---|---|
| GAS本体（rumble関数群） | `gas/Code.gs` |
| フロント（全5タブ） | `app/mini-games/rumble/page.tsx` |
| APIルート群 | `app/api/minigames/rumble/*` |
| 仕様書 | `RUMBLE_SPEC.md` |
| トリガー設置関数 | `gas/Code.gs` の `setupRumbleTriggers_()`（11807行付近） |

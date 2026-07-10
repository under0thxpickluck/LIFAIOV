# ランブル「力のかけら」ロック仕様・バトルログ仕様 総点検（2026-07-10）

対象：LIFAIOV / aisalon の両プロジェクト。
点検の結果、**ランブル実装は両プロジェクトで完全に同一**
（`app/mini-games/rumble/page.tsx`・`app/api/minigames/rumble/*` はバイト単位で一致、
GASの rumble系関数もすべて一致）。以下の指摘は**両方にそのまま当てはまる**。
片方を直したらもう片方へ同じ修正を移植すること。

**このドキュメントは点検結果の整理のみ。実装はまだ行わない。**

---

## 1. 力のかけら（upgrade_shard）の現状仕様

### 入手経路

| 経路 | 計算式 |
|---|---|
| 手動分解（`rumble_dismantle`） | レア度基礎値（common 1 / rare 3 / epic 10 / legendary 40 / mythic 300）＋ 強化Lv×1 ＋ quality 110以上:+3 / 115以上:+8 |
| ガチャのスロット上限超過時の自動分解 | 同上（各部位10個上限、最古の「未装備・未ロック」から自動変換） |

### 消費

- 強化（`rumble_enhance`）のみ。Lv0→10、コスト 5→130個、成功率 100%→25%。**失敗してもかけらは消費**される。

### 残高

- `applies` シートの `upgrade_shard` 列。`/api/minigames/rumble/shard-status` で取得。

---

## 2. ロック仕様の問題点（最重要）

### 2-1. ★ロック機能が「片翼」— ロックを設定する手段がどこにも存在しない

- `equipment` シートに `locked` 列があり、**保護側のロジックは実装済み**：
  - `rumbleDismantle_` … `locked === "true"` なら `item_locked` エラーで分解拒否（`gas/Code.gs:10128`）
  - ガチャ自動分解 … `equipped || locked` のアイテムをスキップ（`gas/Code.gs:9511`）
  - フロントにもエラー文言「ロック中は分解できません」、説明文「未装備・未ロックの装備が自動的に力のかけらに変換されます」あり
- しかし **ロックをON/OFFする GAS action・APIルート・UIが一切存在しない**
  （GASの action 一覧に `rumble_lock` 系なし、`/api/minigames/rumble/` にlock系ルートなし、装備カードにトグルなし）。
- 結果：シートを手で編集しない限り `locked` は常に false。エラー文言・説明文は実質デッドコード。
  「ロックしたのに勝手に分解された」ではなく「**そもそもロックできない**」状態。

**修正案（基本構造を変えない追加のみ）**
- [ ] GAS に `rumble_toggle_lock` action を追加（userId + itemId、locked を反転して返す）
- [ ] `/api/minigames/rumble/lock` proxy ルートを新規作成
- [ ] 装備カードに 🔒/🔓 トグルボタンを追加（`rumbleEquipment_` が locked を返すよう 2-4 とセットで対応）

### 2-2. 装備中アイテムの分解をサーバー側で防いでいない

- フロントは装備中アイテムの分解ボタンを disabled にしている（`page.tsx:1303`）が、
  GAS `rumbleDismantle_` は **equipped チェックなし** → API直叩きで装備中のまま行削除できる。
- [ ] `rumbleDismantle_` に `equipped === "true"` なら `item_equipped` エラーを追加

### 2-3. 分解・強化に排他制御（LockService）がない

- `rumbleEntry_` は LockService（15秒）で排他しているが、`rumbleDismantle_` / `rumbleEnhance_` にはない。
- かけら残高の read → write の間に並行リクエストが挟まると、残高のロストアップデート
  （分解×2連打で片方の加算が消える／強化の二重消費・すり抜け）が起こり得る。
- [ ] dismantle / enhance にも LockService を追加

### 2-4. 強化モーダルの表示がリロード後に常に「Lv0」扱いになる（表示と実消費の乖離）

- `rumbleEquipment_` の返却は `id / slot / rarity / name / bonus / equipped` のみで、
  **`enhance_level` / `luck` / `stability` / `locked` を返さない**（`gas/Code.gs:9549-9563`）。
- フロントの型は `enhance_level?: number` で `item.enhance_level ?? 0` として扱うため、
  強化直後は state で正しいが、**ページをリロードすると全装備がLv0表示**になる。
- 強化モーダルは「必要かけら5個・成功率100%」と表示するのに、GAS側は実レベル基準で
  消費・判定する（例：実Lv5なら35個消費・成功率80%）。**表示より多く消費される**ためクレーム直結。
- [ ] `rumbleEquipment_` の返却に `enhance_level / luck / stability / locked` を追加（フロントは既に受け皿あり）

### 2-5. その他（メモ）

- `ENHANCE_TABLE` がフロント（`page.tsx:37`）とGAS（`Code.gs:10159`）で二重管理。現在は一致しているが、片側だけ変更すると 2-4 と同種の乖離が起こる（GASの `planToGrant_` と Next.js `PLANS` の関係と同じ注意点）。
- 強化成功時は `bonus` 列を直接加算し、`enhance_bonus` 列は常に0のまま使われていない。分解時のかけら計算は `enhance_level` 参照なので実害はないが、列が意味を持っていない。

---

## 3. バトルログの現状仕様

- バトルは**事前生成の演出**（リアルタイムではない）。`rumble_spectator` がイベント列
  （intro / batch_eliminate / battle / ranking / result）を生成して返す。
- 観戦データは localStorage `rumble_spectator_{date}_{userId}` にキャッシュし、
  同日中の再生（もう一度見る）は同一内容。30秒キャッシュ＋日付変化で再取得（既知課題#2は解消済みを確認）。
- ライブ表示は最新20件保持。全文閲覧用に**バトルログモーダル**（TODAY / PREV 切替）。
- 前日分は `daily-result`（日付指定）＋spectatorキャッシュで再生。
- 日次抽選：18:50 JST 締切、重み `floor(sqrt(rp)×1000)`、上位5名にBP配布、
  `rumble_daily_result` シートに永続化（`distributed=true` のみ表示）。

## 4. バトルログの問題点

### 4-1. ★モーダルでも最新20件しか見られない

- ログは `addLog` 時点で `slice(-20)` されて state に入る（`page.tsx:498-501` / prev側 `:561`）。
- バトルログモーダルは**その切り詰め済み state をそのまま表示**しているため（`page.tsx:962-1019`）、
  「全ログを見る」ためのモーダルなのに序盤（イントロ〜Wave2あたり）のログが消える。
  1バトルのイベントは参加者数によって40件超になり得るので、後半しか残らない。
- [ ] 修正案：全件保持の別配列（`fullBattleLogs`）を追加しモーダルはそちらを表示、
  ライブ表示のみ `slice(-20)` を維持（描画コスト対策）。

### 4-2. PREV再生で脱落状態が更新されない（既知課題#8が現存）

- `handlePrevPlay` は `batch_eliminate` イベントでログ追加のみ行い、プレイヤー状態を更新しない。
- 現状PREVモーダルにプレイヤータグ表示がないため無症状だが、
  PREV側に生存/脱落の可視化を足す場合はここの対応が前提になる。

### 4-3. 締切時刻の表記が紛らわしい（動作は正しい・メモ）

- 締切は `"YYYY-MM-DDT18:50:00.000Z"` と **Z（UTC）表記**だが、`created_at` が
  JSTシフト済みISO（`new Date(Date.now()+9h).toISOString()`）で保存されているため、
  文字列比較としては **JST 18:50 として正しく動作**している。
- ただし将来 `created_at` の保存形式を「本物のUTC」に変えた瞬間に9時間ズレる時限爆弾。
  コメントで既に注記されているが、変更禁止事項として認識しておくこと。

### 4-4. aisalonのみ：GASのルーティングが二重化している

- aisalon の `gas/Code.gs` には doPost 相当のルーティングブロックが**2箇所**ある
  （通常の doPost 内 `:7625〜` と、`ep_send_to_lfw` 修正時に追加された第2ブロック `:13324〜`）。
  rumble系 action も両方に定義されている。
- 現状は同じ関数を呼ぶので動作差はないが、**片方だけ修正する事故**が起きやすい構造。
  LIFAIOVに重複はない。aisalonでrumbleを修正する際は両ブロックの整合を確認すること。

---

## 5. 対応順の提案

| 優先 | 項目 | 対象 | 工数 |
|---|---|---|---|
| 1 | 2-4 `rumbleEquipment_` の返却フィールド追加（強化コスト誤表示の解消） | 両方 | 小 |
| 2 | 2-1 ロックのトグル実装（action + API + UI） | 両方 | 中 |
| 3 | 4-1 バトルログモーダルの全件表示 | 両方 | 小 |
| 4 | 2-2 装備中分解のサーバー側ガード | 両方 | 小 |
| 5 | 2-3 dismantle/enhance のLockService | 両方 | 小 |
| 6 | 4-2 PREV再生の脱落可視化（機能追加時に） | 両方 | 中 |
| — | 4-4 aisalonのルーティング二重化の解消（または運用ルール化） | aisalonのみ | 小〜中 |

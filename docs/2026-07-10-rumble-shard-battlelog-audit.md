# ランブル「力のかけら」ロック仕様・バトルログ仕様 総点検（2026-07-10）

対象：LIFAIOV / aisalon の両プロジェクト。
点検の結果、**ランブル実装は両プロジェクトで完全に同一**
（`app/mini-games/rumble/page.tsx`・`app/api/minigames/rumble/*` はバイト単位で一致、GASの rumble系関数もすべて一致）。
以下の指摘は**両方にそのまま当てはまる**。片方を直したらもう片方へ同じ修正を移植すること。

**2026-07-10 取捨選択済み。「確定修正内容」が実装時の指示書になる。実装はまだ行わない。**

| 項目 | 判断 |
|---|---|
| R-0 バトルログが一度も表示されない問題 | 🔴 最優先で原因確認（コード修正の前に運用設定の確認） |
| R-1 強化コスト誤表示の解消 | ✅ 実装する |
| R-2 バトルログモーダルの全件表示 | ✅ 実装する |
| R-3 サーバー側ガード（装備中分解の拒否＋排他制御） | ✅ 実装する |
| R-4 ロックのトグル実装 | ⏸ 保留 |
| R-5 PREV再生の脱落可視化（既知課題#8） | ⏸ 保留 |
| R-6 aisalonのGASルーティング二重化の解消 | ⏸ 保留（運用注意として記録） |

---

## R-0.【最優先】バトルログが一度も表示されたことがない問題

### 表示の仕組み（前提）

観戦タブのバトル演出・バトルログは、次のチェーンが**全部成立して初めて**表示される：

```
① 毎日18:50〜19:59 JST に GASトリガー rumbleDailyLotteryTrigger_ が発火
② rumbleDailyLottery_ がBP抽選を実行 → rumble_daily_result シートに distributed=true で書き込み
③ 続けて rumbleSpectator_ がバトルイベントを生成 → rumble_battle_log シートに保存
④ フロントの daily-result API が「全順位 distributed 済み」を確認して status:"ready" を返す
⑤ 観戦タブが ready 分岐に入り、バトル再生ボタン／バトルログが表示される
```

②が一度も実行されていないと、daily-result は**永遠に "pending"** を返し、
観戦タブは「本日の参加者＋カウントダウン」の表示のまま。前回バトルの「⚔️ バトルログを再生」
ボタンも `prevSpectatorData.status === "ready"` が条件のため**常に無効**になる。
→ 「かなり手間を加えたが一度も表示されない」という症状はこのチェーンの入口（①②）が
動いていないことと完全に一致する。

### 原因の有力候補（確認順）

1. **`setupRumbleTriggers()` が本番GASで未実行**
   トリガーはコードのデプロイでは設置されない。`gas/Code.gs:11985` の `setupRumbleTriggers()` を
   **GASエディタから一度手動実行**しないと `rumbleDailyLotteryTrigger_` は存在しない。
   → 確認：GASエディタ左メニュー「トリガー」に `rumbleDailyLotteryTrigger_`（18時・19時の2本）があるか。
2. **GASプロジェクトのタイムゾーンが Asia/Tokyo になっていない**
   トリガーの `atHour(18)` は**スクリプトのタイムゾーン基準**。もしUTCのままだと
   JST 3時・4時に発火し、トリガー関数冒頭の「JST 18:50以前はスキップ」ガード
   （`gas/Code.gs:9913`）に**毎回引っかかって何もせず終了**する。
   トリガーが設置済みなのに動かない場合はほぼこれ。
   → 確認：GASの「プロジェクト設定 > タイムゾーン」が `Asia/Tokyo` か。
   実行ログに `Too early (JST x:xx), skipping.` が繰り返し出ていないか。
3. **本番GASのデプロイが古い**（`rumbleDailyLotteryTrigger_` 等の関数自体が本番に存在しない）
4. （上記が全て正常な場合のみ）`rumble_daily_result` / `rumble_battle_log` シートの中身と
   `rumbleDailyLottery_` の実行ログを確認して個別調査

### 確定対応内容

- [ ] **［運用確認］** 上記1〜3を本番GASで確認（トリガー一覧／タイムゾーン／実行ログ／`rumble_daily_result` シートの行有無）
- [ ] **［応急処置］** 管理APIの手動実行で即日復旧できる：`POST /api/admin/rumble-run-now`
  （GASの `rumbleRunNow_` = 現在時刻を締切として抽選＋バトルログ生成まで一括実行）。
  実行後に観戦タブが ready になりバトルログが再生できるかで、チェーン全体の生存確認にもなる
- [ ] **［恒久対応］** `setupRumbleTriggers()` をGASエディタから実行（タイムゾーンを Asia/Tokyo に
  設定した上で）。両プロジェクトそれぞれのGASで実施
- [ ] **［再発防止・コード修正（小）］** `rumbleDailyLotteryTrigger_` がガードでスキップした際、
  `Logger.log` だけでなく管理者が気づける記録（例：`rumble_daily_result` に `skipped_too_early`
  行を残す、または監視シートに追記）を追加する

※ この問題が解決してから R-2（モーダル全件表示）の効果を確認すること
（そもそもログが出ていない状態ではモーダル修正の検証ができない）。

---

## R-1. 強化コスト誤表示の解消 【✅実装する】

### 問題

- GAS `rumbleEquipment_`（`gas/Code.gs:9549-9563`）の返却が
  `id / slot / rarity / name / bonus / equipped` のみで、`enhance_level` を返さない。
- フロントは `item.enhance_level ?? 0` で扱うため、**ページをリロードすると全装備がLv0表示**になり、
  強化モーダルが「必要かけら5個・成功率100%」と表示するのに、GAS側は実レベル基準で
  消費・判定する（例：実Lv5なら35個消費・成功率80%）。**表示より多く消費される**。

### 確定修正内容

- [ ] `gas/Code.gs` `rumbleEquipment_` の `items.push({...})` に以下を追加
  （先頭で `ensureEquipmentNewCols_(sheet)` を呼んで列を保証してから）：
  ```
  enhance_level: Number(data[i][idx["enhance_level"]] || 0),
  luck:          Number(data[i][idx["luck"]] || 0),
  stability:     Number(data[i][idx["stability"]] || 0),
  locked:        String(data[i][idx["locked"]]) === "true",
  ```
- [ ] フロントは型（`Equipment` に `enhance_level?` 等）も受け皿も既にあるため**変更不要**。
  装備カードに Lv 表示を足す場合のみ `page.tsx` の装備一覧に `Lv{item.enhance_level}` を追記
- [ ] 本番GASへ再デプロイ（両プロジェクト）

---

## R-2. バトルログモーダルの全件表示 【✅実装する】

### 問題

- ログは `addLog` 時点で `slice(-20)` されて state に入る（`page.tsx:498-501`、PREV側 `:561`）。
- バトルログモーダル（`page.tsx:962-1019`）は**その切り詰め済み state をそのまま表示**しているため、
  「全ログを見る」ためのモーダルなのに序盤のログ（イントロ〜Wave2あたり）が消える。
  イベントは参加者数によって40件超になり得る。

### 確定修正内容（フロントのみ・`page.tsx`）

- [ ] 全件保持用 state を追加：`fullBattleLogs` / `prevFullBattleLogs`（型は既存と同じ）
- [ ] `handleSpectatorPlay` / `handlePrevPlay` の `addLog` 内で、
  既存の `battleLogs`（`slice(-20)`、ライブ表示用）への追加に加えて全件配列にも push する
- [ ] 再生開始時のリセット（`setBattleLogs([])` している箇所）で全件配列も同時にクリア
- [ ] モーダルの `const logs = isToday ? battleLogs : prevBattleLogs;`（`page.tsx:964`）を
  `fullBattleLogs / prevFullBattleLogs` 参照に変更
- [ ] ライブ表示（タブ内のログエリア）は現状の20件のまま変更しない（描画コスト対策）

---

## R-3. サーバー側ガード 【✅実装する】

### 問題

1. **装備中アイテムの分解をサーバーが拒否しない**：フロントはボタンを disabled にしているが
   （`page.tsx:1303`）、GAS `rumbleDismantle_` は equipped チェックなし → API直叩きで
   装備中のまま行削除できる。
2. **分解・強化に排他制御がない**：`rumbleEntry_` は LockService（15秒）で排他しているが、
   `rumbleDismantle_` / `rumbleEnhance_` はかけら残高の read → write 間が無防備。
   連打・並行実行で残高のロストアップデート（二重付与／二重消費のすり抜け）が起こり得る。

### 確定修正内容（`gas/Code.gs`・両プロジェクト）

- [ ] `rumbleDismantle_` のロックチェック（`:10128`）の直後に装備中チェックを追加：
  ```
  if (String(row[idx["equipped"]]) === "true") return json_({ ok: false, error: "item_equipped" });
  ```
- [ ] フロント `page.tsx` の分解エラー表示（`:661`）に `item_equipped` の文言を追加：
  「装備中は分解できません（先に別の装備に付け替えてください）」
- [ ] `rumbleDismantle_` / `rumbleEnhance_` の本体を `rumbleEntry_` と同じ
  LockService パターン（`LockService.getScriptLock()` → `waitLock(15000)` → `try/finally releaseLock()`）で包む
- [ ] 本番GASへ再デプロイ

---

## R-4〜R-6. 保留項目（記録として残す）

### R-4. ロックのトグル実装 【⏸保留】

- `equipment.locked` 列と保護側ロジック（分解拒否・ガチャ自動分解のスキップ）は実装済みだが、
  **ロックをON/OFFする action・API・UIが存在しない**ため、locked は常に false のデッドコード状態。
- 実装する場合：GAS `rumble_toggle_lock` action ＋ `/api/minigames/rumble/lock` ＋
  装備カードに 🔒 トグル（R-1で `locked` が返るようになるため受け皿は整う）。
- 保留の間の注意：フロントの説明文
  「最も古い**未装備・未ロック**の装備が自動的に力のかけらに変換されます」（`page.tsx:1351`）は
  ロック機能が存在しない現状と食い違うため、実装しないなら文言から「未ロック」を外すことを検討。

### R-5. PREV再生の脱落可視化 【⏸保留】

- `handlePrevPlay` は `batch_eliminate` でログ追加のみ行い、プレイヤー状態を更新しない（既知課題#8）。
- 現状PREVモーダルにプレイヤータグ表示がないため無症状。PREV側に生存/脱落の可視化を
  足すときにあわせて対応する。

### R-6. aisalonのGASルーティング二重化 【⏸保留・運用注意】

- aisalon の `gas/Code.gs` には doPost 相当のルーティングが**2箇所**ある
  （通常の doPost 内 `:7625〜` と、ep_send_to_lfw 修正時に追加された第2ブロック `:13324〜`）。
  rumble系 action も両方に定義されている。
- 現状は同じ関数を呼ぶため動作差はないが、**片方だけ修正する事故**が起きやすい。
  aisalon側でGASを修正する際は、必ず両ブロックの整合を確認すること（LIFAIOVに重複はない）。

---

## 補足メモ（修正対象外・変更禁止事項）

- 抽選締切の文字列 `"YYYY-MM-DDT18:50:00.000Z"` は **Z表記だがJSTとして正しく動作**している
  （`created_at` がJSTシフト済みISOで保存されているため）。`created_at` の保存形式を
  本物のUTCに変えると9時間ズレる。**保存形式は変更しないこと**。
- `ENHANCE_TABLE` はフロント（`page.tsx:37`）とGAS（`Code.gs:10159`）の二重管理。
  現在は一致。変更時は必ず両方を揃える。
- 強化成功時は `bonus` 列を直接加算し `enhance_bonus` 列は未使用（常に0）。実害なし。

---

## 実装順（確定分のみ）

| 順 | 項目 | 主な変更箇所 | 対象 |
|---|---|---|---|
| 1 | R-0 バトルログ非表示の原因確認（トリガー・タイムゾーン）＋応急処置 | 運用（GASエディタ・管理API） | 両方 |
| 2 | R-1 `rumbleEquipment_` 返却フィールド追加 | `gas/Code.gs` | 両方 |
| 3 | R-3 サーバー側ガード（equipped拒否＋LockService） | `gas/Code.gs`, `page.tsx`（文言のみ） | 両方 |
| 4 | R-2 ログモーダル全件表示（R-0解決後に検証） | `page.tsx` | 両方 |
| 5 | R-0 再発防止のスキップ記録 | `gas/Code.gs` | 両方 |

# aisalon 追随修正タスク指示書（2026-07-12）

> **この文書は aisalon（`C:\Users\unite\aisalon`）作業セッション用の完全指示書。**
> LIFAIOV（`C:\Users\unite\LIFAIOV`）側で2026-07-11〜12に実装・本番検証済みの修正のうち、
> aisalon にも適用すべきものを、aisalon の実コード調査（2026-07-12実施）に基づいて整理した。
> 行番号はすべて **2026-07-12時点の aisalon 実コードで検証済み**（作業時は再確認すること）。

---

## 🚫 絶対厳守ルール（混合防止）

1. **aisalon と LIFAIOV は完全に別プロジェクト。** 会員基盤・GASインスタンス・スプレッドシートすべて別。
   - aisalon = 本家（lifai.vercel.app / JAMDAO会員）。プランは **34/57/114/567/1134**（旧値 30/50/100/500/1000 併存）
   - LIFAIOV = /5000系独立体（lifaiov.vercel.app）。プランは **500/2000/3000/5000**
2. **編集するのは aisalon のみ。LIFAIOV は読み取り専用の参照。**
3. **LIFAIOV固有の値を絶対に持ち込まない：**
   - capマップ `{"500":1000, "2000":4000, "3000":8000, "5000":10000}` を aisalon のデフォルトマップに足さない
   - 参加者カウンター「138」・LIFAIOVのお知らせ文面・`https://lifaiov.vercel.app` のURL
   - LIFAIOVの `entry_source="5000"` / `apply_id` プレフィックス判定ロジック
4. **既存のコード・API・構造を削除・変更しない。追加とガード挿入のみで対応する**（各プロジェクトのCLAUDE.md共通ルール）。
5. メール文面・リンクURLは **aisalon のドメイン（lifai.vercel.app）** に合わせる。

---

## ⚠️ aisalon特有の構造注意（過去障害の再発防止）

### doPost が2ブロックある（giftEP障害の原因構造）

- aisalon の `gas/Code.gs` には rumble系アクションのルーティングが **2箇所** ある：
  - `:7632` 付近のブロック（例: `if (action === 'rumble_dismantle') return rumbleDismantle_(body);`）
  - `:13330` 付近のブロック（例: `if (action === "rumble_dismantle") return rumbleDismantle_(body);`）
- GASは**同名関数の最後の定義だけが有効**。過去に「死んでいる方にだけaction追加」でgiftEPが飛ばない障害が発生した。
- **新アクションを追加するときは必ず両方のブロックに追加する**（どちらが有効か調べる手間より、両方に入れる方が安全）。
- 詳細: `docs/2026-07-10-poripori-integration-audit.md` §3（LIFAIOV側リポジトリ）

### GAS反映は手動デプロイ＋トリガー手動設置

- `gas/Code.gs` はリポジトリ上のコピー。修正後に**本番GASへ手動デプロイ**が必要。
- 時間ベーストリガーはデプロイでは設置されない。**setup系関数をGASエディタから1回手動実行**する。

---

## 🔴 優先度1: セキュリティ・実害系（最優先で実施）

### T1. Music Boost 無料有効化の脆弱性を封鎖 【LIFAIOVで発見・修正済みの穴】

**問題（aisalon現状・検証済み）:**
`app/api/music-boost/subscribe/route.ts:9-11` がクライアントの `paymentMethod` をそのままGASへ素通し。
GAS `musicBoostSubscribe_` は `paymentMethod !== "ep"` のとき決済チェックなしで有効化するため、
**ログイン済みユーザーが `paymentMethod:"card"` をPOSTするだけで支払いなしにブーストを有効化できる。**

**修正内容（LIFAIOV `3f1984e` を踏襲）:**
1. `app/api/music-boost/subscribe/route.ts` … `paymentMethod` をクライアントから受け取らず **`"ep"` 固定**にする
2. GAS `musicBoostSubscribe_` … EPガード（T2）の直後に card経路の保護を追加：
   - `paymentMethod !== "ep"` の場合は `adminKey === ADMIN_SECRET`（`getSecrets_()` 経由）必須。不一致は `admin_unauthorized`
   - `square_payment_id` があれば `wallet_ledger` の `kind:"music_boost_card"` で冪等チェック（二重有効化防止）
   - 有効化成功時に `wallet_ledger` へ `kind:"music_boost_card"`・memo に `payment_id:` を含めて記録

**LIFAIOV参照:** `gas/Code.gs` の `musicBoostSubscribe_` 内「カード決済経路の保護」ブロック／`app/api/music-boost/subscribe/route.ts`

### T2. Music Boost EP決済停止 【両プロジェクト適用と決定済み・aisalon未適用】

**問題（検証済み):** `app/music-boost/page.tsx:449` にEP支払いボタンが生きたまま。GASに `ep_payment_suspended` ガードなし。

**修正内容（LIFAIOV `eaf66c1` を踏襲）:**
1. EP決済ボタンを常時 disabled＋「EP決済は現在休止中」表記に（IIFE内の残高判定ごと置き換え。confirmモーダルが開けなくなる）
2. 注意書きに「• EP決済は現在休止中です（クレジットカードのみ）」を追加
3. GAS `musicBoostSubscribe_` の EP決済処理の**手前**にガード追加（処理本体は温存・再開時はガードのみ削除）:
   ```js
   if (paymentMethod === "ep") {
     return json_({ ok: false, error: "ep_payment_suspended" });
   }
   ```

### T3. クレカ購入の自動有効化＋期限切れ自動処理 【C-1 Phase 1 の移植】

**問題（検証済み):**
- `app/api/square/webhook/route.ts:138-140` … music_boost注文（bp_amount=0）は**ログのみで有効化されない**（買っても何も起きない）
- GAS `musicBoostAutoRenew_`（`:10863`）はEP自動更新関数で**トリガー未接続**。EP停止方針と矛盾するため**接続してはいけない**
- 期限切れの active を失効させる仕組みが存在しない

**修正内容（LIFAIOV `3f1984e` を踏襲）:**
1. **webhook自動有効化**: `bp_amount === 0` 分岐で `pack_id` が `music_boost_` 始まりなら
   GAS `music_boost_subscribe` を `paymentMethod:"card"` + `adminKey`（env `GAS_ADMIN_KEY`）+ `square_payment_id` 付きで呼ぶ。
   `isTest` 時はスキップ。GAS失敗でも200を返す（Squareリトライ防止）
2. **GAS `musicBoostExpireTrigger_()` 新規**: 期限切れ（`expires_at <= now`）の active 行を `expired` 化＋
   再購入案内メール送信（**URLは `https://lifai.vercel.app/music-boost` に読み替える**）。
   `musicBoostAutoRenew_` は無変更・未接続のまま温存
3. **GAS `setupMusicBoostTriggers()` 新規**: `musicBoostExpireTrigger_` を毎日9時で設置（既存同名トリガー削除→設置）
4. **リリース時**: GASデプロイ後に `setupMusicBoostTriggers()` を1回手動実行。
   Vercelの `GAS_ADMIN_KEY` が aisalon GAS の ScriptProperties `ADMIN_SECRET` と一致するか確認

**注意:** aisalonの `MUSIC_BOOST_PLANS` のID・価格は aisalon側の定義を使う（照合すること）。

### T4. ランブル R-3: サーバー側ガード

**問題（検証済み):** `gas/Code.gs` の `rumbleDismantle_`（`:9904`）/`rumbleEnhance_`（`:9945`）に
LockService なし・装備中チェックなし（`item_equipped` は全コード中0件）。
API直叩きで装備中のまま分解可能＋連打でかけら残高のロストアップデートが起こり得る。

**修正内容（LIFAIOV `844e17e` を踏襲）:**
1. `rumbleDismantle_` … ロックチェックの直後に装備中チェック追加:
   `if (String(row[idx["equipped"]]) === "true") return json_({ ok: false, error: "item_equipped" });`
2. `rumbleDismantle_` / `rumbleEnhance_` の本体を `rumbleEntry_` と同じ LockService パターンで包む
   （`getScriptLock()` → `waitLock(15000)` → `try { 本体 } finally { releaseLock() }`）
3. フロント `app/mini-games/rumble/page.tsx` の分解エラー表示に `item_equipped` →
   「装備中は分解できません（先に別の装備に付け替えてください）」を追加

---

## 🟡 優先度2: LIFAIOV踏襲の機能修正

### T5. ランブル R-1: `rumbleEquipment_` の返却フィールド追加（強化コスト誤表示の修正）

**問題（検証済み):** aisalon の `rumbleEquipment_` の `items.push` は `enhance_level/luck/stability/locked` を返さない
（`:9281` の `enhance_level` は別関数）。リロード後に全装備Lv0表示になり、表示コストより多くかけらを消費する。

**修正内容（LIFAIOV `844e17e` を踏襲）:**
- `rumbleEquipment_` の先頭で `ensureEquipmentNewCols_(sheet)` を呼び、`items.push` に追加:
  ```js
  enhance_level: Number(data[i][idx["enhance_level"]] || 0),
  luck:          Number(data[i][idx["luck"]] || 0),
  stability:     Number(data[i][idx["stability"]] || 0),
  locked:        String(data[i][idx["locked"]]) === "true",
  ```
- フロントの `Equipment` 型に `locked?: boolean` を追加（他フィールドは受け皿が既にあるはず。要確認）

### T6. ランブル R-2: バトルログモーダルの全件表示

**問題（検証済み):** `fullBattleLogs` は aisalon に存在しない（0件）。ログが `slice(-20)` で切り詰められ、
モーダルでも序盤ログが消える。

**修正内容（LIFAIOV `844e17e` を踏襲・フロントのみ）:**
- `fullBattleLogs` / `prevFullBattleLogs` state を追加
- `handleSpectatorPlay` / `handlePrevPlay` の `addLog` で全件配列にも push
- 再生開始・リプレイ時のリセット箇所で全件配列も同時クリア
- モーダルの `const logs = isToday ? battleLogs : prevBattleLogs;` を全件配列参照に変更
- ライブ表示（タブ内）は20件のまま変更しない

### T7. ランブル R-4: 装備ロックのトグル実装

**問題（検証済み):** `rumble_lock` / `rumbleToggleLock_` は aisalon に存在しない（0件）。
`locked` 列と保護ロジック（分解拒否・ガチャ自動変換スキップ）はあるがONにする手段がない。

**修正内容（LIFAIOV `c7a96ae` を踏襲）:**
1. GAS: `rumbleToggleLock_(params)` 新規（`getEquipmentItem_` の user_id 一致検索で本人所有チェック、
   `locked` 列を `"true"/"false"` 文字列で更新）
2. GAS dispatch: `if (action === 'rumble_lock') return rumbleToggleLock_(body);` を
   **⚠️ 両方のルーティングブロック（`:7632`付近と`:13330`付近）に追加**（doPost二重化対策）
3. API: `app/api/minigames/rumble/lock/route.ts` 新規（dismantleルートをひな型に `locked: boolean` 必須）
4. フロント: 装備カードに 🔒/🔓 トグルボタン・「🔒 ロック中」バッジ・ロック中は分解ボタン disabled、
   装備タブに msg 表示欄がなければ追加

### T8. ランブル R-0再発防止: トリガー発火記録

**問題（検証済み):** `rumble_trigger_log` / `logRumbleTrigger_` は aisalon に存在しない（0件）。
TZ不正等でガードに毎回かかる事故をシート上で検知できない。

**修正内容（LIFAIOV `5203ed5` を踏襲）:**
- `rumbleDailyLotteryTrigger_` のスキップ時に `logRumbleTrigger_("skipped_too_early", ...)`、実行時に `("lottery_run", ...)` を記録
- `logRumbleTrigger_(event, detail)` 新規: `rumble_trigger_log` シート（`ts_jst/event/detail`）に追記。失敗しても本処理に影響させない

### T9. narasu代理申請: 歌詞任意化＋生成曲ピッカー＋説明文（A-2 / B-2 / B-1）

**問題（検証済み):**
- `lib/narasu-agency/validation.ts` に `missingLyrics` チェックが現存（2箇所マッチ）
- 「自分の生成曲から選ぶ」ピッカーなし（0件）
- `app/music2/page.tsx` に「歌詞（歌唱内容）の変更はできません」の説明なし（0件）

**修正内容（LIFAIOV `9b6caf9` / `3736810` / `946aa81` を踏襲）:**
1. **A-2**: `missingLyrics` チェックブロックを削除。フォームの歌詞ラベル `*` →「（任意）」、
   placeholder「（必須）」→「（任意）」。confirm画面の「歌詞: なし」が赤（エラー風）なら中立色に
2. **B-2**: フォームに「🎵 自分の生成曲から選ぶ」ボタン＋選択モーダル。
   `GET /api/music/history?userId=` を利用（**aisalonに同ルートが存在するか先に確認**。無ければB-2は保留）。
   決定時 `{ url: downloadUrl || audioUrl, title, lyrics }` を既存 `newAudioEntry()` 形式で追加、
   上限15曲ガード・URL重複スキップ・空の初期エントリ置換
3. **B-1**: `/music2` 結果画面の歌詞カード直上に
   「⚠️ 生成後の歌詞（歌唱内容）の変更はできません。歌詞を変えたい場合は新しく生成（BP消費）してください」を追加。
   チュートリアル完成スライドにも同趣旨を一文追加

### T10. 曲の長さ: `chooseSongDurationSec()` の移植（A-3・aisalonのバグ気味挙動の解消）

**問題（検証済み):** `app/api/song/approve-structure/route.ts:89` が `durationTargetSec: isPro ? 180 : 150` の**固定値**。
UIの長さ指定チップを送っても参照されない（実質無視）。

**修正内容（LIFAIOV `dd26fb5` ＋ `app/api/song/approve-structure/route.ts` の `chooseSongDurationSec` を踏襲）:**
- `chooseSongDurationSec(userDuration?)` を移植: ユーザー指定があれば優先、未指定は `150 + Math.floor(Math.random() * 61)`（150〜210秒）
- attempt1/2で同一の長さを使う（LIFAIOV実装参照）
- 固定値 `isPro ? 180 : 150` をこの関数呼び出しに置き換え（**既存の呼び出し構造は変えない**）
- UIに長さの注記があれば「2分30秒〜3分30秒」表記に合わせる（aisalonのUI文言を確認して判断）

### T11. リファラアプリ: EP報酬（cc_affiliate_reward）の表示（LIFAIOV `a32cd46` の読み替え移植）

**問題（検証済み):**
- aisalon GAS `:4394` の `BONUS_KINDS = ["referral_bonus", "referral_entry"]` のみ
- aisalon には `cc_affiliate_reward`（EP建て・`:2429` で記録）が存在するが**リファラアプリに表示されない**
- フロント `app/referral-app/page.tsx` に EP表示なし（0件）

**修正内容（読み替えに注意）:**
1. GAS `my_referral_dashboard`: `BONUS_KINDS` に **aisalonに実在するEP建てkindのみ**追加。
   検証済みは `cc_affiliate_reward`。**`affiliate_reward`（月次）が aisalon の台帳に存在するかは要確認**
   — aisalonの月次配当は別実装のため、実際に `wallet_ledger` に書いている kind を grep で確認してから追加する。
   EP建て合計は `total_affiliate_ep` として `total_bonus`（旧USD）と分離
2. APIルート: `total_affiliate_ep` パススルー
3. フロント: EP建ては「N EP」表記・memo(JSON)は `L{level}・月・相手ID` に整形・
   サマリータイルの単位出し分け（LIFAIOVはEPベースに全面変更したが、**aisalonは旧USD報酬が主データの可能性がある**ため、
   実データの構成比を確認して「どちらをタイルの主表示にするか」を判断すること。混在するなら並記）

### T12. お知らせ運用の整備（E-1・両プロジェクト決定事項）

**問題（検証済み):** `data/notices.ts` なし。`NOTICES` は `app/top/page.tsx:176` にハードコード（2026-06-10の1件）。

**修正内容（LIFAIOV `9ca440a` を踏襲）:**
1. `data/notices.ts` を新規作成し、**既存の1件（2026-06-10 紹介報酬お知らせ）を維持して移行**
2. NoticeBoard を最新3件表示＋4件以上は「過去のお知らせを見る ▼」で展開に拡張
3. aisalon の CLAUDE.md に運用ルール追記（リリース時に `data/notices.ts` へ1件追加）
4. 第1号（今回の追随修正リリース時）は **aisalonのリリース内容で文面を書く**（LIFAIOVの文面流用禁止。
   例: narasu歌詞任意化・曲の長さ変更・ランブル改善など、実際にaisalonへ入れたものだけ）

---

## 🟢 対応不要・aisalonに持ち込んではいけないもの

| 項目 | 理由 |
|---|---|
| A-1 BP月次回復のcapマップ修正 | **aisalonは対応済み**（`:2852-2853` に旧プラン値あり・`bulkBpRecovery()` あり）。LIFAIOVの500/2000/3000/5000は絶対に足さない |
| Square webhook の `group:"5000"` → `""` 修正 | LIFAIOV固有の会員構造問題。aisalonのwebhookに `group` は無い（検証済み） |
| /5000 参加者カウンター「138」・Bot done化 | 会員基盤が別。aisalon側の実数・実状況で別途判断 |
| `bulkBpRecovery()` の移植 | aisalonに既にある |
| LIFAIOVのお知らせ文面・`lifaiov.vercel.app` URL | aisalonのドメインは `lifai.vercel.app` |

---

## 📋 推奨実装順とリリース手順

**実装順:** T1・T2（セキュリティ・即効）→ T3 → T4 → T5〜T8（ランブル一式）→ T9・T10 → T11 → T12（お知らせは最後に第1号投稿とセット）

**各タスク共通の進め方:**
1. 指示書の行番号を鵜呑みにせず、**aisalonの実コードを必ず読んでから**修正案を確定する
2. LIFAIOV側の該当ファイル・コミットを**読み取り専用で参照**し、aisalonの構造（doPost二重化・プラン値・URL・シート構成）に読み替える
3. 修正はタスク単位でコミット（LIFAIOV側のコミットメッセージが参考になる）
4. `npx tsc --noEmit`（フロント）と `node --check`（GASを.jsコピーして）で検証

**リリース手順（全タスク共通）:**
1. aisalon本番GASへ手動デプロイ
2. トリガー設置関数の手動実行: `setupMusicBoostTriggers()`（T3）。`setupRumbleTriggers()` の登録状況・
   プロジェクトTZ=Asia/Tokyo も同時に確認（LIFAIOVで発生したR-0問題はaisalonでも起こり得る）
3. フロントデプロイ（aisalonのデプロイフローに従う）
4. 動作確認: music-boostのEPボタン休止表示／クレカテスト購入で自動有効化／ランブル装備のLv保持・ロック・分解拒否／
   リファラアプリのEP表示／narasu歌詞任意

---

## 参照（LIFAIOV側・読み取り専用）

| タスク | LIFAIOVコミット | 主なファイル |
|---|---|---|
| T1/T2/T3 | `eaf66c1`, `3f1984e` | `gas/Code.gs`（musicBoostSubscribe_/musicBoostExpireTrigger_）, `app/api/square/webhook/route.ts`, `app/api/music-boost/subscribe/route.ts`, `app/music-boost/page.tsx` |
| T4/T5/T6 | `844e17e` | `gas/Code.gs`（rumbleDismantle_/rumbleEnhance_/rumbleEquipment_）, `app/mini-games/rumble/page.tsx` |
| T7 | `c7a96ae` | `gas/Code.gs`（rumbleToggleLock_）, `app/api/minigames/rumble/lock/route.ts` |
| T8 | `5203ed5` | `gas/Code.gs`（logRumbleTrigger_） |
| T9 | `9b6caf9`, `3736810`, `946aa81` | `lib/narasu-agency/validation.ts`, `app/narasu-agency/form/page.tsx`, `app/music2/page.tsx` |
| T10 | `dd26fb5` | `app/api/song/approve-structure/route.ts`（chooseSongDurationSec） |
| T11 | `a32cd46` | `gas/Code.gs`（my_referral_dashboard）, `app/api/referral/dashboard/route.ts`, `app/referral-app/page.tsx` |
| T12 | `9ca440a` | `data/notices.ts`, `app/top/page.tsx`, `CLAUDE.md` |

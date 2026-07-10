# LIFAIOV ⇔ aisalon 仕様差異 点検レポート（2026-07-10）

姉妹リポジトリ `under0thxpickluck/aisalon`（本家・lifai.vercel.app / JAMDAO会員向け）と
本リポジトリ `under0thxpickluck/LIFAIOV`（lifaiov.vercel.app / 5000系会員向け）の差分点検結果。
会員基盤は完全に別物だが、コードベースはほぼ同一の姉妹構成
（ディレクトリ構造はほぼ一致、内容が異なるファイルは74件、GAS差分は約2,200行）。

**このドキュメントは点検結果の整理のみ。実装・移植はまだ行わない。**

---

## 1. LIFAIOVが真似したいもの（aisalon → LIFAIOV に移植したい候補）

※ Ultraモード（歌詞持込生成）とグローバルダークモード基盤は検討の結果、**LIFAIOVへの移植は不要と判断**（2026-07-10）。

### 1-1. ★最重要★ BP月次回復の capマップに旧プラン値を含める＋一括回復関数

`docs/2026-07-10-music-feedback-tasks.md` A-1（BPの毎月半分回復ができていない）の
**根本原因の最有力候補が aisalon 側で既に対策済み**だった。

- aisalon `gas/Code.gs:2852`（`monthly_bp_recover`）の capマップは
  `{"34","57","114","567","1134"}` に加えて **旧プラン値 `{"30","50","100","500","1000"}` も含む**。
  LIFAIOV のマップは新値のみ → `applies` シートの `plan` 列が旧値のユーザーは
  `unknown_plan` で回復されず、フロントはサイレント失敗するため誰も気づかない。
- さらに aisalon には **`bulkBpRecovery()`**（`gas/Code.gs:11765`）がある：
  GASエディタから手動実行して全 approved ユーザーへ月次回復を即時適用し、
  `bp_last_reset_at` を当日に揃えて以後の30日サイクルを開始する運用リカバリ関数。

**移植案**：capマップに旧プラン値を追加（1行）＋ `bulkBpRecovery()` を移植して
未回復だった期間のリカバリを一括実行 → その後は通常サイクルに乗る。
（前提確認：LIFAIOV 本番シートの `plan` 列の実値と、本番GASへのデプロイ状況）

### 1-2. Square Webhook のテストモード

aisalon の `app/api/square/webhook/route.ts` は `isTest=true` 時に
`payload.test_reference_id` を直接使い Orders API 呼び出しをスキップできる
（NOWPayments の `x-test-ipn: 1` と同じ発想）。決済フローの動作確認が楽になる。

### 1-3. アフィリエイト管理の診断情報

aisalon の月次配当（`app/admin/finance/MonthlyTab.tsx`）は
`debug_info`（対象月の approved 数 / ref_code なし / referrer 不明の件数）と
`ep_per_jpy` をGASから受け取り、集計から漏れた人を管理画面で可視化できる。
「配当が合わない」調査の時間短縮になる。

### 1-4. /me の EP受取通知（ep_notification）

aisalon は `/api/me` が `ep_notification`（未読のEP受取通知数）を返し、UIでバッジ表示。
LIFAIOV は `ep-notification-clear` ルートはあるが `/me` が通知数を返していない。

---

## 2. aisalonに真似させてあげたいもの（LIFAIOV → aisalon に輸出したい候補）

### 2-1. 曲の長さのランダム化（＋ユーザー指定優先）

LIFAIOV の `chooseSongDurationSec()`（`app/api/song/approve-structure/route.ts:40`）は
未指定時 2〜4分ランダム＋attempt1/2で同一長を保証。
aisalon は `isPro ? 180 : 150` 秒の固定で、UIの長さ指定チップ（30秒〜3分）を送っても
approve-structure 側が参照しない（実質無視されるバグ気味の状態）。
※タスクMD A-3（2分30秒〜3分30秒への変更）を実装したら、その版を輸出するのがよい。

### 2-2. 楽曲売却の承認/却下フロー＋TOP通知

- LIFAIOV admin：楽曲売却リクエストを **承認/却下**（`handleMusicSellUpdate`）
  ＋ TOPページで承認通知を表示（`/api/apply-sell/notify`）
- aisalon admin：**削除のみ**（`handleMusicSellDelete`）
- LIFAIOV の 5000管理画面には楽曲売却一覧＋財務ゲートウェイもある

### 2-3. 月次配当の6ヶ月サマリー一覧

LIFAIOV の `MonthlyTab` は過去6ヶ月分の配当合計・対象者数を一括表示
（`loadMonthlySummaries` / `/api/admin/affiliate-summary`）。aisalon にはない。
（お互いに 1-3 と 2-3 を交換すると両方の管理画面が完成形に近づく）

### 2-4. ステーキング設定の管理API

LIFAIOV には `admin_set_staking_config`（GAS）＋ `/api/admin/staking-config` があり、
ステーキングの床値・倍率を管理画面から変更できる。aisalon はハードコードのまま。

### 2-5. 運営マニュアル

LIFAIOV の `/admin/manual`（`app/admin/manual/page.tsx`）と
`docs/staff-manual-admin-operations.md`。スタッフ運用の属人化防止に有効。

### 2-6. narasu代理申請の一時停止フラグ

LIFAIOV の `NARASU_AGENCY_SUSPENDED`（`lib/narasu-agency/constants.ts`）。
受付を1行で止められる運用スイッチ。aisalon にはない。

### 2-7. 管理者用リセットメール再送API

LIFAIOV の `/api/admin/reset-resend`。aisalon はGAS直呼びのみ。

---

## 3. 意図的な差異（真似しない・要注意）

移植作業のときに**混ぜてはいけない**ビジネス設定の違い。

| 項目 | LIFAIOV | aisalon |
|---|---|---|
| 会員プラン（USDT） | 34 / 57 / 114 / 567 / 1134 | 30 / 50 / 100 / 500 / 1000（プレセール25%OFF表示 `purchase/jam`） |
| BPコスト | 高い（music_full 360 / pro 900 / BGM 288） | 安い（music_full 100 / pro 250 / BGM 80 / ultra 300） |
| 紹介報酬 tier1 | 10% | 20% |
| EP→円レート | 固定運用 | プラン別 `getEpPerJpy_`（Starter 4EP=1円 → Infra 2EP=1円） |
| Square webhook | `group:"5000"` 固定（lifaiov.vercel.app） | group指定なし＝本家シート（lifai.vercel.app） |
| 外部連携 | LFW送金（`check_lfw_deposit` 等） | lootify SSO＋aisalonギフト入金・売却リクエスト群 |
| song生成のボーカルなし | 明示ブロック（BGMへ誘導） | Ultra経由で許可 |

※ EPプラン別レート（getEpPerJpy_）は移植対象ではないが、
タスクMD C-1「900EPは安すぎる」の価格設計の参考モデルになる。

---

## 4. 推奨アクション（優先順）

1. **A-1の裏取り**：LIFAIOV本番シートの `plan` 列の実値を確認 → aisalon式に capマップへ旧値追加＋`bulkBpRecovery()` 移植（工数小・クレーム直結）
2. **曲の長さロジックの輸出**：A-3実装後に aisalon へ（aisalon側の長さ指定無視も直る）
3. 管理画面機能の相互交換（1-3 ⇔ 2-3、2-2、2-4）は運用負荷と相談して順次

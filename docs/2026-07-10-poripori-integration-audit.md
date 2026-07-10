# poripori（Lootify / MIRAIX）連携 総点検（2026-07-10）

対象：LIFAIOV / aisalon の両プロジェクトと、別リポジトリ poripori との連携部分。
※ poripori リポジトリ本体は本セッションでは取り込めなかったため（アクセス承認待ち）、
本レポートは **LIFAIOV / aisalon 側の連携コード全数点検**＋poripori側で確認すべき項目リスト。

**このドキュメントは点検結果の整理のみ。実装はまだ行わない。**

---

## 1. 連携の全体像（現状把握）

| 連携 | 方式 | LIFAIOV | aisalon |
|---|---|---|---|
| SSO（サロン→MIRAIX） | `/api/miraix/sso` が GAS login で本人確認 → HMAC-SHA256 の短命トークン（5分）を発行し `MIRAIX_APP_URL/salon-link?sso=` へ誘導 | ✅ `salon:"lifaiov"` / group="5000" 固定 | ✅ `salon:"aisalon"` / group="" 固定 |
| ログイン（poripori→サロン） | `lootify_login` / `lootify_me` / `lootify_logout`（poriporiがサロンの認証情報で直接ログイン） | ❌ なし | ✅ あり |
| EP送金（サロン→poripori） | ギフト送信画面で `LFW-XXXXXX` 形式の宛先を入力 → `/api/ep/send-to-lfw` → GAS `ep_send_to_lfw` がEP控除＋`lfw_deposits` シートへ pending 行を追加 | ✅ | ✅ |
| 入金確認・消費（poripori→サロン） | poripori が GAS をポーリングし pending を取得 → 消費マーク | ✅ `check_lfw_deposit` / `consume_lfw_deposits`（認証: `key`=GAS_API_KEY） | ✅ 同左 ＋ 新版 `check_aisalon_gift_deposits` / `consume_aisalon_gift_deposits`（認証: `api_key`=LOOTIFY_API_KEY） |
| 売上申請・ウォレット | `create_aisalon_sell_request` / `get_aisalon_wallets` 等 | ❌ なし | ✅ あり |

---

## 2. giftEPが飛ばなかった障害（aisalon）— 原因確定

### 根本原因

GASは**同名関数が複数あると「最後の定義」だけが有効**になる。aisalonの `gas/Code.gs` には
doPost が4つ定義されており（`:103`=コメントアウト済 / `:6442` / `:7601` / `:13290`）、
**実際に動くのは最後の `:13290`**。`ep_send_to_lfw` のルーティングは当初 `:7601` の
doPost（＝上書きされて動かない方）にしか無かったため、リクエストは `:13290` → `handle_`
にフォールスルーして **`bad_action` で失敗**＝EPが飛ばなかった。

### 現状

- 最新コミット `4e1c9e2`「fix(gas): ep_send_to_lfw を実際に動くdoPostへ追加(bad_action修正)」で
  `:13300` に追加済み。**リポジトリ上は修正完了**。
- [ ] **要確認：本番GASへデプロイされているか**（デプロイされていなければ障害は継続中）
- [ ] 修正後の実送金テスト（少額EPで LFW-XXXXXX 宛に送信 → poripori側で受領確認）

---

## 3. 到達不能アクションの全数チェック結果 【✅現時点で問題なし】

同種の事故（有効でないdoPostにだけ追加）が他に無いか、全actionを機械的に照合した。

- **aisalon**：旧doPost（`:7601`）にあって有効doPost（`:13290`）にも `handle_` にも無いaction → **0件**
- **LIFAIOV**：旧doPost（`:6650`）にあって有効doPost（`:7809`）にも `handle_` にも無いaction → **0件**
- 有効doPostは両方とも末尾で `return handle_(key, body)` にフォールスルーしており、コア処理は網羅される

### ⚠️ ただし構造的リスクは残っている

| | doPost定義数 | 有効なもの |
|---|---|---|
| LIFAIOV | 3（`:103`コメント済 / `:6650`死に / `:7809`有効） | `:7809` |
| aisalon | 4（`:103`コメント済 / `:6442`死に / `:7601`死に / `:13290`有効） | `:13290` |

**新しいactionを「死んでいるdoPost」に追加すると同じ障害が再発する**。今回のgiftEP障害はまさにこれ。

- [ ] **再発防止（推奨）**：死んでいるdoPost/doGetを削除するか、
  `// ⚠️ この doPost は上書きされて動きません。action追加は :13290（aisalon）/ :7809（LIFAIOV）へ` の
  コメントを各ブロック先頭に付ける。CLAUDE.md にも「action追加はファイル末尾に最も近いdoPostへ」と明記

---

## 4. 連携コードの品質点検（詳細）

### 4-1. `ep_send_to_lfw`（両方・実装ほぼ同一）✅ 概ね健全

- 認証：`key`＋`id/code`（mktAuth_で本人確認）✅
- LockService（8秒）で排他 ✅ ／ 残高チェック→控除→`lfw_deposits` に pending 追加 ✅
- 宛先形式 `^LFW-[A-Z0-9]{6}$` を検証 ✅ ／ 整数額のみ ✅
- `gift_transactions` に「贈った」履歴も記録 ✅（memo文言のみ差異：「Lootify EP送金」/「LoofityJa EP送金」）

### 4-2. 入金確認・消費（poripori側から呼ばれる）✅ 概ね健全

- `consume_*` は LockService＋pendingのみ消費（冪等）✅
- 新旧2系統が併存（`check_lfw_deposit`=key認証 / `check_aisalon_gift_deposits`=LOOTIFY_API_KEY認証、
  どちらも同じ `lfw_deposits` シートを参照）。**poripori側がサロンごとに正しい系統・正しい認証を
  使っているかは poripori 側の確認が必要**（§6）

### 4-3. MIRAIX SSO（両方）✅ 良設計

- サロンIDをenvでなくコードに固定（取り違え事故防止）、両リポジトリの差分は `SALON_ID` の1行のみ ✅
- GAS login で本人確認後に発行、トークン有効期限5分、group不一致はフェイルクローズ（403）✅

### 4-4. `lootify_login` / `lootify_me`（aisalonのみ）⚠️ 注意点あり

- パスワード照合・approved限定は正しい ✅
- ⚠️ `session_token = base64(loginId + ":" + pw_hash)`：**無期限・失効不能**
  （無効化する手段がパスワード変更のみ）。base64は可逆なのでトークンを持つ者は pw_hash を読める。
  検証は毎回シートの現pw_hashと突合するため乗っ取りには直結しないが、
  中期的には HMAC署名＋有効期限つきトークンへの置き換えを推奨（poripori側と同時変更が必要）
- [ ] 置き換えるかどうかは poripori 側の実装確認とセットで判断

### 4-5. 設定依存（動かない場合にまず見る場所）

- [ ] aisalon GAS ScriptProperties に `LOOTIFY_API_KEY` が設定されているか
  （未設定だと `check_aisalon_gift_deposits` 系は常に unauthorized）
- [ ] 両プロジェクトの env：`MIRAIX_SSO_SECRET` / `MIRAIX_APP_URL`（SSO用）
- [ ] poripori 側が保持する各サロンの GAS URL・APIキーが最新か

---

## 5. Music Boost：EP購入の停止 【✅確定・実装する】

運営判断：**Music Boost の EP 決済を停止し、クレジットカード（Square）のみにする**。
（EP払いは期限切れの自動処理がなく未払い追跡が手動になるため）

### 確定修正内容（両プロジェクト同一UIのため両方に適用）

1. `app/music-boost/page.tsx` … EP決済ボタン（`EPで支払う（N EP）`）を
   **disabled＋「EP決済は現在休止中」表記**に変更（ボタン自体は残して休止が伝わるようにする）
2. 同ページ … EP決済確認モーダル（`confirmPlan`）を開かないようにする（休止中はクリック不可なので実質不要だが、直接呼び出しも塞ぐ）
3. 同ページ … 注意書き「• EPは換金不可です」付近に「• EP決済は現在休止中です（クレジットカードのみ）」を追加
4. **［サーバー側も塞ぐ・重要］** GAS `musicBoostSubscribe_` の EP決済処理の冒頭に
   停止ガードを追加（UIだけではAPI直叩きでEP購入できてしまうため）：
   ```
   if (paymentMethod === "ep") return json_({ ok: false, error: "ep_payment_suspended" });
   ```
   ※ 将来EP決済を再開する可能性があるため、処理本体は削除せずガードのみ追加
5. クレジットカード（Square checkout）ボタンは現状のまま

---

## 6. poripori 側で確認すべきことリスト（リポジトリ取り込み後）

- [ ] サロンごとの入金確認の呼び分け：LIFAIOV → `check_lfw_deposit`（key認証）／
  aisalon → `check_aisalon_gift_deposits`（LOOTIFY_API_KEY認証）を正しく使い分けているか
- [ ] `consume` 呼び出しの deposit_ids 指定・リトライ処理（冪等なので再送は安全）
- [ ] `verifySsoToken` が `salon` と `gasGroup` の整合を検証しているか（miraixSso.ts のコメント上は検証する設計）
- [ ] LFWアドレス（LFW-XXXXXX）の発行・ユーザー紐づけロジック
- [ ] lootify session_token の保存方法（無期限トークンのため平文保存・ログ出力がないか）
- [ ] エラー時のユーザー通知（今回のgiftEP障害はサロン側が bad_action を返しても
  poripori/ユーザーに見えにくかった。失敗の可視化があるか）

---

## 7. 対応順の提案

| 優先 | 項目 | 対象 |
|---|---|---|
| 1 | §2 giftEP修正の本番GASデプロイ確認＋実送金テスト | aisalon |
| 2 | §5 Music Boost EP決済の停止（UI＋GASガード） | 両方 |
| 3 | §3 死にdoPostの整理 or 警告コメント＋CLAUDE.mdルール化 | 両方 |
| 4 | §4-5 設定値の棚卸し（LOOTIFY_API_KEY / MIRAIX env） | 両方 |
| 5 | §6 poripori側チェック（リポジトリ取り込み後） | poripori |
| 中期 | §4-4 lootifyセッショントークンの強化 | aisalon + poripori |

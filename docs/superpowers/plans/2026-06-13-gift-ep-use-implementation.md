# GiftEP「使い道」実装計画（2026-06-13）

## 背景・問題

GiftEP機能の公開前総点検で以下が判明した。

- 「使い道」ページ（`app/gift/use/page.tsx`）は **Music Boost** と **ワークフロー** を「GiftEP利用可」と案内している
- しかし `/api/gift/use`（GAS `gift_use` アクション）を呼ぶコードはフロントのどこにも存在しない
- Music Boost の決済（GAS `musicBoostSubscribe_`）は EP / 外部決済のみで、GiftEP決済の分岐がない
- チュートリアル（`components/GiftEPTutorial.tsx`）にも「支払いにGiftEPを充当できます」という記述がある

**結果: 受け取ったGiftEPは現状なにも消費手段がなく、30日で失効するだけ。** 案内と実態の不一致は顧客の混乱・問い合わせ・不信につながるため、公開前に対処が必要。

なお GAS 側の消費基盤は実装済みで動作する状態にある：

- `gift_use` アクション（認証・許可機能チェック・整数チェック・ロック・期限近い順の消費・`gift_usage_logs` 記録）
- `GIFT_FEATURES_ALLOWED_ = ["musicboost", "workflow"]`
- `giftAdjustGiftEp_()`（期限バケツ管理・有効残高チェック）

欠けているのは「呼び出す側」だけ。

## 対応方針（2段階）

### フェーズ1【公開ブロッカー解消・即日可能】: 表記を実態に合わせる

コード変更は表示のみ。リスクほぼゼロ。GiftEP公開はこれで可能になる。

対象ファイルと変更内容：

1. `app/gift/use/page.tsx`
   - `FEATURES` 配列の Music Boost / ワークフローを `available: false` にし、バッジを「準備中」表示に変更（現在の「利用不可」バッジとは別の文言・色にして「これから使えるようになる」ことが伝わるようにする）
   - 説明文を「GiftEP決済は近日対応予定です」等に変更
   - ページ冒頭の「GiftEPはLIFAI内の運営公式機能でのみ利用できます」はそのまま
2. `components/GiftEPTutorial.tsx`
   - 「LIFAI内サービスで使う」の説明を「対応サービスは順次拡大予定。『使い道』ページで確認できます」に変更
3. `app/gift/page.tsx`
   - サブコピー「贈れる・使える、LIFAI内限定ギフトクレジット」→ 使い道未開放の間は「贈れる」主体の文言に調整（任意）

注意（CLAUDE.mdルール）: 文言の変更は事前に変更案を提示し承認を得てから実施する。

### フェーズ2【本対応】: Music Boost に GiftEP 決済を実装

#### 設計方針

- **GAS内で決済を完結させる**（フロントから `/api/gift/use` と `/api/music-boost/subscribe` を別々に呼ぶ2リクエスト方式は、片方失敗時に原子性が壊れるため不採用）
- `musicBoostSubscribe_` に `paymentMethod === "gift_ep"` の分岐を追加し、既存のEP決済分岐と同じ位置で処理する

#### GAS変更（`gas/Code.gs`）

1. `musicBoostSubscribe_` に GiftEP 決済分岐を追加
   - `paymentMethod === "gift_ep"` のとき:
     - `epCost = plan.price * 100`（EP決済と同レート）
     - `giftGetUserGiftData_(userId)` で有効残高確認 → 不足なら `{ ok:false, error:"insufficient_gift_ep", balance, needed }`
     - `giftAdjustGiftEp_(userId, -epCost, null)` で減算（期限近い順に自動消費）
     - `gift_usage_logs` に記録（`feature_type: "musicboost"`, `feature_ref: planId`, 既存 `gift_use` と同形式）
     - 減算失敗時はサブスク行を作らずエラー返却
   - **ロック必須**: `musicBoostSubscribe_` は現状 `LockService` を使っていない。GiftEP減算は `gift_send` / `gift_use` / `expireGiftEP` とスクリプトロックで直列化されている前提のため、GiftEP分岐（できれば関数全体）をスクリプトロックで保護する
   - **認証の補強（要検討）**: `musicBoostSubscribe_` は `userId` のみで本人確認をしていない。GiftEP残高を減らす操作になるため、`id` + `code` を受けて `mktAuth_` で検証する形に揃えることを推奨（既存EP決済も同じ問題を抱えているが、スコープを広げるかは要相談）
2. （任意・併用払い）GiftEP残高が足りない場合に「GiftEP優先消費 → 不足分をEPで支払う」混合決済。実装が複雑になる（部分ロールバック必要）ため初版では見送り、全額GiftEPのみとする

#### Next.js API変更

- `app/api/music-boost/subscribe/route.ts`: `paymentMethod` はすでに素通しのため、`"gift_ep"` を渡すだけで追加変更ほぼ不要。認証補強する場合は `id` / `code` の受け渡しを追加

#### フロント変更

1. `/music-boost` ページ（`app/music-boost/page.tsx`）
   - プラン購入UIに支払い方法の選択肢「GiftEPで支払う」を追加
   - GiftEP残高を `/api/gift/balance`（POST, `{id, code}`）で取得して表示。残高不足時はボタン無効化＋不足額表示
   - エラーマップに `insufficient_gift_ep` / `lock_timeout` / `auth_failed` を追加
2. `app/gift/use/page.tsx`
   - Music Boost を `available: true` に戻し、「使う →」リンクで `/music-boost` へ誘導（フェーズ1の表記を解除）
3. ワークフローの使い道はコンテンツ仕様が未定のため、フェーズ2では対象外（「準備中」のまま）。仕様が決まり次第別計画を起こす

#### テスト計画

- [ ] GiftEP残高 > プラン価格: 決済成功 → `gift_ep_balance` / `gift_ep_expiry_map` が期限近い順に減る → `gift_usage_logs` に1行追加 → ブースト行が active になる
- [ ] GiftEP残高不足: `insufficient_gift_ep` が返り、サブスク行が作られない・残高が減らない
- [ ] 期限切れバケツ（過去日キー）を持つユーザー: 失効分が消費に使われない
- [ ] 小数 / 0 / 負数の `amount` 系パラメータ: GAS側バリデーションで拒否
- [ ] 同時実行: ロックにより直列化される（`lock_timeout` 時にユーザーへ再試行案内）
- [ ] EP決済（既存パス）にリグレッションがないこと
- [ ] `/gift/use` → `/music-boost` → 決済 → `/gift` 残高反映の一連導線

#### リリース手順

1. GAS変更を Apps Script エディタへ反映 → 新バージョンでWebアプリを再デプロイ
2. Next.js 側を Vercel にデプロイ
3. 本番でテスト用ユーザーによる少額GiftEP決済の動作確認
4. 確認後、フェーズ1の「準備中」表記を解除するコミットをデプロイ

## 関連する未解決事項（この計画のスコープ外・要判断）

- 5000グループユーザーは `mktAuth_` が本体シートしか見ないため GiftEP 全機能が認証エラーになる（マーケット等と同じ既存制限）
- LFW送金が GiftEP の月間50,000EP上限枠を消費する仕様の是非
- `get_balance` / `musicBoostSubscribe_` が id のみで動く（パスワード検証なし）点の補強

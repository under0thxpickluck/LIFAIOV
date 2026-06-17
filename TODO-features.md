# 機能実装 TODO（aisalon / LIFAIOV 共通）

---

## 前提：構造の理解

- **財務管理ユーザー一覧** = `app/admin/finance/UsersTab.tsx`（両プロジェクト共通）
- **ガチャロジック** = GASの`gacha_spin`アクションが確率を決定。`bp-config.ts`の`GACHA_TABLE`はフロント表示のみ
- **音楽生成フロー** = `song/start` でBP即時deduct → `song/approve-structure` で音声生成
- **BP操作** = GASの`deduct_bp`（消費）/ `grant_bp_for_sell`（付与）経由

---

## 両プロジェクト調査で判明した差異・注意点

| 項目 | LIFAIOV | aisalon |
|---|---|---|
| `app/api/song/` 配下ルート群 | 存在・同一コード | 存在・同一コード |
| `song/cancel` のGAS未呼び出しバグ | あり | あり（同一バグ） |
| UsersTabの「アカウント操作」セクション | **あり**（リセットメールボタン付き） | **なし** |
| jobStoreのユーザーIDフィールド | `job.userId` | `job.userId` |

### 注意1: aisalonのUsersTabはセクションが少ない
LIFAIOVには既に「アカウント操作」セクションがあるが、aisalonにはない。
お知らせ・ガチャUIをaisalonに追加する際は、このセクション自体を新設してから追記する。

### 注意2: jobStoreのフィールド名
`_jobStore.ts` の `SongJob` 型でユーザーIDは `userId?` として保存される（`loginId` ではない）。
BP返還処理では `job.userId` を参照すること。

### 注意3: globのWindowsパス問題
aisalonのsongルート確認時、Globツールがパス区切りの問題でファイルを検出できなかった。
実際には `app/api/song/` 配下に `start`, `approve-structure`, `cancel` など全て存在する。
今後aisalonで「ファイルが見つからない」となった場合はBashの `ls` で直接確認すること。

---

## 機能1: ユーザーへの個別お知らせ送信

### 概要
`UsersTab.tsx` のユーザー詳細パネルに、件名＋本文を入力して任意のユーザーへメールを送れるUIを追加する。

### 変更方針（構造を壊さないため）
- UsersTab の「アカウント操作」セクションにお知らせ送信フォームを追記するだけ
- 既存の`onSendResetMail`ボタンは一切触らない
- 新しいAPIルートを追加し、GASに新アクションを追加する

### Next.js 変更（両プロジェクト）

#### 新規ファイル: `app/api/admin/notify-user/route.ts`
```
POST { loginId, subject, message }
  → GAS action: admin_notify_user
  → ok: true | { ok: false, error }
```

#### 変更ファイル: `app/admin/finance/UsersTab.tsx`
- **LIFAIOV**: 既存の「アカウント操作」セクションの下に追記
- **aisalon**: 「アカウント操作」セクション自体が存在しないため、新設してから追記

追加するUI：
- `subject` state（件名テキストボックス）
- `message` state（本文テキストエリア）
- 「送信」ボタン → `POST /api/admin/notify-user`
- 送信結果メッセージ表示

### GAS 変更（両プロジェクト別々）
新アクション `admin_notify_user` を追加：
```javascript
case "admin_notify_user": {
  // adminKey 検証
  // loginId でユーザー行を検索 → email取得
  // MailApp.sendEmail(email, subject, message, { from: 'noreply.xxxxx@gmail.com' })
  // return { ok: true }
}
```

### タスク
- [ ] LIFAIOV: `app/api/admin/notify-user/route.ts` を作成
- [ ] LIFAIOV: `app/admin/finance/UsersTab.tsx` に送信UIを追加
- [ ] LIFAIOV: GASに `admin_notify_user` アクションを追加
- [ ] aisalon: `app/api/admin/notify-user/route.ts` を作成
- [ ] aisalon: `app/admin/finance/UsersTab.tsx` に送信UIを追加
- [ ] aisalon: GASに `admin_notify_user` アクションを追加

---

## 機能2: ガチャ確率のユーザー個別設定

### 概要
`UsersTab.tsx` のユーザー詳細パネルから、ユーザーごとのガチャ確率プリセットを変更できるようにする。

### 設計方針
- **プリセット制**（具体的な確率テーブルは GAS 側で管理）
  - `normal`：現在のテーブル
  - `lucky`：高レアリティ枠を2倍程度
  - `super_lucky`：さらに高レアリティ枠を優遇
- GASの`applies`シートに `gacha_rate_preset` 列を追加
- `gacha_spin` アクションでその列を参照して確率を切り替える

### Next.js 変更（両プロジェクト）

#### 新規ファイル: `app/api/admin/set-gacha-preset/route.ts`
```
POST { loginId, preset }  // preset: "normal" | "lucky" | "super_lucky"
  → GAS action: admin_set_gacha_preset
  → ok: true | { ok: false, error }
```

#### 変更ファイル: `app/admin/finance/UsersTab.tsx`
- **LIFAIOV**: 「アカウント操作」セクションに追記
- **aisalon**: お知らせ機能で新設した「アカウント操作」セクションに追記

追加するUI：
- `AdminUser` 型に `gacha_rate_preset?: string` を追加
- `<select>` で normal / lucky / super_lucky を選択
- 「適用」ボタン → `POST /api/admin/set-gacha-preset`
- `admin/list` がユーザー情報を返す際に `gacha_rate_preset` を含めることが前提

### GAS 変更（両プロジェクト別々）

#### `applies`シートに列追加
- `gacha_rate_preset` 列（デフォルト空 = `normal` 扱い）

#### 新アクション `admin_set_gacha_preset`
```javascript
case "admin_set_gacha_preset": {
  // adminKey 検証
  // loginId でユーザー行を検索
  // gacha_rate_preset 列に preset 値をセット
  // return { ok: true }
}
```

#### 既存アクション `gacha_spin` を修正
```javascript
// preset に応じてテーブルを切り替え
const preset = row['gacha_rate_preset'] || 'normal';
const table = preset === 'super_lucky' ? SUPER_LUCKY_TABLE
            : preset === 'lucky' ? LUCKY_TABLE
            : DEFAULT_TABLE;
```

#### `admin_list` アクションを修正
- 返却オブジェクトに `gacha_rate_preset` を含める

### タスク
- [ ] LIFAIOV: `app/api/admin/set-gacha-preset/route.ts` を作成
- [ ] LIFAIOV: `app/admin/finance/UsersTab.tsx` にプリセットUI追加
- [ ] LIFAIOV: GASに `gacha_rate_preset` 列追加 + `admin_set_gacha_preset` アクション追加
- [ ] LIFAIOV: GASの `gacha_spin` にプリセット分岐を追加
- [ ] LIFAIOV: GASの `admin_list` に `gacha_rate_preset` を含める
- [ ] aisalon: 同上5点

---

## 機能3: 音楽生成失敗時のBP返還

### 概要
音楽生成が途中で失敗した場合に、消費したBPをユーザーに返還する。

### 現状の問題点
1. `song/start/route.ts`でBPをdeductした後に`status: "failed"`になっても返還処理がない
2. `song/cancel/route.ts`は`bpRefunded`の値を返すだけで、**実際のGAS呼び出しをしていない**（バグ）
3. `approve-structure/route.ts`でElevenLabs失敗時も返還なし

### 変更方針
- GASに `refund_bp` アクションを追加（`wallet_ledger` に `music_refund_bp` として記録）
- Next.js に共通ヘルパー関数 `refundBpToUser(loginId, amount, memo)` を作成
- 失敗になり得る各箇所でこのヘルパーを呼ぶ

### GAS 変更（両プロジェクト別々）

#### 新アクション `refund_bp`
```javascript
case "refund_bp": {
  // adminKey 検証
  // loginId でユーザー行を検索
  // bp_balance += amount
  // wallet_ledger に { kind: "music_refund_bp", amount, memo } を記録
  // return { ok: true, newBalance }
}
```

### Next.js 変更（両プロジェクト）

#### 新規ヘルパー（`song/start/route.ts` 内またはlib）
```typescript
async function refundBpToUser(loginId: string, amount: number, memo: string) {
  // GAS refund_bp アクションを呼ぶ
  // 失敗してもthrowしない（ログのみ）
}
```

#### `app/api/song/start/route.ts` の修正箇所
```typescript
// OpenAIキー未設定で失敗後（現状返還なし）
await updateJob(jobId, { status: "failed", ... });
await refundBpToUser(String(id), bpCost, "音楽生成失敗（設定エラー）");
// ↑ これを追加

// generateStructureAndLyrics が null を返した場合も同様
```

#### `app/api/song/approve-structure/route.ts` の修正箇所
```typescript
// ElevenLabs 失敗時（generateAudioAttempt 内）
await updateJob(jobId, { status: "failed", ... });
// jobからloginIdを取得してrefundBpToUser呼び出しを追加
// ※ jobに loginId フィールドが存在するか _jobStore.ts で確認必要
```

#### `app/api/song/cancel/route.ts` のバグ修正
```typescript
// 現状: GAS呼び出しなし（バグ）
const bpRefunded = getBpRefund(job.status);
await updateJob(String(jobId), { status: "cancelled" });
return NextResponse.json({ ok: true, status: "cancelled", bpRefunded });

// 修正後:
const bpRefunded = getBpRefund(job.status);
await updateJob(String(jobId), { status: "cancelled" });
if (bpRefunded > 0) {
  await refundBpToUser(job.loginId, bpRefunded, `キャンセル返還（${job.status}）`);
}
return NextResponse.json({ ok: true, status: "cancelled", bpRefunded });
```

### 注意点
- `_jobStore.ts` の `SongJob` 型は `loginId` ではなく **`userId?`** フィールドで保存される。返還時は `job.userId` を使う
- refund は冪等ではないため、二重返還を防ぐために `job.bpRefunded` フラグを jobStore に追加検討
- `approve-structure/route.ts` は 300秒タイムアウトの長時間処理のため、失敗箇所が複数ある

### タスク
- [ ] LIFAIOV: GASに `refund_bp` アクションを追加
- [ ] LIFAIOV: `song/start/route.ts` に失敗時BP返還を追加
- [ ] LIFAIOV: `song/approve-structure/route.ts` に失敗時BP返還を追加
- [ ] LIFAIOV: `song/cancel/route.ts` のGAS未呼び出しバグを修正
- [ ] aisalon: 上記4点を確認・適用（routeファイル名がLIFAIOVと異なる可能性あり）

---

## 実装順序（推奨）

1. **機能3（BP返還）** → バグ修正含むため先行
2. **機能1（お知らせ）** → 単純なGAS追加＋UI追加
3. **機能2（ガチャ設定）** → GASの既存アクション変更があるため最後

## 作業の進め方

- GAS変更は Claude に貼り付けてもらえれば対応可能
- Next.js変更は「LIFAIOV実装して」と言えば対応可能
- aisalonとLIFAIOVは別々に進める（GASが別インスタンスのため）

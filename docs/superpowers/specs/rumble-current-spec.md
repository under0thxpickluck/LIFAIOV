# ランブル 現状実装仕様書

> 作成日: 2026-04-01  
> 目的: 観戦機能の再実装・改善時に既存実装を壊さないための記録

---

## 1. ファイル構成

| ファイル | 役割 |
|---|---|
| `app/mini-games/rumble/page.tsx` | フロントエンド全体（5タブ） |
| `app/api/minigames/rumble/spectator/route.ts` | GET /spectator → GAS proxy |
| `app/api/minigames/rumble/entry/route.ts` | POST /entry → GAS proxy |
| `app/api/minigames/rumble/status/route.ts` | GET /status → GAS proxy |
| `gas/Code.gs` | GAS側全処理（rumble系関数） |

---

## 2. GAS シート構造

### `rumble_entry`
```
id | user_id | date | score | rp | created_at
```
- `date`: `"YYYY-MM-DD"` (JST)
- `score` = `rp`（現時点では同値）

### `rumble_week`
```
user_id | week_id | total_rp | updated_at
```
- `week_id`: 週の識別子（`getWeekId_()` で生成）
- 参加のたびに `total_rp += rp` で加算

### `applies` 内 rumble関連列
```
bp_balance | ep_balance | upgrade_shard | rumble_display_name | level
```

### `equipment`
```
id | user_id | slot | rarity | name | base_bonus | bonus | quality |
enhance_level | enhance_bonus | luck | stability | equipped | locked | created_at
```

---

## 3. GAS関数

### `rumbleEntry_(params)` — バトル参加

**スコア計算式:**
```
levelBonus   = userLevel × 2
equipBonus   = getUserEquipmentBonus_(userId)  // 上限50
randomFactor = random整数(0〜50)
score        = 100 + levelBonus + equipBonus + randomFactor
rp           = score  // RPはスコアと同値
```

**処理フロー:**
1. LockService（15秒）で排他制御
2. 当日参加済みチェック（二重参加禁止）
3. BP残高確認 → -100 BP
4. スコア計算
5. `rumble_entry` シートに追記
6. `rumble_week` シートの週累計RP更新
7. `SpreadsheetApp.flush()` で即確定

---

### `rumbleStatus_(params)` — ステータス取得

**返却値:**
```json
{
  "ok": true,
  "entered_today": true,
  "today_score": 145,
  "today_rp": 145,
  "week_rp": 430,
  "week_id": "2026-W14",
  "bp_balance": 900,
  "display_name": "warrior123"
}
```

---

### `rumbleSpectator_(params)` — 観戦イベント生成

**重要: バトルは「演出の事前生成」であり、リアルタイムシミュレーションではない。**  
結果はスコア順で確定済み。イベント列は呼び出しのたびにランダム生成される。

#### 処理フロー

```
1. 当日の rumble_entry を全取得
2. applies から display_name をマッピング
3. score降順でソート → rank付与
4. 脱落波計算（4波）
5. イベント列(events[])を生成して返却
```

#### 脱落波計算式

```
target3    = max(3, floor(total × 0.03))  // 最終生存者数（最低3名）

wave1_elim = floor((total     - target3) × 0.45)
wave2_elim = floor((remaining - target3) × 0.45)
wave3_elim = floor((remaining - target3) × 0.55)
wave4_elim = remaining - 3

waves = [wave1, wave2, wave3, wave4].filter(n > 0)
```

脱落順序: **スコア下位から** 順に脱落（上位が生き残る）

#### 各フェーズのイベント

| フェーズ | 内容 | 注目戦数 |
|---|---|---|
| イントロ | "ランブルが はじまる！" + 参加者数 | — |
| Wave1（序盤戦） | batch_eliminate + 注目戦 | 2戦 |
| Wave2（中盤戦） | batch_eliminate + 注目戦 | 2戦 |
| Wave3（終盤戦） | batch_eliminate + 注目戦 | 3戦 |
| Wave4（決戦） | batch_eliminate + 注目戦 | 3戦 |
| TOP3決戦 | 2位 vs 1位の1戦 | 1戦 |
| 結果 | ranking + result イベント | — |

#### 注目戦のロジック

```
playerA（攻撃側）: 自分 or TOP10 から優先選出
playerB（守備側）: 11位以下からランダム選出

damage  = floor(playerA.score / 10) + random(0〜10)
isCrit  = random() < 0.1  // 10%確率
表示ダメージ = isCrit ? damage × 2 : damage
```

#### イベント型定義

```typescript
type SpectatorEvent = {
  type:    "intro" | "batch_eliminate" | "battle" | "log" | "ranking" | "result";
  text?:   string;
  ids?:    string[];      // batch_eliminate時の脱落者ID一覧
  a?:      string;        // battle時の攻撃者ID
  b?:      string;        // battle時の防御者ID
  is_crit?: boolean;
  phase?:  string;
  delay:   number;        // ms単位（フロントでのwait時間）
};
```

#### 返却値

```json
{
  "ok": true,
  "status": "ready",
  "date": "2026-04-01",
  "players": [{ "id": "...", "display_name": "...", "score": 145, "rp": 145, "rank": 1, "is_self": false }],
  "events": [...],
  "self": { "id": "...", "display_name": "...", "score": 130, "week_rp": 430, "week_rank": 5 },
  "ranking": [{ "user_id": "...", "display_name": "...", "total_rp": 1200 }],
  "total": 42
}
```

参加者0人の場合:
```json
{ "ok": true, "status": "no_data", "players": [], "events": [], "self": null, "ranking": [] }
```

---

### `rumbleRewardDistribute_()` — 週次報酬配布

**報酬テーブル:**

| 順位 | EP報酬 |
|---|---|
| 1位 | 1,500 EP |
| 2位 | 1,000 EP |
| 3位 | 700 EP |
| 4〜10位 | 400 EP |
| 11〜50位 | 80 EP |
| 51〜100位 | 10 EP |

GASエディタから手動実行（または管理者メニュー）で配布。

---

## 4. API Routes

### GET `/api/minigames/rumble/spectator`

```
QueryParams: userId, date(省略可・当日)
GAS body:    { action: "rumble_spectator", userId, date }
返却:        SpectatorData
```

### POST `/api/minigames/rumble/entry`

```
Body:     { userId }
GAS body: { action: "rumble_entry", key: GAS_API_KEY, userId }
返却:     { ok, score?, rp?, bp?, week_id?, error? }
```

### GET `/api/minigames/rumble/status`

```
QueryParams: userId
GAS body:    { action: "rumble_status", key: GAS_API_KEY, userId }
返却:        { ok, entered_today, today_score, today_rp, week_rp, week_id, bp_balance, display_name }
```

---

## 5. フロントエンド

### タブ構成（5タブ）

`"バトル" | "観戦" | "ランキング" | "装備" | "ガチャ"`

### 主要 State 一覧

| 変数 | 型 | 用途 |
|---|---|---|
| `userId` | `string` | localStorage `addval_auth_v1` から取得 |
| `tab` | `Tab` | 現在タブ |
| `status` | `RumbleStatus \| null` | 参加状況・スコア・週間RP |
| `countdown` | `string` | 次バトルまでカウントダウン表示 |
| `bpBalance` | `number \| null` | BP残高 |
| `localEnteredToday` | `boolean` | 当日参加済みローカルフラグ |
| `displayName` | `string` | 表示名 |
| `spectatorData` | `SpectatorData \| null` | GASから取得した観戦データ（キャッシュ） |
| `spectatorLoading` | `boolean` | 観戦データ読込中 |
| `spectatorPlayers` | `SpectatorPlayer[]` | 観戦中プレイヤー状態（alive/eliminated） |
| `battleLogs` | `{text,color,id}[]` | バトルログ（最新8件のみ保持） |
| `spectatorPhase` | `"waiting" \| "live" \| "result"` | 観戦フェーズ |
| `isPlaying` | `boolean` | イベント再生中フラグ |
| `logCounter` | `number` | ログID生成用カウンター |

### 観戦タブ APIコール条件

```typescript
// 初回のみ取得（spectatorData が null の間だけ）
if (tab !== "観戦" || !userId || spectatorData) return;
```

→ **一度取得したら再取得しない（キャッシュ）**

### タイマー計算式（現状）

```typescript
const now    = new Date();
const nowJst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const target = new Date(nowJst);
target.setHours(19, 0, 0, 0);  // ⚠ setHoursはlocaltimeで動作
if (nowJst.getHours() >= 19) target.setDate(target.getDate() + 1);
while (target.getDay() === 0 || target.getDay() === 6) target.setDate(target.getDate() + 1);
const diff = target.getTime() - nowJst.getTime();
```

**⚠ 既知の問題:** `target.setHours(19, 0, 0, 0)` はブラウザのローカルタイムで動作する。  
JST端末では問題ないが、UTC端末だと目標時刻がJST 28:00（翌4:00）になる。

### handleSpectatorPlay — イベント再生ロジック

```typescript
const handleSpectatorPlay = async () => {
  if (!spectatorData || isPlaying || spectatorData.status === "no_data") return;

  setIsPlaying(true);
  setSpectatorPhase("live");
  setBattleLogs([]);
  setSpectatorPlayers(spectatorData.players.map(p => ({ ...p, status: "alive" })));

  let counter = 0;
  const addLog = (text, color = "text-white") => {
    counter++;
    setBattleLogs(prev => [...prev, { text, color, id: counter }].slice(-8)); // 最新8件
  };

  for (const event of spectatorData.events) {
    await new Promise(r => setTimeout(r, Math.min(event.delay > 0 ? event.delay : 800, 2000)));

    switch (event.type) {
      case "intro":
      case "log":
        addLog(event.text, "text-white/80"); break;
      case "batch_eliminate":
        setSpectatorPlayers(prev => prev.map(p =>
          event.ids.includes(p.id) ? { ...p, status: "eliminated" } : p
        ));
        addLog(event.text, "text-red-400/80"); break;
      case "battle":
        addLog(event.text, event.is_crit ? "text-yellow-400" : "text-purple-300"); break;
      case "ranking":
        addLog("━━━━━━━━━━━━━━━━", "text-white/20");
        addLog("🏆 今日の順位が確定！", "text-yellow-400"); break;
      case "result":
        addLog(event.text, "text-yellow-300");
        setSpectatorPhase("result"); break;
    }
  }
  setIsPlaying(false);
};
```

### 観戦UI構成

1. **ステータスカード**: フェーズ表示 / 参加者数 / 生存数・脱落数・自分の状態
2. **バトルログ**: 最新8件、色分け表示（min-height: 200px）
3. **再生ボタン**: "観戦スタート" / "もう一度見る"
4. **プレイヤー一覧**: 全員をタグ表示（TOP10金色 / 自分紫 / 脱落は打消し線）
5. **今週ランキング TOP5**: 自分が圏外の場合は別途表示

---

## 6. 既知の問題・改善予定

| # | 問題 | 影響 | 対応状況 |
|---|---|---|---|
| 1 | タイマーの `setHours` がローカルタイム依存 | UTC環境でズレる | ✅ 修正済み（`Intl.DateTimeFormat` 使用に変更） |
| 2 | `spectatorData` が一度取得したら再取得しない | 古いデータを表示し続ける | ✅ 修正済み（30秒キャッシュ + 日付変化で再取得） |
| 3 | バトルログが最新8件のみ | 重要な脱落情報が流れる | ✅ 修正済み（最新20件に拡張 + バトルログモーダル実装） |
| 4 | バトルは事前生成の演出のみ（リアルタイムではない） | 仕様として許容 | ー 仕様 |
| 5 | 観戦イベントは呼び出しのたびに再生成（毎回ランダム） | 再生のたびに結果が変わる | ー 仕様（localStorage キャッシュで再生は同一） |
| 6 | バトル参加後にBP残高UIが即時更新されない | 次の status 取得まで旧値を表示 | ✅ 修正済み（`handleEntry` で -100BP 即時反映） |
| 7 | `rumble_daily_result` / `rumble_spectator` GASボディにkeyなし | 認証方式変更時に壊れるリスク | ✅ 修正済み（bodyに `key` 追加） |
| 8 | `handlePrevPlay` でbatch_eliminate時にプレイヤー状態が未更新 | 前回バトルの脱落可視化が機能しない（現状バトルログモーダルにプレイヤータグなし→無症状） | 残課題 |
| 9 | 観戦タブuseEffectが `spectatorData` を依存配列に持ち過剰評価 | パフォーマンス面のみ | 残課題（低優先度） |

---

## 7. 絶対に壊してはいけない仕様

- `rumble_entry` / `rumble_week` シートの列構造
- `rumbleEntry_` のスコア計算式・BP消費・二重参加防止
- `rumbleRewardDistribute_` の報酬テーブル
- `SpectatorData` の型定義（フロント・GAS間インターフェース）
- doPost での `rumble_spectator` ルーティング
- タブ切り替えの既存ロジック（バトル・ランキング・装備・ガチャは完成済み）

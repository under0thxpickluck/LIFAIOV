# ローディングインジケーター差し込み箇所 調査レポート

作成日: 2026-06-22

全ページ・コンポーネントのAPIウェイト状態を網羅的に調査した結果をまとめる。

---

## 優先度 HIGH — スピナーなし（ユーザーが何も分からない）

### 1. `app/top/page.tsx` — バックグラウンドフェッチ群

ダッシュボード入場時に5〜6本のAPIを並行発火するが、いずれにもローディング表示がない。

| fetch先 | 用途 | 現状 |
|---|---|---|
| `/api/wallet/balance` | BP/EP残高 | BalanceBadge は残高取得後に表示。取得中は空欄か前回値 |
| `/api/user/pending-bp` | 未払いBP確認 | サイレント失敗のまま表示なし |
| `/api/me` | ユーザー名・紹介情報 | サイレント。名前が遅れて表示される |
| `/api/daily-login` | ログインボーナス | サイレント。成功時にモーダルが出る |
| `/api/apply-sell/notify` | 楽曲売却通知 | サイレント |
| `/api/wallet/recover` | 月次BP回復 | サイレント |

**推奨**: BalanceBadge に `animate-pulse` のスケルトンを追加。`/api/me` の名前表示部分にもスケルトン。

---

### 2. `app/mini-games/tap/page.tsx` — 初期ステータス未取得

`status` は null で始まりAPIレスポンスを待つ。タップボタンは `disabled + opacity-40` になるが、なぜ押せないのかユーザーに伝わらない。

- 状態: `const [status, setStatus] = useState<TapStatus | null>(null);`
- fetch: `/api/minigames/tap/status`
- 現状UI: ボタンが薄くなるだけ。「読み込み中」等のテキストなし

**推奨**: `status === null` のとき、ボタン上部または中央に小さなスピナーを表示。

---

### 3. `app/music-boost/page.tsx` — loading=true だが UI 分岐なし

`loading` stateが定義されているが、`loading ? <Spinner /> : <Content />` のような分岐が一切ない。ページは初期状態のまま（空データ）で表示される。

- 状態: `const [loading, setLoading] = useState(true);`
- fetch: `/api/music-boost/status`, `/api/wallet/balance`, `/api/music-boost/info`
- 現状UI: loading中も全セクションが空白で表示される

**推奨**: `loading` が true の間、カード領域全体にスピナーまたは `animate-pulse` スケルトンを表示。

---

### 4. `app/chat/page.tsx` — AI 応答中のタイピングインジケーターなし

`fetch("/api/cat-chat")` 中、AIが回答を生成している間、何のフィードバックもない。

- 現状UI: ユーザーが送信後、返答が来るまで画面が静止したまま
- 応答が遅い場合、送信ボタンを連打するリスクあり

**推奨**: `isTyping` stateを追加し、`...` アニメーションや「考え中...」表示を入れる。送信ボタンも `disabled` にする。

---

### 5. `app/mini-games/rumble/page.tsx` — 複数フェッチの一部に表示なし

タブ切替時に複数のAPIを発火するが、一部はサイレント。

| fetch先 | 現状 |
|---|---|
| `/api/minigames/rumble/status` | サイレント（初期 null） |
| `/api/minigames/rumble/ranking` | サイレント |
| `/api/minigames/rumble/equipment` | サイレント |
| `/api/minigames/rumble/shard-status` | サイレント |
| `/api/minigames/rumble/spectator` | `spectatorLoading` → "読み込み中..." テキスト ✅（最低限あり） |
| `/api/minigames/rumble/daily-result` | `dailyResultLoading` → "読み込み中..." テキスト ✅ |

**推奨**: status / ranking / equipment 取得中にそれぞれのセクションへスケルトンを追加。

---

## 優先度 MEDIUM — テキストのみ（スピナーへの格上げ推奨）

現状は「読み込み中…」テキストが表示されるが、視認性が低くブランドとしてチープに見える。

| ファイル | 箇所 | 現状 |
|---|---|---|
| `app/gift/page.tsx` | 残高カード内 | `読み込み中…` テキスト |
| `app/gift/history/page.tsx` | 履歴リスト | `読み込み中…` テキスト |
| `app/membership/page.tsx` | ステータスカード | `読み込み中…` テキスト |
| `app/market/orders/page.tsx` | 出品中リスト | `読み込み中…` テキスト |
| `components/StakingModal.tsx` | ステーク一覧 | `読み込み中…` テキスト |
| `app/reset/page.tsx` | Suspense fallback | `loading...` 英語テキスト（日本語化も必要） |

**推奨**: 各箇所のテキストを `<Spinner />` + テキストのコンボ、またはスケルトンに置き換える。

---

## 優先度 LOW — ボタンテキスト変更のみ（機能的だが視覚フィードバック弱め）

フォーム送信系はボタンテキストが変わるが、スピナーアイコンがないため少し頼りない。

| ファイル | ボタンテキスト | 補足 |
|---|---|---|
| `app/confirm/page.tsx` | `"送信中..."` | disabled + テキスト変更 ✅ |
| `app/apply-sell/page.tsx` | `"送信中…"` | disabled + テキスト変更 ✅ |
| `app/market/create/page.tsx` | `"出品中…"` | opacity変更あり ✅ |
| `app/gift/send/page.tsx` | `"送信中…"` | opacity変更あり ✅ |
| `app/narasu-agency/confirm/page.tsx` | `"送信中…"` | disabled ✅ |
| `components/StakingModal.tsx` | `"処理中..."` | disabled ✅ |

**推奨**: 必要に応じてボタン左にミニスピナー（`animate-spin` SVGまたは `●●●` アニメ）を追加する程度で十分。

---

## 優先度 NONE — 既に適切に処理済み

| ファイル | 対応状況 |
|---|---|
| `app/login/page.tsx` | "確認中...", "送信中..." ×3箇所、disabled ✅ |
| `app/referral-app/page.tsx` | `<Skel />` スケルトンプレースホルダー ✅ |
| `app/market/page.tsx` | `<Spinner />` コンポーネント表示 ✅ |
| `app/admin/page.tsx` | `animate-pulse` スケルトン + テキスト ✅ |
| `app/music2/page.tsx` | `<ProgressBar>` コンポーネント ✅ |
| `components/GachaModal.tsx` | 🎰 回転アニメーション、disabled ✅ |

---

## 実装優先順位まとめ

```
HIGH（新規実装が必要）:
  1. app/chat/page.tsx — タイピングインジケーター追加
  2. app/music-boost/page.tsx — loading分岐を追加してスピナー表示
  3. app/mini-games/tap/page.tsx — status=null時のスピナー追加
  4. app/top/page.tsx — BalanceBadge・名前表示にスケルトン追加

MEDIUM（既存テキストをスピナーに格上げ）:
  5. app/gift/page.tsx, history, app/membership/page.tsx
  6. components/StakingModal.tsx
  7. app/reset/page.tsx — fallbackを日本語スピナーに変更

LOW（ボタンにスピナーアイコン追加、任意）:
  8. 各フォーム送信ボタン
```

---

## 共通スピナーコンポーネントの提案

現在 `app/market/page.tsx` の `<Spinner />` ローカルコンポーネントが存在する。
これを `components/ui/Spinner.tsx` として切り出し、全体で使い回せるようにすることを推奨する。

```tsx
// components/ui/Spinner.tsx
export function Spinner({ size = 20, color = "#7C3AED" }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ color }}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
```

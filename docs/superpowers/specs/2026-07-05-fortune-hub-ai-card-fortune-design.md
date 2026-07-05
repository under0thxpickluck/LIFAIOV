# 占いハブ ＋ AIカード占い 設計仕様書（MVP）

- 日付: 2026-07-05
- 対象リポ: LIFAIOV（`~/LIFAIOV`）。**まずLIFAIOVで完成させ、その後 aisalon へ個別移植**（コード共有せず各リポに適用。2サロンを混ぜない）。
- 種別: 新機能設計（没入型AIカード占い）＋既存「団子占い」入口の「占い」ハブ化
- 使用技術: Next.js 14 App Router / React 18 / TypeScript / TailwindCSS / Framer Motion / OpenAI(`openai` v6) / JSONカードデータ。スマホファースト・レスポンシブ。

## 1. 目的とコンセプト

「AIカード占い」は単なるタロットではなく、**仮想空間でAI占い師と対話する没入型体験**。暗い星空・月・ろうそく・円卓・シルエットの占い師の中で、ユーザーがカードを選び、AIがその人だけの結果を語る。品質目標は一般的Webアプリではなく**ゲームレベルの世界観・演出・高級感**。

既存の「団子占い」ミニアプリの入口を「**占い**」に改名し、その中で「団子占い / カード占い」を選べるようにする。

## 2. スコープ

### 2.1 MVPに含む
- 「占い」ハブ（`/fortune`）＋団子/カードのセレクト。
- カード占いの没入フロー end-to-end（タイトル→質問→事前3問→モード選択→デッキ/シャッフル/3枚選択→ローディング→結果）。
- 22枚カードJSON、OpenAI結果生成（7フィールド）、演出（星・炎・浮遊・選択光・結果カード回転）、テーマ配色、レスポンシブ。
- モード選択UI（無料/Standard/Premium）と**課金スタブ（単一シーム）**。無料は1日1回（localStorage判定）。
- 「もう一度占う」。

### 2.2 MVPに含めない（構造だけ用意し後日差し込み）
画像として保存 / SNS共有 / 履歴保存 / 実BP・EP消費 / 毎日運勢・恋愛/仕事/金運の専用スプレッド / 音声読み上げ / Live2D / 背景変更 / 季節イベント / 限定カード / コレクション / お気に入り。

## 3. 入口・ルーティング（採用: サブルート方式）

- `/fortune`（`app/fortune/page.tsx`）を「占い」**ハブ**に置き換える。入口で「団子占い / カード占い」を選択。
- 既存の団子占いページ本体を `app/fortune/dango/page.tsx` へ**移設**（内部ロジック・localStorageキー `dango_result/dango_install_id/dango_fortune_cache`・公開JSON `/fortune/config/*.json` の参照は不変）。ハブから `/fortune/dango` へ遷移。
- カード占いは新規 `app/fortune/cards/page.tsx`。
- 入口ラベルの改名「団子占い」→「占い」（リンク先は `/fortune` のまま）:
  - `app/top/page.tsx:415`（タイルlabel）
  - `components/AppSidebar.tsx:42`
  - `app/5000/page.tsx:712`（feature card title）
  - `components/LifaiCat.tsx:444`（「占いを見る +10BP」は文言そのまま可）
  - マーケ用静的HTML（`public/guide.html` 等）はMVP対象外（後日）。
- 団子占いのBP付与（`/api/missions` `mission_type='fortune'` 等）はハブ移設後も従来どおり `/fortune/dango` で動くこと。

## 4. カード占い体験フロー（ステートマシン）

`FortuneApp` が `currentStep` で1画面ずつ遷移する：

1. `intro` — タイトル「月影の占術」／説明「運命は、未来を決めるものではなく、あなたの心を映すもの。」／「占いを始める」。
2. `question` — 「今、何を占いましょうか？」＋質問入力（例: 仕事/恋愛/人生/事業/お金/人間関係）。
3. `preQuestions` — 事前3問（すべて必須）:
   - ① 現在一番悩んでいること（currentSituation）
   - ② 本当はどうしたいか（trueFeeling）
   - ③ 理想の未来（idealFuture）
   入力後「カードを引く」。
4. `mode` — モード選択（無料/Standard/Premium）。※消費はスタブ（§7）。
5. `deck` — 円卓に22枚裏面 → シャッフル演出（集まる→高速混合→円状に再展開）→「心を静かにし、惹かれるカードを三枚選んでください。」→ **3枚選択**（1枚目=過去/2枚目=現在/3枚目=未来、選択時に紫発光・少し浮く・金粒子）→3枚で「占う」表示。
6. `loading` — カード浮遊・光・占い師が手を動かす／「カードが語りかけています…」「あなただけの運命を読み解いています…」＝OpenAI送信中。
7. `result` — 上部に質問、中央に3枚（回転して表になる）、summary/past/present/future/action/warning/finalMessage、「もう一度占う」。

各カードの正逆（orientation）は選択時にランダム決定（upright/reversed）。

## 5. コンポーネント構成

`components/tarot/` 配下（＋ページは `app/fortune/cards/page.tsx` が `FortuneApp` をマウント）:

- `FortuneApp` — ステートマシン・全体の器。`useReducer` で状態集約。
- `FortuneIntro` — タイトル画面。
- `QuestionInput` — 占う内容入力。
- `PreQuestionForm` — 事前3問。
- `ModeSelector` — 無料/Standard/Premium 選択。
- `StarBackground` — 星空・月（緩やかに流れる）。全画面の背景レイヤ。
- `FortuneTable` — 円卓レイアウト。
- `FortuneTeller` — 顔を見せないシルエット占い師（ろうそくの炎揺れ含む）。
- `CardDeck` — 22枚配置・シャッフル演出・選択ハンドリング。
- `TarotCard` — 1枚（裏/表、浮遊・傾き・選択光）。
- `SelectedCards` — 選んだ3枚（過去/現在/未来）表示。
- `LoadingScene` — 占い中演出。
- `FortuneResult` — 結果表示。

将来の `History` はMVP範囲外（§2.2）。

## 6. 状態管理

`useReducer` による単一ステート:

```ts
type Orientation = 'upright' | 'reversed'
type Mode = 'free' | 'standard' | 'premium'
type Step = 'intro' | 'question' | 'preQuestions' | 'mode' | 'deck' | 'loading' | 'result'
type SelectedCard = { id: string; name: string; position: 'past' | 'present' | 'future'; orientation: Orientation }
type FortuneResultData = { summary: string; past: string; present: string; future: string; action: string; warning: string; finalMessage: string }

type State = {
  currentStep: Step
  question: string
  currentSituation: string
  trueFeeling: string
  idealFuture: string
  selectedCards: SelectedCard[]   // 最大3、選択順に past/present/future
  mode: Mode
  result: FortuneResultData | null
  loading: boolean
  error: string | null
}
```

## 7. 課金モード（スタブ設計・将来組み込み容易化）

- `lib/fortune/billing.ts` に単一シーム:
  ```ts
  export async function chargeForMode(mode: Mode, loginId: string | null): Promise<{ ok: boolean; error?: string }>
  ```
  MVP実装は常に `{ ok: true }`（実質無料）。後日ここだけ差し替える:
  - Standard → 既存 `@/app/lib/bp-config` の `BP_COSTS`（BP消費、GAS `deduct_bp` 相当）。
  - Premium → GAS `deduct_ep`（冪等キー付き。§既存GASの `deduct_ep` を流用）。
- 無料モードの「1日1回」はMVPでは localStorage キー（例 `tarot_free_last_ymd`）で判定。サーバー厳格化は後日。
- モードごとの差は**プロンプトの指示**（文章量・カテゴリ別/深層分析の有無）で表現（§8）。UIは全モード選択可、消費表示は「（近日）」等で明示。

## 8. OpenAI API

- 新規 `app/api/tarot/route.ts`（Node ランタイム, POST）。既存 `OPENAI_API_KEY` を流用（cat-chat と同系のクライアント初期化）。
- リクエストbody（クライアント→API）:
  ```json
  {
    "question": "今の仕事を続けるべきですか？",
    "currentSituation": "売上が落ちています",
    "trueFeeling": "新しい挑戦をしたい",
    "idealFuture": "自由な生活を送りたい",
    "mode": "free",
    "cards": [
      { "position": "past",    "name": "創造", "orientation": "upright" },
      { "position": "present", "name": "迷い", "orientation": "reversed" },
      { "position": "future",  "name": "再生", "orientation": "upright" }
    ]
  }
  ```
- システムプロンプト（要旨・仕様どおり）: LIFAI専属の幻想的なAI占い師。断定でなく心を映す鏡。一般論を書かない／必ずユーザー入力に触れる／カード意味を反映／前向きな終わり／不安を煽らない／現実的な行動提案／読み物として感動する文章。`mode` に応じて分量・深度を調整（free=簡易、standard=約2倍+行動提案、premium=最長+カテゴリ別+深層心理）。
- 返却は**JSON**（`response_format: json_object` 相当で強制）:
  ```json
  { "summary":"", "past":"", "present":"", "future":"", "action":"", "warning":"", "finalMessage":"" }
  ```
- サーバー側で7フィールドの存在を検証。欠落・非JSON・API失敗・タイムアウト時は `{ ok:false, error }` を返し、クライアントは再試行導線＋やさしいフォールバック文を表示。
- レート/コスト保護: サーバーで簡易入力長制限。カード意味の反映はクライアントが送る `name/orientation` ＋ サーバーが `data/tarot-cards.json` から意味を引いてプロンプトに合成。

## 9. カードデータ

- `data/tarot-cards.json`（**22枚**）。各カード:
  ```ts
  type TarotCard = {
    id: string
    name: string        // 例: 創造, 迷い, 月光, 契約, 炎, 転機, 収穫, 静寂, 解放, 再生, 星導, 影, 運命, 太陽, 月, 塔, 世界, 女神, 審判, 知恵, 旅人, 希望
    image: string       // MVPはプレースホルダ参照（後で実画像に差し替え）
    upright: string     // 正位置の意味
    reversed: string    // 逆位置の意味
    love: string; work: string; life: string; money: string  // カテゴリ別意味
    meaning: string     // 総括的意味
  }
  ```
- 画像はMVPでは**金縁＋中央に月マークのプレースホルダ**（SVG/CSS生成）。`image` フィールドを参照するローダを用意し、後日実画像に差し替え可能。

## 10. ビジュアル / アニメーション

- テーマトークン（CSS変数 or Tailwind拡張で一元化）: 背景 `#09070F` / 紫 `#231235` / 金 `#D9B76B` / 文字 `#F4EFE8` / アクセント `#B56DFF` / カード縁=金 / 影=ぼかし強め。
- Framer Motion:
  - 星: 常にゆっくり流れる（低速ループ）。
  - ろうそく: 炎が小さく揺れる。
  - カード: 浮遊（ゆっくり上下）、マウス/タップで少し傾く。
  - 選択時: 金色の光・少し浮く・拡大（振動しない・上品）。
  - 結果表示: カードが宙へ浮き→回転して表になり→ゆっくり止まる。
- スマホファースト。BGMはブラウザ自動再生制約のため**ユーザー操作でON**（トグル）。`prefers-reduced-motion` 尊重で過度な動きを抑制。

## 11. エラー処理

- OpenAI: 失敗/タイムアウト/不正JSON → 画面に「もう一度お試しください」＋再試行、または最小フォールバック結果（カード意味ベースの静的文）。
- ネットワーク断・二重送信防止（送信中はボタン無効）。
- 未ログインでもカード占い自体は動作（無料モード）。BP/EP消費導入時にログイン要求を追加。

## 12. 検証 / テスト

- LIFAIはテスト/lint未設定（CLAUDE.md「No lint or test commands are configured」）。検証は:
  - `npm run build`（Next.js プロダクションビルドが通ること＝型・importの健全性）。
  - `npm run dev` で全フロー手動確認（intro→result、団子ハブ切替、モバイル表示、演出）。
- OpenAIキー未設定環境ではフォールバック結果で画面が壊れないこと。

## 13. aisalon への移植（LIFAIOV完成後・別ステップ）

- 同一設計を aisalon リポに**個別適用**（ファイルコピー＋各リポの入口/命名に合わせて調整）。コード共有・シンボリックリンクはしない。移植は本仕様完了後に別途プラン化。

## 14. 未解決事項

なし（MVP範囲は確定。実画像・実BP/EP・履歴等は §2.2 のとおり後日別スペック）。

export type Orientation = 'upright' | 'reversed'
export type Mode = 'free' | 'standard' | 'premium'
export type Position = 'past' | 'present' | 'future'
export type Step =
  | 'intro' | 'question' | 'preQuestions' | 'mode' | 'deck' | 'loading' | 'result'

// data/tarot-cards.json の1件
export type TarotCardData = {
  id: string
  name: string
  image: string       // MVPは空文字可(プレースホルダ描画)。後日実画像パス。
  upright: string
  reversed: string
  love: string
  work: string
  life: string
  money: string
  meaning: string
}

// ユーザーが選んだ札(選択順に past/present/future)
export type SelectedCard = {
  id: string
  name: string
  position: Position
  orientation: Orientation
}

// OpenAI が返す結果(7フィールド)
export type FortuneResultData = {
  summary: string
  past: string
  present: string
  future: string
  action: string
  warning: string
  finalMessage: string
}

// クライアント→ /api/tarot のリクエスト
export type TarotRequest = {
  question: string
  currentSituation: string
  trueFeeling: string
  idealFuture: string
  mode: Mode
  cards: { position: Position; name: string; orientation: Orientation }[]
}

export type TarotResponse =
  | { ok: true; result: FortuneResultData }
  | { ok: false; error: string; result?: FortuneResultData } // resultはフォールバック時

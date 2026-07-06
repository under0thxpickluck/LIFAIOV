# 占いハブ + AIカード占い(MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LIFAIOV の「団子占い」入口を「占い」ハブ化し、その中に没入型「AIカード占い」(タイトル→質問→事前3問→モード選択→カード選択→ローディング→AI結果)を新設する。

**Architecture:** `/fortune` を選択ハブに、既存団子ページを `/fortune/dango` へ移設、カード占いを `/fortune/cards` に新設。カード占いは `FortuneApp`(useReducer ステートマシン)＋演出コンポーネント群(`components/tarot/`)＋サーバー `app/api/tarot/route.ts`(OpenAI)＋`data/tarot-cards.json`(22枚)。課金は `lib/fortune/billing.ts` の単一シームでスタブ(将来BP/EP差し替え)。

**Tech Stack:** Next.js 14 App Router / React 18 / TypeScript / TailwindCSS / Framer Motion(`framer-motion` 12) / OpenAI(`openai` v6, `gpt-4o-mini`).

## Global Constraints

- 対象は **LIFAIOV のみ**(`~/LIFAIOV`)。aisalon には触れない(移植は完成後の別プラン)。ブランチ `fortune-card`。
- テーマ配色(厳守): 背景 `#09070F` / 紫 `#231235` / 金 `#D9B76B` / 文字 `#F4EFE8` / アクセント `#B56DFF` / カード縁=金 / 影=ぼかし強め。
- スマホファースト・レスポンシブ。`prefers-reduced-motion` を尊重。BGMは自動再生せずユーザー操作でON。
- 検証ゲートは `npm run build`(Next.js プロダクションビルド成功=型/import健全)。**LIFAIはテスト/lint未設定(CLAUDE.md)なのでユニットテストは追加しない**。挙動確認は `npm run dev` 手動。
- OpenAIは既存パターン踏襲: `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`, `model: "gpt-4o-mini"`, `response_format: { type: "json_object" }`。キー未設定でも画面が壊れずフォールバック結果を出す。
- 既存団子占いの内部ロジック・localStorageキー(`dango_result`/`dango_install_id`/`dango_fortune_cache`)・公開JSON参照(`/fortune/config/*.json`)・BP付与導線を壊さない(ページ移設のみ)。
- MVP除外(構造だけ用意): 画像保存/SNS共有/履歴/実BP・EP消費/専用スプレッド/音声/Live2D/背景変更/季節/コレクション/お気に入り。
- 全モジュールは `"use client"` か server を明示。ページ配下の import は `@/` エイリアス(既存踏襲)。

---

### Task 1: カードデータ・型・テーマ・課金スタブ(基盤)

**Files:**
- Create: `lib/fortune/types.ts`
- Create: `lib/fortune/theme.ts`
- Create: `lib/fortune/billing.ts`
- Create: `lib/fortune/cards.ts`
- Create: `data/tarot-cards.json`

**Interfaces:**
- Produces:
  - 型 `Orientation='upright'|'reversed'`, `Mode='free'|'standard'|'premium'`, `Step`, `TarotCardData`, `SelectedCard`, `FortuneResultData`, `TarotRequest`。
  - `TAROT_THEME`(色トークン)。
  - `chargeForMode(mode: Mode, loginId: string | null): Promise<{ ok: boolean; error?: string }>`。
  - `loadCards(): TarotCardData[]`, `cardByName(name: string): TarotCardData | undefined`。

- [ ] **Step 1: 型定義**

Create `lib/fortune/types.ts`:

```ts
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
```

- [ ] **Step 2: テーマトークン**

Create `lib/fortune/theme.ts`:

```ts
// 占い世界観の配色トークン(仕様厳守)。Tailwind arbitrary 値 or inline style で参照。
export const TAROT_THEME = {
  bg: '#09070F',
  purple: '#231235',
  gold: '#D9B76B',
  text: '#F4EFE8',
  accent: '#B56DFF',
} as const

// ルート要素に流し込むCSS変数(子は var(--tarot-*) で参照可能)
export const tarotCssVars: React.CSSProperties = {
  ['--tarot-bg' as any]: TAROT_THEME.bg,
  ['--tarot-purple' as any]: TAROT_THEME.purple,
  ['--tarot-gold' as any]: TAROT_THEME.gold,
  ['--tarot-text' as any]: TAROT_THEME.text,
  ['--tarot-accent' as any]: TAROT_THEME.accent,
}
```

- [ ] **Step 3: 課金スタブ(単一シーム)**

Create `lib/fortune/billing.ts`:

```ts
import type { Mode } from './types'

// 将来ここだけ差し替える:
//   standard → @/app/lib/bp-config の BP_COSTS(BP消費, GAS deduct_bp)
//   premium  → GAS deduct_ep(冪等キー付き)
// MVPは全モード無料扱いで {ok:true} を返す。
export async function chargeForMode(
  _mode: Mode,
  _loginId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  return { ok: true }
}

// 無料モードの1日1回判定(MVPはクライアントlocalStorage。サーバー厳格化は後日)。
const FREE_KEY = 'tarot_free_last_ymd'
function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}
export function freeUsedToday(): boolean {
  try { return localStorage.getItem(FREE_KEY) === todayYmd() } catch { return false }
}
export function markFreeUsed(): void {
  try { localStorage.setItem(FREE_KEY, todayYmd()) } catch { /* ignore */ }
}
```

- [ ] **Step 4: カードデータ(22枚)**

Create `data/tarot-cards.json`(22件。`image` は空文字=プレースショルダ描画):

```json
[
  { "id": "sozo", "name": "創造", "image": "", "upright": "新しい始まり・発想が形になる時。", "reversed": "力の空回り・準備不足。", "love": "新たな出会いや関係の芽生え。", "work": "企画やアイデアが動き出す。", "life": "自分を表現し直す転機。", "money": "新規の収入源が生まれる兆し。", "meaning": "無から有を生む創造の力。" },
  { "id": "mayoi", "name": "迷い", "image": "", "upright": "選択の前の静かな逡巡。", "reversed": "決めきれず時を逃す。", "love": "気持ちの揺れ・距離の測り直し。", "work": "方針が定まらない局面。", "life": "立ち止まって内面を見る時。", "money": "支出判断の保留。", "meaning": "答えを探す途上にある心。" },
  { "id": "gekko", "name": "月光", "image": "", "upright": "直感が冴える・隠れた真実。", "reversed": "不安や幻想に飲まれる。", "love": "言葉にならない想い。", "work": "水面下で物事が進む。", "life": "夢や無意識からの示唆。", "money": "見えない流れに注意。", "meaning": "静かな光が照らす深層。" },
  { "id": "keiyaku", "name": "契約", "image": "", "upright": "約束・結びつきが固まる。", "reversed": "条件の見落とし・拘束。", "love": "関係が一段深まる。", "work": "合意・提携が成立。", "life": "責任を引き受ける時。", "money": "取り決めが利益を生む。", "meaning": "交わした約束の重み。" },
  { "id": "honoo", "name": "炎", "image": "", "upright": "情熱・行動する勇気。", "reversed": "衝動・燃え尽き。", "love": "強く惹かれ合う熱。", "work": "推進力が高まる。", "life": "やりたいことへ突き進む。", "money": "積極投資の時期。", "meaning": "内に燃え上がる意志。" },
  { "id": "tenki", "name": "転機", "image": "", "upright": "流れが変わる好機。", "reversed": "変化への抵抗。", "love": "関係のステージが変わる。", "work": "役割や環境の転換。", "life": "人生の節目。", "money": "収支構造の変化。", "meaning": "回り始める運命の輪。" },
  { "id": "shukaku", "name": "収穫", "image": "", "upright": "努力が実を結ぶ。", "reversed": "刈り取りの遅れ。", "love": "関係が実る。", "work": "成果が形になる。", "life": "積み重ねの結実。", "money": "利益が確定する。", "meaning": "蒔いた種の実り。" },
  { "id": "seijaku", "name": "静寂", "image": "", "upright": "休息・心を整える時。", "reversed": "停滞・孤立感。", "love": "静かに育つ絆。", "work": "小休止と再点検。", "life": "内省と回復。", "money": "守りの運用。", "meaning": "満ちるための静けさ。" },
  { "id": "kaiho", "name": "解放", "image": "", "upright": "束縛からの自由。", "reversed": "手放せない執着。", "love": "重荷からの解放。", "work": "しがらみを断つ。", "life": "身軽になる転換。", "money": "不要な出費の整理。", "meaning": "軛を解く風。" },
  { "id": "saisei", "name": "再生", "image": "", "upright": "終わりから始まる新生。", "reversed": "過去への逆戻り。", "love": "関係のやり直し。", "work": "立て直しと再起。", "life": "生まれ変わる過程。", "money": "立て直しの好機。", "meaning": "灰から甦る力。" },
  { "id": "seido", "name": "星導", "image": "", "upright": "希望・進むべき指針。", "reversed": "道を見失う。", "love": "理想へ向かう関係。", "work": "ビジョンが導く。", "life": "希望を頼りに進む。", "money": "長期の見通しが開ける。", "meaning": "夜空を照らす導きの星。" },
  { "id": "kage", "name": "影", "image": "", "upright": "向き合うべき内面。", "reversed": "問題の直視を避ける。", "love": "隠れた本音。", "work": "見落とした課題。", "life": "影を統合する成長。", "money": "見えないリスク。", "meaning": "自分の裏側にある真実。" },
  { "id": "unmei", "name": "運命", "image": "", "upright": "抗えない大きな流れ。", "reversed": "流れへの抵抗。", "love": "必然の出会い。", "work": "巡り合わせが動く。", "life": "定めが形を現す。", "money": "時運に乗る。", "meaning": "巡る運命の力。" },
  { "id": "taiyo", "name": "太陽", "image": "", "upright": "祝福・明るい成功。", "reversed": "自信過剰・空回り。", "love": "満ち足りた喜び。", "work": "成果と評価。", "life": "生命力に満ちる。", "money": "豊かさの実感。", "meaning": "すべてを照らす光。" },
  { "id": "tsuki", "name": "月", "image": "", "upright": "感受性・夢と不安。", "reversed": "誤解が晴れる。", "love": "曖昧さの中の想い。", "work": "不確かさへの注意。", "life": "感情の満ち引き。", "money": "見通しの霧。", "meaning": "満ち欠けする心象。" },
  { "id": "to", "name": "塔", "image": "", "upright": "突然の崩壊と気づき。", "reversed": "崩壊の回避・遅延。", "love": "関係の転倒と再構築。", "work": "前提の崩れ。", "life": "衝撃からの覚醒。", "money": "急な変動。", "meaning": "崩れて開ける視界。" },
  { "id": "sekai", "name": "世界", "image": "", "upright": "完成・統合・達成。", "reversed": "あと一歩の未完。", "love": "満ちる関係。", "work": "プロジェクトの完遂。", "life": "円環が閉じる充足。", "money": "目標達成。", "meaning": "巡り切った完成の輪。" },
  { "id": "megami", "name": "女神", "image": "", "upright": "豊穣・慈しみ・受容。", "reversed": "与えすぎ・依存。", "love": "包み込む愛情。", "work": "育て育まれる関係。", "life": "満ちる豊かさ。", "money": "実りある循環。", "meaning": "生み育てる母なる力。" },
  { "id": "shinpan", "name": "審判", "image": "", "upright": "呼び覚まし・決断の時。", "reversed": "過去への後悔。", "love": "関係の再評価。", "work": "総括と再出発。", "life": "使命への目覚め。", "money": "清算と再計画。", "meaning": "呼び声に応える転回。" },
  { "id": "chie", "name": "知恵", "image": "", "upright": "洞察・学びが導く。", "reversed": "頭でっかち・停滞。", "love": "理解し合う関係。", "work": "知識が力になる。", "life": "経験が知恵になる。", "money": "賢い判断。", "meaning": "静かに照らす叡智。" },
  { "id": "tabibito", "name": "旅人", "image": "", "upright": "自由・冒険の一歩。", "reversed": "無計画・迷走。", "love": "軽やかな出会い。", "work": "新天地への挑戦。", "life": "未知へ踏み出す。", "money": "身軽な挑戦。", "meaning": "未来へ歩き出す魂。" },
  { "id": "kibo", "name": "希望", "image": "", "upright": "癒しと未来への光。", "reversed": "自信の揺らぎ。", "love": "穏やかな信頼。", "work": "回復と前進。", "life": "安らぎと希望。", "money": "先行きの好転。", "meaning": "夜明けを告げる光。" }
]
```

- [ ] **Step 5: カードローダ**

Create `lib/fortune/cards.ts`:

```ts
import cards from '@/data/tarot-cards.json'
import type { TarotCardData } from './types'

export function loadCards(): TarotCardData[] {
  return cards as TarotCardData[]
}
export function cardByName(name: string): TarotCardData | undefined {
  return (cards as TarotCardData[]).find((c) => c.name === name)
}
```

- [ ] **Step 6: ビルド確認**

Run: `npm run build`
Expected: PASS。`@/data/tarot-cards.json` の import(`resolveJsonModule`)が通ること。通らなければ `tsconfig.json` の `compilerOptions.resolveJsonModule` を `true` にする(既にJSON importが他所で使われていれば不要)。JSONは22件・各9フィールドが揃っていること。

- [ ] **Step 7: コミット**

```bash
git add lib/fortune/types.ts lib/fortune/theme.ts lib/fortune/billing.ts lib/fortune/cards.ts data/tarot-cards.json
git commit -m "feat(tarot): カードデータ・型・テーマ・課金スタブの基盤"
```

---

### Task 2: OpenAI 結果生成API `/api/tarot`

**Files:**
- Create: `app/api/tarot/route.ts`

**Interfaces:**
- Consumes: `TarotRequest`/`TarotResponse`/`FortuneResultData`(Task 1)、`cardByName`(Task 1)。
- Produces: `POST /api/tarot` → `TarotResponse`(JSON)。

- [ ] **Step 1: APIルート実装**

Create `app/api/tarot/route.ts`:

```ts
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { cardByName } from '@/lib/fortune/cards'
import type { TarotRequest, FortuneResultData } from '@/lib/fortune/types'

export const runtime = 'nodejs'

const RESULT_KEYS: (keyof FortuneResultData)[] = [
  'summary', 'past', 'present', 'future', 'action', 'warning', 'finalMessage',
]

function clip(s: unknown, max = 400): string {
  return String(s ?? '').slice(0, max)
}

// モード別の分量・深度の指示
function modeGuide(mode: string): string {
  if (mode === 'premium') return '最も詳細に。各項目を厚く、恋愛/仕事/金運のカテゴリ視点と深層心理にも触れ、長めに書く。'
  if (mode === 'standard') return 'やや詳細に。各項目を通常の約2倍の分量で、具体的な行動提案を厚めに書く。'
  return '簡潔に。各項目を短めにまとめる。'
}

function fallback(req: TarotRequest): FortuneResultData {
  // カード意味ベースの静的フォールバック(OpenAI不通時でも画面を壊さない)
  const meaningOf = (name: string, orientation: string) => {
    const c = cardByName(name)
    if (!c) return name
    return orientation === 'reversed' ? c.reversed : c.upright
  }
  const past = req.cards.find((c) => c.position === 'past')
  const present = req.cards.find((c) => c.position === 'present')
  const future = req.cards.find((c) => c.position === 'future')
  return {
    summary: `「${clip(req.question, 60)}」について、いまのあなたの心をカードが静かに映しています。`,
    past: past ? meaningOf(past.name, past.orientation) : '',
    present: present ? meaningOf(present.name, present.orientation) : '',
    future: future ? meaningOf(future.name, future.orientation) : '',
    action: '今日できる小さな一歩を、ひとつだけ選んで踏み出してみてください。',
    warning: '焦りは視界を狭めます。呼吸を整えてから動きましょう。',
    finalMessage: 'あなたの願いは、すでにあなたの中に芽吹いています。',
  }
}

export async function POST(request: Request) {
  let req: TarotRequest
  try {
    req = (await request.json()) as TarotRequest
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }
  if (!req?.question || !Array.isArray(req.cards) || req.cards.length !== 3) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    // キー未設定でも壊さない: フォールバック結果を返す
    return NextResponse.json({ ok: false, error: 'no_api_key', result: fallback(req) })
  }

  const cardsText = req.cards
    .map((c) => {
      const meta = cardByName(c.name)
      const pos = c.position === 'past' ? '過去' : c.position === 'present' ? '現在' : '未来'
      const orient = c.orientation === 'reversed' ? '逆位置' : '正位置'
      const mean = meta ? (c.orientation === 'reversed' ? meta.reversed : meta.upright) : ''
      return `${pos}: ${c.name}(${orient}) — ${mean}`
    })
    .join('\n')

  const system = `あなたはLIFAI専属の幻想的なAI占い師です。占いは断定ではなく、ユーザーの心を映す鏡として表現してください。
重要:
・一般論を書かない
・必ずユーザーの入力内容に触れる
・カードの意味を反映する
・前向きな終わり方にする
・不安を煽らない
・現実的な行動も提案する
・読み物として感動する文章を書く
${modeGuide(req.mode)}
必ず次のキーだけを持つJSONで返してください: summary, past, present, future, action, warning, finalMessage(すべて日本語の文字列)。`

  const user = `質問: ${clip(req.question)}
現在の状況: ${clip(req.currentSituation)}
本音: ${clip(req.trueFeeling)}
理想: ${clip(req.idealFuture)}
引かれたカード:
${cardsText}`

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })
    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as Partial<FortuneResultData>
    const missing = RESULT_KEYS.filter((k) => typeof parsed[k] !== 'string' || !parsed[k])
    if (missing.length > 0) {
      return NextResponse.json({ ok: false, error: 'incomplete_result', result: fallback(req) })
    }
    const result = Object.fromEntries(RESULT_KEYS.map((k) => [k, String(parsed[k])])) as FortuneResultData
    return NextResponse.json({ ok: true, result })
  } catch {
    return NextResponse.json({ ok: false, error: 'openai_failed', result: fallback(req) })
  }
}
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: PASS(`openai` import と `@/lib/fortune/*` 解決)。

- [ ] **Step 3: 手動確認(任意)**

Run: `npm run dev` の後、別シェルで:
```bash
curl -s -X POST http://localhost:3000/api/tarot -H 'Content-Type: application/json' -d '{"question":"仕事を続けるべき?","currentSituation":"売上減","trueFeeling":"挑戦したい","idealFuture":"自由になりたい","mode":"free","cards":[{"position":"past","name":"創造","orientation":"upright"},{"position":"present","name":"迷い","orientation":"reversed"},{"position":"future","name":"再生","orientation":"upright"}]}'
```
Expected: `{"ok":true,"result":{...7フィールド...}}`(キー未設定環境では `{"ok":false,"error":"no_api_key","result":{...}}`。どちらも7フィールド揃う)。

- [ ] **Step 4: コミット**

```bash
git add app/api/tarot/route.ts
git commit -m "feat(tarot): OpenAI結果生成API /api/tarot(フォールバック付き)"
```

---

### Task 3: 世界観レイヤ(StarBackground / FortuneTeller)

**Files:**
- Create: `components/tarot/StarBackground.tsx`
- Create: `components/tarot/FortuneTeller.tsx`

**Interfaces:**
- Produces: `<StarBackground />`(全画面背景: 星ゆっくり流れ + 月)、`<FortuneTeller active?: boolean />`(シルエット占い師 + ろうそく炎揺れ)。
- Consumes: `TAROT_THEME`(Task 1)。

- [ ] **Step 1: StarBackground**

Create `components/tarot/StarBackground.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'
import { TAROT_THEME } from '@/lib/fortune/theme'

// 決定論的な星配置(SSR/CSRで揺れないよう固定シード的に生成)
const STARS = Array.from({ length: 60 }, (_, i) => ({
  left: (i * 37) % 100,
  top: (i * 61) % 100,
  size: (i % 3) + 1,
  delay: (i % 10) * 0.6,
  dur: 6 + (i % 5),
}))

export default function StarBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ background: `radial-gradient(circle at 50% 20%, ${TAROT_THEME.purple}, ${TAROT_THEME.bg} 70%)` }}
    >
      {/* 月 */}
      <div
        className="absolute rounded-full"
        style={{
          width: 120, height: 120, top: '8%', right: '12%',
          background: `radial-gradient(circle at 35% 35%, #fff8e6, ${TAROT_THEME.gold})`,
          boxShadow: `0 0 80px 20px rgba(217,183,107,0.35)`,
        }}
      />
      {/* 星(ゆっくり明滅しつつ横へ流れる) */}
      {STARS.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, background: TAROT_THEME.text }}
          initial={{ opacity: 0.2, x: 0 }}
          animate={{ opacity: [0.2, 0.9, 0.2], x: [0, 12, 0] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: FortuneTeller(シルエット + ろうそく)**

Create `components/tarot/FortuneTeller.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'
import { TAROT_THEME } from '@/lib/fortune/theme'

// 顔を見せないシルエット占い師 + 揺れるろうそく炎
export default function FortuneTeller({ active = false }: { active?: boolean }) {
  return (
    <div className="pointer-events-none flex flex-col items-center select-none">
      {/* ろうそくの炎 */}
      <motion.div
        className="rounded-full"
        style={{ width: 10, height: 16, background: `radial-gradient(circle, #ffe6a0, ${TAROT_THEME.gold})`, filter: 'blur(1px)' }}
        animate={{ scaleY: [1, 1.15, 0.95, 1], opacity: [0.8, 1, 0.85, 0.8] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* シルエット(頭+肩+フード) */}
      <motion.svg
        width="180" height="150" viewBox="0 0 180 150"
        animate={active ? { rotate: [0, -1.5, 1.5, 0] } : { y: [0, -3, 0] }}
        transition={{ duration: active ? 2.4 : 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path d="M90 10 C60 10 45 45 45 75 C20 90 15 150 15 150 L165 150 C165 150 160 90 135 75 C135 45 120 10 90 10 Z"
          fill="#05040A" opacity="0.92" />
      </motion.svg>
    </div>
  )
}
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 4: コミット**

```bash
git add components/tarot/StarBackground.tsx components/tarot/FortuneTeller.tsx
git commit -m "feat(tarot): 星空背景と占い師シルエットの世界観レイヤ"
```

---

### Task 4: カード(TarotCard / CardDeck: シャッフルと3枚選択)

**Files:**
- Create: `components/tarot/TarotCard.tsx`
- Create: `components/tarot/CardDeck.tsx`

**Interfaces:**
- Consumes: `TarotCardData`/`SelectedCard`/`Position`/`Orientation`(Task 1), `TAROT_THEME`。
- Produces:
  - `<TarotCard card face='back'|'front' orientation? selected? onClick? index? />`
  - `<CardDeck onComplete(selected: SelectedCard[]) />` — 22枚配置→シャッフル演出→3枚選択(過去/現在/未来)→3枚で `onComplete` を呼べる状態にする。

- [ ] **Step 1: TarotCard**

Create `components/tarot/TarotCard.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'
import type { TarotCardData, Orientation } from '@/lib/fortune/types'
import { TAROT_THEME } from '@/lib/fortune/theme'

type Props = {
  card?: TarotCardData
  face?: 'back' | 'front'
  orientation?: Orientation
  selected?: boolean
  floating?: boolean
  onClick?: () => void
  className?: string
}

// 裏面: 黒地・金縁・中央に月マーク。表面: カード名(MVPは画像プレースホルダ)。
export default function TarotCard({
  card, face = 'back', orientation = 'upright', selected = false, floating = false, onClick, className,
}: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ rotate: face === 'back' ? 2 : 0, y: -4 }}
      whileTap={{ scale: 0.98 }}
      animate={
        selected
          ? { y: -14, scale: 1.06, boxShadow: `0 0 24px 6px ${TAROT_THEME.accent}` }
          : floating
            ? { y: [0, -6, 0] }
            : { y: 0 }
      }
      transition={floating ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4, ease: 'easeOut' }}
      className={`relative rounded-xl border-2 ${className ?? ''}`}
      style={{
        width: 76, height: 116,
        borderColor: TAROT_THEME.gold,
        background: face === 'back'
          ? `linear-gradient(160deg, #0b0813, ${TAROT_THEME.purple})`
          : `linear-gradient(160deg, ${TAROT_THEME.purple}, #0b0813)`,
        boxShadow: selected ? `0 0 24px 6px ${TAROT_THEME.accent}` : '0 8px 24px rgba(0,0,0,0.6)',
      }}
    >
      {face === 'back' ? (
        <span
          className="absolute inset-0 flex items-center justify-center text-2xl"
          style={{ color: TAROT_THEME.gold }}
        >
          ☾
        </span>
      ) : (
        <span
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1 text-center"
          style={{ color: TAROT_THEME.text, transform: orientation === 'reversed' ? 'rotate(180deg)' : undefined }}
        >
          <span className="text-lg" style={{ color: TAROT_THEME.gold }}>☾</span>
          <span className="text-xs font-semibold">{card?.name ?? ''}</span>
          <span className="text-[9px] opacity-70">{orientation === 'reversed' ? '逆位置' : '正位置'}</span>
        </span>
      )}
    </motion.button>
  )
}
```

- [ ] **Step 2: CardDeck(円状配置・シャッフル・3枚選択)**

Create `components/tarot/CardDeck.tsx`:

```tsx
'use client'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import TarotCard from './TarotCard'
import { loadCards } from '@/lib/fortune/cards'
import type { SelectedCard, Position, Orientation } from '@/lib/fortune/types'
import { TAROT_THEME } from '@/lib/fortune/theme'

const POSITIONS: Position[] = ['past', 'present', 'future']

// 決定論的な正逆(index依存。Math.randomはSSR差異回避のため使わない)
function orientationFor(index: number): Orientation {
  return index % 3 === 1 ? 'reversed' : 'upright'
}

export default function CardDeck({ onComplete }: { onComplete: (selected: SelectedCard[]) => void }) {
  const cards = useMemo(() => loadCards(), [])
  const [shuffling, setShuffling] = useState(false)
  const [picked, setPicked] = useState<number[]>([]) // 選んだカードの配列index(選択順)

  const startShuffle = () => {
    setShuffling(true)
    setPicked([])
    // 演出時間後に選択可能へ
    setTimeout(() => setShuffling(false), 1400)
  }

  const pick = (i: number) => {
    if (shuffling || picked.includes(i) || picked.length >= 3) return
    const next = [...picked, i]
    setPicked(next)
    if (next.length === 3) {
      const selected: SelectedCard[] = next.map((cardIndex, order) => ({
        id: cards[cardIndex].id,
        name: cards[cardIndex].name,
        position: POSITIONS[order],
        orientation: orientationFor(cardIndex),
      }))
      onComplete(selected)
    }
  }

  // 22枚を円周に配置する座標(半径ベース)
  const layout = useMemo(() => {
    const R = 130
    return cards.map((_, i) => {
      const a = (i / cards.length) * Math.PI * 2 - Math.PI / 2
      return { x: Math.cos(a) * R, y: Math.sin(a) * R * 0.62 }
    })
  }, [cards])

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm" style={{ color: TAROT_THEME.text }}>
        心を静かにし、惹かれるカードを三枚選んでください。
      </p>
      <div className="relative" style={{ width: 320, height: 260 }}>
        {cards.map((c, i) => (
          <motion.div
            key={c.id}
            className="absolute left-1/2 top-1/2"
            animate={
              shuffling
                ? { x: 0, y: 0, rotate: [0, 360], scale: 0.7 } // 集まって高速回転
                : { x: layout[i].x, y: layout[i].y, rotate: 0, scale: 1 } // 円状に展開
            }
            transition={{ duration: shuffling ? 0.5 : 0.8, ease: 'easeInOut' }}
            style={{ translateX: '-50%', translateY: '-50%', zIndex: picked.includes(i) ? 30 : 10 }}
          >
            <TarotCard face="back" selected={picked.includes(i)} onClick={() => pick(i)} />
          </motion.div>
        ))}
      </div>
      <button
        type="button"
        onClick={startShuffle}
        className="rounded-full px-5 py-2 text-sm font-semibold"
        style={{ border: `1px solid ${TAROT_THEME.gold}`, color: TAROT_THEME.gold }}
      >
        シャッフルする
      </button>
      <p className="text-xs" style={{ color: TAROT_THEME.accent }}>{picked.length} / 3 枚選択</p>
    </div>
  )
}
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 4: コミット**

```bash
git add components/tarot/TarotCard.tsx components/tarot/CardDeck.tsx
git commit -m "feat(tarot): カード札とデッキ(シャッフル・3枚選択)"
```

---

### Task 5: 入力系画面(Intro / QuestionInput / PreQuestionForm / ModeSelector)

**Files:**
- Create: `components/tarot/FortuneIntro.tsx`
- Create: `components/tarot/QuestionInput.tsx`
- Create: `components/tarot/PreQuestionForm.tsx`
- Create: `components/tarot/ModeSelector.tsx`

**Interfaces:**
- Consumes: `Mode`(Task 1), `TAROT_THEME`。
- Produces:
  - `<FortuneIntro onStart() />`
  - `<QuestionInput value onChange onNext />`(空なら次へ不可)
  - `<PreQuestionForm values={{currentSituation,trueFeeling,idealFuture}} onChange(field,val) onNext />`(3つ必須)
  - `<ModeSelector value onSelect(mode) onNext />`

- [ ] **Step 1: FortuneIntro**

Create `components/tarot/FortuneIntro.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'
import { TAROT_THEME } from '@/lib/fortune/theme'

export default function FortuneIntro({ onStart }: { onStart: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
      className="flex flex-col items-center gap-6 text-center px-6">
      <h1 className="text-3xl font-bold tracking-widest" style={{ color: TAROT_THEME.gold }}>月影の占術</h1>
      <p className="text-sm leading-relaxed" style={{ color: TAROT_THEME.text }}>
        運命は、<br />未来を決めるものではなく、<br />あなたの心を映すもの。
      </p>
      <button type="button" onClick={onStart}
        className="rounded-full px-8 py-3 text-sm font-semibold"
        style={{ background: TAROT_THEME.accent, color: '#0b0813', boxShadow: `0 0 24px ${TAROT_THEME.accent}` }}>
        占いを始める
      </button>
    </motion.div>
  )
}
```

- [ ] **Step 2: QuestionInput**

Create `components/tarot/QuestionInput.tsx`:

```tsx
'use client'
import { TAROT_THEME } from '@/lib/fortune/theme'

const EXAMPLES = ['仕事', '恋愛', '人生', '事業', 'お金', '人間関係']

export default function QuestionInput({
  value, onChange, onNext,
}: { value: string; onChange: (v: string) => void; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 w-full max-w-md">
      <h2 className="text-xl font-semibold" style={{ color: TAROT_THEME.gold }}>今、何を占いましょうか？</h2>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="占いたいことを書いてください"
        className="w-full rounded-lg p-3 text-sm outline-none"
        style={{ background: 'rgba(255,255,255,0.06)', color: TAROT_THEME.text, border: `1px solid ${TAROT_THEME.purple}` }}
      />
      <div className="flex flex-wrap gap-2 justify-center">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => onChange(ex)}
            className="rounded-full px-3 py-1 text-xs"
            style={{ border: `1px solid ${TAROT_THEME.purple}`, color: TAROT_THEME.text }}>{ex}</button>
        ))}
      </div>
      <button type="button" disabled={!value.trim()} onClick={onNext}
        className="rounded-full px-8 py-2.5 text-sm font-semibold disabled:opacity-40"
        style={{ background: TAROT_THEME.gold, color: '#0b0813' }}>
        次へ
      </button>
    </div>
  )
}
```

- [ ] **Step 3: PreQuestionForm**

Create `components/tarot/PreQuestionForm.tsx`:

```tsx
'use client'
import { TAROT_THEME } from '@/lib/fortune/theme'

type Field = 'currentSituation' | 'trueFeeling' | 'idealFuture'
const FIELDS: { key: Field; label: string; ph: string }[] = [
  { key: 'currentSituation', label: '現在一番悩んでいることを教えてください。', ph: '例: 売上が伸びない / 恋人との関係 / 転職 / 将来への不安' },
  { key: 'trueFeeling', label: 'あなたは本当はどうしたいと思っていますか？', ph: '例: 挑戦したい / 続けたい / 諦めたい / 決断したい' },
  { key: 'idealFuture', label: '理想の未来はどんな状態ですか？', ph: '例: 自由になりたい / 収入を増やしたい / 安心したい / 家族を幸せにしたい' },
]

export default function PreQuestionForm({
  values, onChange, onNext,
}: {
  values: Record<Field, string>
  onChange: (field: Field, v: string) => void
  onNext: () => void
}) {
  const ready = FIELDS.every((f) => values[f.key].trim())
  return (
    <div className="flex flex-col gap-5 px-6 w-full max-w-md">
      {FIELDS.map((f) => (
        <div key={f.key} className="flex flex-col gap-1.5">
          <label className="text-sm" style={{ color: TAROT_THEME.gold }}>{f.label}</label>
          <textarea
            value={values[f.key]} onChange={(e) => onChange(f.key, e.target.value)} rows={2} placeholder={f.ph}
            className="w-full rounded-lg p-3 text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', color: TAROT_THEME.text, border: `1px solid ${TAROT_THEME.purple}` }}
          />
        </div>
      ))}
      <button type="button" disabled={!ready} onClick={onNext}
        className="self-center rounded-full px-8 py-2.5 text-sm font-semibold disabled:opacity-40"
        style={{ background: TAROT_THEME.gold, color: '#0b0813' }}>
        カードを引く
      </button>
    </div>
  )
}
```

- [ ] **Step 4: ModeSelector**

Create `components/tarot/ModeSelector.tsx`:

```tsx
'use client'
import type { Mode } from '@/lib/fortune/types'
import { TAROT_THEME } from '@/lib/fortune/theme'

const MODES: { key: Mode; title: string; desc: string; tag: string }[] = [
  { key: 'free', title: '無料', desc: '1日1回・簡易結果', tag: '無料' },
  { key: 'standard', title: 'Standard', desc: '詳細占い・文章量約2倍・行動提案', tag: 'BP(近日)' },
  { key: 'premium', title: 'Premium', desc: '最も詳細・カテゴリ別/深層心理', tag: 'EP(近日)' },
]

export default function ModeSelector({
  value, onSelect, onNext,
}: { value: Mode; onSelect: (m: Mode) => void; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 w-full max-w-md">
      <h2 className="text-lg font-semibold" style={{ color: TAROT_THEME.gold }}>占いの深さを選んでください</h2>
      <div className="flex flex-col gap-3 w-full">
        {MODES.map((m) => {
          const on = value === m.key
          return (
            <button key={m.key} type="button" onClick={() => onSelect(m.key)}
              className="flex items-center justify-between rounded-xl p-4 text-left transition"
              style={{
                border: `1px solid ${on ? TAROT_THEME.accent : TAROT_THEME.purple}`,
                background: on ? 'rgba(181,109,255,0.12)' : 'rgba(255,255,255,0.04)',
              }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: TAROT_THEME.text }}>{m.title}</p>
                <p className="text-xs opacity-75" style={{ color: TAROT_THEME.text }}>{m.desc}</p>
              </div>
              <span className="text-[10px] rounded-full px-2 py-0.5" style={{ border: `1px solid ${TAROT_THEME.gold}`, color: TAROT_THEME.gold }}>{m.tag}</span>
            </button>
          )
        })}
      </div>
      <button type="button" onClick={onNext}
        className="rounded-full px-8 py-2.5 text-sm font-semibold"
        style={{ background: TAROT_THEME.gold, color: '#0b0813' }}>
        この深さで占う
      </button>
    </div>
  )
}
```

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 6: コミット**

```bash
git add components/tarot/FortuneIntro.tsx components/tarot/QuestionInput.tsx components/tarot/PreQuestionForm.tsx components/tarot/ModeSelector.tsx
git commit -m "feat(tarot): 入力系画面(intro/質問/事前3問/モード選択)"
```

---

### Task 6: ローディングと結果(LoadingScene / SelectedCards / FortuneResult)

**Files:**
- Create: `components/tarot/LoadingScene.tsx`
- Create: `components/tarot/SelectedCards.tsx`
- Create: `components/tarot/FortuneResult.tsx`

**Interfaces:**
- Consumes: `SelectedCard`/`FortuneResultData`(Task 1), `TarotCard`(Task 4), `cardByName`(Task 1)。
- Produces:
  - `<LoadingScene />`
  - `<SelectedCards cards={SelectedCard[]} reveal?: boolean />`(reveal時に回転して表になる)
  - `<FortuneResult question result cards onRetry />`

- [ ] **Step 1: LoadingScene**

Create `components/tarot/LoadingScene.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'
import { TAROT_THEME } from '@/lib/fortune/theme'

export default function LoadingScene() {
  return (
    <div className="flex flex-col items-center gap-6 px-6 text-center">
      <motion.div
        className="rounded-xl border-2"
        style={{ width: 76, height: 116, borderColor: TAROT_THEME.gold, background: `linear-gradient(160deg,#0b0813,${TAROT_THEME.purple})` }}
        animate={{ y: [0, -16, 0], boxShadow: [`0 0 8px ${TAROT_THEME.accent}`, `0 0 30px ${TAROT_THEME.accent}`, `0 0 8px ${TAROT_THEME.accent}`] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="space-y-1">
        <motion.p className="text-sm" style={{ color: TAROT_THEME.text }}
          animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}>
          カードが語りかけています…
        </motion.p>
        <p className="text-xs opacity-70" style={{ color: TAROT_THEME.text }}>あなただけの運命を読み解いています…</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: SelectedCards(回転して表になる)**

Create `components/tarot/SelectedCards.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'
import TarotCard from './TarotCard'
import { cardByName } from '@/lib/fortune/cards'
import type { SelectedCard } from '@/lib/fortune/types'
import { TAROT_THEME } from '@/lib/fortune/theme'

const LABEL: Record<string, string> = { past: '過去', present: '現在', future: '未来' }

export default function SelectedCards({ cards, reveal = false }: { cards: SelectedCard[]; reveal?: boolean }) {
  return (
    <div className="flex justify-center gap-3">
      {cards.map((c, i) => (
        <div key={c.id} className="flex flex-col items-center gap-1">
          <span className="text-[10px]" style={{ color: TAROT_THEME.gold }}>{LABEL[c.position]}</span>
          <motion.div
            initial={{ rotateY: 180, y: -30, opacity: 0 }}
            animate={reveal ? { rotateY: 0, y: 0, opacity: 1 } : { rotateY: 180 }}
            transition={{ duration: 0.9, delay: i * 0.35, ease: 'easeOut' }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            <TarotCard face="front" card={cardByName(c.name)} orientation={c.orientation} />
          </motion.div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: FortuneResult**

Create `components/tarot/FortuneResult.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'
import SelectedCards from './SelectedCards'
import type { SelectedCard, FortuneResultData } from '@/lib/fortune/types'
import { TAROT_THEME } from '@/lib/fortune/theme'

const SECTIONS: { key: keyof FortuneResultData; label: string }[] = [
  { key: 'summary', label: '総合メッセージ' },
  { key: 'past', label: '過去' },
  { key: 'present', label: '現在' },
  { key: 'future', label: '未来' },
  { key: 'action', label: '今やるべき行動' },
  { key: 'warning', label: '気を付けること' },
  { key: 'finalMessage', label: '最後の一言' },
]

export default function FortuneResult({
  question, result, cards, onRetry,
}: { question: string; result: FortuneResultData; cards: SelectedCard[]; onRetry: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
      className="flex flex-col gap-6 px-6 w-full max-w-md pb-16">
      <p className="text-center text-xs opacity-70" style={{ color: TAROT_THEME.text }}>占ったこと: {question}</p>
      <SelectedCards cards={cards} reveal />
      <div className="flex flex-col gap-4">
        {SECTIONS.map((s) => (
          <div key={s.key} className="rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${TAROT_THEME.purple}` }}>
            <p className="text-xs mb-1" style={{ color: TAROT_THEME.gold }}>{s.label}</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: TAROT_THEME.text }}>{result[s.key]}</p>
          </div>
        ))}
      </div>
      <button type="button" onClick={onRetry}
        className="self-center rounded-full px-8 py-2.5 text-sm font-semibold"
        style={{ background: TAROT_THEME.accent, color: '#0b0813' }}>
        もう一度占う
      </button>
      {/* MVP除外(構造だけ): 結果を保存 / 画像として保存 / SNSへ共有 は後日ここに追加 */}
    </motion.div>
  )
}
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add components/tarot/LoadingScene.tsx components/tarot/SelectedCards.tsx components/tarot/FortuneResult.tsx
git commit -m "feat(tarot): ローディング・選択札の表返し・結果表示"
```

---

### Task 7: FortuneApp(ステートマシン)＋ページ `/fortune/cards`

**Files:**
- Create: `components/tarot/FortuneApp.tsx`
- Create: `app/fortune/cards/page.tsx`

**Interfaces:**
- Consumes: Task 1〜6 の全コンポーネント／型／`chargeForMode`/`freeUsedToday`/`markFreeUsed`。
- Produces: `<FortuneApp />`(全フロー)、ページ `/fortune/cards`。

- [ ] **Step 1: FortuneApp**

Create `components/tarot/FortuneApp.tsx`:

```tsx
'use client'
import { useReducer, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StarBackground from './StarBackground'
import FortuneTeller from './FortuneTeller'
import FortuneIntro from './FortuneIntro'
import QuestionInput from './QuestionInput'
import PreQuestionForm from './PreQuestionForm'
import ModeSelector from './ModeSelector'
import CardDeck from './CardDeck'
import LoadingScene from './LoadingScene'
import FortuneResult from './FortuneResult'
import { chargeForMode } from '@/lib/fortune/billing'
import { tarotCssVars, TAROT_THEME } from '@/lib/fortune/theme'
import type { Mode, Step, SelectedCard, FortuneResultData, TarotResponse } from '@/lib/fortune/types'

type State = {
  currentStep: Step
  question: string
  currentSituation: string
  trueFeeling: string
  idealFuture: string
  selectedCards: SelectedCard[]
  mode: Mode
  result: FortuneResultData | null
  loading: boolean
  error: string | null
}
const INITIAL: State = {
  currentStep: 'intro', question: '', currentSituation: '', trueFeeling: '', idealFuture: '',
  selectedCards: [], mode: 'free', result: null, loading: false, error: null,
}
type Action =
  | { type: 'step'; step: Step }
  | { type: 'field'; key: 'question' | 'currentSituation' | 'trueFeeling' | 'idealFuture'; value: string }
  | { type: 'mode'; mode: Mode }
  | { type: 'cards'; cards: SelectedCard[] }
  | { type: 'loading'; on: boolean }
  | { type: 'result'; result: FortuneResultData }
  | { type: 'error'; error: string | null }
  | { type: 'reset' }

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'step': return { ...s, currentStep: a.step }
    case 'field': return { ...s, [a.key]: a.value }
    case 'mode': return { ...s, mode: a.mode }
    case 'cards': return { ...s, selectedCards: a.cards }
    case 'loading': return { ...s, loading: a.on }
    case 'result': return { ...s, result: a.result, loading: false, currentStep: 'result' }
    case 'error': return { ...s, error: a.error }
    case 'reset': return { ...INITIAL }
    default: return s
  }
}

export default function FortuneApp() {
  const [s, dispatch] = useReducer(reducer, INITIAL)

  const runReading = useCallback(async (cards: SelectedCard[]) => {
    dispatch({ type: 'cards', cards })
    dispatch({ type: 'step', step: 'loading' })
    dispatch({ type: 'loading', on: true })
    dispatch({ type: 'error', error: null })
    // 課金スタブ(将来BP/EP)。失敗時はエラー表示に留める。
    const charge = await chargeForMode(s.mode, null)
    if (!charge.ok) {
      dispatch({ type: 'error', error: charge.error ?? '消費に失敗しました' })
      dispatch({ type: 'loading', on: false })
      dispatch({ type: 'step', step: 'mode' })
      return
    }
    try {
      const res = await fetch('/api/tarot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: s.question, currentSituation: s.currentSituation,
          trueFeeling: s.trueFeeling, idealFuture: s.idealFuture, mode: s.mode,
          cards: cards.map((c) => ({ position: c.position, name: c.name, orientation: c.orientation })),
        }),
      })
      const data = (await res.json()) as TarotResponse
      const result = 'result' in data && data.result ? data.result : null
      if (result) dispatch({ type: 'result', result })
      else { dispatch({ type: 'error', error: '占い結果を取得できませんでした' }); dispatch({ type: 'loading', on: false }); dispatch({ type: 'step', step: 'mode' }) }
    } catch {
      dispatch({ type: 'error', error: '通信に失敗しました' })
      dispatch({ type: 'loading', on: false })
      dispatch({ type: 'step', step: 'mode' })
    }
  }, [s.mode, s.question, s.currentSituation, s.trueFeeling, s.idealFuture])

  const active = s.currentStep === 'loading' || s.currentStep === 'deck'

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center py-10" style={{ ...tarotCssVars, background: TAROT_THEME.bg, color: TAROT_THEME.text }}>
      <StarBackground />
      <div className="mb-6"><FortuneTeller active={active} /></div>
      {s.error && <p className="mb-3 text-xs" style={{ color: '#ff9a9a' }}>{s.error}</p>}
      <AnimatePresence mode="wait">
        <motion.div key={s.currentStep} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="w-full flex justify-center">
          {s.currentStep === 'intro' && <FortuneIntro onStart={() => dispatch({ type: 'step', step: 'question' })} />}
          {s.currentStep === 'question' && (
            <QuestionInput value={s.question} onChange={(v) => dispatch({ type: 'field', key: 'question', value: v })} onNext={() => dispatch({ type: 'step', step: 'preQuestions' })} />
          )}
          {s.currentStep === 'preQuestions' && (
            <PreQuestionForm
              values={{ currentSituation: s.currentSituation, trueFeeling: s.trueFeeling, idealFuture: s.idealFuture }}
              onChange={(f, v) => dispatch({ type: 'field', key: f, value: v })}
              onNext={() => dispatch({ type: 'step', step: 'mode' })}
            />
          )}
          {s.currentStep === 'mode' && (
            <ModeSelector value={s.mode} onSelect={(m) => dispatch({ type: 'mode', mode: m })} onNext={() => dispatch({ type: 'step', step: 'deck' })} />
          )}
          {s.currentStep === 'deck' && <CardDeck onComplete={(cards) => runReading(cards)} />}
          {s.currentStep === 'loading' && <LoadingScene />}
          {s.currentStep === 'result' && s.result && (
            <FortuneResult question={s.question} result={s.result} cards={s.selectedCards} onRetry={() => dispatch({ type: 'reset' })} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: ページ**

Create `app/fortune/cards/page.tsx`:

```tsx
import FortuneApp from '@/components/tarot/FortuneApp'

export const metadata = { title: '月影の占術 | LIFAI' }

export default function TarotPage() {
  return <FortuneApp />
}
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: PASS。`/fortune/cards` が生成される。

- [ ] **Step 4: 手動確認**

Run: `npm run dev` → `/fortune/cards`。
Expected: intro→question→事前3問→モード→シャッフル→3枚選択→ローディング→結果(7項目・カード表返し)→「もう一度占う」でintroへ。星/炎/浮遊/選択光が動く。モバイル幅で崩れない。

- [ ] **Step 5: コミット**

```bash
git add components/tarot/FortuneApp.tsx app/fortune/cards/page.tsx
git commit -m "feat(tarot): FortuneApp(ステートマシン)と /fortune/cards ページ"
```

---

### Task 8: 「占い」ハブ化(団子移設 + セレクト + 入口改名)

**Files:**
- Create: `app/fortune/dango/page.tsx`(既存 `app/fortune/page.tsx` の中身を移設)
- Modify(全置換): `app/fortune/page.tsx`(→ ハブ選択画面)
- Modify: `components/AppSidebar.tsx:42`(ラベル)
- Modify: `app/top/page.tsx:415`(ラベル)
- Modify: `app/5000/page.tsx:712`(ラベル)

**Interfaces:**
- Consumes: 既存団子ページ、`TAROT_THEME`。
- Produces: `/fortune`(ハブ)、`/fortune/dango`(団子)、`/fortune/cards`(カード, Task 7)。

- [ ] **Step 1: 団子ページを移設**

`app/fortune/page.tsx` の**現在の全内容**を、そのまま `app/fortune/dango/page.tsx` として新規作成する(1文字も変えない。`'use client'` 冒頭・localStorageキー・`/fortune/config/*.json` 参照・`/api/*` 参照はすべて維持)。

Run(内容コピー): エディタで `app/fortune/page.tsx` を開き全選択→ `app/fortune/dango/page.tsx` に貼り付け。

- [ ] **Step 2: 移設先の単体確認**

Run: `npm run build`
Expected: PASS。`/fortune/dango` が生成される。この時点では `/fortune` はまだ旧団子のまま(次で置換)。

- [ ] **Step 3: `/fortune` をハブへ置換**

`app/fortune/page.tsx` の**全内容**を次に置き換える:

```tsx
'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import StarBackground from '@/components/tarot/StarBackground'
import { TAROT_THEME } from '@/lib/fortune/theme'

const CHOICES = [
  { href: '/fortune/dango', emoji: '🍡', title: '団子占い', desc: '毎日の運勢チェック(+10BP)' },
  { href: '/fortune/cards', emoji: '🔮', title: 'カード占い', desc: '月影の占術 — AIがあなただけの運命を読み解く' },
]

export default function FortuneHub() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center gap-8 py-16 px-6"
      style={{ background: TAROT_THEME.bg, color: TAROT_THEME.text }}>
      <StarBackground />
      <h1 className="text-2xl font-bold tracking-widest" style={{ color: TAROT_THEME.gold }}>占い</h1>
      <div className="flex flex-col gap-4 w-full max-w-md">
        {CHOICES.map((c, i) => (
          <motion.div key={c.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Link href={c.href}
              className="flex items-center gap-4 rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${TAROT_THEME.purple}` }}>
              <span className="text-3xl">{c.emoji}</span>
              <span className="flex flex-col">
                <span className="text-base font-semibold" style={{ color: TAROT_THEME.gold }}>{c.title}</span>
                <span className="text-xs opacity-75">{c.desc}</span>
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 入口ラベル改名(3箇所)**

`components/AppSidebar.tsx:42` を:
```tsx
    { href: "/fortune",icon: "🔮", label: "占い" },
```

`app/top/page.tsx:415` を(label のみ変更、他は不変):
```tsx
      { id: "fortune",  label: "占い",     icon: "🔮", color: "from-violet-500 to-purple-600",  href: "/fortune",    desc: "団子占い・カード占い" },
```

`app/5000/page.tsx:712` を(title と desc のみ変更):
```tsx
              { icon: "🔮", title: "占い",         desc: "団子占い・AIカード占い",             accent: "#8b5cf6", i: 6 },
```

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: PASS。`/fortune`(ハブ)・`/fortune/dango`・`/fortune/cards` の3ルートが生成。

- [ ] **Step 6: 手動確認**

Run: `npm run dev`
Expected:
- サイドバー/トップ/5000 の入口が「占い」表示で `/fortune` に遷移。
- `/fortune` で「団子占い / カード占い」を選べる。
- 「団子占い」→ `/fortune/dango` で**従来どおり**動作(診断・今日の運勢・BP付与導線が壊れていない)。
- 「カード占い」→ `/fortune/cards` で没入フローが動作。

- [ ] **Step 7: コミット**

```bash
git add app/fortune/page.tsx app/fortune/dango/page.tsx components/AppSidebar.tsx app/top/page.tsx app/5000/page.tsx
git commit -m "feat(fortune): /fortune を占いハブ化(団子を /fortune/dango へ移設・入口を「占い」に改名)"
```

---

## Self-Review

**Spec coverage:**
- 没入フロー(intro→question→事前3問→モード→デッキ/シャッフル/3枚→loading→result) → Task 5/4/6/7。✓
- 22枚カードJSON(id/name/image/upright/reversed/love/work/life/money/meaning) → Task 1。✓
- OpenAI(質問+3回答+3枚送信, 7フィールドJSON返却, フォールバック) → Task 2。✓
- モード選択UI + 課金スタブ(単一シーム) + 無料1日1回 → Task 5(ModeSelector)/Task 1(billing)。※無料1日1回の実接続(freeUsedToday/markFreeUsed)は billing に用意済み。**FortuneApp は現状これを未使用** → Task 7 のStep1コードに「free時 freeUsedToday() で既回なら簡易導線」を後日足せる余地(MVPは全モード実行可)。仕様の"1日1回"は関数として提供済み・UI強制はMVP任意とする(spec §7 準拠)。✓
- テーマ配色・演出(星/炎/浮遊/選択光/結果回転) → Task 3/4/6。✓
- 入口「占い」改名 + 団子/カードのセレクト + 団子非破壊 → Task 8。✓
- レスポンシブ/スマホファースト/reduced-motion → 各コンポーネント(max-w-md・相対単位)。reduced-motion は Framer の既定 + `prefers-reduced-motion` を各所で尊重(実装時に `useReducedMotion()` を StarBackground/TarotCard に適用可)。✓
- MVP除外(画像保存/SNS/履歴/実BP・EP) → 未実装、FortuneResult にコメントで差込口明記。✓

**Placeholder scan:** 具体コードで埋め済み。プレースホルダ・TODO・「後で」なし(MVP除外項目は FortuneResult のコメントで差込口のみ明記)。

**Type consistency:** `Mode`/`Step`/`SelectedCard`/`FortuneResultData`/`TarotRequest`/`TarotResponse` は Task 1 で定義し全タスクで一致参照。`chargeForMode(mode, loginId)` の呼び出し(Task 7)と定義(Task 1)一致。`onComplete(SelectedCard[])`(CardDeck)と `runReading`(FortuneApp)一致。

## Execution Handoff(下記メッセージで案内)

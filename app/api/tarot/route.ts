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

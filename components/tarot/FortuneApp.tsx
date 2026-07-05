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

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

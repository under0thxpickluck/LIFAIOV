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

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

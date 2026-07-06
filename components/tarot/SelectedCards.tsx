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

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

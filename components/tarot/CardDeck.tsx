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

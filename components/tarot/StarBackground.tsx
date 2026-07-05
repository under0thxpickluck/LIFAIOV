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

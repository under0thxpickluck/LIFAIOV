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

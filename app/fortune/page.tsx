'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import StarBackground from '@/components/tarot/StarBackground'
import { TAROT_THEME } from '@/lib/fortune/theme'

const CHOICES = [
  { href: '/fortune/dango', emoji: '🍡', title: '団子占い', desc: '毎日の運勢チェック(+10BP)' },
  { href: '/fortune/cards', emoji: '🔮', title: 'カード占い', desc: '月影の占術 — AIがあなただけの運命を読み解く' },
]

export default function FortuneHub() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center gap-8 py-16 px-6"
      style={{ background: TAROT_THEME.bg, color: TAROT_THEME.text }}>
      <StarBackground />
      <h1 className="text-2xl font-bold tracking-widest" style={{ color: TAROT_THEME.gold }}>占い</h1>
      <div className="flex flex-col gap-4 w-full max-w-md">
        {CHOICES.map((c, i) => (
          <motion.div key={c.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Link href={c.href}
              className="flex items-center gap-4 rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${TAROT_THEME.purple}` }}>
              <span className="text-3xl">{c.emoji}</span>
              <span className="flex flex-col">
                <span className="text-base font-semibold" style={{ color: TAROT_THEME.gold }}>{c.title}</span>
                <span className="text-xs opacity-75">{c.desc}</span>
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

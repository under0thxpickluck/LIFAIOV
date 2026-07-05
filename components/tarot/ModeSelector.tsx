'use client'
import type { Mode } from '@/lib/fortune/types'
import { TAROT_THEME } from '@/lib/fortune/theme'

const MODES: { key: Mode; title: string; desc: string; tag: string }[] = [
  { key: 'free', title: '無料', desc: '1日1回・簡易結果', tag: '無料' },
  { key: 'standard', title: 'Standard', desc: '詳細占い・文章量約2倍・行動提案', tag: 'BP(近日)' },
  { key: 'premium', title: 'Premium', desc: '最も詳細・カテゴリ別/深層心理', tag: 'EP(近日)' },
]

export default function ModeSelector({
  value, onSelect, onNext,
}: { value: Mode; onSelect: (m: Mode) => void; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 w-full max-w-md">
      <h2 className="text-lg font-semibold" style={{ color: TAROT_THEME.gold }}>占いの深さを選んでください</h2>
      <div className="flex flex-col gap-3 w-full">
        {MODES.map((m) => {
          const on = value === m.key
          return (
            <button key={m.key} type="button" onClick={() => onSelect(m.key)}
              className="flex items-center justify-between rounded-xl p-4 text-left transition"
              style={{
                border: `1px solid ${on ? TAROT_THEME.accent : TAROT_THEME.purple}`,
                background: on ? 'rgba(181,109,255,0.12)' : 'rgba(255,255,255,0.04)',
              }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: TAROT_THEME.text }}>{m.title}</p>
                <p className="text-xs opacity-75" style={{ color: TAROT_THEME.text }}>{m.desc}</p>
              </div>
              <span className="text-[10px] rounded-full px-2 py-0.5" style={{ border: `1px solid ${TAROT_THEME.gold}`, color: TAROT_THEME.gold }}>{m.tag}</span>
            </button>
          )
        })}
      </div>
      <button type="button" onClick={onNext}
        className="rounded-full px-8 py-2.5 text-sm font-semibold"
        style={{ background: TAROT_THEME.gold, color: '#0b0813' }}>
        この深さで占う
      </button>
    </div>
  )
}

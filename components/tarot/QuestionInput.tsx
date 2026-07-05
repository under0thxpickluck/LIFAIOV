'use client'
import { TAROT_THEME } from '@/lib/fortune/theme'

const EXAMPLES = ['仕事', '恋愛', '人生', '事業', 'お金', '人間関係']

export default function QuestionInput({
  value, onChange, onNext,
}: { value: string; onChange: (v: string) => void; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 w-full max-w-md">
      <h2 className="text-xl font-semibold" style={{ color: TAROT_THEME.gold }}>今、何を占いましょうか？</h2>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="占いたいことを書いてください"
        className="w-full rounded-lg p-3 text-sm outline-none"
        style={{ background: 'rgba(255,255,255,0.06)', color: TAROT_THEME.text, border: `1px solid ${TAROT_THEME.purple}` }}
      />
      <div className="flex flex-wrap gap-2 justify-center">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => onChange(ex)}
            className="rounded-full px-3 py-1 text-xs"
            style={{ border: `1px solid ${TAROT_THEME.purple}`, color: TAROT_THEME.text }}>{ex}</button>
        ))}
      </div>
      <button type="button" disabled={!value.trim()} onClick={onNext}
        className="rounded-full px-8 py-2.5 text-sm font-semibold disabled:opacity-40"
        style={{ background: TAROT_THEME.gold, color: '#0b0813' }}>
        次へ
      </button>
    </div>
  )
}

'use client'
import { TAROT_THEME } from '@/lib/fortune/theme'

type Field = 'currentSituation' | 'trueFeeling' | 'idealFuture'
const FIELDS: { key: Field; label: string; ph: string }[] = [
  { key: 'currentSituation', label: '現在一番悩んでいることを教えてください。', ph: '例: 売上が伸びない / 恋人との関係 / 転職 / 将来への不安' },
  { key: 'trueFeeling', label: 'あなたは本当はどうしたいと思っていますか？', ph: '例: 挑戦したい / 続けたい / 諦めたい / 決断したい' },
  { key: 'idealFuture', label: '理想の未来はどんな状態ですか？', ph: '例: 自由になりたい / 収入を増やしたい / 安心したい / 家族を幸せにしたい' },
]

export default function PreQuestionForm({
  values, onChange, onNext,
}: {
  values: Record<Field, string>
  onChange: (field: Field, v: string) => void
  onNext: () => void
}) {
  const ready = FIELDS.every((f) => values[f.key].trim())
  return (
    <div className="flex flex-col gap-5 px-6 w-full max-w-md">
      {FIELDS.map((f) => (
        <div key={f.key} className="flex flex-col gap-1.5">
          <label className="text-sm" style={{ color: TAROT_THEME.gold }}>{f.label}</label>
          <textarea
            value={values[f.key]} onChange={(e) => onChange(f.key, e.target.value)} rows={2} placeholder={f.ph}
            className="w-full rounded-lg p-3 text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', color: TAROT_THEME.text, border: `1px solid ${TAROT_THEME.purple}` }}
          />
        </div>
      ))}
      <button type="button" disabled={!ready} onClick={onNext}
        className="self-center rounded-full px-8 py-2.5 text-sm font-semibold disabled:opacity-40"
        style={{ background: TAROT_THEME.gold, color: '#0b0813' }}>
        カードを引く
      </button>
    </div>
  )
}

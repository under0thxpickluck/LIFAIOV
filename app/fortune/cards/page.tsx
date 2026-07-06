import FortuneApp from '@/components/tarot/FortuneApp'

export const metadata = { title: '月影の占術 | LIFAI' }

// 準備中ガード: NEXT_PUBLIC_TAROT_ENABLED === '1' のときだけ入場可。
// 未設定時は直URLでも「準備中」を表示し会員は入れない。
const TAROT_ENABLED = process.env.NEXT_PUBLIC_TAROT_ENABLED === '1'

export default function TarotPage() {
  if (!TAROT_ENABLED) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09070F',
          color: '#F4EFE8',
          fontSize: 14,
          letterSpacing: '0.2em',
        }}
      >
        準備中です
      </div>
    )
  }
  return <FortuneApp />
}

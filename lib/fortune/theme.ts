// 占い世界観の配色トークン(仕様厳守)。Tailwind arbitrary 値 or inline style で参照。
export const TAROT_THEME = {
  bg: '#09070F',
  purple: '#231235',
  gold: '#D9B76B',
  text: '#F4EFE8',
  accent: '#B56DFF',
} as const

// ルート要素に流し込むCSS変数(子は var(--tarot-*) で参照可能)
export const tarotCssVars: React.CSSProperties = {
  ['--tarot-bg' as any]: TAROT_THEME.bg,
  ['--tarot-purple' as any]: TAROT_THEME.purple,
  ['--tarot-gold' as any]: TAROT_THEME.gold,
  ['--tarot-text' as any]: TAROT_THEME.text,
  ['--tarot-accent' as any]: TAROT_THEME.accent,
}

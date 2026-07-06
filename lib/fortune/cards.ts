import cards from '@/data/tarot-cards.json'
import type { TarotCardData } from './types'

export function loadCards(): TarotCardData[] {
  return cards as TarotCardData[]
}
export function cardByName(name: string): TarotCardData | undefined {
  return (cards as TarotCardData[]).find((c) => c.name === name)
}

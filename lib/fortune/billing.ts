import type { Mode } from './types'

// 将来ここだけ差し替える:
//   standard → @/app/lib/bp-config の BP_COSTS(BP消費, GAS deduct_bp)
//   premium  → GAS deduct_ep(冪等キー付き)
// MVPは全モード無料扱いで {ok:true} を返す。
export async function chargeForMode(
  _mode: Mode,
  _loginId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  return { ok: true }
}

// 無料モードの1日1回判定(MVPはクライアントlocalStorage。サーバー厳格化は後日)。
const FREE_KEY = 'tarot_free_last_ymd'
function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}
export function freeUsedToday(): boolean {
  try { return localStorage.getItem(FREE_KEY) === todayYmd() } catch { return false }
}
export function markFreeUsed(): void {
  try { localStorage.setItem(FREE_KEY, todayYmd()) } catch { /* ignore */ }
}

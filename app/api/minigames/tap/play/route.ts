// @deprecated: Use /api/minigames/tap/batch-play instead.
// Kept for debug/fallback/rollback only. Do NOT call from production frontend.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAS_URL     = process.env.GAS_WEBAPP_URL!;
const GAS_API_KEY = process.env.GAS_API_KEY!;

export async function POST(req: Request) {
  void req;
  return NextResponse.json({ ok: false, error: "tap_play_disabled" }, { status: 410 });
}

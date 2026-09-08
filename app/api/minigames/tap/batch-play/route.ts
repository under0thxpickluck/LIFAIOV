// app/api/minigames/tap/batch-play/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAS_URL     = process.env.GAS_WEBAPP_URL!;
const GAS_API_KEY = process.env.GAS_API_KEY!;

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { userId, code, group, batchId, tapCount, maxCombo, startedAt, endedAt } = body ?? {};

  if (!userId)          return NextResponse.json({ ok: false, error: "userId_required" }, { status: 400 });
  if (!code)            return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  if (!batchId)         return NextResponse.json({ ok: false, error: "batchId_required" }, { status: 400 });
  if (!Number.isSafeInteger(tapCount) || tapCount <= 0 || tapCount > 50) {
    return NextResponse.json({ ok: false, error: "invalid_tap_count" }, { status: 400 });
  }

  const bodyStr = JSON.stringify({
    action:    "tap_batch_play",
    key:       GAS_API_KEY,
    userId,
    code,
    group: group ?? "",
    batchId,
    tapCount,
    maxCombo:  maxCombo  ?? 0,
    startedAt: startedAt ?? Date.now(),
    endedAt:   endedAt   ?? Date.now(),
  });
  const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_API_KEY)}`;

  try {
    const res = await fetch(url, {
      method:   "POST",
      headers:  { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(bodyStr)) },
      body:     bodyStr,
      redirect: "follow",
      cache:    "no-store",
    });
    return NextResponse.json(await res.json());
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}

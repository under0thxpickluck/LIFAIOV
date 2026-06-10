import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const id = String(body?.id ?? "").trim();
  const code = String(body?.code ?? "").trim();
  const lfw_address = String(body?.lfw_address ?? "").trim();
  const amount = Number(body?.amount ?? 0);

  if (!id || !code) return NextResponse.json({ ok: false, error: "missing_auth" }, { status: 400 });
  if (!lfw_address) return NextResponse.json({ ok: false, error: "missing_lfw_address" }, { status: 400 });
  if (amount < 1) return NextResponse.json({ ok: false, error: "amount_must_be_positive" }, { status: 400 });

  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;
  if (!gasUrl || !gasKey) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  try {
    const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "ep_send_to_lfw", id, code, lfw_address, amount }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: "gas_unreachable" }, { status: 502 });
  }
}

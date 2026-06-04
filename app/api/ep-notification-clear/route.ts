// app/api/ep-notification-clear/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const base = process.env.GAS_WEBAPP_URL;
    const key  = process.env.GAS_API_KEY;
    if (!base || !key) {
      return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
    }
    const body = await req.json().catch(() => ({} as any));
    const id   = String(body?.id   ?? "").trim();
    const code = String(body?.code ?? "").trim();
    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "id_and_code_required" }, { status: 400 });
    }
    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "ep_notification_clear", id, code }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "bad_gas_json" }));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

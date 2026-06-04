// app/api/admin/cc-affiliate-grant/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const base     = process.env.GAS_WEBAPP_URL;
    const key      = process.env.GAS_API_KEY;
    const adminKey = process.env.GAS_ADMIN_KEY;
    if (!base || !key || !adminKey) {
      return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
    }
    const body       = await req.json().catch(() => ({} as any));
    const payment_id = String(body?.payment_id ?? "").trim();
    if (!payment_id) {
      return NextResponse.json({ ok: false, error: "payment_id_required" }, { status: 400 });
    }
    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "cc_affiliate_grant", adminKey, payment_id }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "bad_gas_json" }));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

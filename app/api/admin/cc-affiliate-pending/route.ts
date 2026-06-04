// app/api/admin/cc-affiliate-pending/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const base     = process.env.GAS_WEBAPP_URL;
    const key      = process.env.GAS_API_KEY;
    const adminKey = process.env.GAS_ADMIN_KEY;
    if (!base || !key || !adminKey) {
      return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
    }
    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "cc_affiliate_pending_list", adminKey }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "bad_gas_json" }));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

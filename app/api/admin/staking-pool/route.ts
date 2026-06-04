// app/api/admin/staking-pool/route.ts
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
    const body    = await req.json().catch(() => ({} as any));
    const month   = String(body?.month ?? "").trim();
    const bp_pool = Number(body?.bp_pool ?? 0);
    const ep_pool = Number(body?.ep_pool ?? 0);

    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "admin_set_staking_pool", adminKey, month, bp_pool, ep_pool }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "bad_gas_json" }));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

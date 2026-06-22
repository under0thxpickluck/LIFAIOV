// app/api/admin/staking-config/route.ts
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
    const body   = await req.json().catch(() => ({} as any));
    const config = body?.config ?? {};

    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "admin_set_staking_config", adminKey, config }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "bad_gas_json" }));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

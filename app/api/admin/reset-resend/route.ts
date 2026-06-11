// app/api/admin/reset-resend/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const id = String(body.id ?? "").trim();

    const base = process.env.GAS_WEBAPP_URL;
    const key = process.env.GAS_API_KEY;
    const adminKey = process.env.GAS_ADMIN_KEY;

    if (!base || !key || !adminKey) {
      return NextResponse.json(
        { ok: false, error: "missing_env", need: ["GAS_WEBAPP_URL", "GAS_API_KEY", "GAS_ADMIN_KEY"] },
        { status: 500 }
      );
    }

    if (!id) {
      return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
    }

    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_resend", adminKey, id }),
      cache: "no-store",
    });
    const text = await res.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "gas_not_json", raw: text.slice(0, 800) },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

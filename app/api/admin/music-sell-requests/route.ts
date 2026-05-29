import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const base     = process.env.GAS_WEBAPP_URL;
  const key      = process.env.GAS_API_KEY;
  const adminKey = process.env.GAS_ADMIN_KEY;

  if (!base || !key || !adminKey) {
    return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
  }

  try {
    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "music_sell_list", adminKey }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const base     = process.env.GAS_WEBAPP_URL;
  const key      = process.env.GAS_API_KEY;
  const adminKey = process.env.GAS_ADMIN_KEY;

  if (!base || !key || !adminKey) {
    return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const requestId = String(body?.requestId ?? "");
  const status    = String(body?.status    ?? "");
  if (!requestId || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ ok: false, error: "invalid_params" }, { status: 400 });
  }

  try {
    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "music_sell_update", adminKey, requestId, status }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const base     = process.env.GAS_WEBAPP_URL;
  const key      = process.env.GAS_API_KEY;
  const adminKey = process.env.GAS_ADMIN_KEY;

  if (!base || !key || !adminKey) {
    return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const requestId = String(body?.requestId ?? "");
  if (!requestId) {
    return NextResponse.json({ ok: false, error: "requestId_required" }, { status: 400 });
  }

  try {
    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "music_sell_delete", adminKey, requestId }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

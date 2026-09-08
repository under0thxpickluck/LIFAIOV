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
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const code = typeof body?.code === "string" ? body.code : "";
  const group = typeof body?.group === "string" ? body.group : "";
  if (!userId || !code) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });

  const bodyStr = JSON.stringify({ action: "tap_status", key: GAS_API_KEY, userId, code, group });
  const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_API_KEY)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(bodyStr)) },
      body: bodyStr,
      redirect: "follow",
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const GAS_URL = process.env.GAS_WEBAPP_URL!;
const GAS_API_KEY = process.env.GAS_API_KEY!;
export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const { userId, planId } = body ?? {};
  if (!userId || !planId) return NextResponse.json({ ok: false, error: "params_required" }, { status: 400 });
  // paymentMethod はクライアントから受け取らず "ep" 固定にする。
  // カード有効化は Square Webhook（adminKey付き）経由のみ — paymentMethod:"card" を
  // クライアントが注入して無料でブーストを有効化するのを防ぐ。
  const bodyStr = JSON.stringify({ action: "music_boost_subscribe", key: GAS_API_KEY, userId, planId, paymentMethod: "ep" });
  const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_API_KEY)}`;
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(bodyStr)) }, body: bodyStr, redirect: "follow", cache: "no-store" });
    return NextResponse.json(await res.json());
  } catch (err: any) { return NextResponse.json({ ok: false, error: err?.message }, { status: 500 }); }
}

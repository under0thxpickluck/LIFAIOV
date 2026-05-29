// app/api/narasu-agency/pay-ep/route.ts
import { NextResponse } from "next/server";

const NARASU_EP_COST = 1000;

export async function POST(req: Request) {
  try {
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    const gasAdminKey = process.env.GAS_ADMIN_KEY;
    if (!gasUrl || !gasKey || !gasAdminKey) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }

    const body = await req.json();
    const loginId = String(body?.loginId ?? "").trim();
    const requestId = String(body?.requestId ?? "").trim();
    if (!loginId) {
      return NextResponse.json({ ok: false, error: "loginId_required" }, { status: 400 });
    }

    const url = `${gasUrl}?key=${encodeURIComponent(gasKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "deduct_ep",
        adminKey: gasAdminKey,
        loginId,
        amount: NARASU_EP_COST,
      }),
    });

    const data = await res.json().catch(() => ({ ok: false, error: "bad_gas_json" }));

    if (data.ok && requestId) {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "narasu_agency_update_payment",
          request_id: requestId,
          payment_method: "EP",
          login_id: loginId,
        }),
      }).catch(() => {});
    }

    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// app/api/square/create-checkout/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lifaiov.vercel.app";

  if (!token || !locationId) {
    console.error("[Square Checkout] missing env", { token: !!token, locationId: !!locationId });
    return NextResponse.json(
      { ok: false, error: "missing_env", need: ["SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"] },
      { status: 500 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { user_id, pack_id, bp_amount, price_cents, label, redirect_path } = body;

  if (!user_id || !pack_id || bp_amount === undefined || !price_cents) {
    return NextResponse.json(
      { ok: false, error: "missing_params", need: ["user_id", "pack_id", "bp_amount", "price_cents"] },
      { status: 400 }
    );
  }

  // reference_id にユーザー情報を埋め込む（Webhook 受信時に使用）
  // format: "{user_id}:{pack_id}:{bp_amount}:{site}"
  // site タグは、同一 Square アカウントを共有する相手サイトの webhook が
  // この決済を処理してしまう混入を防ぐための識別子（aisalon="lifai" / lifaiov="ov"）。
  const SITE = "ov";
  const referenceId = `${user_id}:${pack_id}:${bp_amount}:${SITE}`;
  const idempotencyKey = `${user_id}-${pack_id}-${Date.now()}`;

  // redirect_path を呼び出し元から受け取る（省略時は /membership）
  // membership → "/membership"  /  music-boost → "/music-boost"
  const redirectPath =
    typeof redirect_path === "string" && redirect_path.startsWith("/")
      ? redirect_path
      : "/membership";

  const squareBody = {
    idempotency_key: idempotencyKey,
    order: {
      location_id: locationId,
      reference_id: referenceId,
      line_items: [
        {
          name: label ?? `BPパック (${String(pack_id).toUpperCase()})`,
          quantity: "1",
          base_price_money: {
            amount: Number(price_cents),
            currency: "JPY",
          },
        },
      ],
    },
    checkout_options: {
      redirect_url: `${siteUrl}${redirectPath}?purchase=success`,
    },
  };

  console.log("[Square Checkout] creating link for", { user_id, pack_id, bp_amount, price_cents });

  try {
    const res = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Square-Version": "2024-11-20",
      },
      body: JSON.stringify(squareBody),
    });

    const data = await res.json();
    console.log(
      "[Square Checkout] Square API status",
      res.status,
      JSON.stringify(data).slice(0, 300)
    );

    if (!res.ok || !data.payment_link?.url) {
      return NextResponse.json(
        { ok: false, error: "square_api_error", status: res.status, detail: data },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      checkout_url: data.payment_link.url,
    });
  } catch (e: any) {
    console.error("[Square Checkout] fetch error", e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

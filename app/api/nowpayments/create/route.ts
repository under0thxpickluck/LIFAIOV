// app/api/nowpayments/create/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function pickBaseUrl() {
  // ✅ どっちのenv名でも拾えるようにする（保険）
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "";

  if (explicit) return explicit.replace(/\/+$/, "");

  // ✅ VercelのURLがある時の保険（プロトコル補完）
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  if (vercel) return vercel.replace(/\/+$/, "");

  // ✅ 最終フォールバック（既存踏襲）
  return "https://lifai.vercel.app";
}

function toNumberSafe(v: unknown): number {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
      ? Number(v.replace(/,/g, "").replace(/[^\d.]/g, ""))
      : NaN;
  return Number.isFinite(n) ? n : NaN;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json body" },
      { status: 400 }
    );
  }

  const { amount, plan, applyId } = body ?? {};

  if (!applyId) {
    return NextResponse.json(
      { ok: false, error: "amount/applyId required" },
      { status: 400 }
    );
  }

  const price_amount = toNumberSafe(amount);
  if (!price_amount || !(price_amount > 0)) {
    return NextResponse.json(
      { ok: false, error: "amount must be a positive number" },
      { status: 400 }
    );
  }

  const baseUrl = pickBaseUrl();

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "NOWPAYMENTS_API_KEY is missing" },
      { status: 500 }
    );
  }

  const orderId = `lifai_${String(applyId)}`;
  const description = `LIFAI plan ${plan || price_amount}`;

  // ✅ success_url に plan も乗せる（Applyで復帰しやすい）
  const successUrl = `${baseUrl}/apply?applyId=${encodeURIComponent(
    String(applyId)
  )}${plan ? `&plan=${encodeURIComponent(String(plan))}` : ""}`;

  const cancelUrl = `${baseUrl}/5000`;

  const payload = {
    price_amount,
    price_currency: "usd",
    pay_currency: "usdttrc20",
    order_id: orderId,
    order_description: description,
    ipn_callback_url: `${baseUrl}/api/nowpayments/ipn`,
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  let res: Response;
  let data: any;

  try {
    res = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    data = await res.json().catch(() => ({}));
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "network error", detail: String(e?.message || e) },
      { status: 502 }
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: data?.message || "nowpayments error", data },
      { status: 400 }
    );
  }

  // ✅ invoice_url が無いケースも保険（壊さない）
  if (!data?.invoice_url) {
    return NextResponse.json(
      { ok: false, error: "invoice_url missing from nowpayments response", data },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, invoice_url: data.invoice_url, data });
}
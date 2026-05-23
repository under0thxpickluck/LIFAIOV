import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PLAN_AMOUNTS: Record<string, number> = {
  "500": 500,
  "2000": 2000,
  "3000": 3000,
  "5000": 5000,
};

function pickBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "";
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  if (vercel) return vercel.replace(/\/+$/, "");
  return "https://lifaiov.vercel.app";
}

export async function POST(req: Request) {
  let body: { apply_id?: string; plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json body" }, { status: 400 });
  }

  const { apply_id, plan } = body ?? {};

  if (!apply_id) {
    return NextResponse.json({ ok: false, error: "apply_id required" }, { status: 400 });
  }

  // plan が直接渡されていなければ GAS から取得
  let resolvedPlan = plan;
  if (!resolvedPlan) {
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    if (gasUrl && gasKey) {
      try {
        const statusRes = await fetch(`${gasUrl}?key=${encodeURIComponent(gasKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_apply_status_5000", applyId: apply_id }),
          cache: "no-store",
        });
        const statusData = await statusRes.json().catch(() => ({}));
        resolvedPlan = statusData?.plan || "";
      } catch {
        // GAS 取得失敗でも続行（plan が空の場合は後でエラー）
      }
    }
  }

  const priceAmount = PLAN_AMOUNTS[resolvedPlan ?? ""] ?? 0;
  if (!priceAmount) {
    return NextResponse.json(
      { ok: false, error: `unknown plan: ${resolvedPlan}` },
      { status: 400 }
    );
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "NOWPAYMENTS_API_KEY missing" }, { status: 500 });
  }

  const baseUrl = pickBaseUrl();

  const payload = {
    price_amount: priceAmount,
    price_currency: "usd",
    pay_currency: "usdttrc20",
    order_id: apply_id,
    order_description: `LIFAI 5000 plan ${resolvedPlan}`,
    ipn_callback_url: `${baseUrl}/api/5000/nowpayments/ipn`,
    success_url: `${baseUrl}/5000/purchase-status?apply_id=${encodeURIComponent(apply_id)}`,
    cancel_url: `${baseUrl}/5000/apply`,
  };

  let res: Response;
  let data: Record<string, unknown>;
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
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: "network error", detail: String(e) },
      { status: 502 }
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: (data as any)?.message || "nowpayments error", data },
      { status: 400 }
    );
  }

  if (!(data as any)?.invoice_url) {
    return NextResponse.json(
      { ok: false, error: "invoice_url missing from nowpayments response", data },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    invoice_url: (data as any).invoice_url,
    apply_id,
  });
}

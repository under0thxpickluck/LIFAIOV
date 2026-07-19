import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GAS側 MUSIC_BOOST_PLANS と一致させること
const VALID_PLAN_IDS = [
  "starter", "light", "basic", "growth", "pro",
  "advanced", "premium", "elite", "master", "legend",
] as const;

// 管理者による Music Boost の手動有効化・解約。
// Square Webhook が失敗した場合の救済用。GAS側は既存の
// music_boost_subscribe（adminKey必須のカード経路）／ music_boost_cancel をそのまま使う。
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const { loginId, planId, mode } = body ?? {};

    if (!loginId || !mode) {
      return NextResponse.json(
        { ok: false, error: "loginId_mode_required" },
        { status: 400 }
      );
    }
    if (mode !== "activate" && mode !== "cancel") {
      return NextResponse.json(
        { ok: false, error: "invalid_mode", valid: ["activate", "cancel"] },
        { status: 400 }
      );
    }
    if (mode === "activate" && !VALID_PLAN_IDS.includes(planId)) {
      return NextResponse.json(
        { ok: false, error: "invalid_plan", valid: VALID_PLAN_IDS },
        { status: 400 }
      );
    }

    const base     = process.env.GAS_WEBAPP_URL!;
    const key      = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    if (!base || !key || (mode === "activate" && !adminKey)) {
      return NextResponse.json(
        { ok: false, error: "missing_env" },
        { status: 500 }
      );
    }

    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;

    const gasBody =
      mode === "activate"
        ? {
            action: "music_boost_subscribe",
            userId: String(loginId),
            planId: String(planId),
            paymentMethod: "admin_manual",
            adminKey,
            // wallet_ledger の memo に残る監査用ID（Square決済IDと区別できる形式）
            square_payment_id: `admin_manual_${Date.now()}`,
          }
        : {
            action: "music_boost_cancel",
            userId: String(loginId),
          };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(gasBody),
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
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const VALID_PRESETS = ["normal", "lucky", "super_lucky", "low", "super_low"] as const;
type GachaPreset = typeof VALID_PRESETS[number];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const { loginId, preset } = body ?? {};

    if (!loginId || !preset) {
      return NextResponse.json(
        { ok: false, error: "loginId_preset_required" },
        { status: 400 }
      );
    }
    if (!VALID_PRESETS.includes(preset as GachaPreset)) {
      return NextResponse.json(
        { ok: false, error: "invalid_preset", valid: VALID_PRESETS },
        { status: 400 }
      );
    }

    const base     = process.env.GAS_WEBAPP_URL!;
    const key      = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    if (!base || !key || !adminKey) {
      return NextResponse.json(
        { ok: false, error: "missing_env" },
        { status: 500 }
      );
    }

    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "admin_set_gacha_preset", adminKey, loginId, preset }),
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

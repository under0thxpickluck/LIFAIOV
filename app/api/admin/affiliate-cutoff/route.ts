import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 過去分の一括マークは行数が多いと時間がかかるため延長

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const { before_month, dry_run } = body ?? {};

    const base     = process.env.GAS_WEBAPP_URL!;
    const key      = process.env.GAS_API_KEY!;
    const adminKey = process.env.GAS_ADMIN_KEY!;

    if (!base || !key || !adminKey) {
      return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
    }
    if (!before_month || !/^\d{4}-\d{2}$/.test(before_month)) {
      return NextResponse.json({ ok: false, error: "invalid_month" }, { status: 400 });
    }

    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: "affiliate_cutoff_mark",
        adminKey,
        before_month,
        // 省略時は必ずプレビュー（dry_run:false を明示したときだけ本実行）
        dry_run: dry_run !== false,
      }),
    });

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); }
    catch {
      return NextResponse.json(
        { ok: false, error: "gas_not_json", raw: text.slice(0, 800) },
        { status: 502 }
      );
    }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

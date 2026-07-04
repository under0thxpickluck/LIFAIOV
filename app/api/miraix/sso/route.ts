// app/api/miraix/sso/route.ts — GAS login で本人確認してから短命SSOトークンを発行
import { NextResponse } from "next/server";
import { signSsoToken } from "../../../lib/miraixSso";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { id, code, group } = await req.json().catch(() => ({}));
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    const secret = process.env.MIRAIX_SSO_SECRET;
    const miraixUrl = process.env.MIRAIX_APP_URL;
    if (!gasUrl || !gasKey || !secret || !miraixUrl) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }
    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "id/code required" }, { status: 400 });
    }

    // GAS login で本人確認（クライアント申告の loginId を信用しない）
    const sep = gasUrl.includes("?") ? "&" : "?";
    const r = await fetch(`${gasUrl}${sep}key=${encodeURIComponent(gasKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "login", id, code, group: String(group || "") }),
    });
    const login = await r.json().catch(() => null);
    if (!login?.ok) {
      return NextResponse.json({ ok: false, error: "login_failed" }, { status: 401 });
    }

    // group / login_id は GAS 応答を正とする（id はemailの可能性があり正準IDにしない）
    const canonicalLoginId = String(login.login_id || "");
    if (!canonicalLoginId) {
      return NextResponse.json({ ok: false, error: "login_id_missing" }, { status: 502 });
    }
    const gasGroup: "" | "5000" = String(login.group || "") === "5000" ? "5000" : "";
    const now = Math.floor(Date.now() / 1000);
    const token = await signSsoToken(secret, {
      gasGroup,
      loginId: canonicalLoginId,
      iat: now,
      exp: now + 300, // 5分
    });

    return NextResponse.json(
      { ok: true, url: `${miraixUrl.replace(/\/$/, "")}/salon-link?sso=${encodeURIComponent(token)}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// app/api/miraix/sso/route.ts — GAS login で本人確認してから短命SSOトークンを発行
import { NextResponse } from "next/server";
import { signSsoToken } from "../../../lib/miraixSso";

export const runtime = "nodejs";

// このリポジトリのサロンID（環境変数にはしない: env の取り違えで他サロンに
// なりすます事故を防ぐため、リポジトリ＝サロンの対応をコードに固定する）。
// ⚠️ この行だけが LIFAIOV / aisalon 間で異なる。他は完全同一を保つこと。
const SALON_ID: "lifaiov" | "aisalon" = "lifaiov";
// このサロンの会員が持ち得る唯一の GAS group 値（LIFAIOV="5000" / aisalon=""）
const EXPECTED_GAS_GROUP = { lifaiov: "5000", aisalon: "" }[SALON_ID];

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
    // このサロンで想定外の group が返った場合はトークンを発行しない（他サロンのGASへ
    // 誤ルーティングされて会員残高が混ざる事故のフェイルクローズ。MIRAIX側でも再検証される）
    if (gasGroup !== EXPECTED_GAS_GROUP) {
      return NextResponse.json({ ok: false, error: "group_mismatch" }, { status: 403 });
    }
    const now = Math.floor(Date.now() / 1000);
    const token = await signSsoToken(secret, {
      salon: SALON_ID,
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

// app/api/square/webhook/route.ts
import { NextResponse } from "next/server";
import * as crypto from "crypto";

export const runtime = "nodejs";

// Square の署名検証は「通知URL + rawBody」のHMACなので、
// この URL は Square Dashboard に登録した Notification URL と完全一致が必要
const NOTIFICATION_URL = "https://lifaiov.vercel.app/api/square/webhook";

function verifySquareSig(rawBody: string, sigHeader: string | null, sigKey: string): boolean {
  if (!sigHeader) return false;
  try {
    const hmac = crypto.createHmac("sha256", sigKey);
    hmac.update(NOTIFICATION_URL + rawBody);
    const expected = hmac.digest("base64");
    // タイミング攻撃対策: timingSafeEqual を使う
    const a = Buffer.from(expected, "base64");
    const b = Buffer.from(sigHeader, "base64");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST webhook only" });
}

export async function POST(req: Request) {
  const sigKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;

  const raw = await req.text();
  const sig = req.headers.get("x-square-hmacsha256-signature");

  // テスト用バイパス（本番では x-test-square: 1 ヘッダが来ても NODE_ENV=production なので無効）
  const isTest = process.env.NODE_ENV !== "production" && req.headers.get("x-test-square") === "1";

  console.log("[Square Webhook] hit", new Date().toISOString());
  console.log("[Square Webhook] isTest", isTest, "raw", raw.slice(0, 200));

  // 署名検証
  if (sigKey && !isTest) {
    const ok = verifySquareSig(raw, sig, sigKey);
    console.log("[Square Webhook] sig_ok", ok);
    if (!ok) {
      console.warn("[Square Webhook] bad signature");
      return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
    }
  } else {
    console.log("[Square Webhook] signature skipped (test or no key)");
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const eventType = payload?.type as string | undefined;
  console.log("[Square Webhook] eventType", eventType);

  // payment.updated 以外は無視して 200 を返す（Square がリトライしないように常に 200）
  if (eventType !== "payment.updated") {
    return NextResponse.json({ ok: true, skipped: true, reason: "not_payment_updated" });
  }

  const payment = payload?.data?.object?.payment;
  const status = payment?.status as string | undefined;

  // COMPLETED 以外は無視
  if (status !== "COMPLETED") {
    console.log("[Square Webhook] payment not completed, status:", status);
    return NextResponse.json({ ok: true, skipped: true, reason: `status_${status}` });
  }

  const paymentId = payment?.id as string | undefined;
  const orderId = payment?.order_id as string | undefined;
  const amountCents = payment?.amount_money?.amount as number | undefined;

  console.log("[Square Webhook] COMPLETED paymentId", paymentId, "orderId", orderId, "cents", amountCents);

  if (!paymentId || !orderId) {
    console.warn("[Square Webhook] missing ids");
    return NextResponse.json({ ok: false, error: "missing_ids" }, { status: 400 });
  }

  // Square Orders API で reference_id を取得
  // reference_id = "{user_id}:{pack_id}:{bp_amount}" が埋め込まれている
  let referenceId: string | null = null;
  if (accessToken) {
    try {
      const orderRes = await fetch(`https://connect.squareup.com/v2/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Square-Version": "2024-11-20",
        },
      });
      const orderData = await orderRes.json();
      referenceId = orderData?.order?.reference_id ?? null;
      console.log("[Square Webhook] referenceId", referenceId);
    } catch (e) {
      console.error("[Square Webhook] order fetch failed", e);
    }
  }

  if (!referenceId) {
    // reference_id がない = create-checkout 経由でない（古い square.link からの決済）
    // ログを残して 200 で返す（Square へのリトライを防ぐ）
    console.warn("[Square Webhook] referenceId missing - skipping BP grant");
    return NextResponse.json({ ok: true, warning: "no_reference_id" });
  }

  // reference_id を分解: "user_id:pack_id:bp_amount"
  const parts = referenceId.split(":");
  if (parts.length < 3) {
    console.warn("[Square Webhook] invalid referenceId format", referenceId);
    return NextResponse.json({ ok: true, warning: "invalid_reference_id_format" });
  }

  const userId = parts[0];
  const packId = parts[1];
  const bpAmount = Number(parts[2]);

  console.log("[Square Webhook] parsed", { userId, packId, bpAmount });

  // ── サイト所属ガード（混入防止）───────────────────────────────
  // reference_id 末尾の site タグが自サイトと異なる決済は、同一 Square アカウントを
  // 共有する相手サイトの決済がこの webhook にも配信されたもの。処理せず 200 で無視する。
  // タグ無し（旧 create-checkout 由来の古い決済リンク）は後方互換で従来通り処理する。
  const SELF_SITE = "ov";
  const site = parts[3] || "";
  if (site && site !== SELF_SITE) {
    console.log("[Square Webhook] foreign-site payment skipped", { site, self: SELF_SITE, userId });
    return NextResponse.json({ ok: true, skipped: true, reason: "foreign_site" });
  }

  // bp_amount === 0 は music-boost 注文（BP付与なし・ブーストを自動有効化）
  if (bpAmount === 0) {
    console.log("[Square Webhook] music-boost order received, pack_id:", packId);
    const gasAdminKey = process.env.GAS_ADMIN_KEY;
    if (!isTest && packId.startsWith("music_boost_") && gasUrl && gasKey && gasAdminKey) {
      // pack_id = "music_boost_{planId}"（例: music_boost_starter）
      const planId = packId.slice("music_boost_".length);
      const url = `${gasUrl}?key=${encodeURIComponent(gasKey)}`;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            action: "music_boost_subscribe",
            userId,
            planId,
            paymentMethod: "card",
            adminKey: gasAdminKey,               // GAS側でcard経路はadminKey必須
            square_payment_id: paymentId,        // GAS側で二重有効化防止に使用
          }),
        });
        const text = await r.text();
        console.log("[Square Webhook] music-boost activate GAS status", r.status, "body", text.slice(0, 300));
      } catch (e) {
        console.error("[Square Webhook] music-boost activate GAS call failed", e);
        // GAS失敗でも200を返す（Squareのリトライを防ぐ。台帳未記録なので再purchase時は正常に有効化される）
      }
    } else {
      console.warn("[Square Webhook] music-boost activation skipped", {
        isTest, packId, hasGas: !!(gasUrl && gasKey), hasAdminKey: !!gasAdminKey,
      });
    }
    return NextResponse.json({ ok: true, type: "music_boost_order", pack_id: packId });
  }

  if (!userId || !packId || isNaN(bpAmount) || bpAmount < 0) {
    console.warn("[Square Webhook] referenceId parse failed", { userId, packId, bpAmount });
    return NextResponse.json({ ok: true, warning: "reference_id_parse_failed" });
  }

  // GAS square_grant_bp を呼び出し
  // 会員の実残高は全員メイン applies シート（plan 500/2000/3000/5000, entry_source="5000"）にあるため
  // group は空でメインシートを対象にする（group:"5000" は旧構成の applies_5000 別シート行きで付与が反映されない）
  if (gasUrl && gasKey) {
    const url = `${gasUrl}?key=${encodeURIComponent(gasKey)}`;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "square_grant_bp",
          user_id: userId,
          bp_amount: bpAmount,
          square_payment_id: paymentId,
          pack_id: packId,
          group: "",
          note: `amount_cents:${amountCents} order_id:${orderId}`,
          isTest,
        }),
      });
      const text = await r.text();
      console.log("[Square Webhook] GAS status", r.status, "body", text.slice(0, 300));
    } catch (e) {
      console.error("[Square Webhook] GAS call failed", e);
      // GAS 失敗でも 200 を返す（Square のリトライを防ぐ）
    }
  } else {
    console.warn("[Square Webhook] GAS skipped - missing env", { gasUrl: !!gasUrl, gasKey: !!gasKey });
  }

  return NextResponse.json({ ok: true, isTest });
}

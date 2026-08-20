// app/api/admin/narasu-agency/route.ts
// narasu代理申請の管理用API（/admin/narasu から利用）
// GET  : narasu_agency シートの全申請を返す
// POST : ステータス／管理メモを更新する
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_STATUS = ["submitted", "under_review", "completed", "rejected"];

function readEnv() {
  const base = process.env.GAS_WEBAPP_URL;
  const key = process.env.GAS_API_KEY;
  const adminKey = process.env.GAS_ADMIN_KEY;
  return { base, key, adminKey };
}

async function callGas(base: string, key: string, payload: object) {
  const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "gas_not_json", raw: text.slice(0, 500) };
  }
}

export async function GET() {
  const { base, key, adminKey } = readEnv();
  if (!base || !key || !adminKey) {
    return NextResponse.json(
      { ok: false, error: "missing_env", need: ["GAS_WEBAPP_URL", "GAS_API_KEY", "GAS_ADMIN_KEY"] },
      { status: 500 }
    );
  }
  try {
    const data = await callGas(base, key, { action: "narasu_agency_list", adminKey });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { base, key, adminKey } = readEnv();
  if (!base || !key || !adminKey) {
    return NextResponse.json(
      { ok: false, error: "missing_env", need: ["GAS_WEBAPP_URL", "GAS_API_KEY", "GAS_ADMIN_KEY"] },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const requestId = String(body?.requestId ?? "").trim();
  if (!requestId) {
    return NextResponse.json({ ok: false, error: "requestId_required" }, { status: 400 });
  }

  const status = body?.status === undefined ? "" : String(body.status);
  if (status && !ALLOWED_STATUS.includes(status)) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
  }

  const hasMemo = body?.adminMemo !== undefined && body?.adminMemo !== null;
  if (!status && !hasMemo) {
    return NextResponse.json({ ok: false, error: "nothing_to_update" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    action: "narasu_agency_update",
    adminKey,
    request_id: requestId,
  };
  if (status) payload.status = status;
  if (hasMemo) payload.admin_memo = String(body.adminMemo ?? "");

  try {
    const data = await callGas(base, key, payload);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

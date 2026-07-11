// app/api/referral/dashboard/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DashboardRequest = {
  id?: string;
  code?: string;
};

type Referral = {
  login_id: string;
  plan: string;
  approved_at: string;
};

type Bonus = {
  ts: string;
  kind: string;
  amount: number;
  memo: string;
};

type GasDashboardResponse =
  | {
      ok: true;
      my_ref_code: string;
      referrals: Referral[];
      bonuses: Bonus[];
      total_bonus: number;
      total_affiliate_ep: number;
      group?: string;
    }
  | {
      ok: false;
      reason?: "invalid" | "pending";
      error?: string;
    };

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function jsonError(status: number, payload: Record<string, unknown>) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function ensureEnv(): { gasUrl: string; gasKey: string } | { err: NextResponse } {
  const gasUrl = process.env.GAS_WEBAPP_URL;
  const gasKey = process.env.GAS_API_KEY;

  if (!gasUrl) {
    return { err: jsonError(500, { ok: false, error: "GAS_WEBAPP_URL is missing" }) };
  }
  if (!gasKey) {
    return { err: jsonError(500, { ok: false, error: "GAS_API_KEY is missing" }) };
  }

  return { gasUrl: gasUrl.trim(), gasKey: gasKey.trim() };
}

async function safeReadJson(req: Request): Promise<DashboardRequest> {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return {};
    return (await req.json()) as DashboardRequest;
  } catch {
    return {};
  }
}

async function callGasDashboard(
  gasUrl: string,
  gasKey: string,
  id: string,
  code: string
): Promise<GasDashboardResponse> {
  const url = new URL(gasUrl);
  url.searchParams.set("key", gasKey);

  const controller = new AbortController();
  const timeoutMs = 15_000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "my_referral_dashboard", id, code }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let data: any = null;

    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: "bad_gas_json" };
    }

    if (data && data.ok === true) {
      return {
        ok: true,
        my_ref_code: str(data.my_ref_code),
        referrals: Array.isArray(data.referrals) ? data.referrals : [],
        bonuses: Array.isArray(data.bonuses) ? data.bonuses : [],
        total_bonus: Number(data.total_bonus || 0),
        total_affiliate_ep: Number(data.total_affiliate_ep || 0),
        ...(data.group ? { group: str(data.group) } : {}),
      };
    }

    const reason = str(data?.reason) as "invalid" | "pending" | "";
    const error = str(data?.error);

    return {
      ok: false,
      ...(reason ? { reason } : {}),
      ...(error ? { error } : {}),
    };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "gas_timeout" : "gas_fetch_failed";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  const env = ensureEnv();
  if ("err" in env) return env.err;

  const body = await safeReadJson(req);
  const id = str(body.id).trim();
  const code = str(body.code).trim();

  if (!id || !code) {
    return jsonError(400, { ok: false, error: "id_and_code_required" });
  }

  const gasRes = await callGasDashboard(env.gasUrl, env.gasKey, id, code);

  if (gasRes.ok) {
    return NextResponse.json(
      { ok: true, dashboard: gasRes },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const failedRes = gasRes as Extract<GasDashboardResponse, { ok: false }>;
  if (failedRes.reason === "pending" || failedRes.reason === "invalid") {
    return NextResponse.json(
      { ok: false, reason: failedRes.reason },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
  return jsonError(502, { ok: false, error: failedRes.error || "unknown_error" });
}

export async function GET() {
  return NextResponse.json(
    { ok: true, hint: "POST {id, code} to get referral dashboard" },
    { headers: { "Cache-Control": "no-store" } }
  );
}

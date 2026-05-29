import { NextRequest, NextResponse } from "next/server";
import { calcImageCost } from "@/app/lib/image/cost_calculator";
import { buildPrompt } from "@/app/lib/image/prompt_builder";
import { generateImage } from "@/app/lib/image/image_client";
import { checkBpSufficient } from "@/app/lib/image/image_guard";
import type { ImageChatState } from "@/app/lib/image/image_types";

export const maxDuration = 60;

const GAS_URL = process.env.GAS_WEBAPP_URL ?? "";
const GAS_KEY = process.env.GAS_API_KEY ?? "";

async function gasPost(action: string, body: Record<string, unknown>) {
  const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_KEY)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ action, ...body }),
  });
  return r.json();
}

export async function POST(req: NextRequest) {
  try {
    const { id, code, state } = await req.json() as {
      id: string;
      code: string;
      state: ImageChatState;
    };

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const { totalBp, breakdown } = calcImageCost(state);

    // 残高確認
    const balRes = await gasPost("get_balance", { id });
    if (!balRes.ok) {
      return NextResponse.json({ ok: false, error: "balance_fetch_failed" }, { status: 502 });
    }
    if (!checkBpSufficient(Number(balRes.bp ?? 0), totalBp)) {
      return NextResponse.json({ ok: false, error: "insufficient_bp", totalBp }, { status: 402 });
    }

    // BP消費
    const adminKey = process.env.GAS_ADMIN_KEY ?? "";
    const deductRes = await gasPost("deduct_bp", { adminKey, loginId: id, amount: totalBp });
    if (!deductRes.ok) {
      return NextResponse.json({ ok: false, error: deductRes.error ?? "deduct_bp_failed" }, { status: 400 });
    }

    // 画像生成
    let imageUrl: string;
    try {
      const prompt = buildPrompt(state);
      imageUrl = await generateImage(prompt);
    } catch {
      return NextResponse.json({ ok: false, error: "generation_failed" }, { status: 500 });
    }

    // 履歴保存（fire-and-forget）
    gasPost("image_log", {
      id,
      prompt: buildPrompt(state),
      image_url: imageUrl,
      bp_used: totalBp,
      type: "generate",
      meta_json: JSON.stringify({ breakdown }),
    }).catch(() => {});

    return NextResponse.json({ ok: true, imageUrl, bpUsed: totalBp });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

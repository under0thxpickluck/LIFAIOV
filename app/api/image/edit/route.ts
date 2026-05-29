import { NextRequest, NextResponse } from "next/server";
import { calcImageCost } from "@/app/lib/image/cost_calculator";
import { editImage } from "@/app/lib/image/image_client";
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
    const { id, code, imageUrl, instruction, state } = await req.json() as {
      id: string;
      code: string;
      imageUrl: string;
      instruction: string;
      state: ImageChatState;
    };

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const editState: ImageChatState = { ...state, edit: true };
    const { totalBp, breakdown } = calcImageCost(editState);

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

    // 画像編集
    let resultUrl: string;
    try {
      resultUrl = await editImage({ imageUrl, instruction });
    } catch {
      return NextResponse.json({ ok: false, error: "edit_failed" }, { status: 500 });
    }

    // 履歴保存（fire-and-forget）
    gasPost("image_log", {
      id,
      prompt: instruction,
      image_url: resultUrl,
      bp_used: totalBp,
      type: "edit",
      meta_json: JSON.stringify({ breakdown, original: imageUrl }),
    }).catch(() => {});

    return NextResponse.json({ ok: true, imageUrl: resultUrl, bpUsed: totalBp });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

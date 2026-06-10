import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/app/lib/image/image_client";

export const maxDuration = 60;

const GAS_URL = process.env.GAS_WEBAPP_URL ?? "";
const GAS_KEY = process.env.GAS_API_KEY ?? "";
const JACKET_BP = Number(process.env.IMAGE_JACKET_BP ?? 300);

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

function buildJacketPrompt(params: {
  theme: string;
  genre: string;
  mood: string;
  title: string;
}): string {
  return [
    "album cover art",
    params.genre,
    params.mood,
    params.theme,
    "anime style",
    "elegant composition",
    "beautiful illustration",
    "no text",
    "no typography",
    "high quality",
  ]
    .filter(Boolean)
    .join(", ");
}

export async function POST(req: NextRequest) {
  try {
    const { id, code, jobId, theme, genre, mood, title } = await req.json() as {
      id: string;
      code: string;
      jobId: string;
      theme: string;
      genre: string;
      mood: string;
      title: string;
    };

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // 残高確認
    const balRes = await gasPost("get_balance", { id });
    if (!balRes.ok) {
      return NextResponse.json({ ok: false, error: "balance_fetch_failed" }, { status: 502 });
    }
    if (Number(balRes.bp ?? 0) < JACKET_BP) {
      return NextResponse.json({ ok: false, error: "insufficient_bp", required: JACKET_BP }, { status: 402 });
    }

    // BP仮ロック
    const lockRes = await gasPost("bp_lock", { id, amount: JACKET_BP, reason: "image_jacket" });
    if (!lockRes.ok) {
      return NextResponse.json({ ok: false, error: "bp_lock_failed" }, { status: 502 });
    }
    const lockId = lockRes.lock_id as string;

    // 生成
    let imageUrl: string;
    try {
      const prompt = buildJacketPrompt({ theme, genre, mood, title });
      imageUrl = await generateImage(prompt);
    } catch {
      await gasPost("bp_refund", { id, lock_id: lockId });
      return NextResponse.json({ ok: false, error: "generation_failed" }, { status: 500 });
    }

    // 確定 + 履歴
    await gasPost("bp_commit", { id, lock_id: lockId });
    await gasPost("image_log", {
      id,
      prompt: buildJacketPrompt({ theme, genre, mood, title }),
      image_url: imageUrl,
      bp_used: JACKET_BP,
      type: "jacket",
      meta_json: JSON.stringify({ jobId, title, genre, mood }),
    });

    return NextResponse.json({ ok: true, imageUrl, bpUsed: JACKET_BP });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

// app/api/narasu-agency/resolve-title/route.ts
import { NextResponse } from "next/server";

function extractSongId(url: string): string | null {
  const m = url.match(/song_[A-Z0-9_]+/i);
  return m ? m[0] : null;
}

function urlsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const idA = extractSongId(a);
  const idB = extractSongId(b);
  return !!(idA && idB && idA === idB);
}

export async function POST(req: Request) {
  try {
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    if (!gasUrl || !gasKey) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }

    const body = await req.json();
    const url = String(body?.url ?? "").trim();
    const loginId = String(body?.loginId ?? "").trim();
    if (!url || !loginId) {
      return NextResponse.json({ ok: true, title: null });
    }

    const gasRes = await fetch(`${gasUrl}?key=${encodeURIComponent(gasKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "music_history_list", userId: loginId, limit: 50 }),
      cache: "no-store",
    });
    const data = await gasRes.json().catch(() => ({ ok: false }));
    if (!data.ok || !Array.isArray(data.items)) {
      return NextResponse.json({ ok: true, title: null });
    }

    const match = data.items.find(
      (item: { audioUrl?: string; downloadUrl?: string }) =>
        urlsMatch(item.audioUrl ?? "", url) || urlsMatch(item.downloadUrl ?? "", url)
    );

    return NextResponse.json({ ok: true, title: match?.title ?? null });
  } catch {
    return NextResponse.json({ ok: true, title: null });
  }
}

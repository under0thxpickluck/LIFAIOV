// app/api/narasu-agency/submit/route.ts
import { NextResponse } from "next/server";

async function callGas(gasUrl: string, gasKey: string, payload: object) {
  const url = `${gasUrl}?key=${encodeURIComponent(gasKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok: false, error: "bad_gas_json" }; }
}

export async function POST(req: Request) {
  try {
    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    if (!gasUrl || !gasKey) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }

    const body = await req.json();
    const {
      narasuLoginId,
      narasuPassword,
      audioUrls,
      lyricsText,
      jacketImageUrl,
      jacketNote,
      artistName,
      artistNameKana,
      artistNameAlpha,
      artistPhotoUrl,
      albumName,
      albumNameKana,
      albumNameAlpha,
      note,
      agreedTermsVersion,
      agreedAt,
      loginId,
    } = body ?? {};

    if (!narasuLoginId || !narasuPassword) {
      return NextResponse.json({ ok: false, error: "missing_account_info" }, { status: 400 });
    }
    const filledEntries: { url: string; title: string }[] = (audioUrls ?? [])
      .filter((e: { url: string }) => e.url?.trim())
      .map((e: { url: string; title?: string }) => ({ url: e.url.trim(), title: e.title?.trim() ?? "" }));
    if (filledEntries.length === 0) {
      return NextResponse.json({ ok: false, error: "missing_audio_urls" }, { status: 400 });
    }

    const gas = await callGas(gasUrl, gasKey, {
      action: "narasu_agency_submit",
      narasu_login_id: narasuLoginId,
      narasu_password: narasuPassword,
      audio_urls: filledEntries.map((e) => e.url).join("\n"),
      audio_titles: filledEntries.map((e) => e.title).join("\n"),
      lyrics_text: lyricsText ?? "",
      jacket_image_url: jacketImageUrl ?? "",
      jacket_note: jacketNote ?? "",
      artist_name: artistName ?? "",
      artist_name_kana: artistNameKana ?? "",
      artist_name_alpha: artistNameAlpha ?? "",
      artist_photo_url: artistPhotoUrl ?? "",
      album_name: albumName ?? "",
      album_name_kana: albumNameKana ?? "",
      album_name_alpha: albumNameAlpha ?? "",
      note: note ?? "",
      agreed_terms_version: agreedTermsVersion ?? "",
      agreed_at: agreedAt ?? "",
      login_id: loginId ?? "",
    });

    return NextResponse.json(gas, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

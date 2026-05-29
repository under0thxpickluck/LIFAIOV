// app/narasu-agency/confirm/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isGatePassed, loadDraft, clearDraft } from "@/lib/narasu-agency/storage";
import { getAuth } from "@/app/lib/auth";
import type { NarasuAgencyDraft } from "@/lib/narasu-agency/types";

const NARASU_REQUEST_ID_KEY = "lifai_narasu_request_id_v1";

export default function NarasuConfirmPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<NarasuAgencyDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isGatePassed()) { router.replace("/narasu-agency"); return; }
    const saved = loadDraft();
    if (!saved) { router.replace("/narasu-agency/form"); return; }
    setDraft(saved);
  }, [router]);

  async function handleSubmit() {
    if (!draft) return;
    setSubmitting(true);
    setError("");
    try {
      const auth = getAuth();
      const loginId = (auth as any)?.loginId ?? (auth as any)?.login_id ?? (auth as any)?.id ?? "";
      const res = await fetch("/api/narasu-agency/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, loginId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "送信失敗");
      if (data.requestId) {
        sessionStorage.setItem(NARASU_REQUEST_ID_KEY, data.requestId);
      }
      clearDraft();
      router.push("/narasu-agency/complete");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setSubmitting(false);
    }
  }

  if (!draft) return null;

  const filledUrls = draft.audioUrls.filter((e) => e.url.trim());

  const rowCls = "flex flex-col gap-0.5";
  const labelCls = "text-[10px] font-bold text-slate-400";
  const valueCls = "text-sm text-slate-800 break-all";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-extrabold text-slate-900">入力内容の確認</h1>
          <p className="mt-1 text-sm text-slate-600">内容を確認してから「本申請へ進む」を押してください。</p>

          <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className={rowCls}>
              <p className={labelCls}>narasuログインID</p>
              <p className={valueCls}>{draft.narasuLoginId}</p>
            </div>
            <div className={rowCls}>
              <p className={labelCls}>narasuパスワード</p>
              <p className={valueCls}>{"*".repeat(8)}</p>
            </div>
            <div className={rowCls}>
              <p className={labelCls}>音源URL（{filledUrls.length}件）</p>
              {filledUrls.map((e, i) => (
                <p key={e.id} className={valueCls}>{i + 1}. {e.url}</p>
              ))}
            </div>
            {draft.artistName && (
              <div className={rowCls}>
                <p className={labelCls}>アーティスト名</p>
                <p className={valueCls}>{draft.artistName}</p>
              </div>
            )}
            {draft.artistNameKana && (
              <div className={rowCls}>
                <p className={labelCls}>アーティスト名（仮名）</p>
                <p className={valueCls}>{draft.artistNameKana}</p>
              </div>
            )}
            {draft.artistNameAlpha && (
              <div className={rowCls}>
                <p className={labelCls}>アーティスト名（アルファベット）</p>
                <p className={valueCls}>{draft.artistNameAlpha}</p>
              </div>
            )}
            {draft.albumName && (
              <div className={rowCls}>
                <p className={labelCls}>アルバム名</p>
                <p className={valueCls}>{draft.albumName}</p>
              </div>
            )}
            {draft.albumNameKana && (
              <div className={rowCls}>
                <p className={labelCls}>アルバム名（仮名）</p>
                <p className={valueCls}>{draft.albumNameKana}</p>
              </div>
            )}
            {draft.albumNameAlpha && (
              <div className={rowCls}>
                <p className={labelCls}>アルバム名（アルファベット）</p>
                <p className={valueCls}>{draft.albumNameAlpha}</p>
              </div>
            )}
            {draft.note && (
              <div className={rowCls}>
                <p className={labelCls}>補足事項</p>
                <p className={valueCls}>{draft.note}</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "送信中…" : "本申請へ進む →"}
            </button>
            <button
              onClick={() => router.push("/narasu-agency/form")}
              disabled={submitting}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              修正する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

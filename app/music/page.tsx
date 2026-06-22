"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, getAuthSecret } from "../lib/auth";

const PRO_PLANS = ["2000", "3000", "5000"];

export default function MusicPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) {
      router.replace("/login");
      return;
    }

    // localStorage にキャッシュされた plan があれば先に反映
    const cachedPlan = String((auth as any)?.plan ?? "");
    if (cachedPlan) setPlan(cachedPlan);

    const id =
      (auth as any)?.id ||
      (auth as any)?.loginId ||
      (auth as any)?.login_id ||
      (auth as any)?.email ||
      "";
    const code = getAuthSecret() || (auth as any)?.token || "";

    if (!id || !code) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ id, code, group: (auth as any)?.group || "" }),
        });
        const data = await res.json().catch(() => ({ ok: false }));
        if (data?.ok && data?.me?.plan) {
          setPlan(String(data.me.plan));
        } else {
          setPlan("");
        }
      } catch {
        setPlan("");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const isPro = plan !== null && PRO_PLANS.includes(plan);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">読み込み中…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.16),transparent_60%),radial-gradient(900px_520px_at_112%_0%,rgba(34,211,238,.12),transparent_55%),linear-gradient(180deg,#FFFFFF,#F6F7FB_55%,#FFFFFF)]" />

      <div className="mx-auto max-w-[720px] px-4 py-10">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_26px_70px_rgba(2,6,23,.10)]">
          <div className="flex items-center gap-3">
            <Link
              href="/top"
              className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              ← 戻る
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              <span className="text-base">🎵</span>
              BGM生成
            </div>
          </div>

          <h1 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">
            BGM生成
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            モードを選んでBGM・ループ音源を生成します。
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {/* STANDARD カード */}
            <Link href="/music/standard">
              <div className="relative cursor-pointer rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(2,6,23,.08)] transition hover:-translate-y-[1px] hover:shadow-[0_22px_60px_rgba(2,6,23,.12)] active:translate-y-0">
                <div className="grid h-14 w-14 place-items-center rounded-[18px] bg-gradient-to-br from-indigo-600 to-indigo-400 text-[22px] text-white shadow-[0_10px_20px_rgba(2,6,23,.12)]">
                  🎵
                </div>
                <div className="mt-4">
                  <div className="text-sm font-extrabold text-slate-700">
                    STANDARD
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    日本語でテーマを入力するだけで音楽を生成。全プラン利用可能。
                  </div>
                </div>
                <div className="mt-3 text-right text-xs font-semibold text-slate-500">
                  開く →
                </div>
              </div>
            </Link>

            {/* PRO カード */}
            {isPro ? (
              <Link href="/music/pro">
                <div className="relative cursor-pointer rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(2,6,23,.08)] transition hover:-translate-y-[1px] hover:shadow-[0_22px_60px_rgba(2,6,23,.12)] active:translate-y-0">
                  <div className="grid h-14 w-14 place-items-center rounded-[18px] bg-gradient-to-br from-violet-600 to-violet-400 text-[22px] text-white shadow-[0_10px_20px_rgba(2,6,23,.12)]">
                    🎛️
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-700">
                        PRO
                      </span>
                      <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Core / Infra
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      BPM・波形・ボーカルを細かく設定して高品質な音楽を生成。
                    </div>
                  </div>
                  <div className="mt-3 text-right text-xs font-semibold text-slate-500">
                    開く →
                  </div>
                </div>
              </Link>
            ) : (
              <div className="relative cursor-not-allowed rounded-[24px] border border-slate-200 bg-slate-100 p-5 opacity-70 shadow-[0_18px_50px_rgba(2,6,23,.08)]">
                <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-white">
                  <span>🔒</span>
                  Core/Infra限定
                </div>
                <div className="grid h-14 w-14 place-items-center rounded-[18px] bg-gradient-to-br from-slate-500 to-slate-400 text-[22px] text-white shadow-[0_10px_20px_rgba(2,6,23,.12)]">
                  🎛️
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-700">
                      PRO
                    </span>
                    <span className="rounded-full bg-slate-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Core / Infra
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    BPM・波形・ボーカルを細かく設定して高品質な音楽を生成。
                  </div>
                </div>
                <div className="mt-3 text-right text-xs font-semibold text-slate-400">
                  公開予定
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
  );
}

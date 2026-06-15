// app/narasu-agency/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setGatePassed } from "@/lib/narasu-agency/storage";
import { NARASU_AGENCY_SUSPENDED } from "@/lib/narasu-agency/constants";

export default function NarasuGatePage() {
  const router = useRouter();

  useEffect(() => {
    if (NARASU_AGENCY_SUSPENDED) return;
    setGatePassed();
    router.replace("/narasu-agency/terms");
  }, [router]);

  if (!NARASU_AGENCY_SUSPENDED) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          {/* アイコン */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-amber-500"
            >
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>

          {/* タイトル */}
          <h1 className="text-xl font-extrabold text-slate-900">
            narasu代理申請を一時停止しています
          </h1>

          {/* 本文 */}
          <p className="mt-4 text-sm text-slate-600 leading-relaxed">
            現在、多くのご依頼をいただいており、一件一件の対応品質を維持するため、新規申請の受付を一時停止させていただいております。
          </p>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            ご不便をおかけし、大変申し訳ございません。<br />
            受付を再開する際は、LIFAIコミュニティおよびトップページにてご案内いたします。
          </p>

          {/* 区切り */}
          <div className="my-6 border-t border-slate-100" />

          {/* フッターメッセージ */}
          <p className="text-xs text-slate-400 leading-relaxed">
            すでに申請済みの方のご対応は引き続き進めております。<br />
            ご質問はDiscordまたは運営までお気軽にお問い合わせください。
          </p>

          {/* ボタン */}
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/top"
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-90"
            >
              トップへ戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

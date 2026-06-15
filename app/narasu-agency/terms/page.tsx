// app/narasu-agency/terms/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isGatePassed, saveDraft, loadDraft } from "@/lib/narasu-agency/storage";
import { NARASU_TERMS_VERSION } from "@/lib/narasu-agency/constants";

const TERMS_TEXT = `
narasu代理申請サービス 確認事項

■ サービス概要

本サービスは、LIFAI運営が利用者に代わり、音楽配信サービス「narasu」への楽曲配信申請作業を補助または代行するものです。

■ 提供情報について

本サービスの利用にあたり、以下の情報をご提供いただきます。

・narasuアカウントのログインIDおよびパスワード
・配信を希望する楽曲の音源URL
・歌詞データ（任意）
・アーティスト名、ジャケット情報等の付帯情報

■ アカウント情報の取り扱い

1. 提供されたアカウント情報は、代理申請業務の目的にのみ使用します。
2. 当該情報は、業務完了後、合理的な期間内に削除します。
3. 当社は、合理的な安全管理措置を講じますが、インターネット通信の性質上、完全な安全性を保証するものではありません。

■ 権利および責任

1. 利用者は、申請対象楽曲について、著作権・原盤権その他必要な権利を有している、または正当な許諾を得ていることを保証するものとします。
2. 第三者の権利侵害が発生した場合、当社は一切の責任を負わず、利用者が自己の責任と費用において解決するものとします。

■ 免責事項

1. narasuによる審査結果について、当社は一切保証しません。
2. 配信開始時期はnarasu側の審査状況等により変動する場合があります。
3. 当社は、システム障害、通信障害、外部サービスの仕様変更等により生じた損害について責任を負いません。
4. 本サービスの利用により生じたいかなる間接損害、逸失利益についても責任を負いません。

■ 代行費用

本サービスの利用料金は以下のいずれかとします。

・BP払い：3000BP
・EP払い：1000EP

※EPはLIFAI内ポイントであり、現金への換金はできません。

■ 決済および返金

1. 決済完了後の返金は、原則として行いません。
2. ただし、当社の重大な過失により申請が実施されなかった場合はこの限りではありません。

■ サービス提供の停止

当社は以下の場合、サービスの提供を停止または拒否できるものとします。

・虚偽の情報が提供された場合
・権利侵害の可能性がある場合
・不正利用またはその疑いがある場合

■ 規約の変更

本規約は予告なく変更される場合があります。変更後の内容は本ページに掲載された時点で効力を生じます。

■ 準拠法および管轄

本サービスは日本法に準拠します。
紛争が生じた場合、当社所在地を管轄する裁判所を専属的合意管轄とします。

※本規約は法務レビュー前のドラフトです。正式版は後日更新されます。
`.trim();

export default function NarasuTermsPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!isGatePassed()) {
      router.replace("/narasu-agency");
    }
  }, [router]);

  function handleAgree() {
    const existing = loadDraft();
    const base = existing ?? {
      narasuLoginId: "",
      narasuPassword: "",
      audioUrls: [{ id: crypto.randomUUID(), url: "", title: "", lyrics: "" }],
      lyricsText: "",
      jacketImageUrl: "",
      jacketNote: "",
      artistPhotoUrl: "",
      artistName: "",
      artistNameKana: "",
      artistNameAlpha: "",
      albumName: "",
      albumNameKana: "",
      albumNameAlpha: "",
      note: "",
      agreedTermsVersion: "",
      agreedAt: "",
    };
    saveDraft({
      ...base,
      agreedTermsVersion: NARASU_TERMS_VERSION,
      agreedAt: new Date().toISOString(),
    });
    router.push("/narasu-agency/form");
  }

  function handleDisagree() {
    router.push("/top");
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-extrabold text-slate-900">代理申請に関する確認事項</h1>
          <p className="mt-1 text-xs text-slate-400">お申し込み前に必ずご確認ください</p>

          <div className="mt-6 h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{TERMS_TEXT}</pre>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            <span className="text-sm text-slate-700">上記内容を確認し、同意します</span>
          </label>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleAgree}
              disabled={!agreed}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              同意する →
            </button>
            <button
              onClick={handleDisagree}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              同意しない（トップへ戻る）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

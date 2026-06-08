"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white text-slate-900">
      <div className="mx-auto max-w-[920px] px-4 py-10">
        {/* ===== ヘッダー ===== */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* 1段目：ロゴ + ログイン */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="LIFAI"
                className="h-12 w-12 rounded-2xl border border-slate-200 bg-white shadow-sm object-contain"
              />
              <div>
                <div className="text-lg font-bold">LIFAI</div>
                <div className="text-xs text-slate-500">AI教育サロン</div>
              </div>
            </div>

            {/* スマホではログインだけを右に */}
            <Link
              href="/login"
              className="md:hidden rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 transition"
            >
              ログイン
            </Link>
          </div>

          {/* 2段目：CTAボタン（スマホは横並び2つ / PCは右寄せ） */}
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2 md:justify-end">
            <Link
              href="/start"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              LIFAIって何？
            </Link>

            <Link
              href="/vision"
              className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-white hover:border-slate-300 transition"
              aria-label="もっと詳しく（ビジョンページへ）"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 group-hover:bg-indigo-100 transition">
                i
              </span>
              もっと詳しく
            </Link>

            {/* PCではログインもここに出す */}
            <Link
              href="/login"
              className="hidden md:inline-flex rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-100 transition"
            >
              ログイン
            </Link>

            <button
              disabled
              className="col-span-2 md:col-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400 cursor-not-allowed opacity-60"
            >
              🎨 AI作品集（準備中）
            </button>
          </div>
        </div>

        {/* ===== メインメッセージ ===== */}
        <div className="mt-14 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">
            AI × LIFE × 副業
            <br />
            <span className="text-indigo-600">学びを収益に変える場所</span>
          </h1>

          <p className="mt-6 text-slate-600 max-w-xl mx-auto leading-relaxed">
            LIFAIは、AIを使って「生活を豊かにする力」を身につけるための
            実践型オンラインサロンです。
          </p>
        </div>

        {/* ===== メインCTA ===== */}
        <div className="mt-10 grid gap-4 max-w-md mx-auto">
          <Link
            href="/5000"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-6 py-4 text-base font-bold text-white hover:bg-indigo-700 transition shadow-md"
          >
            権利購入（参加申請）
          </Link>

          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-800 hover:bg-slate-100 transition"
          >
            すでにIDをお持ちの方はこちら
          </Link>
        </div>

        {/* ===== 始め方 ===== */}
        <div className="relative mt-16 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
          {/* 背景ロゴ */}
          <img
            src="/logo.png"
            alt="LIFAI"
            className="absolute right-[-40px] bottom-[-40px] w-[280px] opacity-[0.06] pointer-events-none select-none"
          />

          <div className="relative z-10">
            <div className="text-lg font-bold mb-4">はじめ方</div>

            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
              <div>① 権利購入（仮想通貨）</div>
              <div>② 申請フォーム入力</div>
              <div>③ 承認後ログインID発行</div>
              <div>④ 学習開始・実践サポート</div>
            </div>
          </div>
        </div>

        {/* ===== 承認待ち ===== */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-bold mb-2">承認待ちの場合</div>
          <p className="text-sm text-slate-600 leading-relaxed">
            現在確認中の可能性があります。通常は数時間〜24時間以内に対応いたします。
          </p>
        </div>

        {/* ===== フッター：リンク & お問い合わせ ===== */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* リンク群 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <Link href="/invest" className="text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline">
                広告主様専用
              </Link>

              <Link href="/rule" className="text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline">
                利用規約
              </Link>

              <Link href="/referral" className="text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline">
                紹介プログラム
              </Link>

              {/* ✅ 追加 */}
              <Link href="/privacy" className="text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline">
                プライバシーポリシー
              </Link>

              <Link href="/tokushoho" className="text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline">
                特定商取引法に基づく表記
              </Link>
            </div>

            {/* お問い合わせボタン */}
            <div className="sm:pl-4">
              <a
                href="https://lin.ee/TZcMW09"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                お問い合わせ（公式LINE）
              </a>
              <div className="mt-1 text-[11px] text-slate-400">
                ※返信保証はありません（順次対応）
              </div>
            </div>
          </div>
        </div>

        {/* ===== ホーム画面に追加（PWA案内） ===== */}
        <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-center shadow-sm">
          <div className="text-sm font-extrabold text-indigo-800">📱 アプリのように使えます</div>

          <p className="mt-2 text-xs text-indigo-700 leading-relaxed">
            Safariでこのページを開き、
            「共有」→「ホーム画面に追加」を押してください。
          </p>

          <button
            onClick={() => alert("Safariで開いて\n共有 → ホーム画面に追加\nを押してください")}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition"
          >
            ホーム画面に追加する
          </button>
        </div>

        {/* ===== コピーライト ===== */}
        <div className="mt-10 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} LIFAI AI Salon
        </div>
      </div>
    </main>
  );
}

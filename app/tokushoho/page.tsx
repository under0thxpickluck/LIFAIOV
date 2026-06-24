"use client";

import { useRouter } from "next/navigation";

export default function TokushohoPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* 上部：タイトル＋戻る */}
        <div className="mb-10 flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-wide">
            特定商取引法に基づく表記
          </h1>

          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            戻る
          </button>
        </div>

        {/* 本文カード */}
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <div className="space-y-8 text-sm leading-relaxed text-neutral-700">
            <section>
              <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                販売事業者
              </h2>
              <p>LIFAI Labs, Inc.（LIFAI運営事務局）</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                所在地
              </h2>
              <p>
                131 Continental Dr, Suite 305
                <br />
                Newark, DE 19713 US
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                お問い合わせ
              </h2>
              <p>電話：+81 70 9276 2903</p>
              <p>メール：lifai.official@gmail.com</p>
              <p>
                公式LINE：
                <a
                  href="https://lin.ee/TZcMW09"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 underline text-indigo-600 hover:text-indigo-500"
                >
                  LIFAI公式LINE
                </a>
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                販売価格
              </h2>
              <p>各プランページに表示されたUSDT価格</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                支払方法
              </h2>
              <p>
                クレジットカード決済（Stripe）、銀行振込、
                USDT（仮想通貨）による一括支払い
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                役務提供時期
              </h2>
              <p>送金確認および承認完了時点より開始</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                提供内容
              </h2>
              <p>
                本サービスは、オンライン学習環境、AIツール利用権、
                ワークフロー機能等のデジタル役務を提供する会員制サービスです。
                物品の配送は行われません。
                利用条件および提供範囲は各プラン内容に準じます。
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                返品・返金について
              </h2>
              <p>
                ・役務提供開始後の返金は行いません。
                <br />
                ・プレセール期間中に設定された目標金額に達しなかった場合、
                役務提供開始前に限り全額USDTにて返金を行います。
                <br />
                ・返金時にネットワーク手数料が発生する場合があります。
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                クーリングオフについて
              </h2>
              <p>
                本サービスはインターネットを通じて提供されるデジタルコンテンツおよび役務であり、
                特定商取引法に定めるクーリングオフ制度の対象外となります。
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                仮想通貨決済に関する注意事項
              </h2>
              <p>
                USDT送金時のウォレットアドレス誤入力、ネットワーク選択ミス等による
                送金事故について当事務局は責任を負いません。
                また、仮想通貨の価格変動による損失についても補償いたしません。
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                表現および再現性
              </h2>
              <p>
                本サービスは学習・実践環境の提供を目的とし、
                収益や成果を保証するものではありません。
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                運営主体の変更
              </h2>
              <p>
                本サービスの運営主体は、事業譲渡・会社分割・合併等により
                変更される場合があります。
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

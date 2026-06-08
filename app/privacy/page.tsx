"use client";

import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-16">

        {/* 上部：タイトル＋戻る */}
        <div className="mb-10 flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-wide">
            プライバシーポリシー
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
          <div className="space-y-10 text-sm leading-relaxed text-neutral-700">

            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">
                1. 取得する情報
              </h2>
              <ul className="list-disc space-y-1 pl-6">
                <li>メールアドレス</li>
                <li>LINEアカウント情報（お問い合わせ時）</li>
                <li>ウォレットアドレス（USDT送金確認）</li>
                <li>アクセスログ・利用履歴</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">
                2. 利用目的
              </h2>
              <ul className="list-disc space-y-1 pl-6">
                <li>サービス提供および本人確認</li>
                <li>お問い合わせ対応</li>
                <li>不正防止・安全管理</li>
                <li>サービス改善</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">
                3. 第三者提供
              </h2>
              <p>
                法令に基づく場合を除き、本人の同意なく第三者へ提供することはありません。
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">
                4. データ管理
              </h2>
              <p>
                個人情報は適切なセキュリティ対策のもと管理し、
                不正アクセス・漏えいの防止に努めます。
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">
                5. 改定
              </h2>
              <p>
                本ポリシーは必要に応じて改定される場合があります。
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">
                6. 運営主体および連絡先
              </h2>
              <p>運営主体：LIFAI運営事務局</p>
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
              <p className="mt-2 text-xs text-neutral-500">
                ※返信保証はありません。順次対応いたします。
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">
                7. 外部サービスへの業務委託
              </h2>
              <p>
                本サービスは、決済処理（Stripe）、通信およびインフラ提供、
                公式LINE等の外部サービスを利用する場合があります。
                これらはサービス運営に必要な範囲で業務を委託するものであり、
                適切な管理のもとで取り扱います。
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">
                8. 開示・訂正・削除等の請求
              </h2>
              <p>
                ご本人から自己情報の開示・訂正・削除等の請求があった場合、
                本人確認のうえ、合理的な範囲で速やかに対応いたします。
                ご請求は本ポリシー記載の連絡先までご連絡ください。
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">
                9. Cookieおよびアクセス情報
              </h2>
              <p>
                本サービスでは、利便性向上および不正防止、
                サービス改善の目的でCookieやアクセス情報を利用する場合があります。
                これらは個人を特定する目的では使用いたしません。
              </p>
            </section>

          </div>
        </div>
      </div>
    </main>
  );
}
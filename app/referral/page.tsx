"use client";

import Link from "next/link";
import { useMemo } from "react";

type PlanRow = {
  plan: "40" | "67" | "134" | "667" | "1334";
  label: string;
  maxRefPerMonth: string; // 表現は柔らかく（例：2人まで / 10人まで / 制限なし）
  epCapPerMonth: string; // 例：2000EP
  epRateNormal: string; // 例：4EP=1円
  epRateMax: string; // 条件達成での最大（なければ "—"）
};

type EpRow = {
  amountUsd: number;
  first20Usd: number;
  add10Usd: number;
};

function formatUSD(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "indigo" | "emerald" | "amber" | "rose";
}) {
  const cls =
    tone === "indigo"
      ? "border-indigo-200 bg-indigo-50 text-indigo-800"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${cls}`}>
      {children}
    </span>
  );
}

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(2,6,23,.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-extrabold text-slate-900">{title}</div>
          {desc ? <div className="mt-1 text-sm text-slate-600 leading-relaxed">{desc}</div> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Diagram() {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 1段構造 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold text-slate-900">① 紹介は1段のみ</div>
            <Badge tone="indigo">MLMではない</Badge>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <Node label="あなた（A）" tone="indigo" sub="紹介者" />
              <Arrow />
              <Node label="参加者（B）" tone="emerald" sub="購入/申請" />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 opacity-80">
              <Node label="参加者（B）" tone="emerald" sub="Bが紹介" />
              <Arrow />
              <Node label="参加者（C）" tone="slate" sub="※Aには無関係" />
            </div>

            <div className="mt-4 text-xs text-slate-600 leading-relaxed">
              Aに発生するのは <b>「Aが直接紹介したB」</b> のみ。<br />
              Bが誰かを紹介しても、<b>Aに追加の報酬は発生しません</b>。
            </div>
          </div>
        </div>

        {/* 追加購入10% */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold text-slate-900">② 追加購入は10%（上限あり）</div>
            <Badge tone="amber">月の上限で止まる</Badge>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <Node label="参加者（B）" tone="emerald" sub="会員継続中" />
              <Arrow />
              <Node label="追加クレジット購入" tone="slate" sub="任意" />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <Node label="あなた（A）" tone="indigo" sub="紹介者" />
              <ArrowDown />
              <Node label="10% EP付与" tone="rose" sub="※月上限まで" />
            </div>

            <div className="mt-4 text-xs text-slate-600 leading-relaxed">
              追加クレジットの紹介報酬は <b>10%</b>。ただし <b>月の紹介人数上限</b> と <b>月のEP上限</b> を超えた分は付与されません。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Node({
  label,
  sub,
  tone = "slate",
}: {
  label: string;
  sub?: string;
  tone?: "slate" | "indigo" | "emerald" | "rose";
}) {
  const cls =
    tone === "indigo"
      ? "border-indigo-200 bg-indigo-50 text-indigo-900"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={`min-w-[140px] rounded-2xl border px-3 py-2 ${cls}`}>
      <div className="text-xs font-extrabold">{label}</div>
      {sub ? <div className="mt-1 text-[11px] text-slate-600">{sub}</div> : null}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-slate-400">
      <span className="text-xl font-black">→</span>
    </div>
  );
}
function ArrowDown() {
  return (
    <div className="flex items-center justify-center text-slate-400">
      <span className="text-xl font-black">↓</span>
    </div>
  );
}

export default function ReferralPage() {
  const planRows = useMemo<PlanRow[]>(
    () => [
      { plan: "40", label: "ENTRY", maxRefPerMonth: "2人まで", epCapPerMonth: "2,000円相当まで", epRateNormal: "4EP=1円", epRateMax: "—" },
      { plan: "67", label: "BUILDER", maxRefPerMonth: "5人まで", epCapPerMonth: "4,000円相当まで", epRateNormal: "4EP=1円", epRateMax: "3EP=1円" },
      { plan: "134", label: "AUTOMATION", maxRefPerMonth: "10人まで", epCapPerMonth: "8,000円相当まで", epRateNormal: "4EP=1円", epRateMax: "2.5EP=1円" },
      { plan: "667", label: "CORE", maxRefPerMonth: "上限なし", epCapPerMonth: "15,000円相当まで", epRateNormal: "4EP=1円", epRateMax: "2EP=1円" },
      { plan: "1334", label: "INFRA", maxRefPerMonth: "上限なし", epCapPerMonth: "30,000円相当まで", epRateNormal: "4EP=1円", epRateMax: "2EP=1円" },
    ],
    []
  );

  const epRows = useMemo<EpRow[]>(
    () => [
      { amountUsd: 40, first20Usd: 8, add10Usd: 4 },
      { amountUsd: 67, first20Usd: 13, add10Usd: 7 },
      { amountUsd: 134, first20Usd: 26, add10Usd: 13 },
      { amountUsd: 667, first20Usd: 134, add10Usd: 67 },
      { amountUsd: 1334, first20Usd: 267, add10Usd: 133 },
    ],
    []
  );

  return (
    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.14),transparent_60%),radial-gradient(900px_520px_at_112%_0%,rgba(34,211,238,.10),transparent_55%),linear-gradient(180deg,#FFFFFF,#F6F7FB_55%,#FFFFFF)]" />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(2,6,23,.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(2,6,23,.14) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
        }}
      />

      <div className="mx-auto max-w-[980px] px-4 py-10">
        {/* 上部ナビ */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm text-slate-600 hover:text-slate-900 underline decoration-slate-200 hover:decoration-slate-400"
          >
            ← トップへ戻る
          </Link>
          <Link
            href="/rule"
            className="text-sm text-slate-600 hover:text-slate-900 underline decoration-slate-200 hover:decoration-slate-400"
          >
            利用規約
          </Link>
        </div>

        {/* ヘッダー */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(2,6,23,.10)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_18px_rgba(99,102,241,.35)]" />
                LIFAI / 紹介サービス
              </div>

              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
                紹介サービス
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">
                LIFAIの紹介制度は <b>単層（1段）</b> です。<br />
                「組織で増える」「下位の売上が連鎖する」タイプではありません。<br />
                さらに、付与は <b>EP（ギフト交換ポイント）</b> のみで、１ヵ月あたりの上限を設けています。
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="indigo">紹介は1段のみ</Badge>
                <Badge tone="amber">月の上限あり</Badge>
                <Badge tone="emerald">EP付与（ギフト交換のみ）</Badge>
                <Badge tone="rose">最大20% / 追加10%</Badge>
              </div>
            </div>

            <div className="grid gap-2 md:min-w-[260px]">
              <Link
                href="/5000"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:opacity-95"
              >
                権利購入（参加申請） →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                ログイン
              </Link>
            </div>
          </div>

          {/* 重要まとめ */}
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-extrabold text-slate-700">初回購入</div>
              <div className="mt-2 text-xl font-extrabold text-slate-900">最大 20%</div>
              <div className="mt-1 text-xs text-slate-600">EPで付与（ギフト交換のみ）</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-extrabold text-slate-700">追加クレジット</div>
              <div className="mt-2 text-xl font-extrabold text-slate-900">10%</div>
              <div className="mt-1 text-xs text-slate-600">会員継続中のみ / 月上限まで</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-extrabold text-slate-700">紹介できる人</div>
              <div className="mt-2 text-xl font-extrabold text-slate-900">誰でもOK</div>
              <div className="mt-1 text-xs text-slate-600">EP受取は「紹介者アカウント（無料）」</div>
            </div>
          </div>

          {/* 図 */}
          <div className="mt-6">
            <Diagram />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Card
              title="紹介の基本ルール"
              desc="“分かりやすさ”のために、ルールを先に固定して公開します。"
            >
              <ul className="space-y-2 text-sm text-slate-700 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  紹介は <b>単層（1段）</b> のみ（A→Bのみ、B→Cは無関係）
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  初回購入の紹介報酬：<b>最大20%</b>（EP付与）
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  追加クレジットの紹介報酬：<b>10%</b>（会員継続中・月上限まで）
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  付与は <b>EP（ギフト交換ポイント）のみ</b>（現金の配当不可）
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  <b>月の紹介人数上限</b> と <b>月のEP上限</b> を超えた分は付与されません
                </li>
              </ul>
            </Card>

            <Card
              title="紹介者は会員でなくてもOK"
              desc="リンク共有（紹介）は誰でもできます。EPを受け取るには最低限の登録が必要です。"
            >
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 leading-relaxed">
                <div className="font-extrabold text-slate-900">流れ</div>
                <ol className="mt-2 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="mt-[2px] grid h-5 w-5 place-items-center rounded-lg bg-slate-900 text-white text-xs font-black">
                      1
                    </span>
                    紹介者（会員でなくてもOK）が紹介リンクを共有
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-[2px] grid h-5 w-5 place-items-center rounded-lg bg-slate-900 text-white text-xs font-black">
                      2
                    </span>
                    参加者（B）が購入/申請 → 承認 → 会員化
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-[2px] grid h-5 w-5 place-items-center rounded-lg bg-slate-900 text-white text-xs font-black">
                      3
                    </span>
                    紹介者は「紹介者アカウント（無料）」を作成してEPを受け取る
                  </li>
                </ol>
              </div>

              <div className="mt-4 text-xs text-slate-600 leading-relaxed">
                ※「誰でも紹介できる」を成立させつつ、不正や受取先の特定のために最低限の登録（無料）を推奨しています。
              </div>
            </Card>
          </div>

          {/* プラン上限 */}
          <div className="mt-6">
            <Card
              title="プラン別：紹介上限"
              desc="紹介人数の上限と、月のEP上限を公開します。"
            >
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-[840px] w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs text-slate-600">
                      <th className="px-4 py-3 font-extrabold">プラン</th>
                      <th className="px-4 py-3 font-extrabold">紹介人数上限（月）</th>
                      <th className="px-4 py-3 font-extrabold">EP上限（月）</th>
                      <th className="px-4 py-3 font-extrabold">EP換算（通常）</th>
                      <th className="px-4 py-3 font-extrabold">条件達成MAX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planRows.map((r) => (
                      <tr key={r.plan} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-extrabold text-slate-900">
                          ${r.plan} <span className="ml-2 text-xs font-semibold text-slate-500">{r.label}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{r.maxRefPerMonth}</td>
                        <td className="px-4 py-3 text-slate-700">{r.epCapPerMonth}</td>
                        <td className="px-4 py-3 text-slate-700">{r.epRateNormal}</td>
                        <td className="px-4 py-3 text-slate-700">{r.epRateMax}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs text-slate-600 leading-relaxed">
                ※ EP上限は「見え方が無限にならない」ための設計です。上限到達後は次月にリセットされます。
              </div>
            </Card>
          </div>

          {/* EP早見表 */}
          <div className="mt-6">
            <Card
              title="EP早見表（最大20% / 追加10%）"
              desc="“いくら分のEPが付与される？”が一目で分かります。"
            >
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-[760px] w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs text-slate-600">
                      <th className="px-4 py-3 font-extrabold">購入額</th>
                      <th className="px-4 py-3 font-extrabold">初回（最大20%）</th>
                      <th className="px-4 py-3 font-extrabold">追加（10%）</th>
                      <th className="px-4 py-3 font-extrabold">メモ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {epRows.map((r) => (
                      <tr key={r.amountUsd} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-extrabold text-slate-900">${formatUSD(r.amountUsd)}</td>
                        <td className="px-4 py-3 text-slate-700">${formatUSD(r.first20Usd)} 相当EP</td>
                        <td className="px-4 py-3 text-slate-700">${formatUSD(r.add10Usd)} 相当EP</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          月のEP上限／紹介人数上限を超える分は付与されません
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="emerald">EPはギフト交換のみ</Badge>
                <Badge tone="amber">月の上限あり</Badge>
                <Badge tone="indigo">単層（1段）</Badge>
              </div>
            </Card>
          </div>

          {/* よくある誤解 */}
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Card
              title="よくある誤解：MLMとの違い"
              desc="“どこが違うの？”を分かりやすく説明します。"
            >
              <div className="grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-extrabold text-slate-900">LIFAI（単層）</div>
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      直接紹介（A→B）だけ
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      下位の紹介（B→C）は無関係
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      月の上限がある（無限に増えない）
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-extrabold text-slate-900">一般的なMLM（多段）</div>
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-rose-500" />
                      下位の売上が連鎖的に上位へ分配される
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-rose-500" />
                      組織拡大が収益の中心になりやすい
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card
              title="必ずお読みください"
              desc="LIFAIの紹介制度についての最重要ポイントです。"
            >
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 leading-relaxed">
                <p className="font-extrabold text-slate-900">この紹介制度について</p>
                <p className="mt-2">
                  本制度は単層（1段）の紹介制度です。下位の紹介や組織構造による報酬発生は一切ありません。<br />
                  報酬はEP（ギフト交換ポイント）のみで付与され、現金配当・投資性・元本保証を目的としたものではありません。<br />
                  また、月の紹介人数上限／月のEP上限を設け、無制限に増える設計ではありません。
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 leading-relaxed">
                ※ 実運用上は不正防止のため、紹介者の受取には「紹介者アカウント（無料）」の登録を推奨します。
              </div>
            </Card>
          </div>

          {/* フッターリンク */}
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <Link
              href="/5000"
              className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-extrabold text-white hover:bg-indigo-700"
            >
              権利購入（参加申請）へ →
            </Link>
            <Link
              href="/rule"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              利用規約を見る
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
  );
}

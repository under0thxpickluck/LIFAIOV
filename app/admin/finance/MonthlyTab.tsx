"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LevelSummary = {
  level: number;
  initial_usd: number;
  initial_ep: number;
  cc_usd: number;
  cc_ep: number;
  total_ep: number;
  initial_sources: string[];
  cc_sources: string[];
};

type ReferrerSummary = {
  login_id: string;
  levels: LevelSummary[];
  total_initial_usd: number;
  total_initial_ep: number;
  total_cc_usd: number;
  total_cc_ep: number;
  total_ep: number;
};

type SummaryData = {
  month: string;
  usd_to_jpy: number;
  ep_per_jpy: number;
  plan_ep_rates?: Record<string, number>;
  referrers: ReferrerSummary[];
  summary: {
    total_initial_usd: number;
    total_initial_ep: number;
    total_cc_usd: number;
    total_cc_ep: number;
    total_ep: number;
    referrer_count: number;
  };
};

function currentMonth(): string {
  const now = new Date(Date.now() + 9 * 3600000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthOptions(): string[] {
  const opts: string[] = [];
  const now = new Date(Date.now() + 9 * 3600000);
  for (let i = 0; i < 13; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    opts.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return opts;
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split("-");
  return `${y}年${Number(mo)}月`;
}

function fmtUsd(v: number): string {
  return v === 0 ? "$0" : `$${v.toLocaleString()}`;
}

function fmtEp(v: number): string {
  return v === 0 ? "0 EP" : `${v.toLocaleString()} EP`;
}

const INIT_RATES = [10, 5, 2, 2, 1];
const CC_RATES   = [5, 2.5, 1, 1, 0.5];

export default function MonthlyTab() {
  const [month,    setMonth]    = useState<string>(currentMonth());
  const [data,     setData]     = useState<SummaryData | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [monthSummaries,  setMonthSummaries]  = useState<Array<{ month: string; total_ep: number; referrer_count: number } | null>>([]);
  const [summaryLoading,  setSummaryLoading]  = useState(false);

  const load = async (m: string) => {
    setLoading(true);
    setErr(null);
    setData(null);
    setExpanded(new Set());
    try {
      const res  = await fetch("/api/admin/affiliate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ month: m }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "failed");
      setData(json as SummaryData);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlySummaries = async () => {
    setSummaryLoading(true);
    const months = monthOptions().slice(0, 6);
    const results = await Promise.allSettled(
      months.map(m =>
        fetch("/api/admin/affiliate-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ month: m }),
        })
          .then(r => r.json())
          .then((j: any) => j?.ok ? { month: m, total_ep: Number(j.summary?.total_ep ?? 0), referrer_count: Number(j.summary?.referrer_count ?? 0) } : null)
          .catch(() => null)
      )
    );
    setMonthSummaries(results.map(r => r.status === "fulfilled" ? r.value : null));
    setSummaryLoading(false);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  useEffect(() => {
    load(currentMonth());
    loadMonthlySummaries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* 月選択 */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
        >
          {monthOptions().map(m => (
            <option key={m} value={m}>{fmtMonth(m)}</option>
          ))}
        </select>
        <button
          onClick={() => load(month)}
          disabled={loading}
          className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-black hover:bg-amber-600 disabled:opacity-50"
        >
          {loading ? "集計中…" : "表示する"}
        </button>
        {data && (
          <span className="text-xs text-zinc-500">
            {fmtMonth(data.month)} の集計 ／ 換算: 1 USD = {data.usd_to_jpy} 円
            {data.plan_ep_rates
              ? ` ／ EPレートは受取人プラン別（${Object.entries(data.plan_ep_rates).map(([p, r]) => `$${p}:${r}`).join(" / ")} EP/円、その他: ${data.ep_per_jpy}）`
              : ` × ${data.ep_per_jpy} EP/円`}
          </span>
        )}
      </div>

      {err && (
        <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{err}</div>
      )}

      {/* サマリカード */}
      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "紹介者数",         value: `${data.summary.referrer_count} 人` },
              { label: "初回入金 合計",     value: fmtUsd(data.summary.total_initial_usd) },
              { label: "初回 分配EP 合計",  value: fmtEp(data.summary.total_initial_ep),  color: "text-emerald-400" },
              { label: "合計アフィリエイトEP", value: fmtEp(data.summary.total_ep),       color: "text-amber-400" },
            ].map(c => (
              <div key={c.label} className="rounded-2xl bg-zinc-900 p-4">
                <p className="mb-1 text-xs text-zinc-400">{c.label}</p>
                <p className={`text-lg font-bold ${c.color ?? "text-white"}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* 注記 */}
          <p className="mb-3 text-xs text-zinc-500">
            CC決済（内部課金）列は Stripe 連携後に有効化されます。現在は表示のみ（—）。
          </p>

          {/* テーブル */}
          {data.referrers.length === 0 ? (
            <p className="text-sm text-zinc-500">対象期間にアフィリエイト発生なし</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-bold">紹介者</th>
                    <th className="px-3 py-2 font-bold text-center">段</th>
                    <th className="px-3 py-2 font-bold text-right">初回入金(USD)</th>
                    <th className="px-3 py-2 font-bold text-right">初回 分配EP<br/><span className="text-zinc-500 font-normal">（L1:10%〜L5:1%）</span></th>
                    <th className="px-3 py-2 font-bold text-right text-zinc-600">CC決済(USD)</th>
                    <th className="px-3 py-2 font-bold text-right text-zinc-600">CC 分配EP<br/><span className="font-normal">（L1:5%〜L5:0.5%）</span></th>
                    <th className="px-3 py-2 font-bold text-right">合計EP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.referrers.map(r => {
                    const isOpen = expanded.has(r.login_id);
                    return [
                      /* 合計行 */
                      <tr
                        key={r.login_id}
                        onClick={() => toggleExpand(r.login_id)}
                        className="cursor-pointer border-t border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/60"
                      >
                        <td className="px-3 py-2 font-mono font-bold text-zinc-200">
                          <span className="mr-1 text-zinc-500">{isOpen ? "▼" : "▶"}</span>
                          {r.login_id}
                        </td>
                        <td className="px-3 py-2 text-center text-zinc-400">合計</td>
                        <td className="px-3 py-2 text-right text-zinc-300 font-bold">{fmtUsd(r.total_initial_usd)}</td>
                        <td className="px-3 py-2 text-right text-emerald-400 font-bold">{fmtEp(r.total_initial_ep)}</td>
                        <td className="px-3 py-2 text-right text-zinc-600">—</td>
                        <td className="px-3 py-2 text-right text-zinc-600">—</td>
                        <td className="px-3 py-2 text-right text-amber-400 font-bold">{fmtEp(r.total_ep)}</td>
                      </tr>,

                      /* 段別内訳（展開時） */
                      ...(isOpen ? r.levels.map(lv => (
                        <tr key={`${r.login_id}-L${lv.level}`} className="border-t border-zinc-800/50 bg-zinc-950">
                          <td className="px-3 py-1.5 pl-8 text-zinc-500">
                            {lv.initial_sources.length > 0 && (
                              <span className="text-[10px] text-zinc-600">
                                {lv.initial_sources.slice(0, 3).join(", ")}
                                {lv.initial_sources.length > 3 ? ` 他${lv.initial_sources.length - 3}件` : ""}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              lv.level === 1 ? "bg-amber-900/50 text-amber-300"
                              : lv.level === 2 ? "bg-indigo-900/50 text-indigo-300"
                              : "bg-zinc-800 text-zinc-400"
                            }`}>
                              L{lv.level}
                              <span className="ml-1 font-normal opacity-60">
                                {INIT_RATES[lv.level - 1]}%
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right text-zinc-400">{fmtUsd(lv.initial_usd)}</td>
                          <td className="px-3 py-1.5 text-right text-emerald-500/80">{fmtEp(lv.initial_ep)}</td>
                          <td className="px-3 py-1.5 text-right text-zinc-600">—</td>
                          <td className="px-3 py-1.5 text-right text-zinc-600">—</td>
                          <td className="px-3 py-1.5 text-right text-zinc-300">{fmtEp(lv.total_ep)}</td>
                        </tr>
                      )) : []),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* 付与実行（プレビュー→人間の確認→ボタン付与） */}
      <GrantSection month={month} />

          {/* 直近6ヶ月サマリ */}
          <div className="mt-8">
            <p className="mb-3 text-sm font-bold text-zinc-300">直近6ヶ月サマリ（末締め）</p>
            {summaryLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-zinc-800" />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {monthOptions().slice(0, 6).map((m, i) => {
                  const s = monthSummaries[i];
                  return (
                    <button
                      key={m}
                      onClick={() => { setMonth(m); load(m); }}
                      className={[
                        "rounded-xl border p-3 text-left transition hover:border-amber-500/60",
                        month === m ? "border-amber-500 bg-zinc-800" : "border-zinc-800 bg-zinc-900"
                      ].join(" ")}
                    >
                      <p className="mb-1 text-[11px] font-bold text-zinc-400">{fmtMonth(m)}</p>
                      {s ? (
                        <>
                          <p className="text-sm font-bold text-amber-400">{fmtEp(s.total_ep)}</p>
                          <p className="text-[10px] text-zinc-500">{s.referrer_count} 人</p>
                        </>
                      ) : (
                        <p className="text-[10px] text-zinc-600">データなし</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

      {/* 初期設定：過去分の一括対象外マーク */}
      <CutoffSection />

      {/* ステーキングプール設定 */}
      <StakingPoolSection />
    </div>
  );
}

/* ============================================================
   付与実行セクション
   - 「未付与分を計算」→ GAS dry_run でプレビュー取得
   - 行ごとチェックボックス（5000ルート・日付なしはデフォルト除外）
   - 対象月をタイプして「付与実行」→ dry_run:false で本実行
   ============================================================ */

type GrantLevel = {
  level: number;
  to: string;
  rate_pct: number;
  ep_rate?: number; // 受取人プラン別のEPミントレート（EP/円）
  ep: number;
  status: string; // pending | excluded_legacy | excluded_zero | skipped_dup
};

type GrantRow = {
  apply_id: string;
  login_id: string;
  email: string;
  plan: string;
  amount_usd: number;
  date_used: string;
  flags: string[];
  excluded: boolean;
  exclude_reason: string;
  levels: GrantLevel[];
  row_total_ep: number;
  row_index: number;
};

type GrantPreview = {
  ok: boolean;
  month: string;
  usd_to_jpy: number;
  ep_per_jpy: number;
  plan_ep_rates?: Record<string, number>;
  rates: number[];
  rows: GrantRow[];
  totals: { row_count: number; grant_row_count: number; total_ep: number; referrer_count: number };
  per_referrer: { login_id: string; ep: number }[];
};

type GrantResult = {
  ok: boolean;
  batch_id?: string;
  granted_count?: number;
  granted_total_ep?: number;
  errors?: Array<{ apply_id: string; from: string; level: number; to: string; ep: number; error: string }>;
  partial?: boolean;
  error?: string;
};

const FLAG_LABELS: Record<string, { label: string; cls: string }> = {
  legacy_l1_paid: { label: "旧配当済み(L1除外)", cls: "bg-amber-900/60 text-amber-300" },
  route_5000:     { label: "5000ルート",          cls: "bg-red-900/60 text-red-300" },
  undated:        { label: "日付なし",             cls: "bg-zinc-700 text-zinc-300" },
  no_amount:      { label: "金額不明",             cls: "bg-red-900/60 text-red-300" },
};

const LEVEL_STATUS_LABELS: Record<string, string> = {
  excluded_legacy: "旧配当済みのため除外",
  excluded_zero:   "1EP未満のため除外",
  skipped_dup:     "台帳に付与記録あり（スキップ）",
};

function fmtDateShort(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function GrantSection({ month }: { month: string }) {
  const [preview,      setPreview]      = useState<GrantPreview | null>(null);
  const [previewMonth, setPreviewMonth] = useState<string>("");
  const [loading,      setLoading]      = useState(false);
  const [err,          setErr]          = useState<string | null>(null);
  const [checked,      setChecked]      = useState<Record<string, boolean>>({});
  const [confirmInput, setConfirmInput] = useState("");
  const [executing,    setExecuting]    = useState(false);
  const [result,       setResult]       = useState<GrantResult | null>(null);

  const loadPreview = async () => {
    setLoading(true);
    setErr(null);
    setPreview(null);
    setResult(null);
    setConfirmInput("");
    try {
      const res  = await fetch("/api/admin/affiliate-grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ month, dry_run: true }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "failed");
      const p = json as GrantPreview;
      setPreview(p);
      setPreviewMonth(month);
      // デフォルト選択: サーバー側で除外されていない行のみチェックON
      const init: Record<string, boolean> = {};
      p.rows.forEach(r => { init[r.apply_id] = !r.excluded; });
      setChecked(init);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  // チェック状態を反映した付与予定の合計（no_amount 行は選択不可のため常に除外）
  const selTotals = useMemo(() => {
    if (!preview) return { rows: 0, ep: 0, referrers: 0 };
    let ep = 0;
    let rows = 0;
    const refs = new Set<string>();
    for (const r of preview.rows) {
      if (!checked[r.apply_id]) continue;
      if (r.flags.includes("no_amount")) continue;
      let any = false;
      for (const lv of r.levels) {
        if (lv.status !== "pending") continue;
        ep += lv.ep;
        refs.add(lv.to);
        any = true;
      }
      if (any) rows++;
    }
    return { rows, ep, referrers: refs.size };
  }, [preview, checked]);

  const execute = async () => {
    if (!preview) return;
    if (confirmInput !== previewMonth) return;
    setExecuting(true);
    setErr(null);
    try {
      // デフォルトONだった行のチェックを外した → exclude、デフォルトOFFの行をONにした → include
      const exclude_apply_ids: string[] = [];
      const include_apply_ids: string[] = [];
      preview.rows.forEach(r => {
        if (r.flags.includes("no_amount")) return; // サーバー側で常に除外
        const on = !!checked[r.apply_id];
        if (!r.excluded && !on) exclude_apply_ids.push(r.apply_id);
        if (r.excluded  &&  on) include_apply_ids.push(r.apply_id);
      });
      const res  = await fetch("/api/admin/affiliate-grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ month: previewMonth, dry_run: false, exclude_apply_ids, include_apply_ids }),
      });
      const json = await res.json();
      setResult(json as GrantResult);
      if (json?.ok) {
        setPreview(null); // 付与済みになったのでプレビューは無効。再取得を促す
        setConfirmInput("");
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-1 text-sm font-bold text-zinc-200">🎁 アフィリエイト報酬 付与実行</h2>
      <p className="mb-4 text-[11px] text-zinc-500">
        「未付与分を計算」で対象月の未付与行をプレビュー →
        内容を確認（チェックで対象を調整） → 対象月を入力して付与実行。
        付与済みの行は二度と対象に出ません（行単位＋台帳単位の二重ガード）。
      </p>

      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={loadPreview}
          disabled={loading}
          className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-black hover:bg-amber-600 disabled:opacity-50"
        >
          {loading ? "計算中…" : `${fmtMonth(month)} の未付与分を計算`}
        </button>
        {preview && (
          <span className="text-xs text-zinc-500">
            換算: 1 USD = {preview.usd_to_jpy} 円
            {preview.plan_ep_rates
              ? ` ／ EPレートは受取人プラン別（${Object.entries(preview.plan_ep_rates).map(([p, r]) => `$${p}:${r}`).join(" / ")} EP/円、その他: ${preview.ep_per_jpy}）`
              : ` × ${preview.ep_per_jpy} EP/円`} ／
            料率 L1〜L5: {preview.rates.join("% / ")}%
          </span>
        )}
      </div>

      {err && <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{err}</div>}

      {/* 実行結果 */}
      {result && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${result.ok ? "bg-emerald-900/40 text-emerald-300" : "bg-red-900/50 text-red-300"}`}>
          {result.ok ? (
            <>
              <p className="font-bold">
                ✅ 付与完了: {result.granted_count ?? 0} 件 ／ 合計 {(result.granted_total_ep ?? 0).toLocaleString()} EP
                <span className="ml-2 font-mono text-[10px] opacity-70">batch: {result.batch_id}</span>
              </p>
              {result.partial && (
                <p className="mt-1 text-amber-300">
                  ⚠️ 実行時間の上限により途中で中断しました。もう一度「未付与分を計算」→付与実行で残りが処理されます（二重付与はされません）。
                </p>
              )}
              {(result.errors?.length ?? 0) > 0 && (
                <div className="mt-1 text-red-300">
                  <p className="font-bold">⚠️ 付与に失敗した明細（手動対応が必要）:</p>
                  {result.errors!.map((e, i) => (
                    <p key={i} className="font-mono text-[11px]">
                      L{e.level} → {e.to}（+{e.ep.toLocaleString()} EP, from {e.from}）: {e.error}
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p>❌ 実行エラー: {result.error ?? "unknown"}</p>
          )}
        </div>
      )}

      {preview && (
        <>
          {/* 選択サマリ */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              { label: "付与対象（選択中）", value: `${selTotals.rows} 件` },
              { label: "受取人数",           value: `${selTotals.referrers} 人` },
              { label: "付与EP合計",         value: fmtEp(selTotals.ep), color: "text-amber-400" },
            ].map(c => (
              <div key={c.label} className="rounded-xl bg-zinc-800 p-3">
                <p className="mb-1 text-[11px] text-zinc-400">{c.label}</p>
                <p className={`text-base font-bold ${(c as any).color ?? "text-white"}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {preview.rows.length === 0 ? (
            <p className="mb-4 text-sm text-zinc-500">
              未付与の対象行はありません（すべて付与済み、または対象月に承認行なし）。
            </p>
          ) : (
            <div className="mb-4 overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-800 text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-bold">付与</th>
                    <th className="px-3 py-2 font-bold">被紹介者（発生源）</th>
                    <th className="px-3 py-2 font-bold">日付</th>
                    <th className="px-3 py-2 font-bold text-right">金額</th>
                    <th className="px-3 py-2 font-bold">フラグ</th>
                    <th className="px-3 py-2 font-bold">付与内訳（L1〜L5）</th>
                    <th className="px-3 py-2 font-bold text-right">行合計EP</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map(r => {
                    const noAmount = r.flags.includes("no_amount");
                    const on = !!checked[r.apply_id] && !noAmount;
                    const rowEp = r.levels.reduce((s, lv) => s + (lv.status === "pending" ? lv.ep : 0), 0);
                    return (
                      <tr key={r.apply_id || String(r.row_index)} className={`border-t border-zinc-800 ${on ? "" : "opacity-50"}`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={noAmount}
                            onChange={e => setChecked(prev => ({ ...prev, [r.apply_id]: e.target.checked }))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-mono text-zinc-200">{r.login_id || "—"}</span>
                          <span className="ml-2 text-[10px] text-zinc-500">{r.email}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-zinc-400">{fmtDateShort(r.date_used)}</td>
                        <td className="px-3 py-2 text-right text-zinc-300">
                          {r.amount_usd ? `$${r.amount_usd.toLocaleString()}` : "—"}
                          <span className="ml-1 text-[10px] text-zinc-500">({r.plan || "—"})</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {r.flags.map(f => (
                              <span key={f} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${FLAG_LABELS[f]?.cls ?? "bg-zinc-700 text-zinc-300"}`}>
                                {FLAG_LABELS[f]?.label ?? f}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {r.levels.length === 0 ? (
                            <span className="text-zinc-600">紹介チェーンなし</span>
                          ) : (
                            <div className="space-y-0.5">
                              {r.levels.map(lv => (
                                <p key={lv.level} className={`font-mono text-[11px] ${lv.status === "pending" ? "text-emerald-400" : "text-zinc-600 line-through"}`}>
                                  L{lv.level}({lv.rate_pct}%) → {lv.to} +{lv.ep.toLocaleString()} EP
                                  {lv.ep_rate != null && (
                                    <span className="ml-1 text-[10px] text-zinc-500">@{lv.ep_rate}EP/円</span>
                                  )}
                                  {lv.status !== "pending" && (
                                    <span className="ml-1 no-underline text-[10px] text-zinc-500">
                                      {LEVEL_STATUS_LABELS[lv.status] ?? lv.status}
                                    </span>
                                  )}
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-amber-400">
                          {on ? fmtEp(rowEp) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 受取人別の内訳 */}
          {selTotals.referrers > 0 && (
            <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="mb-2 text-[11px] font-bold text-zinc-400">受取人別の付与予定（選択中の行のみ）</p>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const map: Record<string, number> = {};
                  preview.rows.forEach(r => {
                    if (!checked[r.apply_id] || r.flags.includes("no_amount")) return;
                    r.levels.forEach(lv => {
                      if (lv.status !== "pending") return;
                      map[lv.to] = (map[lv.to] || 0) + lv.ep;
                    });
                  });
                  return Object.entries(map)
                    .sort((a, b) => b[1] - a[1])
                    .map(([id, ep]) => (
                      <span key={id} className="rounded-lg bg-zinc-800 px-2 py-1 font-mono text-[11px] text-zinc-300">
                        {id}: <b className="text-amber-400">+{ep.toLocaleString()} EP</b>
                      </span>
                    ));
                })()}
              </div>
            </div>
          )}

          {/* 実行（二重確認: 対象月をタイプ） */}
          {selTotals.ep > 0 && (
            <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-4">
              <p className="mb-2 text-xs text-amber-300">
                ⚠️ この操作でEP残高が実際に増加し、wallet_ledger に記録されます。取り消しはできません。
                実行するには対象月 <b className="font-mono">{previewMonth}</b> を入力してください。
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={confirmInput}
                  onChange={e => setConfirmInput(e.target.value)}
                  placeholder={previewMonth}
                  className="w-32 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                />
                <button
                  onClick={execute}
                  disabled={executing || confirmInput !== previewMonth}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  {executing ? "付与実行中…" : `${selTotals.rows} 件・${fmtEp(selTotals.ep)} を付与する`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   初期設定セクション：過去分の一括対象外マーク
   - 指定月より前の承認済み・未付与行に「対象外」マークを付ける
   - EP付与はしない（新分配制度の開始月より前を締め出す初期化処理）
   ============================================================ */

function CutoffSection() {
  const [open,     setOpen]     = useState(false);
  const [month,    setMonth]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState<string | null>(null);
  const [previewN, setPreviewN] = useState<{ target_count: number; undated_count: number; rows: Array<{ apply_id: string; login_id: string; email: string; date_used: string }> } | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [doneMsg,  setDoneMsg]  = useState<string | null>(null);

  const loadPreview = async () => {
    if (!/^\d{4}-\d{2}$/.test(month)) { setErr("対象月を YYYY-MM 形式で入力してください"); return; }
    setLoading(true); setErr(null); setPreviewN(null); setDoneMsg(null); setConfirmInput("");
    try {
      const res  = await fetch("/api/admin/affiliate-cutoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ before_month: month, dry_run: true }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "failed");
      setPreviewN({ target_count: json.target_count ?? 0, undated_count: json.undated_count ?? 0, rows: json.rows ?? [] });
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const execute = async () => {
    if (confirmInput !== month) return;
    setExecuting(true); setErr(null);
    try {
      const res  = await fetch("/api/admin/affiliate-cutoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ before_month: month, dry_run: false }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "failed");
      setDoneMsg(`✅ ${json.marked_count ?? 0} 件を対象外にマークしました（batch: ${json.batch_id}）`);
      setPreviewN(null);
      setConfirmInput("");
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between text-left">
        <h2 className="text-sm font-bold text-zinc-200">⚙️ 初期設定：過去分を分配対象外にする</h2>
        <span className="text-zinc-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4">
          <p className="mb-3 text-[11px] text-zinc-500">
            新しい分配制度の開始月を指定すると、それより前に承認された未付与行へ一括で「対象外」マークを付けます
            （EPは付与されません）。マークされた行は以後の付与プレビューに出なくなります。
            通常は運用開始時に1回だけ実行します。例: 6月分から分配する場合は「2026-06」を指定 → 5月以前が対象外。
          </p>

          {err && <div className="mb-3 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{err}</div>}
          {doneMsg && <div className="mb-3 rounded-lg bg-emerald-900/40 px-4 py-2 text-sm text-emerald-300">{doneMsg}</div>}

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={month}
              onChange={e => setMonth(e.target.value)}
              placeholder="2026-06"
              className="w-32 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={loadPreview}
              disabled={loading}
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-bold text-white hover:bg-zinc-600 disabled:opacity-50"
            >
              {loading ? "確認中…" : "対象を確認（マークはまだしない）"}
            </button>
          </div>

          {previewN && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-zinc-300">
                <b className="text-amber-400">{previewN.target_count} 件</b> が「{month} より前」として対象外マークされます。
                {previewN.undated_count > 0 && (
                  <span className="ml-2 text-zinc-500">
                    （日付なしの未付与行が {previewN.undated_count} 件ありますが、これらはマークされません）
                  </span>
                )}
              </p>

              {previewN.rows.length > 0 && (
                <div className="mb-3 max-h-48 overflow-y-auto rounded-lg border border-zinc-800">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-zinc-800 text-zinc-400">
                      <tr>
                        <th className="px-2 py-1 font-bold">login_id</th>
                        <th className="px-2 py-1 font-bold">email</th>
                        <th className="px-2 py-1 font-bold">日付</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewN.rows.map((r, i) => (
                        <tr key={i} className="border-t border-zinc-800">
                          <td className="px-2 py-1 font-mono text-zinc-300">{r.login_id || "—"}</td>
                          <td className="px-2 py-1 text-zinc-500">{r.email}</td>
                          <td className="px-2 py-1 text-zinc-400">{fmtDateShort(r.date_used)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {previewN.target_count > 0 && (
                <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-4">
                  <p className="mb-2 text-xs text-amber-300">
                    ⚠️ マーク後、これらの行に報酬が付与されることはありません（手動での取り消しはシートの
                    affiliate_granted_at / affiliate_batch_id 列を空にすれば可能）。
                    実行するには <b className="font-mono">{month}</b> を入力してください。
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={confirmInput}
                      onChange={e => setConfirmInput(e.target.value)}
                      placeholder={month}
                      className="w-32 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={execute}
                      disabled={executing || confirmInput !== month}
                      className="rounded-lg bg-red-700 px-5 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-40"
                    >
                      {executing ? "マーク中…" : `${previewN.target_count} 件を対象外にする`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StakingPoolSection() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [month,    setMonth]    = useState(thisMonth);
  const [bpPool,   setBpPool]   = useState("");
  const [epPool,   setEpPool]   = useState("");
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState<string | null>(null);
  const [stats,    setStats]    = useState<{ pool: number; total_staked: number; participant_count: number; confirmed_rates: Record<string, number>; gauge_pct: number; remaining?: number; multipliers?: Record<string, number>; floors?: Record<string, number> } | null>(null);

  // 倍率・下限レート設定（編集用。floor は % 表記で保持）
  const [mult,      setMult]      = useState<Record<number, string>>({ 30: "", 60: "", 90: "" });
  const [floorPct,  setFloorPct]  = useState<Record<number, string>>({ 30: "", 60: "", 90: "" });
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgMsg,    setCfgMsg]    = useState<string | null>(null);
  const cfgInit = useRef(false);

  const loadStats = () => {
    fetch(`/api/staking?loginId=__pool_info_only__&type=bp`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.pool_info) setStats(d.pool_info); })
      .catch(() => {});
  };

  useEffect(() => {
    loadStats();
  }, []);

  // 初回ロード時に現在の倍率・下限レートを入力欄へプリセット
  useEffect(() => {
    if (stats && !cfgInit.current && stats.multipliers && stats.floors) {
      const m: Record<number, string> = { 30: "", 60: "", 90: "" };
      const f: Record<number, string> = { 30: "", 60: "", 90: "" };
      [30, 60, 90].forEach(d => {
        m[d] = String((stats.multipliers?.[d] ?? 0) * 100); // 最大レート（%表示）
        f[d] = String((stats.floors?.[d] ?? 0) * 100);
      });
      setMult(m);
      setFloorPct(f);
      cfgInit.current = true;
    }
  }, [stats]);

  const saveConfig = async () => {
    setCfgSaving(true); setCfgMsg(null);
    try {
      // multiplier は「最大レート」。入力は % なので小数へ変換して保存
      const config: Record<string, { multiplier: number; floor: number }> = {};
      [30, 60, 90].forEach(d => {
        config[d] = { multiplier: Number(mult[d]) / 100, floor: Number(floorPct[d]) / 100 };
      });
      const res  = await fetch("/api/admin/staking-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (data.ok) {
        setCfgMsg("✅ 最大レート・下限レートを保存しました");
        loadStats();
      }
      else setCfgMsg("❌ " + (data.error ?? "失敗しました"));
    } catch { setCfgMsg("❌ 通信エラー"); }
    setCfgSaving(false);
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const res  = await fetch("/api/admin/staking-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, bp_pool: Number(bpPool), ep_pool: Number(epPool) }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(`✅ ${month} のプールを設定しました`);
        loadStats(); // 保存後に最新のプール統計を再取得して画面へ反映
      }
      else setMsg("❌ " + (data.error ?? "失敗しました"));
    } catch { setMsg("❌ 通信エラー"); }
    setSaving(false);
  };

  return (
    <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-4 text-sm font-bold text-zinc-200">💎 ステーキングプール設定</h2>

      {/* 現在の統計 */}
      {stats && (
        <div className="mb-5 rounded-xl border border-zinc-700 bg-zinc-800 p-4">
          <p className="mb-2 text-xs font-bold text-zinc-400">現在のBP状況</p>
          <div className="flex flex-wrap gap-4 text-xs text-zinc-300">
            <span>今月プール: <b className="text-amber-400">{stats.pool.toLocaleString()} BP</b></span>
            <span>総ステーク: <b>{stats.total_staked.toLocaleString()} BP</b></span>
            <span>残り受付可能: <b className="text-sky-400">{(stats.remaining ?? Math.max(0, stats.pool - stats.total_staked)).toLocaleString()} BP</b></span>
            <span>参加者: <b>{stats.participant_count} 人</b></span>
          </div>
          <div className="mt-3 flex gap-3 text-xs">
            {[30, 60, 90].map(d => (
              <div key={d} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-center">
                <p className="text-zinc-500">{d}日</p>
                <p className="font-bold text-emerald-400">+{((stats.confirmed_rates[d] ?? 0) * 100).toFixed(1)}%</p>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] text-zinc-500">
              <span>プール消費率</span><span>{stats.gauge_pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-700">
              <div className="h-2 rounded-full bg-amber-500 transition-all" style={{ width: `${stats.gauge_pct}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* 入力フォーム */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-bold text-zinc-400">対象月</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-zinc-400">BPプール</label>
          <input type="number" min={0} value={bpPool} onChange={e => setBpPool(e.target.value)}
            placeholder="例: 10000"
            className="w-36 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-zinc-400">EPプール</label>
          <input type="number" min={0} value={epPool} onChange={e => setEpPool(e.target.value)}
            placeholder="例: 5000"
            className="w-36 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none" />
        </div>
        <div className="flex items-end">
          <button onClick={save} disabled={saving}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50">
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
      {msg && <p className={`mt-3 text-xs ${msg.startsWith("✅") ? "text-emerald-400" : "text-red-400"}`}>{msg}</p>}

      {/* 最大レート・下限レート設定（全体共通） */}
      <div className="mt-6 border-t border-zinc-800 pt-5">
        <h3 className="mb-1 text-sm font-bold text-zinc-200">⚙️ レート設定（最大レート・下限レート／全期間共通）</h3>
        <p className="mb-3 text-[11px] text-zinc-500">
          最大レート＝プールが空（消費率0%）のときのレート。プールが埋まるほど下限レートへ向けて下がります。変更は以降の新規ステークに適用されます。
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="px-2 py-1 text-left font-bold">期間</th>
                <th className="px-2 py-1 text-left font-bold">最大レート（%）</th>
                <th className="px-2 py-1 text-left font-bold">下限レート（%）</th>
              </tr>
            </thead>
            <tbody>
              {[30, 60, 90].map(d => (
                <tr key={d}>
                  <td className="px-2 py-1 font-bold text-zinc-300">{d}日</td>
                  <td className="px-2 py-1">
                    <input type="number" min={0} step="0.1" value={mult[d]}
                      onChange={e => setMult(prev => ({ ...prev, [d]: e.target.value }))}
                      placeholder="例: 10"
                      className="w-28 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min={0} step="0.1" value={floorPct[d]}
                      onChange={e => setFloorPct(prev => ({ ...prev, [d]: e.target.value }))}
                      placeholder="例: 0"
                      className="w-28 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={saveConfig} disabled={cfgSaving}
          className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50">
          {cfgSaving ? "保存中…" : "レート設定を保存"}
        </button>
        {cfgMsg && <p className={`mt-3 text-xs ${cfgMsg.startsWith("✅") ? "text-emerald-400" : "text-red-400"}`}>{cfgMsg}</p>}
      </div>
    </div>
  );
}

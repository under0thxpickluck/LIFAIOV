"use client";

import { useEffect, useState } from "react";

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
            {fmtMonth(data.month)} の集計 ／ 換算: 1 USD = {data.usd_to_jpy} 円 × {data.ep_per_jpy} EP/円
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

      {/* ステーキングプール設定 */}
      <StakingPoolSection />
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
  const [stats,    setStats]    = useState<{ pool: number; total_staked: number; participant_count: number; confirmed_rates: Record<string, number>; gauge_pct: number } | null>(null);

  useEffect(() => {
    const gasUrl = "";
    fetch(`/api/staking?loginId=__pool_info_only__&type=bp`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.pool_info) setStats(d.pool_info); })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const res  = await fetch("/api/admin/staking-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, bp_pool: Number(bpPool), ep_pool: Number(epPool) }),
      });
      const data = await res.json();
      if (data.ok) setMsg(`✅ ${month} のプールを設定しました`);
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
    </div>
  );
}

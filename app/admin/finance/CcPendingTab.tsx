"use client";

import { useEffect, useState } from "react";

type PendingItem = {
  square_payment_id: string;
  payer_login_id:    string;
  referrer_login_id: string;
  referrer_email:    string;
  amount_usd:        number;
  reward_ep:         number;
  status:            string;
  ts:                string;
  granted_at:        string;
};

function fmt(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function CcPendingTab() {
  const [items,      setItems]      = useState<PendingItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [err,        setErr]        = useState<string | null>(null);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [filter,     setFilter]     = useState<"all" | "pending" | "granted">("pending");

  const load = () => {
    setLoading(true);
    setErr(null);
    fetch("/api/admin/cc-affiliate-pending", { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (!json?.ok) throw new Error(json?.error ?? "failed");
        setItems(Array.isArray(json.items) ? json.items : []);
      })
      .catch(e => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const grant = async (payment_id: string) => {
    if (!window.confirm(`payment_id: ${payment_id} のEPを付与しますか？`)) return;
    setGrantingId(payment_id);
    try {
      const res  = await fetch("/api/admin/cc-affiliate-grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "grant failed");
      alert(`付与完了: ${data.reward_ep} EP → ${data.referrer_login_id}`);
      load();
    } catch (e: any) {
      alert("エラー: " + String(e?.message ?? e));
    } finally {
      setGrantingId(null);
    }
  };

  const filtered     = items.filter(i => filter === "all" || i.status === filter);
  const pendingCount = items.filter(i => i.status === "pending").length;

  return (
    <div>
      {err && <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{err}</div>}

      <div className="mb-4 flex items-center gap-3">
        {(["pending", "granted", "all"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "rounded-lg px-4 py-1.5 text-xs font-bold transition",
              filter === f ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200",
            ].join(" ")}
          >
            {f === "pending" ? `未付与 (${pendingCount})` : f === "granted" ? "付与済み" : "全件"}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
        >
          更新
        </button>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-zinc-800" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">対象なし</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-bold">日時</th>
                <th className="px-3 py-2 font-bold">購入者</th>
                <th className="px-3 py-2 font-bold">紹介者</th>
                <th className="px-3 py-2 font-bold text-right">USD額</th>
                <th className="px-3 py-2 font-bold text-right">付与予定EP</th>
                <th className="px-3 py-2 font-bold text-center">状態</th>
                <th className="px-3 py-2 font-bold text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.square_payment_id} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                  <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{fmt(item.ts)}</td>
                  <td className="px-3 py-2 font-mono text-zinc-200">{item.payer_login_id}</td>
                  <td className="px-3 py-2 font-mono text-zinc-200">{item.referrer_login_id}</td>
                  <td className="px-3 py-2 text-right text-zinc-300">${item.amount_usd.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-400">+{item.reward_ep.toLocaleString()} EP</td>
                  <td className="px-3 py-2 text-center">
                    <span className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      item.status === "pending"
                        ? "bg-amber-900/60 text-amber-300"
                        : "bg-emerald-900/60 text-emerald-300",
                    ].join(" ")}>
                      {item.status === "pending" ? "未付与" : "付与済み"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {item.status === "pending" ? (
                      <button
                        onClick={() => grant(item.square_payment_id)}
                        disabled={grantingId === item.square_payment_id}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {grantingId === item.square_payment_id ? "付与中…" : "付与"}
                      </button>
                    ) : (
                      <span className="text-zinc-600 text-[10px]">{fmt(item.granted_at)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

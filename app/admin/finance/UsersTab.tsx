"use client";

import { useEffect, useMemo, useState } from "react";

type AdminUser = {
  login_id: string;
  email?: string;
  name?: string;
  plan?: string;
  status?: string;
  created_at?: string;
  bp_balance?: number;
  ep_balance?: number;
  expected_paid?: number;
  actually_paid?: number;
  payment_status?: string;
  invoice_id?: string;
  order_id?: string;
  bp_granted_at?: string;
  bp_grant_plan?: string;
  referrer_login_id?: string;
  referrer_2_login_id?: string;
  referrer_3_login_id?: string;
  referrer_4_login_id?: string;
  referrer_5_login_id?: string;
  ref_path?: string;
  affiliate_granted_at?: string;
  [k: string]: any;
};

type LedgerItem = {
  ts: string;
  kind: string;
  login_id: string;
  email: string;
  amount: number;
  memo: string;
};

const EP_KINDS = new Set([
  "music_sell", "radio_ep", "rumble_weekly_ep", "deduct_ep",
]);
const BP_KINDS = new Set([
  "gacha_cost", "gacha_prize", "login_bonus", "deduct_bp",
  "rumble_daily_bp", "square_bp_purchase", "monthly_recover",
  "fortune_daily", "stake_lock", "stake_claim", "market_confirm_fee",
]);

function ledgerCurrency(kind: string): "EP" | "BP" | "USD" {
  if (EP_KINDS.has(kind)) return "EP";
  if (BP_KINDS.has(kind) || kind.startsWith("mission_")) return "BP";
  return "USD";
}

function clsx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function fmt(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800 py-2">
      <span className="shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="text-right text-xs text-zinc-200 break-all">{value ?? "—"}</span>
    </div>
  );
}

export default function UsersTab() {
  const [users,    setUsers]    = useState<AdminUser[]>([]);
  const [ledger,   setLedger]   = useState<LedgerItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState<string | null>(null);
  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "EP" | "BP" | "USD">("all");
  const [resetSending, setResetSending] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  useEffect(() => {
    setResetMsg(null);
  }, [selected]);

  const onSendResetMail = async () => {
    if (!selected) return;
    const target = (selected.login_id || selected.email || "").trim();
    if (!target) {
      setResetMsg("❌ login_id もメールアドレスも未設定のため送信できません");
      return;
    }
    if (!window.confirm(`${selected.email || target} 宛にパスワード再設定メールを送信します。よろしいですか？`)) {
      return;
    }
    setResetSending(true);
    setResetMsg(null);
    try {
      const r = await fetch("/api/admin/reset-resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target }),
      });
      const j = await r.json().catch(() => null);
      if (j?.ok) {
        setResetMsg("✅ 送信しました（リセットリンクは72時間有効）");
      } else {
        const reason =
          j?.error === "not_found"     ? "該当ユーザーが見つかりません（メール表記揺れの可能性）"
          : j?.error === "not_approved" ? "ステータスが approved ではないため送信できません"
          : j?.error === "missing_login_or_email" ? "login_id またはメールアドレスが未設定です"
          : String(j?.error ?? "unknown_error");
        setResetMsg(`❌ 送信失敗: ${reason}`);
      }
    } catch (e: any) {
      setResetMsg(`❌ 通信エラー: ${String(e?.message ?? e)}`);
    } finally {
      setResetSending(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/list",          { cache: "no-store" }).then(r => r.json()),
      fetch("/api/admin/wallet-ledger", { cache: "no-store" }).then(r => r.json()),
    ])
      .then(([listJson, ledgerJson]) => {
        if (!listJson?.ok) throw new Error(listJson?.error ?? "list_failed");
        const arr = Array.isArray(listJson.items) ? listJson.items
          : Array.isArray(listJson.rows) ? listJson.rows : [];
        setUsers(arr);
        setLedger(Array.isArray(ledgerJson?.items) ? ledgerJson.items : []);
      })
      .catch(e => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return users;
    const q = query.trim().toLowerCase();
    return users.filter(u =>
      (u.login_id ?? "").toLowerCase().includes(q) ||
      (u.email    ?? "").toLowerCase().includes(q) ||
      (u.name     ?? "").toLowerCase().includes(q)
    );
  }, [users, query]);

  const userLedger = useMemo(() => {
    if (!selected) return [];
    return ledger
      .filter(l => l.login_id === selected.login_id)
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [ledger, selected]);

  const filteredLedger = useMemo(() => {
    if (ledgerFilter === "all") return userLedger;
    return userLedger.filter(l => ledgerCurrency(l.kind) === ledgerFilter);
  }, [userLedger, ledgerFilter]);

  return (
    <div className="flex gap-4">
      <div className={clsx("flex flex-col", selected ? "w-1/2" : "w-full")}>
        <div className="mb-3">
          <input
            type="text"
            placeholder="login_id / メール / 名前で検索"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        {err && (
          <div className="mb-3 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{err}</div>
        )}

        {loading ? (
          <div className="h-32 animate-pulse rounded-xl bg-zinc-800" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400">login_id</th>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400">名前</th>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400">プラン</th>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400">ステータス</th>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400 text-right">EP</th>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400 text-right">BP</th>
                  <th className="px-3 py-2 text-xs font-bold text-zinc-400">紹介報酬</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr
                    key={u.login_id}
                    onClick={() => setSelected(u === selected ? null : u)}
                    className={clsx(
                      "cursor-pointer border-t border-zinc-800 hover:bg-zinc-800/50",
                      selected?.login_id === u.login_id && "bg-zinc-800"
                    )}
                  >
                    <td className="px-3 py-2 text-xs font-mono text-zinc-300">{u.login_id}</td>
                    <td className="px-3 py-2 text-xs text-zinc-200">{u.name ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-zinc-300">{u.plan ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={clsx(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        u.status === "approved"
                          ? "bg-emerald-900/60 text-emerald-300"
                          : "bg-amber-900/60 text-amber-300"
                      )}>
                        {u.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-zinc-200">{(u.ep_balance ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-right text-zinc-200">{(u.bp_balance ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{u.affiliate_granted_at ? "✅" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-zinc-600">{filtered.length} / {users.length} 件</p>
      </div>

      {selected && (
        <div className="w-1/2 rounded-xl border border-zinc-700 bg-zinc-900 p-4 overflow-y-auto max-h-[80vh]">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-bold text-white font-mono">{selected.login_id}</p>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              ✕ 閉じる
            </button>
          </div>

          <section className="mb-4">
            <p className="mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wide">基本情報</p>
            <Row label="メール"       value={selected.email} />
            <Row label="名前"         value={selected.name} />
            <Row label="プラン"       value={selected.plan} />
            <Row label="ステータス"   value={selected.status} />
            <Row label="登録日時"     value={fmt(selected.created_at)} />
          </section>

          <section className="mb-4">
            <p className="mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wide">アカウント操作</p>
            <button
              onClick={onSendResetMail}
              disabled={resetSending}
              className="w-full rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              {resetSending ? "送信中..." : "登録メールアドレスにパスワード再設定メールを送る"}
            </button>
            {resetMsg && (
              <p className={clsx(
                "mt-2 text-xs",
                resetMsg.startsWith("✅") ? "text-emerald-400" : "text-red-400"
              )}>
                {resetMsg}
              </p>
            )}
          </section>

          <section className="mb-4">
            <p className="mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wide">決済状況</p>
            <Row label="想定金額"       value={selected.expected_paid != null ? `${selected.expected_paid} USDT` : undefined} />
            <Row label="実際の入金"     value={selected.actually_paid  != null ? `${selected.actually_paid} USDT` : undefined} />
            <Row label="支払ステータス" value={selected.payment_status} />
            <Row label="invoice_id"    value={selected.invoice_id} />
            <Row label="order_id"      value={selected.order_id} />
          </section>

          <section className="mb-4">
            <p className="mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wide">BP / EP</p>
            <Row label="EP残高"       value={`${(selected.ep_balance ?? 0).toLocaleString()} EP`} />
            <Row label="BP残高"       value={`${(selected.bp_balance ?? 0).toLocaleString()} BP`} />
            <Row label="BP付与日"     value={fmt(selected.bp_granted_at)} />
            <Row label="BP付与プラン" value={selected.bp_grant_plan} />
          </section>

          <section className="mb-4">
            <p className="mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wide">紹介情報</p>
            <Row label="紹介者 L1"    value={selected.referrer_login_id} />
            <Row label="紹介者 L2"    value={selected.referrer_2_login_id} />
            <Row label="紹介者 L3"    value={selected.referrer_3_login_id} />
            <Row label="紹介者 L4"    value={selected.referrer_4_login_id} />
            <Row label="紹介者 L5"    value={selected.referrer_5_login_id} />
            <Row label="ref_path"     value={selected.ref_path} />
            <Row label="紹介報酬付与" value={fmt(selected.affiliate_granted_at)} />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                Wallet 履歴（{filteredLedger.length} / {userLedger.length} 件）
              </p>
              <div className="flex gap-1">
                {(["all", "EP", "BP", "USD"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setLedgerFilter(f)}
                    className={clsx(
                      "rounded-md px-2 py-0.5 text-[10px] font-bold transition",
                      ledgerFilter === f
                        ? f === "EP"  ? "bg-emerald-700 text-white"
                          : f === "BP"  ? "bg-amber-700 text-white"
                          : f === "USD" ? "bg-blue-700 text-white"
                          : "bg-zinc-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    )}
                  >
                    {f === "all" ? "全て" : f}
                  </button>
                ))}
              </div>
            </div>
            {userLedger.length === 0 ? (
              <p className="text-xs text-zinc-600">履歴なし</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full text-left">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="px-2 py-1.5 text-[10px] font-bold text-zinc-400">日時</th>
                      <th className="px-2 py-1.5 text-[10px] font-bold text-zinc-400">kind</th>
                      <th className="px-2 py-1.5 text-[10px] font-bold text-zinc-400 text-right">amount</th>
                      <th className="px-2 py-1.5 text-[10px] font-bold text-zinc-400">memo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map((l, i) => (
                      <tr key={i} className="border-t border-zinc-800">
                        <td className="px-2 py-1.5 text-[10px] text-zinc-400 whitespace-nowrap">{fmt(l.ts)}</td>
                        <td className="px-2 py-1.5 text-[10px] text-zinc-300">
                          <span className={clsx(
                            "mr-1 rounded px-1 py-0.5 text-[9px] font-bold",
                            ledgerCurrency(l.kind) === "EP"  ? "bg-emerald-900/60 text-emerald-400"
                            : ledgerCurrency(l.kind) === "BP"  ? "bg-amber-900/60 text-amber-400"
                            : "bg-blue-900/60 text-blue-400"
                          )}>
                            {ledgerCurrency(l.kind)}
                          </span>
                          {l.kind}
                        </td>
                        <td className={clsx(
                          "px-2 py-1.5 text-[10px] font-bold text-right",
                          l.amount >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {l.amount >= 0 ? "+" : ""}{l.amount.toLocaleString()}
                        </td>
                        <td className="px-2 py-1.5 text-[10px] text-zinc-500 max-w-[120px] truncate">{l.memo || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

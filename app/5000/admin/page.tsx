// app/5000/admin/page.tsx
"use client";

import { useEffect, useState } from "react";

type ApplyRow = {
  apply_id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  ref_id: string;
  created_at: string;
  login_id?: string;
  my_ref_code?: string;
  _rowIndex: string;
  [key: string]: string | undefined;
};

type MusicSellRequest5000 = {
  request_id: string;
  login_id: string;
  title: string;
  music_url: string;
  price_usdt: string;
  memo: string;
  status: string;
  created_at: string;
};

export default function Admin5000Page() {
  const [rows, setRows] = useState<ApplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  // --- 財務ゲートウェイ ---
  const [financePass, setFinancePass] = useState("");
  const [financeBusy, setFinanceBusy] = useState(false);
  const [financeErr,  setFinanceErr]  = useState<string | null>(null);

  // --- 音楽売却申請 ---
  const [musicSellRequests, setMusicSellRequests] = useState<MusicSellRequest5000[]>([]);
  const [musicSellLoading,  setMusicSellLoading]  = useState(false);
  const [musicSellErr,      setMusicSellErr]      = useState<string | null>(null);
  const [musicSellMsg,      setMusicSellMsg]      = useState<string | null>(null);
  const [updatingMusicId,   setUpdatingMusicId]   = useState<string | null>(null);
  const [deletingMusicId,   setDeletingMusicId]   = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/5000/admin/list", { cache: "no-store" });
      const data: any = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        setRows(data.rows || []);
      } else {
        setErr(data.error || "fetch failed");
      }
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadMusicSellRequests();
  }, []);

  const approve = async (applyId: string) => {
    if (!applyId) return;
    setApproving(applyId);
    setMessages((m) => ({ ...m, [applyId]: "承認中..." }));
    try {
      const res = await fetch("/api/5000/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applyId }),
      });
      const data: any = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        const msg = data.already
          ? `承認済み (loginId: ${data.loginId})`
          : `承認完了 (loginId: ${data.loginId}, refCode: ${data.myRefCode}, mail: ${data.resetSent ? "送信済" : "失敗"}, referralResults: ${JSON.stringify(data.referralResults)})`;
        setMessages((m) => ({ ...m, [applyId]: msg }));
        await load();
      } else {
        setMessages((m) => ({ ...m, [applyId]: `エラー: ${data.error || "unknown"}` }));
      }
    } catch (e: any) {
      setMessages((m) => ({ ...m, [applyId]: `エラー: ${String(e)}` }));
    } finally {
      setApproving(null);
    }
  };

  // ── 財務ゲートウェイ ──────────────────────────────────────
  const handleFinanceUnlock = async () => {
    if (!financePass.trim() || financeBusy) return;
    setFinanceBusy(true); setFinanceErr(null);
    try {
      const res  = await fetch("/api/admin/finance-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: financePass }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "unlock_failed");
      sessionStorage.setItem("finance_token", json.token);
      window.location.href = "/admin/finance";
    } catch (e: any) {
      setFinanceErr(String(e?.message ?? e));
    } finally {
      setFinanceBusy(false);
    }
  };

  // ── 音楽売却申請 ─────────────────────────────────────────
  const loadMusicSellRequests = async () => {
    setMusicSellLoading(true); setMusicSellErr(null);
    try {
      const res  = await fetch("/api/admin/music-sell-requests", { cache: "no-store" });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "fetch_failed");
      setMusicSellRequests(Array.isArray(json.requests) ? json.requests : []);
    } catch (e: any) {
      setMusicSellErr(String(e?.message ?? e));
    } finally {
      setMusicSellLoading(false);
    }
  };

  const handleMusicSellUpdate = async (requestId: string, status: "approved" | "rejected") => {
    setUpdatingMusicId(requestId); setMusicSellErr(null); setMusicSellMsg(null);
    try {
      const res  = await fetch("/api/admin/music-sell-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "update_failed");
      setMusicSellMsg(status === "approved" ? "✅ 承認しました" : "❌ 却下しました");
      await loadMusicSellRequests();
    } catch (e: any) {
      setMusicSellErr(String(e?.message ?? e));
    } finally {
      setUpdatingMusicId(null);
    }
  };

  const handleMusicSellDelete = async (requestId: string) => {
    setDeletingMusicId(requestId); setMusicSellErr(null); setMusicSellMsg(null);
    try {
      const res  = await fetch("/api/admin/music-sell-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "delete_failed");
      setMusicSellMsg("🗑 削除しました");
      await loadMusicSellRequests();
    } catch (e: any) {
      setMusicSellErr(String(e?.message ?? e));
    } finally {
      setDeletingMusicId(null);
    }
  };

  const pending = rows.filter((r) => r.status === "pending");
  const approved = rows.filter((r) => r.status === "approved");
  const other = rows.filter((r) => r.status !== "pending" && r.status !== "approved");

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold" style={{ color: "#6C63FF" }}>
            LIFAI /5000 管理パネル
          </h1>
          <button
            onClick={load}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            更新
          </button>
        </div>

        {loading && (
          <p className="mt-6 text-sm text-white/50">読み込み中...</p>
        )}
        {err && (
          <div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400">
            エラー: {err}
          </div>
        )}

        {!loading && !err && (
          <>
            <section className="mt-8">
              <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">
                承認待ち ({pending.length})
              </h2>
              {pending.length === 0 ? (
                <p className="mt-3 text-sm text-white/30">承認待ちの申請はありません</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="py-2 px-3 text-left text-white/50 font-medium">申請ID</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">氏名</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">メール</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">プラン</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">紹介コード</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">日時</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map((row) => (
                        <tr key={row.apply_id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 px-3 font-mono text-xs text-white/60">{row.apply_id}</td>
                          <td className="py-2 px-3">{row.name}</td>
                          <td className="py-2 px-3 text-white/70">{row.email}</td>
                          <td className="py-2 px-3">
                            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
                              ${row.plan}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-white/60">{row.ref_id || "—"}</td>
                          <td className="py-2 px-3 text-xs text-white/40">{row.created_at}</td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => approve(row.apply_id)}
                              disabled={approving === row.apply_id}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                              style={
                                approving === row.apply_id
                                  ? { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }
                                  : { background: "linear-gradient(135deg, #6C63FF, #00D4FF)", color: "#fff" }
                              }
                            >
                              {approving === row.apply_id ? "承認中..." : "承認"}
                            </button>
                            {messages[row.apply_id] && (
                              <p className="mt-1 text-[10px] text-white/50 max-w-xs break-all">
                                {messages[row.apply_id]}
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">
                承認済み ({approved.length})
              </h2>
              {approved.length === 0 ? (
                <p className="mt-3 text-sm text-white/30">承認済みの申請はありません</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="py-2 px-3 text-left text-white/50 font-medium">ログインID</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">氏名</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">メール</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">プラン</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">紹介コード</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">申請ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approved.map((row) => (
                        <tr key={row.apply_id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 px-3 font-mono text-xs text-cyan-400">{row.login_id || "—"}</td>
                          <td className="py-2 px-3">{row.name}</td>
                          <td className="py-2 px-3 text-white/70">{row.email}</td>
                          <td className="py-2 px-3">
                            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-300">
                              ${row.plan}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-purple-300">{row.my_ref_code || "—"}</td>
                          <td className="py-2 px-3 font-mono text-xs text-white/40">{row.apply_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {other.length > 0 && (
              <section className="mt-10">
                <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">
                  その他 ({other.length})
                </h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="py-2 px-3 text-left text-white/50 font-medium">申請ID</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">ステータス</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">氏名</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">メール</th>
                        <th className="py-2 px-3 text-left text-white/50 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {other.map((row) => (
                        <tr key={row.apply_id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 px-3 font-mono text-xs text-white/40">{row.apply_id}</td>
                          <td className="py-2 px-3 text-xs text-yellow-400">{row.status}</td>
                          <td className="py-2 px-3">{row.name}</td>
                          <td className="py-2 px-3 text-white/70">{row.email}</td>
                          <td className="py-2 px-3">
                            {row.status === "manual_review" && (
                              <div>
                                <button
                                  onClick={() => approve(row.apply_id)}
                                  disabled={approving === row.apply_id}
                                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                                  style={
                                    approving === row.apply_id
                                      ? { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }
                                      : { background: "linear-gradient(135deg, #f59e0b, #ef4444)", color: "#fff" }
                                  }
                                >
                                  {approving === row.apply_id ? "承認中..." : "手動承認"}
                                </button>
                                {messages[row.apply_id] && (
                                  <p className="mt-1 text-[10px] text-white/50 max-w-xs break-all">
                                    {messages[row.apply_id]}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
        {/* ═══ 財務管理ゲートウェイ ════════════════════════════ */}
        <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-lg font-semibold" style={{ color: "#6C63FF" }}>🔒 財務管理</p>
          <p className="mb-4 text-xs text-white/40">
            パスワードを入力して財務管理ページへ進んでください。ブラウザを閉じると再認証が必要です。
          </p>
          {financeErr && (
            <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400">
              {financeErr === "invalid_password" ? "パスワードが違います" : financeErr}
            </div>
          )}
          <div className="flex gap-3">
            <input
              type="password"
              placeholder="財務パスワード"
              value={financePass}
              onChange={e => setFinancePass(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleFinanceUnlock(); }}
              className="w-56 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-purple-500 focus:outline-none"
            />
            <button
              onClick={handleFinanceUnlock}
              disabled={financeBusy || !financePass.trim()}
              className="rounded-lg px-5 py-2 text-sm font-bold transition disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #6C63FF, #00D4FF)", color: "#fff" }}
            >
              {financeBusy ? "確認中…" : "財務管理へ →"}
            </button>
          </div>
        </section>

        {/* ═══ 楽曲売却申請 ════════════════════════════════════ */}
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-sm font-bold tracking-wider text-white/60 uppercase">
              楽曲売却申請
            </h2>
            <button
              onClick={loadMusicSellRequests}
              disabled={musicSellLoading}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 hover:bg-white/10 disabled:opacity-40"
            >
              {musicSellLoading ? "読み込み中…" : "更新"}
            </button>
          </div>

          {musicSellMsg && (
            <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-400">
              {musicSellMsg}
            </div>
          )}
          {musicSellErr && (
            <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400">
              エラー：{musicSellErr}
            </div>
          )}

          {musicSellLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-white/5" />
          ) : musicSellRequests.length === 0 ? (
            <p className="text-sm text-white/30">申請はありません</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-2 px-3 text-left text-white/50 font-medium text-xs">申請日時</th>
                    <th className="py-2 px-3 text-left text-white/50 font-medium text-xs">ユーザー</th>
                    <th className="py-2 px-3 text-left text-white/50 font-medium text-xs">楽曲タイトル</th>
                    <th className="py-2 px-3 text-left text-white/50 font-medium text-xs">希望価格</th>
                    <th className="py-2 px-3 text-left text-white/50 font-medium text-xs">ステータス</th>
                    <th className="py-2 px-3 text-right text-white/50 font-medium text-xs">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {musicSellRequests.map((req, i) => {
                    const busy = updatingMusicId === req.request_id;
                    const isPending = req.status === "pending";
                    return (
                      <tr key={req.request_id || i} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 px-3 text-xs text-white/40 whitespace-nowrap">{req.created_at}</td>
                        <td className="py-2 px-3 text-xs font-mono text-cyan-400">{req.login_id}</td>
                        <td className="py-2 px-3 text-xs text-white/70 max-w-[160px]">
                          <div className="truncate">{req.title}</div>
                        </td>
                        <td className="py-2 px-3 text-xs text-purple-300">{req.price_usdt ? `${req.price_usdt} EP` : "—"}</td>
                        <td className="py-2 px-3 text-xs">
                          <span className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            req.status === "approved" ? "bg-green-500/20 text-green-300"
                            : req.status === "rejected" ? "bg-white/10 text-white/30"
                            : "bg-yellow-500/20 text-yellow-300"
                          ].join(" ")}>
                            {req.status === "approved" ? "承認済" : req.status === "rejected" ? "却下済" : "審査中"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          {isPending && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleMusicSellUpdate(req.request_id, "approved")}
                                disabled={busy}
                                className="rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
                                style={{ background: "linear-gradient(135deg, #10b981, #0d9488)", color: "#fff" }}
                              >
                                {busy ? "…" : "承認"}
                              </button>
                              <button
                                onClick={() => handleMusicSellUpdate(req.request_id, "rejected")}
                                disabled={busy}
                                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-white/60 hover:bg-white/10 disabled:opacity-50"
                              >
                                {busy ? "…" : "却下"}
                              </button>
                            </div>
                          )}
                          {req.status === "approved" && (
                            <button
                              onClick={() => handleMusicSellDelete(req.request_id)}
                              disabled={deletingMusicId === req.request_id}
                              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              {deletingMusicId === req.request_id ? "…" : "🗑 削除"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

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

export default function Admin5000Page() {
  const [rows, setRows] = useState<ApplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

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

  useEffect(() => { load(); }, []);

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
      </div>
    </main>
  );
}

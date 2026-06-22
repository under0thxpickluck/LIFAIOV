"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingCat } from "@/components/LoadingCat";
import Link from "next/link";
import { getAuth, getAuthSecret } from "@/app/lib/auth";

type TxRecord = {
  id: string;
  from_user: string;
  to_user: string;
  amount: number;
  created_at: string;
  expiry_date: string;
  status: string;
  note: string;
};

type Tab = "received" | "sent" | "expired";

export default function GiftHistoryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("received");
  const [sent, setSent] = useState<TxRecord[]>([]);
  const [received, setReceived] = useState<TxRecord[]>([]);
  const [expired, setExpired] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const auth = getAuth();
    if (!auth) { router.replace("/login"); return; }
    const id = (auth as any)?.id || (auth as any)?.loginId || "";
    const code = getAuthSecret() || (auth as any)?.token || "";

    fetch("/api/gift/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, code }),
      cache: "no-store",
    })
      .then(r => r.json())
      .catch(() => ({ ok: false }))
      .then((data: any) => {
        if (data.ok) {
          setSent(data.sent || []);
          setReceived(data.received || []);
          setExpired(data.expired || []);
        } else {
          setError(data.error || "取得に失敗しました");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  const tabs: { key: Tab; label: string; data: TxRecord[] }[] = [
    { key: "received", label: "受け取った", data: received },
    { key: "sent",     label: "贈った",     data: sent },
    { key: "expired",  label: "失効",       data: expired },
  ];

  const current = tabs.find(t => t.key === tab)!;
  const statusColor = (s: string) => s === "expired" ? "rgba(234,240,255,0.3)" : "#A78BFA";

  return (
    <main style={{ minHeight: "100vh", background: "#0B1220", color: "#EAF0FF" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: -10, pointerEvents: "none",
        background: "radial-gradient(ellipse 600px 400px at 20% -10%, rgba(124,58,237,0.12) 0%, transparent 60%)" }} />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <Link href="/gift" style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)", padding: "6px 14px", fontSize: 12,
            fontWeight: 600, color: "rgba(234,240,255,0.65)", textDecoration: "none" }}>
            ← 戻る
          </Link>
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(234,240,255,0.45)" }}>📋 GiftEP履歴</span>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex: 1, borderRadius: 12, border: "1px solid",
                borderColor: tab === t.key ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)",
                background: tab === t.key ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                padding: "8px", fontSize: 12, fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? "#A78BFA" : "rgba(234,240,255,0.45)", cursor: "pointer" }}>
              {t.label}
              <span style={{ marginLeft: 4, fontSize: 10 }}>({t.data.length})</span>
            </button>
          ))}
        </div>

        {loading && <div style={{ padding: "40px 0", display: "flex", justifyContent: "center" }}><LoadingCat fullscreen={false} /></div>}
        {error && <p style={{ fontSize: 13, color: "#FCA5A5" }}>{error}</p>}

        {!loading && current.data.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <p style={{ fontSize: 13, color: "rgba(234,240,255,0.3)" }}>
              {tab === "received" ? "受け取ったGiftEPはありません" :
               tab === "sent" ? "贈ったGiftEPはありません" : "失効したGiftEPはありません"}
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {current.data.map(tx => (
            <div key={tx.id} style={{ background: "#0F1A2E", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: 11, color: "rgba(234,240,255,0.4)", marginBottom: 4 }}>
                    {tab === "sent" ? `→ ${tx.to_user}` : `← ${tx.from_user}`}
                  </p>
                  {tx.note && <p style={{ fontSize: 12, color: "rgba(234,240,255,0.65)", marginBottom: 4 }}>"{tx.note}"</p>}
                  <p style={{ fontSize: 10, color: "rgba(234,240,255,0.3)" }}>
                    {isNaN(new Date(tx.created_at).getTime()) ? tx.created_at : new Date(tx.created_at).toLocaleString("ja-JP")}
                    {tx.status === "expired" ? " · 失効済" : tx.expiry_date ? ` · 有効期限: ${tx.expiry_date}` : ""}
                  </p>
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: statusColor(tx.status), flexShrink: 0 }}>
                  {tx.amount.toLocaleString()}
                  <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>GiftEP</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "rgba(234,240,255,0.2)" }}>© LIFAI</div>
      </div>
    </main>
  );
}

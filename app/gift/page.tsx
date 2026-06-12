"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuth, getAuthSecret } from "@/app/lib/auth";
import GiftEPTutorial, { useGiftEPTutorial } from "@/components/GiftEPTutorial";

type BalanceData = {
  balance: number;
  expiring_soon: number;
  next_expiry_date: string | null;
};

export default function GiftEPTopPage() {
  const router = useRouter();
  const [myId, setMyId] = useState("");
  const [myCode, setMyCode] = useState("");
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const { open: tutorialOpen, openTutorial, closeTutorial } = useGiftEPTutorial();

  useEffect(() => {
    const auth = getAuth();
    if (!auth) { router.replace("/login"); return; }
    const id = (auth as any)?.id || (auth as any)?.loginId || "";
    const code = getAuthSecret() || (auth as any)?.token || "";
    setMyId(id);
    setMyCode(code);

    fetch("/api/gift/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, code }),
      cache: "no-store",
    })
      .then(r => r.json())
      .catch(() => ({ ok: false, error: "network" }))
      .then((res: any) => {
        if (res.ok) {
          setData({ balance: res.balance, expiring_soon: res.expiring_soon, next_expiry_date: res.next_expiry_date });
        } else {
          setLoadError(res.error === "auth_failed"
            ? "認証エラーが発生しました。再度ログインしてください。"
            : "残高の取得に失敗しました。時間をおいて再度お試しください。");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", background: "#0B1220", color: "#EAF0FF" }}>
      <GiftEPTutorial open={tutorialOpen} onClose={closeTutorial} />

      <div style={{ position: "fixed", inset: 0, zIndex: -10, pointerEvents: "none",
        background: "radial-gradient(ellipse 800px 500px at 20% -10%, rgba(124,58,237,0.18) 0%, transparent 60%)" }} />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <Link href="/top" style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)", padding: "6px 14px", fontSize: 12,
            fontWeight: 600, color: "rgba(234,240,255,0.65)", textDecoration: "none" }}>
            ← 戻る
          </Link>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9999,
            border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
            padding: "4px 12px", fontSize: 12, fontWeight: 600, color: "rgba(234,240,255,0.65)" }}>
            🎁 GiftEP
          </div>
          <button
            onClick={openTutorial}
            style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: 9999,
              border: "1px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.1)",
              fontSize: 13, fontWeight: 700, color: "#A78BFA", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            ?
          </button>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", color: "#EAF0FF", marginBottom: 4 }}>
          GiftEP
        </h1>
        <p style={{ fontSize: 12, color: "rgba(234,240,255,0.45)", marginBottom: 24 }}>
          贈れる・使える、LIFAI内限定ギフトクレジット（有効期限30日）
        </p>

        <div style={{ background: "#0F1A2E", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24, padding: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.4)", marginBottom: 16 }}>
          {loading ? (
            <p style={{ fontSize: 13, color: "rgba(234,240,255,0.4)" }}>読み込み中…</p>
          ) : loadError ? (
            <p style={{ fontSize: 12, color: "#FCA5A5" }}>{loadError}</p>
          ) : (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(167,139,250,0.7)", marginBottom: 6 }}>
                GiftEP残高
              </p>
              <p style={{ fontSize: 36, fontWeight: 800, color: "#A78BFA", lineHeight: 1 }}>
                {(data?.balance ?? 0).toLocaleString()}
                <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 6, color: "rgba(167,139,250,0.6)" }}>GiftEP</span>
              </p>
              {data?.expiring_soon && data.expiring_soon > 0 ? (
                <p style={{ marginTop: 10, fontSize: 11, color: "#FCD34D" }}>
                  ⚠ {data.expiring_soon.toLocaleString()} GiftEP が7日以内に失効します
                  {data.next_expiry_date && `（${data.next_expiry_date}）`}
                </p>
              ) : data?.next_expiry_date ? (
                <p style={{ marginTop: 10, fontSize: 11, color: "rgba(234,240,255,0.35)" }}>
                  次回失効日: {data.next_expiry_date}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
          {[
            { href: "/gift/send", icon: "🎁", label: "GiftEPを贈る" },
            { href: "/gift/history", icon: "📋", label: "履歴" },
            { href: "/gift/use", icon: "✨", label: "使い道" },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ background: "#0F1A2E",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "16px 8px",
              textAlign: "center", textDecoration: "none", display: "block" }}>
              <p style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(234,240,255,0.7)" }}>{item.label}</p>
            </Link>
          ))}
        </div>

        <div style={{ borderRadius: 16, border: "1px solid rgba(167,139,250,0.2)",
          background: "rgba(124,58,237,0.06)", padding: "14px 16px",
          fontSize: 11, color: "rgba(167,139,250,0.7)", lineHeight: 1.9 }}>
          <p style={{ fontWeight: 700, color: "rgba(167,139,250,0.9)", marginBottom: 6 }}>⚠ GiftEP利用ルール</p>
          <p>・GiftEPは換金できません</p>
          <p>・受け取ったGiftEPは再送できません</p>
          <p>・マーケットや外部サービスでの利用は禁止です</p>
          <p>・有効期限は付与から30日です</p>
          <p>・外部売買・換金目的での利用は永久BANの対象です</p>
        </div>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "rgba(234,240,255,0.2)" }}>© LIFAI</div>
      </div>
    </main>
  );
}

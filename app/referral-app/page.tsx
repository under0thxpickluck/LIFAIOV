"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuth, getAuthSecret } from "@/app/lib/auth";
import { QRCodeSVG } from "qrcode.react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Referral = {
  login_id: string;
  plan: string;
  approved_at: string;
};

type Bonus = {
  ts: string;
  kind: string;
  amount: number;
  memo: string;
};

type DashboardData = {
  my_ref_code: string;
  referrals: Referral[];
  bonuses: Bonus[];
  total_bonus: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskId(id: string): string {
  if (id.length <= 4) return id;
  return id.slice(0, 2) + "***" + id.slice(-2);
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function formatAmount(n: number): string {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthKey(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

function getCurrentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getPrevMonthKey(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function kindLabel(kind: string): string {
  if (kind === "referral_bonus") return "紹介報酬";
  if (kind === "referral_entry") return "入会報酬";
  return kind;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:        "#08111E",
  card:      "#0D1B2A",
  cardAlt:   "#0A1628",
  border:    "rgba(255,255,255,0.07)",
  borderEm:  "rgba(16,185,129,0.25)",
  text:      "#E8F4F0",
  textMuted: "rgba(232,244,240,0.45)",
  textDim:   "rgba(232,244,240,0.25)",
  em:        "#10B981",
  emDim:     "rgba(16,185,129,0.7)",
  emBg:      "rgba(16,185,129,0.1)",
  emBorder:  "rgba(16,185,129,0.2)",
  shadow:    "0 8px 40px rgba(0,0,0,0.5)",
  shadowEm:  "0 0 24px rgba(16,185,129,0.12)",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skel({ w = "100%", h = 16 }: { w?: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 8,
      background: "rgba(255,255,255,0.05)",
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

// ─── Monthly Bonuses ──────────────────────────────────────────────────────────

function MonthlyBonuses({ bonuses }: { bonuses: Bonus[] }) {
  const monthKeys = Array.from(new Set(bonuses.map((b) => getMonthKey(b.ts)).filter(Boolean)))
    .sort().reverse();

  const [openMonths, setOpenMonths] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (monthKeys[0]) s.add(monthKeys[0]);
    return s;
  });

  if (monthKeys.length === 0) return null;

  const toggle = (key: string) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden", boxShadow: C.shadow }}>
      <p style={{ padding: "14px 18px 10px", fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.08em" }}>
        月別報酬
      </p>
      {monthKeys.map((key) => {
        const mb = bonuses.filter((b) => getMonthKey(b.ts) === key);
        const total = mb.reduce((s, b) => s + b.amount, 0);
        const isOpen = openMonths.has(key);
        return (
          <div key={key} style={{ borderTop: `1px solid ${C.border}` }}>
            <button
              onClick={() => toggle(key)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "13px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{getMonthLabel(key)}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.em }}>{formatAmount(total)}</span>
                <span style={{ fontSize: 10, color: C.textDim }}>{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>
            {isOpen && (
              <div style={{ padding: "0 18px 14px" }}>
                <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${C.border}` }}>
                  <table style={{ minWidth: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                        {["日付","種別","金額","メモ"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: h === "金額" ? "right" : "left", fontWeight: 700, color: C.textDim, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mb.map((b, i) => (
                        <tr key={b.ts + b.kind + i} style={{ borderTop: `1px solid ${C.border}` }}>
                          <td style={{ padding: "8px 12px", color: C.textMuted, whiteSpace: "nowrap" }}>{formatDate(b.ts)}</td>
                          <td style={{ padding: "8px 12px", color: C.textMuted }}>{kindLabel(b.kind)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: C.em }}>{formatAmount(b.amount)}</td>
                          <td style={{ padding: "8px 12px", color: C.textDim, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.memo || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Referral Tree (vertical list / Option A) ─────────────────────────────────

function ReferralTree({ referrals }: { referrals: Referral[] }) {
  if (referrals.length === 0) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "18px 18px 14px", boxShadow: C.shadow }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.08em", marginBottom: 16 }}>紹介ツリー</p>
      {/* Root */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.em, boxShadow: `0 0 8px ${C.em}`, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: C.em }}>あなた</span>
      </div>
      {/* Children */}
      <div style={{ paddingLeft: 3 }}>
        {referrals.map((r, i) => {
          const isLast = i === referrals.length - 1;
          return (
            <div key={r.login_id + i} style={{ display: "flex", alignItems: "stretch" }}>
              {/* Connector lines */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
                <div style={{ width: 1, height: 14, background: "rgba(16,185,129,0.3)" }} />
                <div style={{ display: "flex", alignItems: "center", height: 20 }}>
                  <div style={{ width: 1, height: isLast ? "50%" : "100%", background: "rgba(16,185,129,0.3)", alignSelf: "flex-start" }} />
                </div>
                {!isLast && <div style={{ width: 1, flex: 1, background: "rgba(16,185,129,0.3)" }} />}
              </div>
              <div style={{ display: "flex", alignItems: "center", height: 20, marginBottom: 4, paddingLeft: 6, marginTop: 14 }}>
                <div style={{ width: 10, height: 1, background: "rgba(16,185,129,0.3)", marginRight: 8 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.cardAlt,
                  border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 12px", minWidth: 0 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: C.text, fontWeight: 600 }}>{maskId(r.login_id)}</span>
                  <span style={{ fontSize: 11, color: C.emDim, fontWeight: 700 }}>${r.plan}</span>
                  <span style={{ fontSize: 10, color: C.textDim, whiteSpace: "nowrap" }}>{formatDate(r.approved_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Password Gate ────────────────────────────────────────────────────────────

const APP_PASSWORD = "boss";
const SESSION_KEY = "referral_app_authed";

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (pw === APP_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onAuth();
    } else {
      setError(true);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: 32, width: "100%", maxWidth: 360, boxShadow: C.shadow }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, textAlign: "center", marginBottom: 6, color: C.text }}>🤝 リファラ</h2>
        <p style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginBottom: 24 }}>紹介実績・報酬・コード共有</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="パスワードを入力"
          style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${error ? "rgba(252,165,165,0.5)" : C.border}`,
            borderRadius: 14, padding: "12px 16px", fontSize: 13, color: C.text, outline: "none",
            marginBottom: 10, boxSizing: "border-box" }}
        />
        {error && <p style={{ fontSize: 12, color: "#FCA5A5", textAlign: "center", marginBottom: 10 }}>パスワードが違います</p>}
        <button
          onClick={submit}
          style={{ width: "100%", padding: "13px", borderRadius: 14,
            background: "linear-gradient(135deg, #10B981, #0D9488)", border: "none",
            fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer",
            boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}
        >
          入室する
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReferralAppPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<"code" | "url" | "">("");
  const [qrOpen, setQrOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") setAuthed(true);
  }, []);

  const fetchData = useCallback(async () => {
    const auth = getAuth();
    if (!auth || auth.status !== "approved") { router.replace("/login"); return; }
    const id = (auth as any)?.id || (auth as any)?.loginId || "";
    const code = getAuthSecret() || (auth as any)?.token || "";
    if (!id || !code) { router.replace("/login"); return; }

    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/referral/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ id, code }),
      });
      const json: any = await res.json().catch(() => ({ ok: false, error: "not_json" }));
      if (!json?.ok) {
        if (json?.reason === "pending") router.replace("/login");
        else setErr(json?.error || json?.reason || "failed");
        return;
      }
      setData(json.dashboard);
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!authed) return;
    const t = setTimeout(() => fetchData(), 50);
    return () => clearTimeout(t);
  }, [authed, fetchData]);

  const copy = async (text: string, kind: "code" | "url") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setErr("クリップボードへのコピーに失敗しました");
    }
  };

  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />;

  const auth = getAuth();
  const group = (data as any)?.group || (auth as any)?.group || "";
  const is5000 = group === "5000";
  const purchasePath = is5000 ? "/5000" : "/purchase/jam";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const refCode = data?.my_ref_code || "";
  const refUrl = refCode ? `${origin}${purchasePath}?refCode=${encodeURIComponent(refCode)}` : "";

  const currentKey = getCurrentMonthKey();
  const prevKey = getPrevMonthKey();
  const currentMonthBonus = data
    ? data.bonuses.filter((b) => getMonthKey(b.ts) === currentKey).reduce((s, b) => s + b.amount, 0)
    : 0;
  const prevMonthBonus = data
    ? data.bonuses.filter((b) => getMonthKey(b.ts) === prevKey).reduce((s, b) => s + b.amount, 0)
    : 0;

  const visibleReferrals = showAll ? (data?.referrals ?? []) : (data?.referrals ?? []).slice(0, 5);

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      {/* Radial glow */}
      <div style={{ position: "fixed", inset: 0, zIndex: -10, pointerEvents: "none",
        background: "radial-gradient(ellipse 700px 400px at 70% -5%, rgba(16,185,129,0.1) 0%, transparent 60%)" }} />

      {/* QR モーダル */}
      {qrOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}
          onClick={() => setQrOpen(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 28, padding: 32, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 14, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>紹介リンク QR</p>
            <QRCodeSVG value={refUrl || "https://lifai.vercel.app"} size={200} />
            <p style={{ fontSize: 9, color: "#94a3b8", wordBreak: "break-all", textAlign: "center", maxWidth: 200 }}>{refUrl}</p>
            <button onClick={() => setQrOpen(false)}
              style={{ fontSize: 11, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>
              閉じる
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "36px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Link href="/top" style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)",
            padding: "6px 14px", fontSize: 12, fontWeight: 600, color: C.textMuted, textDecoration: "none" }}>
            ← 戻る
          </Link>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9999,
            border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)",
            padding: "4px 12px", fontSize: 12, fontWeight: 600, color: C.textMuted }}>
            🤝 リファラ
          </div>
        </div>

        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", color: C.text, marginBottom: 4 }}>紹介ダッシュボード</h1>
          <p style={{ fontSize: 12, color: C.textMuted }}>あなたの紹介実績と報酬をまとめて確認</p>
        </div>

        {/* ① シェアカード */}
        <div style={{ background: C.card, border: `1px solid ${C.borderEm}`, borderRadius: 24,
          padding: 24, boxShadow: `${C.shadow}, ${C.shadowEm}` }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.emDim, letterSpacing: "0.08em", marginBottom: 10 }}>あなたの紹介コード</p>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Skel w={120} h={36} />
              <Skel h={36} />
            </div>
          ) : (
            <>
              <p style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 800, color: C.em,
                letterSpacing: "0.15em", marginBottom: 14, lineHeight: 1 }}>
                {refCode || "—"}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <button
                  onClick={() => copy(refCode, "code")}
                  disabled={!refCode}
                  style={{ padding: "8px 16px", borderRadius: 12,
                    background: copied === "code" ? "rgba(16,185,129,0.2)" : "linear-gradient(135deg,#10B981,#0D9488)",
                    border: copied === "code" ? `1px solid ${C.em}` : "none",
                    color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    boxShadow: copied === "code" ? "none" : "0 4px 16px rgba(16,185,129,0.3)",
                    opacity: !refCode ? 0.4 : 1 }}
                >
                  {copied === "code" ? "✓ コピーしました" : "コードをコピー"}
                </button>
                <button
                  onClick={() => copy(refUrl, "url")}
                  disabled={!refUrl}
                  style={{ padding: "8px 16px", borderRadius: 12,
                    background: copied === "url" ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${copied === "url" ? C.em : C.border}`,
                    color: C.text, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    opacity: !refUrl ? 0.4 : 1 }}
                >
                  {copied === "url" ? "✓ コピーしました" : "リンクをコピー"}
                </button>
                <button
                  onClick={() => setQrOpen(true)}
                  disabled={!refUrl}
                  style={{ padding: "8px 14px", borderRadius: 12,
                    background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
                    color: C.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    opacity: !refUrl ? 0.4 : 1 }}
                >
                  QR
                </button>
              </div>
              {refUrl && (
                <p style={{ fontSize: 10, color: C.textDim, wordBreak: "break-all", lineHeight: 1.6 }}>{refUrl}</p>
              )}
              <p style={{ fontSize: 10, color: C.textDim, marginTop: 8 }}>紹介コードは登録後に紐づけることはできません。</p>
            </>
          )}
        </div>

        {/* ② サマリー 2×2 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {loading ? (
            [0,1,2,3].map(i => <Skel key={i} h={76} />)
          ) : (
            [
              { label: "紹介した人", value: `${data?.referrals.length ?? 0} 人`, accent: false },
              { label: "報酬合計",   value: formatAmount(data?.total_bonus ?? 0), accent: true },
              { label: "今月の報酬", value: formatAmount(currentMonthBonus), accent: false },
              { label: "先月の報酬", value: formatAmount(prevMonthBonus), accent: false },
            ].map((item) => (
              <div key={item.label} style={{ background: C.card, border: `1px solid ${item.accent ? C.emBorder : C.border}`,
                borderRadius: 18, padding: "14px 16px", textAlign: "center",
                boxShadow: item.accent ? C.shadowEm : C.shadow }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 6 }}>{item.label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: item.accent ? C.em : C.text, lineHeight: 1 }}>{item.value}</p>
              </div>
            ))
          )}
        </div>

        {/* エラー */}
        {err && !loading && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 16, padding: "12px 16px", fontSize: 12, color: "#FCA5A5" }}>
            データの取得に失敗しました。
            <button onClick={() => { setErr(""); fetchData(); }}
              style={{ marginLeft: 8, textDecoration: "underline", background: "none", border: "none", color: "#FCA5A5", cursor: "pointer", fontSize: 12 }}>
              再試行
            </button>
          </div>
        )}

        {/* ③ 月別報酬 */}
        {!loading && data && data.bonuses.length > 0 && (
          <MonthlyBonuses bonuses={data.bonuses} />
        )}

        {/* ④ 紹介した人リスト */}
        {!loading && data && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden", boxShadow: C.shadow }}>
            <p style={{ padding: "14px 18px 10px", fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.08em" }}>紹介した人</p>
            {data.referrals.length === 0 ? (
              <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
                <p style={{ fontSize: 13, color: C.textMuted }}>まだ紹介した人はいません</p>
                <button
                  onClick={() => copy(refUrl, "url")}
                  disabled={!refUrl}
                  style={{ padding: "10px 24px", borderRadius: 14,
                    background: "linear-gradient(135deg,#10B981,#0D9488)", border: "none",
                    color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(16,185,129,0.3)", opacity: !refUrl ? 0.4 : 1 }}
                >
                  {copied === "url" ? "✓ コピーしました" : "コードをシェアする"}
                </button>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ minWidth: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderTop: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
                      {["ID","プラン","入会日","状態"].map(h => (
                        <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: C.textDim, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleReferrals.map((r, i) => (
                      <tr key={r.login_id + i} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", color: C.text, fontWeight: 600 }}>{maskId(r.login_id)}</td>
                        <td style={{ padding: "10px 14px", color: C.emDim, fontWeight: 700 }}>${r.plan}</td>
                        <td style={{ padding: "10px 14px", color: C.textMuted, whiteSpace: "nowrap" }}>{formatDate(r.approved_at)}</td>
                        <td style={{ padding: "10px 14px", color: C.em, fontSize: 11, fontWeight: 700 }}>承認済み</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!showAll && data.referrals.length > 5 && (
                  <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
                    <button
                      onClick={() => setShowAll(true)}
                      style={{ fontSize: 12, color: C.em, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}
                    >
                      もっと見る（あと {data.referrals.length - 5} 人）
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ⑤ 紹介ツリー */}
        {!loading && data && data.referrals.length > 0 && (
          <ReferralTree referrals={data.referrals} />
        )}

        <div style={{ textAlign: "center", fontSize: 11, color: C.textDim, marginTop: 8 }}>© LIFAI</div>
      </div>
    </main>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuth, getAuthSecret } from "@/app/lib/auth";

type Step = "input" | "confirm" | "done";

const LFW_PATTERN = /^LFW-[A-Z0-9]{6}$/;

export default function GiftSendPage() {
  const router = useRouter();
  const [myId, setMyId] = useState("");
  const [myCode, setMyCode] = useState("");
  const [epBalance, setEpBalance] = useState<number | null>(null);

  const [step, setStep] = useState<Step>("input");
  const [toUser, setToUser] = useState("");
  const [amount, setAmount] = useState<number | "">(100);
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultGiftId, setResultGiftId] = useState("");
  const [resultExpiry, setResultExpiry] = useState("");


  useEffect(() => {
    const auth = getAuth();
    if (!auth) { router.replace("/login"); return; }
    const id = (auth as any)?.id || (auth as any)?.loginId || "";
    const code = getAuthSecret() || (auth as any)?.token || "";
    setMyId(id);
    setMyCode(code);

    const group = (() => { try { return JSON.parse(localStorage.getItem("addval_auth_v1") || "{}").group || ""; } catch { return ""; } })();
    fetch(`/api/wallet/balance?id=${encodeURIComponent(id)}&code=${encodeURIComponent(code)}&group=${encodeURIComponent(group)}`)
      .then(r => r.json())
      .catch(() => ({}))
      .then((d: any) => { if (d.ok && typeof d.ep === "number") setEpBalance(d.ep); });
  }, [router]);

  const isLfw = LFW_PATTERN.test(toUser.trim().toUpperCase());

  const inputStyle: React.CSSProperties = {
    width: "100%", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)", padding: "10px 14px",
    fontSize: 13, color: "#EAF0FF", outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700,
    color: "rgba(234,240,255,0.55)", letterSpacing: "0.04em",
  };

  const handleSend = async () => {
    if (!myId || !myCode) return;
    setLoading(true);
    setError("");
    try {
      const destination = toUser.trim().toUpperCase();
      const sendingToLfw = LFW_PATTERN.test(destination);

      if (sendingToLfw) {
        const res = await fetch("/api/ep/send-to-lfw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: myId, code: myCode, lfw_address: destination, amount: Number(amount) }),
        });
        const data = await res.json().catch(() => ({ ok: false }));
        if (!data.ok) {
          const errMap: Record<string, string> = {
            insufficient_ep: `EP残高が不足しています（残高: ${data.ep_balance ?? "?"}EP）`,
            auth_failed: "認証エラーが発生しました",
            invalid_lfw_address: "LFWアドレスの形式が正しくありません",
            amount_must_be_positive: "1以上の数量を入力してください",
            lock_timeout: "ただいま混み合っています。少し時間をおいて再度お試しください",
          };
          setError(errMap[data.error] || data.error || "送信に失敗しました");
          setStep("input");
          return;
        }
        setResultGiftId(data.deposit_id);
        setResultExpiry("");
      } else {
        const res = await fetch("/api/gift/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: myId, code: myCode, to_user: toUser.trim(), amount: Number(amount), note }),
        });
        const data = await res.json().catch(() => ({ ok: false }));
        if (!data.ok) {
          const errMap: Record<string, string> = {
            cannot_send_to_self: "自分自身へは送れません",
            insufficient_ep: `EP残高が不足しています（残高: ${data.ep_balance ?? "?"}EP）`,
            exceeds_single_limit: `1回の上限は${(data.limit ?? 10000).toLocaleString()}EPです`,
            exceeds_monthly_limit: `月間上限（${(data.limit ?? 50000).toLocaleString()}EP）を超えています（今月送信済み: ${(data.used ?? 0).toLocaleString()}EP）`,
            to_user_not_found: "送信先のユーザーIDが見つかりません。IDをご確認ください（メールアドレスでは送れません）",
            auth_failed: "認証エラーが発生しました",
            amount_must_be_positive: "1以上の数量を入力してください",
            amount_must_be_integer: "数量は整数で入力してください",
            lock_timeout: "ただいま混み合っています。少し時間をおいて再度お試しください",
          };
          setError(errMap[data.error] || data.error || "送信に失敗しました");
          setStep("input");
          return;
        }
        setResultGiftId(data.gift_id);
        setResultExpiry(data.expiry_date);
      }
      setStep("done");
    } catch (e) {
      setError("通信エラーが発生しました");
      setStep("input");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0B1220", color: "#EAF0FF" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: -10, pointerEvents: "none",
        background: "radial-gradient(ellipse 600px 400px at 20% -10%, rgba(124,58,237,0.15) 0%, transparent 60%)" }} />

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <Link href="/gift" style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)", padding: "6px 14px", fontSize: 12,
            fontWeight: 600, color: "rgba(234,240,255,0.65)", textDecoration: "none" }}>
            ← 戻る
          </Link>
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(234,240,255,0.45)" }}>🎁 GiftEPを贈る</span>
        </div>

        <div style={{ background: "#0F1A2E", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24, padding: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>

          {step === "done" ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <p style={{ fontSize: 36, marginBottom: 16 }}>🎉</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#A78BFA", marginBottom: 8 }}>
                {isLfw ? "EPを送金しました！" : "GiftEPを送りました！"}
              </p>
              <p style={{ fontSize: 12, color: "rgba(234,240,255,0.5)", marginBottom: 4 }}>
                {Number(amount).toLocaleString()} {isLfw ? "EP" : "GiftEP"} → {toUser}
              </p>
              <p style={{ fontSize: 11, color: "rgba(234,240,255,0.35)", marginBottom: 24 }}>
                {resultExpiry ? `有効期限: ${resultExpiry}` : ""}
              </p>
              <Link href="/gift" style={{ display: "inline-block", borderRadius: 16,
                background: "linear-gradient(90deg,#6366F1,#A78BFA)", padding: "12px 32px",
                fontSize: 13, fontWeight: 700, color: "#fff", textDecoration: "none" }}>
                GiftEPトップへ
              </Link>
            </div>
          ) : step === "confirm" ? (
            <>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#EAF0FF", marginBottom: 20 }}>送信内容を確認</p>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16,
                padding: "16px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                {(isLfw ? [
                  ["送信先", toUser],
                  ["送金EP数量", `${Number(amount).toLocaleString()} EP`],
                  ["種別", "Lootify（LFW）へのEP送金"],
                ] : [
                  ["送信先", toUser],
                  ["GiftEP数量", `${Number(amount).toLocaleString()} GiftEP`],
                  ["メッセージ", note || "（なし）"],
                  ["有効期限", "付与から30日"],
                ]).map(([label, value]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "rgba(234,240,255,0.45)" }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#EAF0FF", textAlign: "right", maxWidth: "60%" }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)",
                background: "rgba(124,58,237,0.06)", padding: "12px 14px", marginBottom: 20,
                fontSize: 10, color: "rgba(167,139,250,0.7)", lineHeight: 1.8 }}>
                <p>・送信したEPは返還されません</p>
                {isLfw ? (
                  <p>・メッセージはLFW送金では送信されません</p>
                ) : (
                  <>
                    <p>・GiftEPは換金・再送できません</p>
                    <p>・外部売買は永久BAN対象です</p>
                  </>
                )}
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  style={{ accentColor: "#A78BFA", width: 16, height: 16 }} />
                <span style={{ fontSize: 12, color: "rgba(234,240,255,0.7)" }}>
                  上記の利用ルールに同意して送信する
                </span>
              </label>

              {error && <p style={{ fontSize: 12, color: "#FCA5A5", marginBottom: 12 }}>{error}</p>}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep("input")}
                  style={{ flex: 1, borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)", padding: "12px", fontSize: 13,
                    fontWeight: 600, color: "#EAF0FF", cursor: "pointer" }}>
                  修正する
                </button>
                <button onClick={handleSend} disabled={!agreed || loading}
                  style={{ flex: 2, borderRadius: 14, background: (!agreed || loading)
                    ? "rgba(99,102,241,0.35)" : "linear-gradient(90deg,#6366F1,#A78BFA)",
                    padding: "12px", fontSize: 13, fontWeight: 700, color: "#fff",
                    border: "none", cursor: (!agreed || loading) ? "not-allowed" : "pointer",
                    opacity: (!agreed || loading) ? 0.6 : 1 }}>
                  {loading ? "送信中…" : "送信確定"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#EAF0FF", marginBottom: 20 }}>GiftEPを贈る</p>
              {epBalance !== null && (
                <p style={{ fontSize: 11, color: "rgba(234,240,255,0.4)", marginBottom: 16 }}>
                  あなたのEP残高: <span style={{ color: "#A78BFA", fontWeight: 700 }}>{epBalance.toLocaleString()} EP</span>
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <label style={labelStyle}>送信先ユーザーID *</label>
                  <input value={toUser} onChange={e => setToUser(e.target.value)}
                    placeholder="相手のloginId" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>GiftEP数量（1〜10,000）*</label>
                  <input type="number" value={amount} min={1} max={10000} step={1}
                    onChange={e => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>メッセージ（任意・200字以内）</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                    placeholder="応援メッセージなど" style={{ ...inputStyle, resize: "none" }} />
                </div>
                {error && <p style={{ fontSize: 12, color: "#FCA5A5" }}>{error}</p>}
                <button
                  onClick={() => {
                    setError("");
                    if (!toUser.trim()) { setError("送信先を入力してください"); return; }
                    if (!amount || Number(amount) < 1) { setError("1以上の数量を入力してください"); return; }
                    if (!Number.isInteger(Number(amount))) { setError("数量は整数で入力してください"); return; }
                    if (Number(amount) > 10000) { setError("1回の上限は10,000 EPです"); return; }
                    setStep("confirm");
                  }}
                  style={{ borderRadius: 14, background: "linear-gradient(90deg,#6366F1,#A78BFA)",
                    padding: "13px", fontSize: 13, fontWeight: 700, color: "#fff",
                    border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(99,102,241,0.35)" }}>
                  確認画面へ →
                </button>
              </div>
            </>
          )}
        </div>
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "rgba(234,240,255,0.2)" }}>© LIFAI</div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

type LockDays = 30 | 60 | 90;
type StakeType = "bp" | "ep";

const PLANS: { days: LockDays; rate: number; label: string; rateLabel: string }[] = [
  { days: 30, rate: 0.10, label: "30日", rateLabel: "+10%" },
  { days: 60, rate: 0.25, label: "60日", rateLabel: "+25%" },
  { days: 90, rate: 0.50, label: "90日", rateLabel: "+50%" },
];

type StakeItem = {
  stake_id:    string;
  staked_bp:   number;
  rate:        number;
  interest_bp: number;
  total_bp:    number;
  started_at:  string;
  expires_at:  string;
  status:      string;
  claimable:   boolean;
};

function formatDate(isoStr: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  loginId:     string;
  onClose:     () => void;
  onBpChanged: () => void;
};

export default function StakingModal({ loginId, onClose, onBpChanged }: Props) {
  const [visible,      setVisible]      = useState(false);
  const [stakeType,    setStakeType]    = useState<StakeType>("bp");
  const [selectedDays, setSelectedDays] = useState<LockDays>(30);
  const [amount,       setAmount]       = useState("");
  const [stakes,       setStakes]       = useState<StakeItem[]>([]);
  const [bpBalance,    setBpBalance]    = useState<number | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [claiming,     setClaiming]     = useState<string | null>(null);
  const [msg,          setMsg]          = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const fetchStakes = async () => {
    if (!loginId) return;
    try {
      const r = await fetch(`/api/staking?loginId=${encodeURIComponent(loginId)}`, { cache: "no-store" });
      const d = await r.json();
      if (d.ok) {
        setStakes(d.stakes ?? []);
        setBpBalance(Number(d.bp_balance ?? 0));
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchStakes(); }, [loginId]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const plan       = PLANS.find((p) => p.days === selectedDays)!;
  const amountNum  = Number(amount);
  const hasPreview = amountNum >= 100;
  const interest   = hasPreview ? Math.floor(amountNum * plan.rate) : 0;
  const total      = hasPreview ? amountNum + interest : 0;
  const matureDate = hasPreview
    ? formatDate(new Date(Date.now() + selectedDays * 24 * 60 * 60 * 1000).toISOString())
    : "";

  const canStake =
    hasPreview &&
    bpBalance !== null &&
    amountNum <= bpBalance &&
    !submitting;

  const handleStake = async () => {
    if (!canStake) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const r = await fetch("/api/staking", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ loginId, amount: amountNum, days: selectedDays }),
      });
      const d = await r.json();
      if (d.ok) {
        setMsg(`✅ ${amountNum.toLocaleString()} BPをステークしました`);
        setAmount("");
        await fetchStakes();
        onBpChanged();
      } else {
        setMsg("❌ " + (d.reason === "insufficient_bp" ? "BP残高が不足しています" : (d.error ?? "エラーが発生しました")));
      }
    } catch {
      setMsg("❌ 通信エラーが発生しました");
    }
    setSubmitting(false);
  };

  const handleClaim = async (stakeId: string) => {
    setClaiming(stakeId);
    setMsg(null);
    try {
      const r = await fetch("/api/staking", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ loginId, stake_id: stakeId }),
      });
      const d = await r.json();
      if (d.ok) {
        setMsg(`✅ ${d.total_bp?.toLocaleString() ?? ""}BP を受け取りました`);
        await fetchStakes();
        onBpChanged();
      } else {
        setMsg("❌ " + (d.error ?? "受け取りに失敗しました"));
      }
    } catch {
      setMsg("❌ 通信エラーが発生しました");
    }
    setClaiming(null);
  };

  const activeStakes    = stakes.filter((s) => s.status === "active");
  const claimableStakes = activeStakes.filter((s) => s.claimable);
  const lockedStakes    = activeStakes.filter((s) => !s.claimable);

  return (
    <div
      onClick={handleClose}
      style={{
        position:        "fixed",
        inset:           0,
        zIndex:          9999,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        backgroundColor: "rgba(0,0,0,0.65)",
        opacity:         visible ? 1 : 0,
        transition:      "opacity 0.3s ease",
        cursor:          "pointer",
        overflowY:       "auto",
        padding:         "24px 0",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background:   "#18181b",
          borderRadius: "16px",
          padding:      "24px",
          maxWidth:     "400px",
          width:        "90%",
          boxShadow:    "0 32px 80px rgba(0,0,0,0.5)",
          border:       "1px solid rgba(255,255,255,0.08)",
          transform:    visible ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
          transition:   "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          cursor:       "default",
        }}
      >
        {/* BP / EP タブ */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px", background: "#27272a", borderRadius: "10px", padding: "4px" }}>
          <button
            onClick={() => setStakeType("bp")}
            style={{
              flex: 1, padding: "8px 4px", borderRadius: "7px", border: "none",
              background: stakeType === "bp" ? "rgba(245,158,11,0.15)" : "transparent",
              color: stakeType === "bp" ? "#f59e0b" : "#71717a",
              fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
            }}
          >
            💎 BPステーキング
          </button>
          <button
            disabled
            title="準備中"
            style={{
              flex: 1, padding: "8px 4px", borderRadius: "7px", border: "none",
              background: "transparent",
              color: "#3f3f46",
              fontSize: "13px", fontWeight: 700, cursor: "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
            }}
          >
            ✨ EPステーキング
            <span style={{ fontSize: "10px", background: "#3f3f46", color: "#71717a", borderRadius: "4px", padding: "1px 5px" }}>準備中</span>
          </button>
        </div>

        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <p style={{ fontSize: "15px", fontWeight: 900, color: "#f4f4f5", margin: 0 }}>
              💎 BPステーキング
            </p>
            <p style={{ fontSize: "11px", color: "#71717a", margin: "2px 0 0" }}>
              BPを預けてロック期間後に利息付きで受け取れます
            </p>
          </div>
          {bpBalance !== null && (
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "10px", color: "#71717a", margin: 0 }}>残高</p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#f59e0b", margin: 0 }}>
                {bpBalance.toLocaleString()} BP
              </p>
            </div>
          )}
        </div>

        {/* 利率説明 */}
        <div style={{
          background:          "rgba(245,158,11,0.07)",
          border:              "1px solid rgba(245,158,11,0.2)",
          borderRadius:        "10px",
          padding:             "12px 14px",
          marginBottom:        "18px",
        }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", margin: "0 0 8px" }}>
            📌 利率のしくみ
          </p>
          <p style={{ fontSize: "11px", color: "#a1a1aa", margin: "0 0 6px", lineHeight: 1.6 }}>
            預けたBPに対してロック期間に応じた固定利率が適用されます。<br />
            満期になったら「受け取る」ボタンで元本＋利息をまとめて回収できます。
          </p>
          <div style={{ display: "flex", gap: "6px" }}>
            {PLANS.map((p) => (
              <div key={p.days} style={{
                flex:         1,
                background:   "#27272a",
                borderRadius: "8px",
                padding:      "6px 4px",
                textAlign:    "center",
              }}>
                <p style={{ fontSize: "10px", color: "#71717a", margin: "0 0 2px" }}>{p.label}</p>
                <p style={{ fontSize: "13px", fontWeight: 800, color: "#4ade80", margin: 0 }}>{p.rateLabel}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ロック期間選択 */}
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#71717a", marginBottom: "8px" }}>
          ロック期間を選ぶ
        </p>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {PLANS.map((p) => (
            <button
              key={p.days}
              onClick={() => setSelectedDays(p.days)}
              style={{
                flex:         1,
                padding:      "10px 4px",
                borderRadius: "10px",
                border:       selectedDays === p.days ? "2px solid #f59e0b" : "1px solid rgba(255,255,255,0.12)",
                background:   selectedDays === p.days ? "rgba(245,158,11,0.15)" : "transparent",
                color:        selectedDays === p.days ? "#f59e0b" : "#a1a1aa",
                fontSize:     "12px",
                fontWeight:   700,
                cursor:       "pointer",
                textAlign:    "center",
              }}
            >
              <div>{p.label}</div>
              <div style={{ fontSize: "11px", marginTop: "2px", color: selectedDays === p.days ? "#4ade80" : "#52525b" }}>
                {p.rateLabel}
              </div>
            </button>
          ))}
        </div>

        {/* 入力 */}
        <input
          type="number"
          min={100}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="預けるBP数（最低100BP）"
          style={{
            width:        "100%",
            padding:      "10px 12px",
            borderRadius: "10px",
            border:       "1px solid rgba(255,255,255,0.12)",
            background:   "#27272a",
            color:        "#f4f4f5",
            fontSize:     "14px",
            outline:      "none",
            boxSizing:    "border-box",
            marginBottom: "4px",
          }}
        />
        {bpBalance !== null && amountNum > bpBalance && (
          <p style={{ fontSize: "11px", color: "#f87171", marginBottom: "4px" }}>
            BP残高が不足しています（残高: {bpBalance.toLocaleString()} BP）
          </p>
        )}
        <p style={{ fontSize: "11px", color: "#52525b", marginBottom: "12px" }}>
          最低100BPから預け入れできます
        </p>

        {/* 予想サマリー */}
        {hasPreview && (
          <div style={{
            background:   "#27272a",
            borderRadius: "10px",
            padding:      "12px",
            marginBottom: "12px",
            fontSize:     "12px",
            color:        "#a1a1aa",
          }}>
            <Row label="預入"       value={`${amountNum.toLocaleString()} BP`} />
            <Row label="利息"       value={`+${interest.toLocaleString()} BP（${plan.rateLabel}）`} valueColor="#4ade80" />
            <Row label="満期受取"   value={`${total.toLocaleString()} BP`} valueColor="#f59e0b" />
            <Row label="満期日"     value={`${plan.days}日後（${matureDate}）`} last />
          </div>
        )}

        {/* ステークボタン */}
        <button
          onClick={handleStake}
          disabled={!canStake}
          style={{
            width:        "100%",
            padding:      "12px",
            borderRadius: "10px",
            border:       "none",
            background:   canStake ? "#f59e0b" : "rgba(245,158,11,0.2)",
            color:        canStake ? "#000" : "#71717a",
            fontSize:     "14px",
            fontWeight:   700,
            cursor:       canStake ? "pointer" : "not-allowed",
            marginBottom: "20px",
            transition:   "opacity 0.15s",
          }}
        >
          {submitting ? "処理中..." : "BPをステークする"}
        </button>

        {/* メッセージ */}
        {msg && (
          <div style={{
            background:   msg.startsWith("✅") ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
            border:       `1px solid ${msg.startsWith("✅") ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
            borderRadius: "8px",
            padding:      "10px 12px",
            marginBottom: "16px",
            fontSize:     "12px",
            color:        msg.startsWith("✅") ? "#4ade80" : "#f87171",
          }}>
            {msg}
          </div>
        )}

        {/* ステーク中一覧 */}
        <p style={{ fontSize: "13px", fontWeight: 800, color: "#f4f4f5", marginBottom: "10px" }}>
          📋 ステーク中
        </p>

        {loading ? (
          <p style={{ fontSize: "12px", color: "#52525b", textAlign: "center", padding: "12px 0" }}>読み込み中…</p>
        ) : activeStakes.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#52525b", textAlign: "center", padding: "12px 0" }}>
            まだステークがありません
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
            {[...claimableStakes, ...lockedStakes].map((s) => (
              <div key={s.stake_id} style={{
                background:   s.claimable ? "rgba(74,222,128,0.07)" : "#27272a",
                border:       `1px solid ${s.claimable ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: "10px",
                padding:      "12px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#f4f4f5", margin: "0 0 2px" }}>
                      {s.staked_bp.toLocaleString()} BP
                      <span style={{ fontSize: "11px", color: "#4ade80", marginLeft: "6px" }}>
                        → {s.total_bp.toLocaleString()} BP
                      </span>
                    </p>
                    <p style={{ fontSize: "10px", color: "#71717a", margin: 0 }}>
                      満期: {formatDate(s.expires_at)}　利率: {Math.round(s.rate * 100)}%
                    </p>
                  </div>
                  {s.claimable && (
                    <button
                      onClick={() => handleClaim(s.stake_id)}
                      disabled={claiming === s.stake_id}
                      style={{
                        padding:      "6px 14px",
                        borderRadius: "8px",
                        border:       "none",
                        background:   "#4ade80",
                        color:        "#000",
                        fontSize:     "12px",
                        fontWeight:   700,
                        cursor:       "pointer",
                        flexShrink:   0,
                      }}
                    >
                      {claiming === s.stake_id ? "処理中" : "受け取る"}
                    </button>
                  )}
                </div>
                {s.claimable && (
                  <p style={{ fontSize: "10px", color: "#4ade80", margin: "6px 0 0", fontWeight: 600 }}>
                    ✅ 満期です！受け取れます
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 閉じるボタン */}
        <button
          onClick={handleClose}
          style={{
            width:        "100%",
            marginTop:    "4px",
            padding:      "11px",
            borderRadius: "10px",
            border:       "1px solid rgba(255,255,255,0.12)",
            background:   "transparent",
            color:        "#a1a1aa",
            fontSize:     "13px",
            fontWeight:   600,
            cursor:       "pointer",
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor, last }: {
  label: string; value: string; valueColor?: string; last?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: last ? 0 : "4px" }}>
      <span>{label}</span>
      <span style={{ color: valueColor ?? "#f4f4f5", fontWeight: 700 }}>{value}</span>
    </div>
  );
}

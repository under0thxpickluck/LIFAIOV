"use client";

// components/GachaModal.tsx
import { useEffect, useState, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import AnimatedModal from "./animations/AnimatedModal";
import { GlowBadge } from "./animations/GlowBadge";

type GachaResult = {
  prize_bp:    number;
  net:         number;
  bp_balance:  number;
  results?:    { prize_bp: number; rarity: string }[];
  fragments?:  number;
  gacha_count?: number;
  rarity?:     string;
  to_pity?:    number;
};

type Props = {
  loginId:    string;
  onClose:    () => void;
  onBpEarned: (amount: number) => void;
};

const GACHA_TABLE = [
  { bp: 5,     pct: "28%",   rarity: "common"    },
  { bp: 10,    pct: "24%",   rarity: "common"    },
  { bp: 20,    pct: "18%",   rarity: "common"    },
  { bp: 40,    pct: "12%",   rarity: "common"    },
  { bp: 80,    pct: "8%",    rarity: "uncommon"  },
  { bp: 150,   pct: "5%",    rarity: "uncommon"  },
  { bp: 300,   pct: "3%",    rarity: "rare"      },
  { bp: 600,   pct: "0.8%",  rarity: "epic"      },
  { bp: 1000,  pct: "1%",    rarity: "legendary" },
  { bp: 5000,  pct: "0.18%", rarity: "mythic"    },
  { bp: 20000, pct: "0.02%", rarity: "god"       },
] as const;

const GACHA_TUTORIAL_SLIDES = [
  {
    icon: "🎰",
    title: "BPガチャとは？",
    body: "BPを消費して抽選し、当たったBPをそのまま獲得できます。消費より多いBPが当たることも！最大20,000BPのGODレアも存在します。",
  },
  {
    icon: "🎯",
    title: "3つの引き方",
    body: "「1回引く」は100BP消費。「10連」は1,000BPで10回まとめて引け、合計150BP以上が保証されます。「デイリー」は1日1回だけ参加できる特別枠（80BP）です。",
  },
  {
    icon: "⚡",
    title: "天井システムと欠片",
    body: "100回引くと高レアが必ず当たる「天井」があります。50回を超えると高レアの確率もUP。ガチャを回すたびに「欠片」も獲得でき、将来的な特典交換に使えます。",
  },
] as const;

const RARITY_STYLE: Record<string, { color: string; label: string }> = {
  common:    { color: "#a1a1aa", label: "COMMON"    },
  uncommon:  { color: "#4ade80", label: "UNCOMMON"  },
  rare:      { color: "#60a5fa", label: "RARE"      },
  epic:      { color: "#c084fc", label: "EPIC"      },
  legendary: { color: "#fbbf24", label: "LEGENDARY" },
  mythic:    { color: "#f472b6", label: "MYTHIC"    },
  god:       { color: "#f87171", label: "GOD"       },
};

export default function GachaModal({ loginId, onClose, onBpEarned }: Props) {
  const [visible,       setVisible]       = useState(false);
  const [spinning,      setSpinning]      = useState(false);
  const [result,        setResult]        = useState<GachaResult | null>(null);
  const [errMsg,        setErrMsg]        = useState<string>("");
  const [dailyUsed,     setDailyUsed]     = useState(false);
  const dailyCalledRef = useRef(false);
  const [showTutorial,  setShowTutorial]  = useState(false);
  const [tutorialStep,  setTutorialStep]  = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  // マウント時にデイリー使用状況を確認
  useEffect(() => {
    if (!loginId) return;
    fetch("/api/gacha/daily/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId }),
    })
      .then(r => r.json())
      .then(d => { if (d.ok && d.used) setDailyUsed(true); })
      .catch(() => {});
  }, [loginId]);

  const handleDaily = async () => {
    if (spinning || dailyUsed || !loginId || dailyCalledRef.current) return;
    dailyCalledRef.current = true;
    setSpinning(true);
    setErrMsg("");
    try {
      const res = await fetch("/api/gacha/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));
      if (!data.ok) {
        if (data.error === "daily_already_used") {
          setDailyUsed(true);
          setErrMsg("本日のデイリーガチャは使用済みです");
        } else {
          const reason = data.reason || data.error || "failed";
          setErrMsg(reason === "insufficient_bp" ? "BPが不足しています（80BP必要）" : `エラー: ${reason}`);
          dailyCalledRef.current = false;
        }
        return;
      }
      setDailyUsed(true);
      setResult({
        prize_bp:    data.prize_bp,
        net:         data.net,
        bp_balance:  data.bp_balance,
        fragments:   data.fragments,
        gacha_count: data.gacha_count,
        rarity:      data.rarity,
        to_pity:     data.to_pity,
      });
      onBpEarned(data.prize_bp);
    } catch {
      setErrMsg("通信エラーが発生しました");
      dailyCalledRef.current = false;
    } finally {
      setSpinning(false);
    }
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const handleSpin = async (is10 = false) => {
    if (spinning || !loginId) return;
    setSpinning(true);
    setErrMsg("");
    try {
      const res = await fetch("/api/gacha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, is10 }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));

      if (!data.ok) {
        const reason = data.reason || data.error || "failed";
        setErrMsg(
          reason === "insufficient_bp"
            ? `BPが不足しています（${is10 ? "1000" : "100"}BP必要）`
            : `エラー: ${reason}`
        );
        return;
      }

      setResult({
        prize_bp:    data.prize_bp,
        net:         data.net,
        bp_balance:  data.bp_balance,
        results:     data.results,
        fragments:   data.fragments,
        gacha_count: data.gacha_count,
        rarity:      data.rarity,
      });
      onBpEarned(data.prize_bp);
    } catch {
      setErrMsg("通信エラーが発生しました");
    } finally {
      setSpinning(false);
    }
  };

  const handleAgain = () => {
    setResult(null);
    setErrMsg("");
  };

  return (
    <AnimatedModal
      open={visible}
      onBackdropClick={result ? undefined : handleClose}
    >
      <div
        style={{
          background:   "#18181b",
          borderRadius: "16px",
          padding:      "24px",
          maxWidth:     "380px",
          width:        "92vw",
          boxShadow:    "0 32px 80px rgba(0,0,0,0.5)",
          border:       "1px solid rgba(255,255,255,0.08)",
          cursor:       "default",
          maxHeight:    "90vh",
          overflowY:    "auto",
        }}
      >
        {/* ===== チュートリアル画面 ===== */}
        {showTutorial ? (
          <div style={{ textAlign: "center" }}>
            {/* スライドインジケーター */}
            <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "20px" }}>
              {GACHA_TUTORIAL_SLIDES.map((_, i) => (
                <div
                  key={i}
                  style={{
                    height:       "6px",
                    borderRadius: "999px",
                    background:   i === tutorialStep ? "#7c3aed" : "rgba(255,255,255,0.12)",
                    width:        i === tutorialStep ? "24px" : "6px",
                    transition:   "width 0.2s ease, background 0.2s ease",
                  }}
                />
              ))}
            </div>

            <div style={{ fontSize: "40px", marginBottom: "12px" }}>
              {GACHA_TUTORIAL_SLIDES[tutorialStep].icon}
            </div>
            <p style={{ fontSize: "15px", fontWeight: 900, color: "#f4f4f5", marginBottom: "10px" }}>
              {GACHA_TUTORIAL_SLIDES[tutorialStep].title}
            </p>
            <p style={{ fontSize: "13px", color: "#a1a1aa", lineHeight: 1.7, marginBottom: "24px", textAlign: "left" }}>
              {GACHA_TUTORIAL_SLIDES[tutorialStep].body}
            </p>

            <div style={{ display: "flex", gap: "8px" }}>
              {tutorialStep > 0 && (
                <button
                  onClick={() => setTutorialStep(tutorialStep - 1)}
                  style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#a1a1aa", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >
                  ← 戻る
                </button>
              )}
              {tutorialStep < GACHA_TUTORIAL_SLIDES.length - 1 ? (
                <button
                  onClick={() => setTutorialStep(tutorialStep + 1)}
                  style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#7c3aed,#6366f1)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                >
                  次へ →
                </button>
              ) : (
                <button
                  onClick={() => { setShowTutorial(false); setTutorialStep(0); }}
                  style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#7c3aed,#6366f1)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                >
                  はじめる
                </button>
              )}
            </div>
            <button
              onClick={() => { setShowTutorial(false); setTutorialStep(0); }}
              style={{ marginTop: "10px", width: "100%", background: "none", border: "none", color: "#52525b", fontSize: "12px", cursor: "pointer" }}
            >
              スキップ
            </button>
          </div>
        ) : result ? (
          <div style={{ textAlign: "center" }}>
            {(() => {
              const style = RARITY_STYLE[result.rarity ?? "common"] ?? RARITY_STYLE.common;
              return (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ marginBottom: "8px" }}>
                    <GlowBadge color={style.color} glow={result.prize_bp >= 300}>
                      {style.label}
                    </GlowBadge>
                  </div>

                  <motion.p
                    initial={reduced ? {} : { scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={reduced ? { duration: 0 } : { type: "spring", damping: 16, stiffness: 280, delay: 0.1 }}
                    style={{
                      fontSize:      "44px",
                      fontWeight:    900,
                      color:         style.color,
                      letterSpacing: "-0.02em",
                      margin:        "0 0 6px",
                    }}
                  >
                    +{result.prize_bp.toLocaleString()}BP
                  </motion.p>

                  <p style={{ fontSize: "13px", fontWeight: 700, color: result.net >= 0 ? "#4ade80" : "#f87171" }}>
                    差引: {result.net >= 0 ? "+" : ""}{result.net}BP
                  </p>
                </div>
              );
            })()}

            {/* 欠片 */}
            {result.fragments !== undefined && (
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "10px 14px", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#71717a" }}>欠片</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#fb923c" }}>🔮 {result.fragments}個</span>
              </div>
            )}

            {/* 天井ゲージ */}
            {result.gacha_count !== undefined && (
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "10px 14px", marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#71717a", marginBottom: "6px" }}>
                  <span>天井ゲージ</span>
                  <span>{result.gacha_count} / 100回</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "999px", height: "6px", overflow: "hidden" }}>
                  <div style={{
                    background:   "linear-gradient(90deg,#eab308,#ef4444)",
                    height:       "100%",
                    borderRadius: "999px",
                    width:        `${Math.min(100, result.gacha_count)}%`,
                    transition:   "width 0.6s ease",
                  }} />
                </div>
                {result.gacha_count >= 50 && (
                  <p style={{ fontSize: "11px", color: "#fbbf24", marginTop: "5px" }}>⚡ 50回超え：高レア確率UP中！</p>
                )}
                {result.to_pity !== undefined && (
                  <p style={{ fontSize: "11px", color: "#71717a", marginTop: "4px" }}>天井まであと{result.to_pity}回</p>
                )}
              </div>
            )}

            {/* 10連個別結果 */}
            {result.results && result.results.length > 1 && (
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "11px", color: "#71717a", marginBottom: "8px", textAlign: "center" }}>
                  ── 10連結果 ──
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "320px", overflowY: "auto" }}>
                  {result.results.map((r, i) => {
                    const s = RARITY_STYLE[r.rarity] ?? RARITY_STYLE.common;
                    const isRare = r.prize_bp >= 250;
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: isRare ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                        border: isRare ? `1px solid ${s.color}40` : "1px solid rgba(255,255,255,0.05)",
                        borderRadius: "10px", padding: "10px 14px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "11px", color: "#71717a", width: "20px" }}>{i + 1}</span>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: s.color,
                            background: `${s.color}20`, padding: "2px 6px", borderRadius: "4px" }}>
                            {s.label}
                          </span>
                        </div>
                        <span style={{ fontSize: "18px", fontWeight: 900, color: s.color }}>
                          +{r.prize_bp.toLocaleString()}BP
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p style={{ fontSize: "11px", color: "#52525b", marginBottom: "16px" }}>
              現在の残高: {result.bp_balance.toLocaleString()}BP
            </p>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleAgain}
                style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: "#7c3aed", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
              >
                もう一度
              </button>
              <button
                onClick={handleClose}
                style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#a1a1aa", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
              >
                閉じる
              </button>
            </div>
          </div>
        ) : (
          /* ===== 通常画面 ===== */
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <p style={{ fontSize: "16px", fontWeight: 900, color: "#f4f4f5", margin: 0 }}>
                🎰 BPガチャ
              </p>
              <button
                onClick={() => { setShowTutorial(true); setTutorialStep(0); }}
                title="使い方を見る"
                style={{ width: "26px", height: "26px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "#a1a1aa", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
              >
                ?
              </button>
            </div>
            <p style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "16px" }}>
              10連150BP以上保証・100回天井あり
            </p>

            {/* 排出率テーブル */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "20px" }}>
              {GACHA_TABLE.map(({ bp, pct, rarity }) => {
                const style = RARITY_STYLE[rarity];
                return (
                  <div
                    key={bp}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#27272a", borderRadius: "8px", padding: "6px 10px" }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: 700, color: style.color }}>
                      {bp.toLocaleString()}BP
                    </span>
                    <span style={{ fontSize: "10px", color: "#52525b" }}>{pct}</span>
                  </div>
                );
              })}
            </div>

            {spinning && !reduced && (
              <div style={{ textAlign: "center", padding: "12px 0", marginBottom: "8px" }}>
                <motion.div
                  style={{ fontSize: 36, display: "inline-block" }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.35, repeat: Infinity, ease: "easeInOut" }}
                >
                  🎰
                </motion.div>
              </div>
            )}

            {errMsg && (
              <p style={{ fontSize: "12px", color: "#f87171", marginBottom: "12px", textAlign: "center" }}>
                {errMsg}
              </p>
            )}

            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <button
                onClick={() => handleSpin(false)}
                disabled={spinning}
                style={{
                  flex:         1,
                  padding:      "13px",
                  borderRadius: "12px",
                  border:       "none",
                  background:   spinning ? "#4c1d95" : "linear-gradient(135deg,#7c3aed,#6366f1)",
                  color:        "#fff",
                  fontSize:     "13px",
                  fontWeight:   700,
                  cursor:       spinning ? "not-allowed" : "pointer",
                  opacity:      spinning ? 0.6 : 1,
                }}
              >
                {spinning ? "抽選中…" : "1回引く\n100BP"}
              </button>
              <button
                onClick={() => handleSpin(true)}
                disabled={spinning}
                style={{
                  flex:         1,
                  padding:      "13px",
                  borderRadius: "12px",
                  border:       "none",
                  background:   spinning ? "#78350f" : "linear-gradient(135deg,#d97706,#dc2626)",
                  color:        "#fff",
                  fontSize:     "13px",
                  fontWeight:   700,
                  cursor:       spinning ? "not-allowed" : "pointer",
                  opacity:      spinning ? 0.6 : 1,
                }}
              >
                {spinning ? "抽選中…" : "10連\n1000BP"}
              </button>
            </div>

            <button
              onClick={handleDaily}
              disabled={spinning || dailyUsed}
              style={{
                width:        "100%",
                marginBottom: "8px",
                padding:      "12px",
                borderRadius: "12px",
                border:       "none",
                background:   dailyUsed
                  ? "rgba(255,255,255,0.05)"
                  : "linear-gradient(135deg,#059669,#10b981)",
                color:        dailyUsed ? "#52525b" : "#fff",
                fontWeight:   700,
                fontSize:     "14px",
                cursor:       (spinning || dailyUsed) ? "not-allowed" : "pointer",
                opacity:      spinning ? 0.6 : 1,
              }}
            >
              {dailyUsed ? "✅ 本日のデイリー使用済み" : "🎁 デイリー 80BP（1日1回）"}
            </button>

            <button
              onClick={handleClose}
              disabled={spinning}
              style={{
                width:        "100%",
                padding:      "11px",
                borderRadius: "12px",
                border:       "1px solid rgba(255,255,255,0.12)",
                background:   "transparent",
                color:        "#a1a1aa",
                fontSize:     "13px",
                fontWeight:   600,
                cursor:       spinning ? "not-allowed" : "pointer",
              }}
            >
              閉じる
            </button>
          </>
        )}
      </div>
    </AnimatedModal>
  );
}

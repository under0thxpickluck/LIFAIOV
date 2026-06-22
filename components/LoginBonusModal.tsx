"use client";

import { useEffect, useState } from "react";
import AnimatedModal from "./animations/AnimatedModal";
import { CountUpNumber } from "./animations/CountUpNumber";
import { RewardBurst } from "./animations/RewardBurst";

type Props = {
  bp_earned: number;
  streak: number;
  onClose: () => void;
};

export default function LoginBonusModal({ bp_earned, streak, onClose }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 300);
  };

  const nextBonus = (): string => {
    if (streak < 3) return `あと${3 - streak}日で +10BP`;
    if (streak < 7) return `あと${7 - streak}日で +20BP`;
    if (streak < 30) return `あと${30 - streak}日で +100BP`;
    return "🎉 MAX ボーナス達成中！";
  };

  return (
    <AnimatedModal open={open} onBackdropClick={handleClose}>
      <div
        style={{
          background: "#18181b",
          borderRadius: "16px",
          padding: "24px",
          textAlign: "center",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          maxWidth: "320px",
          width: "90vw",
          border: "1px solid rgba(255,255,255,0.08)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <RewardBurst count={10} colors={["#f59e0b", "#fbbf24", "#f97316"]} />

        <p
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "#a1a1aa",
            letterSpacing: "0.05em",
            margin: "0 0 8px",
          }}
        >
          ログインボーナス
        </p>

        <p
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#f4f4f5",
            margin: "0 0 16px",
          }}
        >
          🔥 {streak}日連続ログイン中
        </p>

        <div
          style={{
            fontSize: "36px",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            color: "#f59e0b",
            margin: "0 0 8px",
          }}
        >
          <CountUpNumber to={bp_earned} prefix="+" suffix="BP 獲得！" duration={1.0} />
        </div>

        <p
          style={{
            fontSize: "12px",
            color: "#a1a1aa",
            margin: "0 0 24px",
          }}
        >
          {nextBonus()}
        </p>

        <button
          onClick={handleClose}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "12px",
            border: "none",
            background: "#f59e0b",
            color: "#000",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          受け取る
        </button>
      </div>
    </AnimatedModal>
  );
}

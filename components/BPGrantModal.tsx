"use client";

import { useEffect, useState } from "react";
import AnimatedModal from "./animations/AnimatedModal";
import { CountUpNumber } from "./animations/CountUpNumber";
import { RewardBurst } from "./animations/RewardBurst";

type Props = {
  amount: number;
  onClose: () => void;
};

export default function BPGrantModal({ amount, onClose }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 300);
  };

  return (
    <AnimatedModal open={open} onBackdropClick={handleClose}>
      <div
        style={{
          background: "white",
          borderRadius: "28px",
          padding: "40px 32px",
          textAlign: "center",
          boxShadow: "0 32px 80px rgba(2,6,23,0.22)",
          maxWidth: "340px",
          width: "90vw",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <RewardBurst count={12} colors={["#6366f1", "#8b5cf6", "#a78bfa", "#c084fc"]} />

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <img
            src="/getBP.png"
            alt="BP獲得"
            style={{ width: "120px", height: "120px", objectFit: "contain" }}
          />
        </div>

        <div
          style={{
            fontSize: "32px",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: 0,
          }}
        >
          <CountUpNumber to={amount} prefix="+" suffix=" BP 獲得！" duration={1.0} />
        </div>

        <p style={{ marginTop: "8px", fontSize: "14px", color: "#64748b", fontWeight: 600 }}>
          売却BPが付与されました
        </p>

        <button
          type="button"
          onClick={handleClose}
          style={{
            marginTop: "24px",
            width: "100%",
            padding: "12px",
            borderRadius: "16px",
            border: "none",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "white",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          閉じる
        </button>
      </div>
    </AnimatedModal>
  );
}

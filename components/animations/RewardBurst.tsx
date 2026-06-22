"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

type Props = {
  count?: number;
  colors?: string[];
};

export function RewardBurst({
  count = 12,
  colors = ["#f59e0b", "#6366f1", "#10b981", "#ec4899", "#f87171"],
}: Props) {
  const reduced = useReducedMotion();

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (360 / count) * i;
        const rad = (angle * Math.PI) / 180;
        const dist = 60 + (i % 3) * 20;
        return {
          id: i,
          tx: Math.cos(rad) * dist,
          ty: Math.sin(rad) * dist,
          color: colors[i % colors.length],
          size: 6 + (i % 2) * 3,
        };
      }),
    [count, colors]
  );

  if (reduced) return null;

  return (
    <div
      aria-hidden
      style={{
        pointerEvents: "none",
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: p.color,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.tx, y: p.ty, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.05 }}
        />
      ))}
    </div>
  );
}

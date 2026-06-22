"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  color: string;
  children: ReactNode;
  glow?: boolean;
};

export function GlowBadge({ color, children, glow = false }: Props) {
  const reduced = useReducedMotion();
  const shouldGlow = glow && !reduced;

  return (
    <motion.div
      style={{
        display: "inline-block",
        color,
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.15em",
        background: `${color}20`,
        border: `1px solid ${color}60`,
      }}
      animate={
        shouldGlow
          ? {
              boxShadow: [
                `0 0 0px ${color}`,
                `0 0 18px ${color}80`,
                `0 0 0px ${color}`,
              ],
            }
          : {}
      }
      transition={
        shouldGlow
          ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          : {}
      }
    >
      {children}
    </motion.div>
  );
}

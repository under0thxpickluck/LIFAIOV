"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function MotionCard({
  children,
  delay = 0,
  className = "",
  onClick,
  disabled = false,
}: Props) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      onClick={onClick}
      initial={reduced ? {} : { opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduced
          ? { duration: 0 }
          : { delay, type: "spring", damping: 20, stiffness: 260 }
      }
      whileHover={disabled || reduced ? {} : { scale: 1.04 }}
      whileTap={disabled || reduced ? {} : { scale: 0.96 }}
      style={{ cursor: onClick && !disabled ? "pointer" : undefined }}
    >
      {children}
    </motion.div>
  );
}

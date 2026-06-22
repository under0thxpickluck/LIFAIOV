"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode, MouseEvent } from "react";

type Props = {
  open: boolean;
  onBackdropClick?: () => void;
  children: ReactNode;
};

export default function AnimatedModal({ open, onBackdropClick, children }: Props) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      onClick={onBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
        cursor: onBackdropClick ? "pointer" : "default",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: open ? 1 : 0 }}
      transition={{ duration: reduced ? 0 : 0.25 }}
    >
      <motion.div
        onClick={(e: MouseEvent) => e.stopPropagation()}
        style={{ cursor: "default" }}
        initial={reduced ? {} : { scale: 0.88, y: 24, opacity: 0 }}
        animate={
          reduced
            ? {}
            : open
              ? { scale: 1, y: 0, opacity: 1 }
              : { scale: 0.92, y: 12, opacity: 0 }
        }
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", damping: 22, stiffness: 280 }
        }
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

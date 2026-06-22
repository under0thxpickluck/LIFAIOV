"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Props = {
  href: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  badge?: string;
  disabled?: boolean;
};

export function GameTile({ href, title, subtitle, icon, badge, disabled }: Props) {
  const reduced = useReducedMotion();
  // CSS の hover/active クラスは削除（framer-motion に委譲）
  const base =
    "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_70px_rgba(0,0,0,.35)] backdrop-blur-xl";

  const content = (
    <motion.div
      className={`${base} ${disabled ? "opacity-40" : ""}`}
      initial={reduced ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { type: "spring", damping: 20, stiffness: 260 }}
      whileHover={disabled || reduced ? {} : { y: -2, backgroundColor: "rgba(255,255,255,0.10)" }}
      whileTap={disabled || reduced ? {} : { scale: 0.98 }}
    >
      {/* 角の光 */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-cyan-400/20 blur-2xl" />
      {/* badge */}
      {badge ? (
        <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-slate-200">
          {badge}
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-black/25 text-white">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-base font-extrabold text-white">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-slate-300/80">{subtitle}</div> : null}
        </div>
      </div>
    </motion.div>
  );

  if (disabled) return <div>{content}</div>;
  return <Link href={href}>{content}</Link>;
}

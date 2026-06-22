"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
} from "framer-motion";

type Props = {
  from?: number;
  to: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
};

export function CountUpNumber({
  from = 0,
  to,
  duration = 1.2,
  className = "",
  prefix = "",
  suffix = "",
}: Props) {
  const reduced = useReducedMotion();
  const count = useMotionValue(reduced ? to : from);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (reduced) {
      count.set(to);
      return;
    }
    const controls = animate(count, to, { duration, ease: "easeOut" });
    return controls.stop;
  }, [to, count, duration, reduced]);

  return (
    <motion.span className={className}>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </motion.span>
  );
}

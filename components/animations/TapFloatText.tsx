"use client";

import { motion, useReducedMotion } from "framer-motion";

type FloatItem = {
  id: number;
  text: string;
  color: string;
  x: number;
};

type Props = {
  items: FloatItem[];
};

export function TapFloatText({ items }: Props) {
  const reduced = useReducedMotion();

  return (
    <>
      {items.map((f) => (
        <motion.div
          key={f.id}
          className={`absolute text-sm font-bold pointer-events-none select-none ${f.color}`}
          style={{ left: `${f.x}%`, top: 0 }}
          initial={{ y: 0, opacity: 1 }}
          animate={reduced ? { opacity: 0 } : { y: -72, opacity: 0 }}
          transition={
            reduced ? { duration: 0.15 } : { duration: 0.65, ease: "easeOut" }
          }
        >
          {f.text}
        </motion.div>
      ))}
    </>
  );
}

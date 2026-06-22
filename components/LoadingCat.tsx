"use client";

import { useEffect, useState } from "react";

const FRAMES = [
  "/taiki/taiki1.png",
  "/taiki/taiki2.png",
  "/taiki/taiki3.png",
  "/taiki/taiki4.png",
];

type Props = {
  /** true（デフォルト）= 画面全体を固定オーバーレイ、false = インライン表示 */
  fullscreen?: boolean;
  /** インライン時のテキストカラー。デフォルトは白 */
  textColor?: string;
};

export function LoadingCat({ fullscreen = true, textColor = "text-white" }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % 4), 1000);
    return () => clearInterval(id);
  }, []);

  const inner = (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-bold ${textColor}`}>読み込み中…</span>
      <img
        src={FRAMES[frame]}
        alt=""
        aria-hidden
        className="w-8 h-8 object-contain"
      />
    </div>
  );

  if (!fullscreen) return inner;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50">
      <div className="flex flex-col items-center gap-3">
        <img
          src={FRAMES[frame]}
          alt=""
          aria-hidden
          className="w-16 h-16 object-contain"
        />
        <span className="text-sm font-bold text-white">読み込み中…</span>
      </div>
    </div>
  );
}

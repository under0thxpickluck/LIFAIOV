"use client";

import { useEffect, useState } from "react";

const FRAMES = [
  "/taiki/taiki1.png",
  "/taiki/taiki2.png",
  "/taiki/taiki3.png",
  "/taiki/taiki4.png",
];

type Props = {
  /** true（デフォルト）= 画面全体グレー固定表示、false = インライン */
  fullscreen?: boolean;
  textColor?: string;
};

export function LoadingCat({ fullscreen = true, textColor = "text-gray-500" }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % 4), 1000);
    return () => clearInterval(id);
  }, []);

  // 全フレームを重ねて表示し、opacity だけ切り替える（ちらつき防止）
  const iconSize = fullscreen ? 96 : 32;
  const icon = (
    <div style={{ position: "relative", width: iconSize, height: iconSize, flexShrink: 0 }}>
      {FRAMES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            mixBlendMode: "multiply",   // 白背景を背景色に溶け込ませる
            opacity: i === frame ? 1 : 0,
            transition: "opacity 0.1s",
          }}
        />
      ))}
    </div>
  );

  if (!fullscreen) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className={`text-sm font-bold ${textColor}`}>読み込み中…</span>
        {icon}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        backgroundColor: "#e5e7eb", // gray-200
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      {icon}
      <p style={{ fontSize: 14, fontWeight: 700, color: "#6b7280", margin: 0 }}>
        読み込み中…
      </p>
    </div>
  );
}

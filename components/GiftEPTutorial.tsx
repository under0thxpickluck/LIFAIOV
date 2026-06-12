"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "gift_ep_tutorial_seen";

const PAGES = [
  {
    icon: "🎁",
    title: "GiftEPとは？",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 13, color: "rgba(234,240,255,0.75)", lineHeight: 1.8 }}>
          GiftEPは<strong style={{ color: "#A78BFA" }}>LIFAI内限定のギフトクレジット</strong>です。
          <br />メンバー同士で贈り合い、LIFAI内の各種サービスで使えます。
        </p>
        <div style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 14, padding: "14px 16px" }}>
          <p style={{ fontSize: 12, color: "rgba(167,139,250,0.9)", fontWeight: 700, marginBottom: 8 }}>📌 基本スペック</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              ["有効期限", "付与から 30日間"],
              ["単位", "1 GiftEP〜"],
              ["入手方法", "他メンバーから受け取る"],
              ["換金", "❌ 不可"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "rgba(234,240,255,0.45)" }}>{k}</span>
                <span style={{ color: "#EAF0FF", fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "✨",
    title: "使い道",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          {
            icon: "🎁",
            title: "仲間に贈る",
            desc: "「GiftEPを贈る」からメンバーIDを指定して送れます。感謝やお祝いに。",
          },
          {
            icon: "✨",
            title: "LIFAI内サービスで使う",
            desc: "「使い道」ページで対応サービスを確認。支払いにGiftEPを充当できます。",
          },
          {
            icon: "📋",
            title: "履歴を確認",
            desc: "送った・受け取った記録はいつでも「履歴」から確認できます。",
          },
        ].map((item) => (
          <div
            key={item.title}
            style={{
              display: "flex",
              gap: 12,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14,
              padding: "12px 14px",
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1, marginTop: 2 }}>{item.icon}</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#EAF0FF", marginBottom: 4 }}>{item.title}</p>
              <p style={{ fontSize: 12, color: "rgba(234,240,255,0.5)", lineHeight: 1.7 }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: "⚠️",
    title: "利用ルール",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontSize: 12, color: "rgba(234,240,255,0.5)", lineHeight: 1.7 }}>
          GiftEPはLIFAIコミュニティの信頼を守るため、以下のルールを設けています。
        </p>
        {[
          { icon: "🚫", text: "換金・外部売買は禁止（違反で永久BAN）", warn: true },
          { icon: "🔁", text: "受け取ったGiftEPの再送は不可", warn: false },
          { icon: "⏳", text: "有効期限は付与から30日（期限切れは失効）", warn: false },
          { icon: "🌐", text: "LIFAI外のサービスでの利用は禁止", warn: false },
          { icon: "🏪", text: "マーケットでの売買目的の利用は禁止", warn: false },
        ].map((r) => (
          <div
            key={r.text}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              background: r.warn ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${r.warn ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 12,
              padding: "10px 12px",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1.4 }}>{r.icon}</span>
            <p style={{ fontSize: 12, color: r.warn ? "#FCA5A5" : "rgba(234,240,255,0.65)", lineHeight: 1.7, fontWeight: r.warn ? 700 : 500 }}>
              {r.text}
            </p>
          </div>
        ))}
      </div>
    ),
  },
];

export function useGiftEPTutorial() {
  // SSRとクライアントで初期描画を一致させるため、マウント後に未読判定して開く
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== "1") setOpen(true);
  }, []);

  const openTutorial = () => setOpen(true);
  const closeTutorial = () => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  return { open, openTutorial, closeTutorial };
}

export default function GiftEPTutorial({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);

  if (!open) return null;

  const current = PAGES[page];
  const isLast = page === PAGES.length - 1;

  const handleClose = () => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, "1");
    setPage(0);
    onClose();
  };

  return (
    <>
      {/* オーバーレイ */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* モーダル */}
      <div
        style={{
          position: "fixed",
          inset: "0 0 0 0",
          zIndex: 51,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 16px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            width: "100%",
            maxWidth: 400,
            background: "#0F1A2E",
            border: "1px solid rgba(167,139,250,0.25)",
            borderRadius: 24,
            padding: "28px 24px 24px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          }}
        >
          {/* ページ数インジケーター */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
            {PAGES.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === page ? 20 : 6,
                  height: 6,
                  borderRadius: 9999,
                  background: i === page ? "#A78BFA" : "rgba(167,139,250,0.25)",
                  transition: "width 0.2s",
                }}
              />
            ))}
          </div>

          {/* アイコン + タイトル */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <p style={{ fontSize: 40, lineHeight: 1, marginBottom: 10 }}>{current.icon}</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#EAF0FF" }}>{current.title}</p>
          </div>

          {/* 本文 */}
          <div style={{ marginBottom: 24 }}>{current.content}</div>

          {/* ナビゲーション */}
          <div style={{ display: "flex", gap: 10 }}>
            {page > 0 && (
              <button
                onClick={() => setPage((p) => p - 1)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "rgba(234,240,255,0.6)",
                  cursor: "pointer",
                }}
              >
                ← 戻る
              </button>
            )}
            <button
              onClick={isLast ? handleClose : () => setPage((p) => p + 1)}
              style={{
                flex: 2,
                padding: "12px",
                borderRadius: 14,
                background: isLast
                  ? "linear-gradient(90deg,#6366F1,#A78BFA)"
                  : "rgba(167,139,250,0.15)",
                border: isLast ? "none" : "1px solid rgba(167,139,250,0.3)",
                fontSize: 13,
                fontWeight: 700,
                color: isLast ? "#fff" : "#A78BFA",
                cursor: "pointer",
              }}
            >
              {isLast ? "はじめる →" : "次へ →"}
            </button>
          </div>

          {/* スキップ */}
          {!isLast && (
            <button
              onClick={handleClose}
              style={{
                display: "block",
                width: "100%",
                marginTop: 12,
                background: "none",
                border: "none",
                fontSize: 11,
                color: "rgba(234,240,255,0.25)",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              スキップ
            </button>
          )}
        </div>
      </div>
    </>
  );
}

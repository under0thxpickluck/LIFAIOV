"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getAuth, getAuthSecret } from "@/app/lib/auth";

type Message = { id: string; role: "user" | "assistant"; content: string; images?: string[] };

const GREETING: Message = {
  id: "greeting",
  role: "assistant",
  content: "やあ！何でも聞いてね。AI・副業・LIFAIのことも、日常のことも答えるよ🐱",
};

const SERVICES = [
  { icon: "🎼", label: "音楽生成",       href: "/music2" },
  { icon: "🚀", label: "Music Boost",    href: "/music-boost" },
  { icon: "📝", label: "ノート生成",      href: "/note-generator" },
  { icon: "🛒", label: "マーケット",      href: "/market" },
  { icon: "🔮", label: "占い",        href: "/fortune" },
  { icon: "💎", label: "ステーキング",    href: "/top" },
  { icon: "🎰", label: "ガチャ",          href: "/top" },
  { icon: "🧩", label: "ワークフロー",    href: "/workflow" },
  { icon: "⚔️", label: "Rumble Arena",   href: "/mini-games/rumble" },
  { icon: "⛏️", label: "Tap Mining",     href: "/mini-games/tap" },
  { icon: "👑", label: "メンバーシップ",  href: "/membership" },
];

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function resizeImage(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = document.createElement("img");
        img.onload = () => {
          const MAX = 800;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
            else { width = Math.round((width * MAX) / height); height = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const remaining = 3 - attachedImages.length;
    if (remaining <= 0) return;
    const toAdd = files.slice(0, remaining);
    toAdd.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) return; // 10MB超は無視
      resizeImage(file).then((resized) => {
        setAttachedImages((prev) => {
          if (prev.length >= 3) return prev;
          return [...prev, resized];
        });
      });
    });
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const currentImages = [...attachedImages];
    const userMessage: Message = { id: `msg-${Date.now()}`, role: "user", content: text, images: currentImages.length ? currentImages : undefined };
    const updatedMessages = [...messages, userMessage];
    setInput("");
    setMessages(updatedMessages);
    setAttachedImages([]);
    setIsLoading(true);

    const auth = getAuth();
    const code = getAuthSecret();

    try {
      const res = await fetch("/api/cat-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          // historyは images を除外して送信（ボディサイズ削減）
          history: updatedMessages.slice(-10).map((m) => ({ id: m.id, role: m.role, content: m.content })),
          images: currentImages.length ? currentImages : undefined,
          id: auth?.id,
          code,
        }),
      });
      const data = await res.json();
      const reply = data.ok
        ? data.reply
        : "ごめんね、うまく答えられなかったよ🙀 もう一度試してみて！";
      setMessages((prev) => [...prev, { id: `msg-${Date.now()}`, role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `msg-${Date.now()}`, role: "assistant", content: "ごめんね、通信エラーが起きたよ🙀 もう一度試してみて！" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: "#0A0A0A", color: "#fff" }}>

      {/* ── ヘッダー ── */}
      <header
        className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.08)", background: "#0A0A0A" }}
      >
        <button
          onClick={() => router.push("/top")}
          className="text-sm font-medium mr-1"
          style={{ color: "rgba(255,255,255,0.4)" }}
          aria-label="戻る"
        >
          ← 戻る
        </button>
        <Image src="/aibot/cat_normal.png" alt="リファ猫" width={32} height={32} className="rounded-full" />
        <div>
          <div className="text-sm font-bold">リファ猫に相談</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>何でも聞いてね</div>
        </div>
      </header>

      {/* ── メインエリア（サイドバー＋チャット） ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── 左サイドバー ── */}
        <aside
          className="flex-shrink-0 flex flex-col border-r overflow-hidden"
          style={{
            width: sidebarOpen ? 200 : 48,
            borderColor: "rgba(255,255,255,0.08)",
            background: "#0f0f0f",
            transition: "width 0.25s ease",
          }}
        >
          {/* 開閉ボタン */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center justify-center h-12 flex-shrink-0 hover:bg-white/5 transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
            aria-label={sidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
          >
            <span
              className="text-base"
              style={{
                display: "inline-block",
                transition: "transform 0.25s ease",
                transform: sidebarOpen ? "rotate(0deg)" : "rotate(180deg)",
              }}
            >
              ◀
            </span>
          </button>

          <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }} />

          {/* サービスリンク */}
          <nav className="flex-1 overflow-y-auto py-2">
            {SERVICES.map((s) => (
              <button
                key={s.href + s.label}
                onClick={() => router.push(s.href)}
                className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                style={{ color: "rgba(255,255,255,0.65)" }}
                title={s.label}
              >
                <span className="text-lg flex-shrink-0 w-6 text-center">{s.icon}</span>
                <span
                  className="text-xs font-medium truncate"
                  style={{
                    opacity: sidebarOpen ? 1 : 0,
                    transition: "opacity 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.label}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* ── チャットエリア ── */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* メッセージエリア */}
          <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 items-start ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <Image
                    src="/aibot/cat_normal.png"
                    alt="リファ猫"
                    width={28}
                    height={28}
                    className="rounded-full flex-shrink-0 mt-1"
                  />
                )}
                <div
                  className="rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[80%]"
                  style={{
                    background: msg.role === "user"
                      ? "linear-gradient(135deg, #4f46e5, #6366f1)"
                      : "rgba(255,255,255,0.08)",
                    color: "#fff",
                    borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.images?.length ? (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {msg.images.map((img, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={img.slice(0, 40)}
                          src={img}
                          alt={`画像${i + 1}`}
                          style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8, display: "block", objectFit: "contain" }}
                        />
                      ))}
                    </div>
                  ) : null}
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 items-start justify-start">
                <Image
                  src="/aibot/cat_normal.png"
                  alt="リファ猫"
                  width={28}
                  height={28}
                  className="rounded-full flex-shrink-0 mt-1"
                />
                <div
                  className="rounded-2xl px-4 py-3 text-sm"
                  style={{ background: "rgba(255,255,255,0.08)", borderRadius: "18px 18px 18px 4px" }}
                >
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>●</span>
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* 入力エリア */}
          <div
            className="flex-shrink-0 px-4 py-3 border-t"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "#0A0A0A" }}
          >
            {/* 添付画像プレビュー */}
            {attachedImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {attachedImages.map((img, i) => (
                  <div key={img.slice(0, 40)} className="relative flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`添付画像${i + 1}`}
                      style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }}
                    />
                    <button
                      onClick={() => setAttachedImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-white"
                      style={{ background: "rgba(0,0,0,0.7)", fontSize: 10, lineHeight: 1 }}
                      aria-label="画像を削除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div
              className="flex gap-2 items-center rounded-2xl px-4 py-2"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {/* 非表示ファイル選択 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={isLoading}
              />
              {/* クリップボタン */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || attachedImages.length >= 3}
                className="flex-shrink-0 text-base transition-opacity"
                style={{
                  color: "rgba(255,255,255,0.4)",
                  opacity: isLoading || attachedImages.length >= 3 ? 0.3 : 1,
                  cursor: isLoading || attachedImages.length >= 3 ? "not-allowed" : "pointer",
                  background: "none",
                  border: "none",
                  padding: 0,
                }}
                aria-label="画像を添付"
              >
                📎
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="何か聞いてみて…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "#fff" }}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="rounded-xl px-4 py-1.5 text-sm font-bold transition-opacity"
                style={{
                  background: "linear-gradient(135deg, #4f46e5, #6366f1)",
                  color: "#fff",
                  opacity: isLoading || !input.trim() ? 0.4 : 1,
                  cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
                }}
              >
                送信
              </button>
            </div>
            <p className="text-center text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
              Enterで送信
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

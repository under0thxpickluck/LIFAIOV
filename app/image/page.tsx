"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, getAuthSecret } from "@/app/lib/auth";
import { emptyState, mergeState } from "@/app/lib/image/chat_state";
import type { ImageChatState, ImageHistoryItem, ImagePreviewCost } from "@/app/lib/image/image_types";
import ImageChatPanel from "@/components/image/ImageChatPanel";
import ImageStateChips from "@/components/image/ImageStateChips";
import ImageCostBox from "@/components/image/ImageCostBox";
import ImagePreviewCard from "@/components/image/ImagePreviewCard";
import ImageHistoryGrid from "@/components/image/ImageHistoryGrid";
import ImageStylePicker from "@/components/image/ImageStylePicker";
import ImageGenerateButton from "@/components/image/ImageGenerateButton";
import ImageEditPanel from "@/components/image/ImageEditPanel";

const MAX_SESSION = 10;
const COOLDOWN_SEC = 20;

type Message = { role: "ai" | "user"; text: string };
type Tab = "generate" | "history" | "edit";

async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank");
  }
}

export default function ImagePage() {
  const router = useRouter();
  const [authId, setAuthId] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [balance, setBalance] = useState(0);

  const [tab, setTab] = useState<Tab>("generate");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [state, setState] = useState<ImageChatState>(emptyState());
  const [cost, setCost] = useState<ImagePreviewCost | null>(null);
  const [hq, setHq] = useState(false);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  const [history, setHistory] = useState<ImageHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [editResultUrl, setEditResultUrl] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [sessionCount, setSessionCount] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [copied, setCopied] = useState(false);

  const initialized = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  useEffect(() => {
    const a = getAuth();
    if (!a) { router.replace("/login"); return; }
    const id = (a as any)?.id || (a as any)?.loginId || (a as any)?.login_id || "";
    const code = getAuthSecret() || (a as any)?.token || "";
    if (!id || !code) { router.replace("/login"); return; }
    setAuthId(id);
    setAuthCode(code);

    // 残高取得
    fetch("/api/wallet/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, group: (a as any)?.group || "" }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setBalance(Number(d.bp ?? 0)); })
      .catch(() => {});
  }, [router]);

  // コスト計算
  useEffect(() => {
    if (!state || (state.turns === 0 && !state.character)) return;
    const s: ImageChatState = { ...state, hq };
    fetch("/api/image/preview-cost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: s }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCost({ totalBp: d.totalBp, breakdown: d.breakdown }); })
      .catch(() => {});
  }, [state, hq]);

  const handleSend = useCallback(async (text: string) => {
    if (!authId || !authCode) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/image/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: authId, code: authCode, message: text, history: messages, state }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
        const nextState = data.stateUpdate ?? data.state;
        if (nextState) {
          setState((prev) => mergeState(prev, nextState));
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "エラーが発生しました。もう一度試してください。" }]);
    } finally {
      setChatLoading(false);
    }
  }, [authId, authCode, messages, state]);

  const startCooldown = useCallback(() => {
    setCooldownLeft(COOLDOWN_SEC);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldownLeft((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!authId || !authCode || !cost) return;
    if (cooldownLeft > 0 || sessionCount >= MAX_SESSION) return;
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: authId, code: authCode, state: { ...state, hq } }),
      });
      const data = await res.json();
      if (data.ok) {
        setImageUrl(data.imageUrl);
        setBalance((b) => b - data.bpUsed);
        setSessionCount((c) => c + 1);
        startCooldown();
      } else {
        setGenError(data.error === "insufficient_bp" ? "BPが不足しています" : "生成に失敗しました");
      }
    } catch {
      setGenError("通信エラーが発生しました");
    } finally {
      setGenerating(false);
    }
  }, [authId, authCode, state, hq, cost, cooldownLeft, sessionCount, startCooldown]);

  const loadHistory = useCallback(async () => {
    if (!authId || !authCode) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/image/history?id=${encodeURIComponent(authId)}&code=${encodeURIComponent(authCode)}`);
      const data = await res.json();
      if (data.ok) setHistory(data.items ?? []);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, [authId, authCode]);

  useEffect(() => {
    if (tab === "history" && authId && authCode && !initialized.current) {
      initialized.current = true;
      loadHistory();
    }
  }, [tab, authId, authCode, loadHistory]);

  const handleEdit = useCallback(async (instruction: string) => {
    if (!authId || !authCode || !imageUrl) return;
    setEditLoading(true);
    try {
      const res = await fetch("/api/image/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: authId, code: authCode, imageUrl, instruction, state }),
      });
      const data = await res.json();
      if (data.ok) {
        setEditResultUrl(data.imageUrl);
        setBalance((b) => b - data.bpUsed);
      }
    } catch {
      // ignore
    } finally {
      setEditLoading(false);
    }
  }, [authId, authCode, imageUrl, state]);

  return (
    <main className="min-h-screen bg-[#0B1220] text-[#EAF0FF]">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* ヘッダー */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold">AI 画像生成</h1>
            <p className="mt-1 text-xs text-[#A8B3CF]">会話しながらイメージを固めて画像を生成</p>
          </div>
          <div className="rounded-full border border-white/10 bg-[#0d1a2e] px-4 py-1.5 text-xs font-bold text-[#EAF0FF]">
            {balance} BP
          </div>
        </div>

        {/* タブ */}
        <div className="mb-6 flex gap-1 rounded-2xl border border-white/10 bg-[#0d1a2e] p-1">
          {(["generate", "history", "edit"] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = { generate: "生成", history: "履歴", edit: "編集" };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                  tab === t
                    ? "bg-gradient-to-r from-[#7C5CFF] to-[#3AA0FF] text-white"
                    : "text-[#A8B3CF] hover:text-[#EAF0FF]"
                }`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* 生成タブ */}
        {tab === "generate" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 左: チャット */}
            <div className="flex flex-col gap-4">
              <div className="h-80">
                <ImageChatPanel messages={messages} onSend={handleSend} loading={chatLoading} />
              </div>
              <ImageStateChips state={state} />
            </div>

            {/* 右: プレビュー + 設定 */}
            <div className="flex flex-col gap-4">
              <ImagePreviewCard imageUrl={imageUrl} loading={generating} />

              {/* ダウンロード・コピーボタン */}
              {imageUrl && !generating && (
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadImage(imageUrl, `lifai_image_${Date.now()}.png`)}
                    className="flex-1 rounded-xl border border-white/10 bg-[#0d1a2e] py-2.5 text-xs font-semibold text-[#EAF0FF] transition hover:bg-white/10"
                  >
                    ⬇ ダウンロード
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(imageUrl).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold transition ${
                      copied
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : "border-white/10 bg-[#0d1a2e] text-[#EAF0FF] hover:bg-white/10"
                    }`}
                  >
                    {copied ? "✓ コピー済み" : "🔗 URLコピー"}
                  </button>
                </div>
              )}

              <ImageStylePicker
                selected={state.style}
                onChange={(s) => setState((prev) => ({ ...prev, style: s }))}
              />

              {/* 高品質オプション */}
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#0d1a2e] px-4 py-3">
                <input
                  type="checkbox"
                  checked={hq}
                  onChange={(e) => setHq(e.target.checked)}
                  className="h-4 w-4 accent-[#7C5CFF]"
                />
                <div>
                  <p className="text-sm font-semibold">高品質モード</p>
                  <p className="text-xs text-[#A8B3CF]">解像度・品質が向上します (+20BP)</p>
                </div>
              </label>

              <ImageCostBox cost={cost} balance={balance} />

              {genError && (
                <p className="rounded-xl bg-[#FF6B6B]/10 px-4 py-2 text-sm text-[#FF6B6B]">{genError}</p>
              )}

              {/* レート制限表示 */}
              <div className="flex items-center justify-between text-xs text-[#A8B3CF]">
                <span>今セッションの生成回数: {sessionCount} / {MAX_SESSION}</span>
                {cooldownLeft > 0 && (
                  <span className="text-[#7C5CFF] font-semibold">次の生成まで {cooldownLeft}秒</span>
                )}
                {sessionCount >= MAX_SESSION && (
                  <span className="text-[#FF6B6B] font-semibold">セッション上限に達しました</span>
                )}
              </div>

              <ImageGenerateButton
                onClick={handleGenerate}
                loading={generating}
                disabled={!cost || balance < (cost?.totalBp ?? 0) || cooldownLeft > 0 || sessionCount >= MAX_SESSION}
                bpCost={cost?.totalBp ?? 0}
              />
            </div>
          </div>
        )}

        {/* 履歴タブ */}
        {tab === "history" && (
          <div>
            {historyLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 rounded-full border-4 border-[#7C5CFF] border-t-transparent animate-spin" />
              </div>
            ) : (
              <ImageHistoryGrid items={history} />
            )}
          </div>
        )}

        {/* 編集タブ */}
        {tab === "edit" && (
          <div className="max-w-lg mx-auto">
            {!imageUrl ? (
              <div className="rounded-2xl border border-dashed border-white/20 py-12 text-center">
                <p className="text-sm text-[#A8B3CF]">
                  まず「生成」タブで画像を作成してください
                </p>
              </div>
            ) : (
              <ImageEditPanel
                originalUrl={imageUrl}
                onEdit={handleEdit}
                loading={editLoading}
                resultUrl={editResultUrl}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

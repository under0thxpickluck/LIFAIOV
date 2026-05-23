"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const POLL_INTERVAL_MS = 5000;

type StatusData = {
  ok: boolean;
  apply_id?: string;
  status?: string;
  payment_status?: string;
  plan?: string;
  mail_sent?: boolean;
  error?: string;
};

const STATUS_MESSAGES: Record<string, { title: string; body: string; done: boolean }> = {
  pending_payment:    { title: "申込受付済み",     body: "支払いをお待ちしています。外部アプリからお振り込みください。",   done: false },
  payment_waiting:    { title: "入金確認中",       body: "入金の到着を待っています。ページを閉じても処理は継続されます。", done: false },
  payment_confirming: { title: "入金確認中",       body: "ブロックチェーンの承認を確認しています。しばらくお待ちください。", done: false },
  payment_confirmed:  { title: "承認処理中",       body: "入金を確認しました。承認処理を行っています。",                 done: false },
  approved:           { title: "承認完了",         body: "認証メールをご登録のメールアドレスにお送りしました。",          done: true  },
  manual_review:      { title: "手動確認が必要です", body: "サポートチームが確認します。ご連絡をお待ちください。",          done: true  },
  pending_error:      { title: "エラーが発生しました", body: "サポートへご連絡ください。",                                done: true  },
};

function PurchaseStatusContent() {
  const searchParams = useSearchParams();
  const [applyId, setApplyId] = useState<string>("");
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // apply_id は URL param → sessionStorage の順で取得
    const paramId = searchParams.get("apply_id") ?? "";
    const stored = typeof window !== "undefined"
      ? sessionStorage.getItem("5000_apply_id") ?? ""
      : "";
    const id = paramId || stored;
    setApplyId(id);
  }, [searchParams]);

  async function fetchStatus(id: string) {
    if (!id) return;
    try {
      const res = await fetch(
        `/api/5000/purchase-status?apply_id=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );
      const data: StatusData = await res.json();
      setStatusData(data);
      return data;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!applyId) return;

    let stopped = false;

    async function poll() {
      const data = await fetchStatus(applyId);
      if (stopped) return;
      const info = STATUS_MESSAGES[data?.status ?? ""];
      if (info?.done) return; // ポーリング停止
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      stopped = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [applyId]);

  async function handleResend() {
    if (!applyId) return;
    setResending(true);
    setResendMsg(null);
    try {
      const res = await fetch("/api/5000/reset/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply_id: applyId }),
      });
      const data = await res.json();
      if (data?.ok) {
        setResendMsg("メールを再送しました。届かない場合はサポートへご連絡ください。");
      } else {
        setResendMsg("再送に失敗しました: " + (data?.error ?? "unknown error"));
      }
    } catch {
      setResendMsg("通信エラーが発生しました。");
    } finally {
      setResending(false);
    }
  }

  const status = statusData?.status ?? "";
  const info = STATUS_MESSAGES[status] ?? null;
  const showResend = status === "approved" && statusData?.mail_sent === false;

  const accentColor = info?.done ? (status === "approved" ? "#00D4FF" : "#ff8080") : "#6C63FF";

  if (!applyId) {
    return (
      <main style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          apply_id が見つかりません。申込ページからやり直してください。
        </p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      {/* 背景グロー */}
      <div style={{
        pointerEvents: "none", position: "fixed", inset: 0, zIndex: 0,
        background: [
          "radial-gradient(ellipse 700px 500px at 5% 0%, rgba(108,99,255,0.08) 0%, transparent 60%)",
          "radial-gradient(ellipse 600px 400px at 100% 20%, rgba(0,212,255,0.06) 0%, transparent 60%)",
        ].join(","),
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 440, width: "100%", textAlign: "center" }}>
        {/* アイコン */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%", margin: "0 auto 24px",
          background: `linear-gradient(135deg, #6C63FF, ${accentColor})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, boxShadow: `0 0 40px rgba(108,99,255,0.4)`,
        }}>
          {status === "approved" ? "✓" : info?.done ? "!" : "…"}
        </div>

        {/* タイトル */}
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>
          {info ? info.title : (statusData ? "確認中…" : "読み込み中…")}
        </h1>

        {/* 本文 */}
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, margin: "0 0 24px" }}>
          {info ? info.body : "現在の状況を確認しています。しばらくお待ちください。"}
        </p>

        {/* ポーリング中インジケーター */}
        {!info?.done && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", margin: "0 0 24px" }}>
            5秒ごとに自動更新中…
          </p>
        )}

        {/* 承認後：月額サブスク案内 */}
        {status === "approved" && (
          <div style={{
            marginBottom: 24, padding: "20px 24px",
            border: "1px solid rgba(108,99,255,0.3)",
            borderRadius: 16, background: "rgba(108,99,255,0.08)",
            textAlign: "left",
          }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
              🎉 次のステップ：月額プランに申し込む
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 14 }}>
              LIFAIへの参加には月額サブスクリプションへのご登録が必要です。下記より手続きをお願いします。
            </p>
            <a
              href="https://square.link/u/JM500LiD"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block", width: "100%", padding: "13px 0",
                borderRadius: 12, textAlign: "center",
                background: "linear-gradient(135deg, #6C63FF, #00D4FF)",
                color: "#fff", fontSize: 14, fontWeight: 800,
                textDecoration: "none",
              }}
            >
              月額プランに申し込む（¥9,800/月）
            </a>
          </div>
        )}

        {/* メール再送ボタン */}
        {showResend && (
          <button
            onClick={handleResend}
            disabled={resending}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
              background: resending ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #6C63FF, #00D4FF)",
              color: resending ? "rgba(255,255,255,0.3)" : "#fff",
              fontSize: 14, fontWeight: 800, cursor: resending ? "not-allowed" : "pointer",
              marginBottom: 12,
            }}
          >
            {resending ? "送信中…" : "認証メールを再送する"}
          </button>
        )}

        {/* 再送結果メッセージ */}
        {resendMsg && (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>{resendMsg}</p>
        )}

        {/* apply_id 表示（サポート問い合わせ用）*/}
        {applyId && (
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 32 }}>
            申込ID: {applyId}
          </p>
        )}
      </div>
    </main>
  );
}

export default function PurchaseStatusPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", background: "#0A0A0A" }} />}>
      <PurchaseStatusContent />
    </Suspense>
  );
}

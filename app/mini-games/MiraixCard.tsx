"use client";
import { useState } from "react";
import { getAuth, getAuthSecret } from "../lib/auth";

type Th = { card: string; cardHover: string; muted: string; badge: string };

const ENABLED = process.env.NEXT_PUBLIC_MIRAIX_ENABLED === "1";

// LIFAI Arcade の MIRAIX カード。
// - NEXT_PUBLIC_MIRAIX_ENABLED !== "1" の間は従来どおり「準備中」（押せない）
// - 有効時はクリック → 免責ゲート（外部サイト・保証なし・LIFAI無関係）→ 同意後にSSO遷移
export function MiraixCard({ th }: { th: Th }) {
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!ENABLED) {
    return (
      <div aria-disabled="true" className={`${th.card} rounded-2xl p-6 block opacity-50 cursor-not-allowed select-none`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔮</span>
            <div>
              <h2 className="font-bold">MIRAIX</h2>
              <p className={`${th.muted} text-xs`}>EPで遊べる予測ゲーム（外部サイト）</p>
            </div>
          </div>
          <span className={`${th.muted} text-xs px-3 py-1 rounded-full border border-current`}>準備中</span>
        </div>
      </div>
    );
  }

  const go = async () => {
    setErr(null);
    setLoading(true);
    try {
      const auth = getAuth();
      const code = getAuthSecret();
      if (!auth?.id || !code) {
        setErr("セッションの有効期限が切れています。一度ログインし直してください。");
        return;
      }
      const res = await fetch("/api/miraix/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: auth.id, code, group: auth.group ?? "" }),
      }).then((r) => r.json()).catch(() => null);
      if (!res?.ok || !res.url) {
        setErr("接続に失敗しました。しばらく待ってから再度お試しください。");
        return;
      }
      window.location.href = res.url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => { setAgreed(false); setErr(null); setOpen(true); }}
        className={`${th.card} rounded-2xl p-6 ${th.cardHover} transition block w-full text-left`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔮</span>
            <div>
              <h2 className="font-bold">MIRAIX</h2>
              <p className={`${th.muted} text-xs`}>EPで遊べる予測ゲーム（外部サイト）</p>
            </div>
          </div>
          <span className={`${th.badge} text-xs px-3 py-1 rounded-full`}>PLAY</span>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className={`${th.card} rounded-2xl p-6 max-w-md w-full`}>
            <h3 className="font-bold text-lg mb-3">外部サイトへ移動します</h3>
            <ul className={`${th.muted} text-sm space-y-2 mb-4 list-disc pl-5`}>
              <li>MIRAIX は<strong>外部サイト</strong>です。</li>
              <li>転送したEPを含め、<strong>資金保証・返金等の保証は一切できません</strong>。</li>
              <li>MIRAIX は <strong>LIFAI（LIFAIOV / aisalon）とは関係のない別サービス</strong>であり、LIFAI はその運営・内容について責任を負いません。</li>
            </ul>
            <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              上記を理解し、同意します
            </label>
            {err && <p className="text-red-500 text-xs mb-3">{err}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setOpen(false)}
                className={`flex-1 rounded-xl border border-current py-2 text-sm ${th.muted}`}>
                キャンセル
              </button>
              <button type="button" disabled={!agreed || loading} onClick={go}
                className={`flex-1 rounded-xl py-2 text-sm ${th.badge} disabled:opacity-40`}>
                {loading ? "接続中..." : "同意して移動"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

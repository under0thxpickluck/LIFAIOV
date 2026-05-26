"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// plan列（"30"/"50"/"100"/"500"/"1000"）→ 表示ランク名
const PLAN_RANK_MAP: Record<string, string> = {
  "30":   "Starter",
  "50":   "Builder",
  "100":  "Automation",
  "500":  "Core",
  "1000": "Infra",
};

// plan列 → BP上限（GAS planToGrant_ 実値 + /5000プラン）
const PLAN_BP_CAP: Record<string, number> = {
  "34":   300,
  "57":   600,
  "114":  1200,
  "567":  6000,
  "1134": 12000,
  // /5000プラン
  "500":  1000,
  "2000": 4000,
  "3000": 8000,
  "5000": 10000,
};

const BP_PACKS = [
  { id: "s",   label: "S",   price: 7.5,  bp: 500,   tag: null,      color: "border-white/10",    squareUrl: "https://square.link/u/psdQz6zG" },
  { id: "m",   label: "M",   price: 15,   bp: 1200,  tag: null,      color: "border-white/10",    squareUrl: "https://square.link/u/Pqma4c0e" },
  { id: "l",   label: "L",   price: 30,   bp: 2600,  tag: null,      color: "border-white/10",    squareUrl: "https://square.link/u/t9rI14uZ" },
  { id: "xl",  label: "XL",  price: 75,   bp: 7000,  tag: "おすすめ",  color: "border-purple-500",  squareUrl: "https://square.link/u/V5rWWucX" },
  { id: "xxl", label: "XXL", price: 150,  bp: 16000, tag: "最大効率", color: "border-yellow-500",  squareUrl: "https://square.link/u/xjZ3lkH4" },
];

type MemberStatus = {
  rank: string;
  base_bp: number;
  extra_bp: number;
  total_bp: number;
  next_renewal: string;
  bp_cap: number;
};

export default function MembershipPage() {
  const [userId, setUserId]     = useState("");
  const [status, setStatus]     = useState<MemberStatus | null>(null);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("addval_auth_v1");
      if (raw) { const auth = JSON.parse(raw); setUserId(String(auth?.id ?? "")); }
    } catch {}
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetch("/api/wallet/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, group: (() => { try { const a = JSON.parse(localStorage.getItem("addval_auth_v1") || "{}"); return a?.group || ""; } catch { return ""; } })() }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          const plan  = String(d.plan ?? "");
          const rank  = PLAN_RANK_MAP[plan] ?? plan ?? "Starter";
          const bpCap = PLAN_BP_CAP[plan]   ?? 300;
          setStatus({
            rank,
            base_bp:      Number(d.bp ?? 0),
            extra_bp:     0,
            total_bp:     Number(d.bp ?? 0),
            next_renewal: "—",
            bp_cap:       bpCap,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const handlePurchase = async (pack: typeof BP_PACKS[0]) => {
    setMsg(`🔒 現在BPパック購入は準備中です（${pack.label}パック / $${pack.price}`);
  };

  const handleSquarePurchase = async (pack: typeof BP_PACKS[0]) => {
    if (!userId) {
      setMsg("ログインしてから購入してください");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/square/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          pack_id: pack.id,
          bp_amount: pack.bp,
          price_cents: Math.round(pack.price * 100), // $7.5 → 750 cents
          label: `${pack.label}パック - ${pack.bp.toLocaleString()}BP`,
        }),
      });
      const data = await res.json();
      if (!data.ok || !data.checkout_url) {
        setMsg("決済ページの準備に失敗しました。時間をおいて再試行してください。");
        console.error("[membership] create-checkout failed", data);
        return;
      }
      window.open(data.checkout_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error("[membership] create-checkout error", e);
      setMsg("エラーが発生しました。再試行してください。");
    } finally {
      setBusy(false);
    }
  };

  const totalBp = (status?.base_bp ?? 0) + (status?.extra_bp ?? 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 max-w-lg mx-auto">

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/top" className="text-white/40 text-sm">← Back</Link>
        <div className="text-center">
          <h1 className="font-bold text-lg">メンバーシップ & BP</h1>
          <p className="text-xs text-white/40">クレジットの確認・回復・追加購入</p>
        </div>
        <div className="w-16" />
      </div>

      {/* 現在の状態カード */}
      <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/20 rounded-2xl p-5 mb-6">
        {loading ? (
          <p className="text-white/40 text-sm text-center py-4">読み込み中…</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-white/40 mb-1">現在のランク</p>
                <p className="font-black text-xl text-purple-400">{status?.rank ?? "Starter"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/40 mb-1">次回更新日</p>
                <p className="text-sm text-white/70">{status?.next_renewal ?? "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-white/40 mb-1">通常BP</p>
                <p className="font-black text-lg text-white">{(status?.base_bp ?? 0).toLocaleString()}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-white/40 mb-1">追加BP</p>
                <p className="font-black text-lg text-blue-400">{(status?.extra_bp ?? 0).toLocaleString()}</p>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-center">
                <p className="text-xs text-white/40 mb-1">合計BP</p>
                <p className="font-black text-lg text-purple-300">{totalBp.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <a href="#purchase"
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-center text-sm font-bold">
                BPを購入
              </a>
            </div>
          </>
        )}
      </div>

      {/* BPの仕組み */}
      <div className="bg-white/5 rounded-xl p-5 mb-6">
        <h2 className="font-bold mb-3">💡 BPの仕組み</h2>
        <p className="text-sm text-white/60 leading-relaxed mb-3">
          毎月、現在のランクに応じた通常クレジットが回復します。回復量は最大値の50%です。
        </p>
        <p className="text-sm text-white/60 leading-relaxed mb-3">
          回復後の通常クレジットは上限を超えません。追加購入や報酬で得たBPは、この回復の影響を受けません。
        </p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-xs text-white/40">通常クレジット</p>
            <p className="text-sm font-bold text-green-400 mt-1">毎月回復</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-xs text-white/40">追加クレジット</p>
            <p className="text-sm font-bold text-blue-400 mt-1">失効なし</p>
          </div>
        </div>
      </div>

      {/* 回復の例 */}
      <div className="bg-white/5 rounded-xl p-5 mb-6">
        <h2 className="font-bold mb-3">📊 回復の例（上限300の場合）</h2>
        <div className="space-y-2">
          {[
            { current: 150, cap: 300, recovery: 150, result: 300, note: "満タン回復" },
            { current: 250, cap: 300, recovery: 50,  result: 300, note: "上限まで回復" },
            { current: 500, cap: 300, recovery: 0,   result: 500, note: "回復なし（上限超え）" },
          ].map((c, i) => (
            <div key={i} className="flex items-center justify-between text-sm bg-white/3 rounded-lg p-3">
              <span className="text-white/40">現在 {c.current}</span>
              <span className="text-green-400">+{c.recovery}</span>
              <span className="text-white font-bold">→ {c.result}</span>
              <span className="text-white/30 text-xs">{c.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ランクについて */}
      <div className="bg-white/5 rounded-xl p-4 mb-6">
        <h2 className="font-bold mb-2">🏆 ランクについて</h2>
        <p className="text-sm text-white/60">
          ランクに応じて、毎月回復する通常クレジット量が変わります。
        </p>
      </div>

      {/* BP追加購入 */}
      <div id="purchase" className="mb-6">
        <h2 className="font-bold text-lg mb-1">💎 BPを追加購入</h2>
        <p className="text-xs text-white/40 mb-1">高品質なAI処理・インフラ維持のため、BP価格を調整しています</p>
        <p className="text-sm text-white/60 mb-4">追加購入したBPは失効せず、回復の影響も受けません。</p>

        <div className="space-y-3">
          {BP_PACKS.map(pack => (
            <div key={pack.id}
              className={`border ${pack.color} rounded-xl p-4 bg-white/5 relative`}>
              {pack.tag && (
                <span className={`absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-bold ${
                  pack.tag === "おすすめ" ? "bg-purple-500/30 text-purple-300" : "bg-yellow-500/30 text-yellow-300"
                }`}>
                  {pack.tag}
                </span>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-2xl text-white">{pack.bp.toLocaleString()} <span className="text-sm text-white/40">BP</span></p>
                  <p className="text-sm text-white/60 mt-0.5">{pack.label}パック</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${pack.price}</p>
                  <button
                    onClick={() => handleSquarePurchase(pack)}
                    disabled={busy}
                    className="mt-2 inline-block px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-bold hover:scale-105 transition text-white disabled:opacity-60 disabled:cursor-not-allowed">
                    {busy ? "準備中…" : "購入する"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {msg && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white/70 mb-4 text-center">
          {msg}
        </div>
      )}

      {/* 注意事項 */}
      <div className="bg-white/5 rounded-xl p-4 mb-6">
        <h2 className="font-bold text-sm mb-2">📋 ご利用案内</h2>
        <ul className="text-xs text-white/40 space-y-1">
          <li>• 通常クレジットは毎月50%分回復します</li>
          <li>• 上限以上の通常クレジットは回復されません</li>
          <li>• 追加購入BPは回復・失効の影響を受けません</li>
          <li>• 購入済みBPの返金はできません</li>
        </ul>
      </div>

      {/* 最終CTA */}
      <div className="flex flex-col sm:flex-row gap-3 mt-4">
        <a href="#purchase"
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-center font-bold">
          BPを購入
        </a>
        <Link href="/top"
          className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-center font-bold text-white/60">
          利用を開始
        </Link>
      </div>
    </div>
  );
}

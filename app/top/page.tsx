"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingCat } from "@/components/LoadingCat";
import { useRouter } from "next/navigation";
import { computeRaised } from "../lib/presale";
import { clearAuth, getAuth, getAuthSecret, setAuth, type AuthState } from "../lib/auth";
import { useLifaiCat } from "@/components/LifaiCat";
import BPGrantModal from "@/components/BPGrantModal";
import LoginBonusModal from "@/components/LoginBonusModal";
import MusicSellApprovedModal from "@/components/MusicSellApprovedModal";
import MissionCard from "@/components/MissionCard";
import GachaModal from "@/components/GachaModal";
import StakingModal from "@/components/StakingModal";
import RadioCard from "@/components/RadioCard";
import { motion, AnimatePresence } from "framer-motion";

/** ✅ カウントダウン + 調達バー（returnの外に置く） */
function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}
function formatMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function PresaleHeader({
  endAtISO,
  goal,
  currencyLabel = "USDT",
}: {
  endAtISO: string;
  goal: number;
  currencyLabel?: string;
}) {
  const endMs = useMemo(() => new Date(endAtISO).getTime(), [endAtISO]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const raised = computeRaised(now);

  const diff = Math.max(0, endMs - now);
  const totalSec = Math.floor(diff / 1000);

  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const pct = goal > 0 ? Math.min(100, Math.max(0, (raised / goal) * 100)) : 0;

  return (
    <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(2,6,23,.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-extrabold text-slate-700">プレセール終了まで</p>

          <div className="mt-2 flex items-center gap-2">
            <TimeBox label="日" value={pad2(days)} />
            <TimeBox label="時" value={pad2(hours)} />
            <TimeBox label="分" value={pad2(mins)} />
            <TimeBox label="秒" value={pad2(secs)} />
          </div>

          {diff === 0 && (
            <p className="mt-2 text-xs font-semibold text-rose-600">プレセールは終了しました</p>
          )}
        </div>

        <div className="w-full md:max-w-md">
          <div className="flex items-end justify-between">
            <p className="text-xs font-extrabold text-slate-700">{currencyLabel}調達額</p>
            <p className="text-sm font-extrabold text-slate-900">
              {formatMoney(raised)} / {formatMoney(goal)}
            </p>
          </div>

          <div className="mt-2 h-3 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-pink-500 to-amber-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-600">進捗：{pct.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}

function TimeBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
      <p className="text-base font-extrabold leading-none text-slate-900">{value}</p>
      <p className="mt-1 text-[10px] font-bold text-slate-500">{label}</p>
    </div>
  );
}

function BalanceBadge({ auth, refreshTrigger }: { auth: AuthState; refreshTrigger?: number }) {
  const [bp, setBp] = useState<number>(0);
  const [ep, setEp] = useState<number>(0);
  const [err, setErr] = useState<string>("");

  const fetchBalance = useCallback(async () => {
    const id =
      (auth as any)?.id ||
      (auth as any)?.loginId ||
      (auth as any)?.login_id ||
      "";

    if (!id) {
      setErr("no_login_id");
      return;
    }

    try {
      const r = await fetch("/api/wallet/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ id, group: (auth as any)?.group || "" }),
      });

      const data: any = await r.json().catch(() => ({ ok: false, error: "not_json" }));

      if (!data.ok) {
        setErr(data.error || "failed");
        return;
      }

      setBp(Number(data.bp || 0));
      setEp(Number(data.ep || 0));
    } catch (e: any) {
      setErr(String(e));
    }
  }, [auth]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance, refreshTrigger]);

  return (
    <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700">
      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-extrabold text-white leading-none">
        WALLET
      </span>
      <div className="flex flex-col gap-0.5 leading-none">
        <span className="flex items-center gap-0.5">
          <span className="text-slate-500">BP</span>
          <span className="font-extrabold text-slate-900">{bp}</span>
        </span>
        <span className="flex items-center gap-0.5">
          <span className="text-slate-500">EP</span>
          <span className="font-extrabold text-slate-900">{ep}</span>
        </span>
      </div>
      {err ? <span className="text-[10px] opacity-50">(!)</span> : null}
    </div>
  );
}


// ── お知らせデータ（空配列のときは「なし」表示） ────────────────────
type Notice = {
  id: string;
  date: string;   // "YYYY-MM-DD"
  title: string;
  body: string;
};

const NOTICES: Notice[] = [];

function NoticeBoard() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-extrabold tracking-wide text-slate-500">お知らせ</p>
      {NOTICES.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">最新のお知らせはありません</p>
      ) : (
        <ul className="mt-1 divide-y divide-slate-100">
          {NOTICES.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => setOpenId(openId === n.id ? null : n.id)}
                className="flex w-full items-start gap-2 rounded px-1 py-2 text-left transition hover:bg-slate-100"
              >
                <span className="mt-0.5 shrink-0 text-[10px] text-slate-400">{n.date}</span>
                <span className="flex-1 text-xs font-semibold text-slate-700">{n.title}</span>
                <span className="shrink-0 text-[10px] text-slate-400">{openId === n.id ? "▲" : "▼"}</span>
              </button>
              {openId === n.id && (
                <div className="px-1 pb-2">
                  <p className="whitespace-pre-line text-xs leading-relaxed text-slate-600">{n.body}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type AppDef = {
  id: string;
  label: string;
  icon: string;
  color: string;
  href: string;
  desc: string;
  badge?: string;
  comingSoon?: boolean;
  onOpen?: () => void;
  disabled?: boolean;
};

export default function AppHomePage() {
  const router = useRouter();
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const { trackEvent } = useLifaiCat();

  // 未受取BP通知
  const [bpGrantModal, setBpGrantModal] = useState<{ amount: number } | null>(null);

  // ログインボーナス通知
  const [loginBonus, setLoginBonus] = useState<{
    bp_earned: number;
    streak: number;
  } | null>(null);

  // 楽曲売却承認通知
  const [musicSellApproved, setMusicSellApproved] = useState<{ title: string; ep: number }[] | null>(null);

  // EP獲得通知（CCアフィリエイト報酬）
  const [epNotification, setEpNotification] = useState<{ amount: number } | null>(null);

  // BPガチャ
  const [showGacha, setShowGacha] = useState(false);

  // BPステーキング
  const [showStaking, setShowStaking] = useState(false);

  // 残高更新トリガー
  const [balanceTrigger, setBalanceTrigger] = useState(0);

  // 選択中アプリ（ポップアップ）
  const [selectedApp, setSelectedApp] = useState<AppDef | null>(null);

  useEffect(() => {
    const a = getAuth();
    setAuthState(a);

    if (!a) {
      router.replace("/login");
      return;
    }
    if ((a as any).status === "pending") {
      router.replace("/pending");
      return;
    }

    // 未受取BPチェック
    const id = (a as any)?.id || (a as any)?.loginId || (a as any)?.login_id || "";
    const code = getAuthSecret() || (a as any)?.token || "";
    if (id && code) {
      (async () => {
        try {
          const res = await fetch("/api/user/pending-bp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ id, code }),
          });
          const data = await res.json().catch(() => ({ ok: false }));
          if (data.ok && data.hasPending && data.amount > 0) {
            setBpGrantModal({ amount: data.amount });
          }
        } catch {
          // 通知失敗はサイレントに無視
        }
      })();
    }

    // EP通知チェック（CCアフィリエイト報酬）
    if (id && code) {
      (async () => {
        try {
          const meRes = await fetch("/api/me", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ id, code }),
          });
          const meData = await meRes.json().catch(() => ({ ok: false }));
          if (meData.ok && meData.me?.ep_notification > 0) {
            setEpNotification({ amount: meData.me.ep_notification });
          }
          // メールでログインした既存セッションを正規 login_id へ自動修復
          // （gacha/staking 等は login_id でのみ照合するため、メール保存だと not_found になる）
          if (meData.ok && meData.me?.login_id && meData.me.login_id !== id) {
            const cur = getAuth();
            if (cur) {
              const healed = setAuth({
                status: cur.status,
                id:     meData.me.login_id,
                token:  cur.token,
                ...(cur.plan  ? { plan:  cur.plan }  : {}),
                ...(cur.group ? { group: cur.group } : {}),
              });
              setAuthState(healed);
            }
          }
        } catch {
          // 通知失敗はサイレントに無視
        }
      })();
    }

    // ログインボーナス
    const loginId = (a as any)?.loginId ?? (a as any)?.login_id ?? (a as any)?.id ?? "";
    if (loginId) {
      const todayJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const bonusKey = "addval_login_bonus_date_" + loginId;
      const alreadyClaimed = typeof window !== "undefined" && localStorage.getItem(bonusKey) === todayJst;
      if (!alreadyClaimed) {
        fetch("/api/daily-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loginId }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.ok && data.bp_earned > 0) {
              if (typeof window !== "undefined") localStorage.setItem(bonusKey, todayJst);
              setLoginBonus({ bp_earned: data.bp_earned, streak: data.streak });
            } else if (data.reason === "already_claimed") {
              if (typeof window !== "undefined") localStorage.setItem(bonusKey, todayJst);
            }
          })
          .catch(() => {});
      }

      // 楽曲売却承認通知チェック
      fetch("/api/apply-sell/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && Array.isArray(data.items) && data.items.length > 0) {
            setMusicSellApproved(data.items);
          }
        })
        .catch(() => {});

      // 月次BP回復チェック（30日に1回、サイレント失敗）
      fetch("/api/wallet/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, id: loginId, group: (a as any)?.group || "" }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.bp_recovered > 0) {
            setBalanceTrigger((n) => n + 1);
          }
        })
        .catch(() => {});
    }
  }, [router]);

  // AIBot: /top入場イベント（残高付き）
  useEffect(() => {
    if (!auth) return;
    const id =
      (auth as any)?.id ||
      (auth as any)?.loginId ||
      (auth as any)?.login_id ||
      "";
    if (!id) {
      trackEvent("page_view", { page_id: "top_home", bp: "0", ep: "0" });
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/wallet/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ id, group: auth?.group || "" }),
        });
        const data = await r.json().catch(() => ({ ok: false }));
        trackEvent("page_view", {
          page_id: "top_home",
          bp: String(data.ok ? (data.bp ?? 0) : 0),
          ep: String(data.ok ? (data.ep ?? 0) : 0),
        });
      } catch {
        trackEvent("page_view", { page_id: "top_home", bp: "0", ep: "0" });
      }
    })();
  }, [auth, trackEvent]);

  const apps: AppDef[] = useMemo(
    () => [
      { id: "fortune",  label: "団子占い",     icon: "🔮", color: "from-violet-500 to-purple-600",  href: "/fortune",    desc: "毎日の運勢 +10BP" },
      { id: "market",   label: "マーケット",   icon: "🛒", color: "from-orange-400 to-amber-500",   href: "/market",     desc: "メンバー間売買" },
      { id: "gacha",    label: "LIFASLOT",    icon: "🎰", color: "from-pink-500 to-rose-500",      href: "#gacha",      desc: "BP消費で報酬",          onOpen: () => { setSelectedApp(null); setShowGacha(true); } },
      { id: "staking",  label: "ステーキング", icon: "💎", color: "from-cyan-400 to-teal-500",      href: "#staking",    desc: "BPを預けて増やす",      onOpen: () => { setSelectedApp(null); setShowStaking(true); } },
      { id: "member",    label: "メンバーシップ", icon: "👑", color: "from-slate-500 to-zinc-600",  href: "/membership", desc: "プランをアップグレード" },
      { id: "music2",    label: "MUSICCREATE", icon: "🎼", color: "from-indigo-500 to-violet-600", href: "/music2",        desc: "歌詞・構成・音楽を3ステップで生成", badge: "Beta" },
      { id: "music-boost", label: "Music Boost", icon: "🚀", color: "from-purple-700 to-blue-600",   href: "/music-boost",   desc: "案件優先度を高める月額ブースト",    badge: "New"  },
      { id: "note",      label: "ノート生成",    icon: "📝", color: "from-violet-400 to-purple-500", href: "/note-generator", desc: "構成→本文→見出し→導入文まで一括", badge: "New" },
      { id: "workflow",  label: "ワークフロー",  icon: "🧩", color: "from-cyan-400 to-sky-500",     href: "/workflow",   desc: "n8n/自動化の設計テンプレを作る",           badge: "準備中" },
      { id: "minigames", label: "LIFAI Arcade", icon: "🎮", color: "from-pink-500 to-purple-600",   href: "/mini-games", desc: "ミニゲームで報酬をゲット",                 badge: "New" },
      { id: "referral",      label: "リファラ",  icon: "🤝", color: "from-emerald-500 to-teal-600",  href: "/referral-app", desc: "紹介実績・報酬・コード共有" },
      { id: "gift",          label: "GiftEP",   icon: "🎁", color: "from-emerald-400 to-teal-500",  href: "/gift",       desc: "EP贈与 · LIFAI内限定ギフトクレジット" },
      { id: "gift-exchange", label: "Gift交換", icon: "🎀", color: "from-rose-400 to-pink-500",      href: "#",           desc: "ギフトポイントの交換・利用（近日公開）", badge: "準備中", disabled: true },
      { id: "image",         label: "画像生成",    icon: "🖼️", color: "from-violet-500 to-indigo-600", href: "/image",       desc: "AIと会話して画像を生成・編集" },
    ],
    []
  );

  const logout = () => {
    clearAuth();
    router.replace("/");
  };

  const handleBpModalClose = async () => {
    setBpGrantModal(null);
    // 受取完了をGASに通知
    const a = getAuth();
    const id = (a as any)?.id || (a as any)?.loginId || (a as any)?.login_id || "";
    const code = getAuthSecret() || (a as any)?.token || "";
    if (id && code) {
      await fetch("/api/user/claim-bp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, code }),
      }).catch(() => {});
    }
  };

  // ✅ 認証判定が終わるまで一瞬も中身を描画しない（チラ見え防止）
  if (auth === null) return null;

  const loginId =
    (auth as any)?.loginId ??
    (auth as any)?.login_id ??
    (auth as any)?.id ??
    "";

  if (auth === null) return <LoadingCat />;

  return (
    <>
    {bpGrantModal && (
      <BPGrantModal amount={bpGrantModal.amount} onClose={handleBpModalClose} />
    )}

    {/* EP獲得通知モーダル（CCアフィリエイト報酬） */}
    {epNotification && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
        <div className="w-full max-w-sm rounded-3xl border border-emerald-500/40 bg-zinc-900 p-8 text-center shadow-2xl">
          <div className="mb-2 text-4xl">🎉</div>
          <h2 className="mb-2 text-xl font-extrabold text-white">EP を獲得しました！</h2>
          <p className="mb-6 text-3xl font-black text-emerald-400">
            +{epNotification.amount.toLocaleString()} EP
          </p>
          <p className="mb-6 text-xs text-zinc-400">紹介アフィリエイト報酬として付与されました</p>
          <button
            onClick={async () => {
              setEpNotification(null);
              try {
                const _id   = (auth as any)?.id || (auth as any)?.loginId || "";
                const _code = getAuthSecret() || (auth as any)?.token || "";
                await fetch("/api/ep-notification-clear", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: _id, code: _code }),
                });
              } catch {}
            }}
            className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-500"
          >
            確認
          </button>
        </div>
      </div>
    )}
    {loginBonus && (
      <LoginBonusModal
        bp_earned={loginBonus.bp_earned}
        streak={loginBonus.streak}
        onClose={() => {
          setLoginBonus(null);
          setBalanceTrigger((n) => n + 1);
        }}
      />
    )}
    {musicSellApproved && (
      <MusicSellApprovedModal
        items={musicSellApproved}
        onClose={() => {
          setMusicSellApproved(null);
          setBalanceTrigger((n) => n + 1);
        }}
      />
    )}
    {showGacha && (
      <GachaModal
        loginId={loginId}
        onClose={() => setShowGacha(false)}
        onBpEarned={(_amount) => {
          setBalanceTrigger((n) => n + 1);
        }}
      />
    )}
    {showStaking && (
      <StakingModal
        loginId={loginId}
        onClose={() => setShowStaking(false)}
        onBpChanged={() => setBalanceTrigger((n) => n + 1)}
      />
    )}

    {/* アプリ詳細ポップアップ */}
    <AnimatePresence>
      {selectedApp && (
        <>
          {/* オーバーレイ */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSelectedApp(null)}
          />
          {/* スライドアップシート */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 max-w-sm mx-auto rounded-t-3xl bg-zinc-900 p-6 shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${selectedApp.color} flex items-center justify-center text-4xl shadow-lg`}>
                {selectedApp.icon}
              </div>
              <div>
                <p className="text-lg font-extrabold text-white">{selectedApp.label}</p>
                <p className="mt-1 text-sm text-zinc-400">{selectedApp.desc}</p>
              </div>
              {selectedApp.badge === '準備中' ? (
                <button
                  disabled
                  className="mt-2 w-full rounded-2xl bg-slate-700 px-6 py-3 text-sm font-extrabold text-slate-400 cursor-not-allowed"
                >
                  準備中
                </button>
              ) : selectedApp.onOpen ? (
                <button
                  onClick={selectedApp.onOpen}
                  className="mt-2 w-full rounded-2xl bg-amber-400 px-6 py-3 text-sm font-extrabold text-zinc-900 hover:bg-amber-300 active:scale-95 transition"
                >
                  開く →
                </button>
              ) : selectedApp.href.startsWith("#") ? (
                <button
                  onClick={() => setSelectedApp(null)}
                  className="mt-2 w-full rounded-2xl bg-amber-400 px-6 py-3 text-sm font-extrabold text-zinc-900 hover:bg-amber-300 active:scale-95 transition"
                >
                  開く →
                </button>
              ) : (
                <Link
                  href={selectedApp.href}
                  className="mt-2 block w-full rounded-2xl bg-amber-400 px-6 py-3 text-sm font-extrabold text-zinc-900 text-center hover:bg-amber-300 active:scale-95 transition"
                  onClick={() => setSelectedApp(null)}
                >
                  開く →
                </Link>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.16),transparent_60%),radial-gradient(900px_520px_at_112%_0%,rgba(34,211,238,.12),transparent_55%),linear-gradient(180deg,#FFFFFF,#F6F7FB_55%,#FFFFFF)]" />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(2,6,23,.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(2,6,23,.14) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
        }}
      />

      <div className="mx-auto max-w-[920px] px-4 py-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_26px_70px_rgba(2,6,23,.10)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,.4)]" />
                LIFAI APP HOME
              </div>
              <h1 className="truncate text-sm font-extrabold tracking-tight text-slate-900">
                LIFAIへようこそ
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <BalanceBadge auth={auth} refreshTrigger={balanceTrigger} />

              <button
                onClick={logout}
                className="rounded-2xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                LOGOUT
              </button>
            </div>
          </div>

          <NoticeBoard />

          {/* ✅ アプリグリッド（LINEミニアプリ風 4列） */}
          <div className="mt-6">
            <p className="mb-3 text-xs font-extrabold text-slate-700">アプリ</p>
            <motion.div
              className="grid grid-cols-4 gap-3 px-2"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.045 } },
              }}
            >
              {apps.map((app) => (
                <motion.button
                  key={app.id}
                  onClick={() => { if (app.disabled) return; setSelectedApp(app); }}
                  className="flex flex-col items-center gap-1 focus:outline-none"
                  style={{ cursor: app.disabled ? "not-allowed" : "pointer", opacity: app.disabled ? 0.6 : 1 }}
                  variants={{
                    hidden: { opacity: 0, y: 12, scale: 0.93 },
                    visible: {
                      opacity: 1, y: 0, scale: 1,
                      transition: { type: "spring", damping: 18, stiffness: 260 },
                    },
                  }}
                  whileTap={app.disabled ? {} : { scale: 0.92 }}
                >
                  <div className="relative">
                    <motion.div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center text-2xl shadow-md`}
                      whileHover={app.disabled ? {} : { scale: 1.08 }}
                      transition={{ type: "spring", damping: 18, stiffness: 300 }}
                    >
                      {app.icon}
                    </motion.div>
                    {app.badge && (
                      <span className={`absolute -top-1 -right-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white leading-none ${app.badge === 'Beta' ? 'bg-sky-500' : 'bg-slate-700'}`}>
                        {app.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-600 text-center leading-tight">
                    {app.label}
                  </span>
                </motion.button>
              ))}
            </motion.div>
          </div>

          <MissionCard
            loginId={loginId}
            onBpEarned={(_amount) => {
              setBalanceTrigger((n) => n + 1);
            }}
          />

          <RadioCard
            loginId={loginId}
            onEpEarned={() => setBalanceTrigger((n) => n + 1)}
          />


<div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            問い合わせはTOPページにございます。
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
</>
  );
}

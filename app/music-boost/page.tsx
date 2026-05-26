"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "../lib/useTheme";
import { ThemeToggle } from "@/components/ThemeToggle";

// ── チュートリアル ────────────────────────────────────────────────────────────

const BOOST_TUTORIAL_KEY = "musicboost_tutorial_seen";

const BOOST_TUTORIAL_SLIDES = [
  {
    icon: "🚀",
    title: 'あなたの楽曲を「空間」に届ける Music Boost',
    body: `Music Boostは、あなたの楽曲を企業向け音楽配信サービスに掲載できる機能です。\n\n店舗・オフィス・施設などで実際に流れることで、自然な形で認知が広がります。\n\n💡 ポイント\nこれは「広告・露出」の仕組みです\n再生数を増やすためのツールではありません`,
  },
  {
    icon: "🏪",
    title: "どこで流れるの？",
    body: `あなたの楽曲は、LIFAIの配信ネットワークを通じて企業や店舗のBGMとして使用されます。\n\n例👇\n・カフェ\n・美容室\n・オフィス\n・ショップ\n\n日常の中で自然に再生されるため、リスナーに違和感なく届きます。`,
  },
  {
    icon: "✨",
    title: "Music Boostで得られるもの",
    body: `Music Boostの価値は「数字」だけではありません👇\n\n✔ 認知の拡大\n→ 多くの人に存在を知ってもらえる\n\n✔ ブランド価値の向上\n→ プロっぽさ・信頼感が上がる\n\n✔ 新しいファンとの接点\n→ 偶然の出会いが生まれる\n\n✔ 露出経路の増加\n→ SNS以外の導線ができる`,
  },
  {
    icon: "⚠️",
    title: "重要：これは再生数を増やすツールではありません",
    body: `Music Boostは、意図的に再生数を増やす仕組みではありません。\n\nあくまで👇\n\n「自然な環境で楽曲に触れてもらう」\n\nことを目的としています。\n\n💡 イメージ\n広告 × 音楽配信 × 空間演出\n\n無理に再生されるのではなく、環境の一部として届けられます。`,
  },
  {
    icon: "📋",
    title: "使い方はとてもシンプル",
    body: `① プランを選択\n② 楽曲を登録\n③ 自動で配信開始\n\nブースト率が高いほど、優先的に採用されやすくなります。\n\n💡 ポイント\n空き枠には上限があります\n早めの利用がおすすめです`,
  },
  {
    icon: "🎵",
    title: "配信したい楽曲を登録しよう",
    body: `契約後に表示されるフォームから、ブーストしたいアーティスト名と楽曲名を入力できます。\n\n入力内容は運営に即時反映されます。\n\n✏️ いつでも変更可能\n契約期間中は何度でも更新できます。`,
  },
] as const;

const PLANS = [
  { id: "starter",  label: "Starter",  percent: 2,  price: 9,    slots: 10,  color: "from-gray-600 to-gray-500",     recommend: "推奨：8曲以上配信済みの方",   squareUrl: "https://square.link/u/Z8JfMUyE" },
  { id: "light",    label: "Light",    percent: 5,  price: 29,   slots: 25,  color: "from-blue-700 to-blue-500",     recommend: "推奨：16曲以上配信済みの方",  squareUrl: "https://square.link/u/a3n7mj8b" },
  { id: "basic",    label: "Basic",    percent: 10, price: 59,   slots: 50,  color: "from-green-700 to-green-500",   recommend: "推奨：30曲以上配信済みの方",  squareUrl: "https://square.link/u/AknPSYzR" },
  { id: "growth",   label: "Growth",   percent: 15, price: 99,   slots: 75,  color: "from-teal-700 to-teal-500",     recommend: "推奨：50曲以上配信済みの方",  squareUrl: "https://square.link/u/0Tl1BZwU" },
  { id: "pro",      label: "Pro",      percent: 20, price: 149,  slots: 100, color: "from-purple-700 to-purple-500", recommend: "推奨：75曲以上配信済みの方",  squareUrl: "https://square.link/u/6EQ6FZPS" },
  { id: "advanced", label: "Advanced", percent: 25, price: 199,  slots: 125, color: "from-indigo-700 to-indigo-500", recommend: "推奨：100曲以上配信済みの方", squareUrl: "https://square.link/u/yXfPqP2m" },
  { id: "premium",  label: "Premium",  percent: 30, price: 299,  slots: 150, color: "from-pink-700 to-pink-500",     recommend: "推奨：150曲以上配信済みの方", squareUrl: "https://square.link/u/f19KQa9n" },
  { id: "elite",    label: "Elite",    percent: 35, price: 499,  slots: 175, color: "from-orange-700 to-orange-500", recommend: "推奨：200曲以上配信済みの方", squareUrl: "https://square.link/u/n532LqZd" },
  { id: "master",   label: "Master",   percent: 40, price: 699,  slots: 200, color: "from-red-700 to-red-500",       recommend: "推奨：300曲以上配信済みの方", squareUrl: "https://square.link/u/GRD64dbi" },
  { id: "legend",   label: "Legend",   percent: 45, price: 1000, slots: 225, color: "from-yellow-600 to-yellow-400", recommend: "推奨：500曲以上配信済みの方", squareUrl: "https://square.link/u/PX68xQhf" },
];

type BoostStatus = {
  current_boost: {
    plan_id: string; percent: number; price_usd: number;
    slots_used: number; status: string; started_at: string; expires_at: string;
  } | null;
  total_slots: number;
  used_slots: number;
  available_slots: number;
};

export default function MusicBoostPage() {
  const { isDark, toggleTheme } = useTheme();
  const th = {
    page:       isDark ? "bg-[#0a0a0a] text-white"          : "bg-gray-50 text-gray-900",
    card:       isDark ? "bg-white/5"                        : "bg-white shadow-sm",
    cardBorder: isDark ? "border-white/10"                   : "border-gray-200",
    muted:      isDark ? "text-white/60"                     : "text-gray-500",
    faint:      isDark ? "text-white/40"                     : "text-gray-400",
    ghost:      isDark ? "text-white/20"                     : "text-gray-300",
    modal:      isDark ? "bg-[#18181b] border-white/10"      : "bg-white border-gray-200",
    progressBg: isDark ? "bg-white/10"                       : "bg-gray-200",
    inputBg:    isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-300 text-gray-900",
    back:       isDark ? "text-white/40"                     : "text-gray-400",
    helpBtn:    isDark ? "border-white/20 bg-white/5 text-white/50 hover:border-purple-400 hover:bg-purple-500/20 hover:text-purple-300" : "border-gray-300 bg-white text-gray-400 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-500",
    planCard:   (isCurrent: boolean, isSelected: boolean) =>
      isDark
        ? isCurrent  ? "border-purple-500 bg-purple-500/10"
          : isSelected ? "border-white/30 bg-white/10"
          : "border-white/10 bg-white/5 hover:bg-white/8"
        : isCurrent  ? "border-purple-500 bg-purple-50"
          : isSelected ? "border-gray-400 bg-gray-100"
          : "border-gray-200 bg-white hover:bg-gray-50",
    planSubText: isDark ? "text-white/40" : "text-gray-400",
    planPrice:   isDark ? "text-white/60" : "text-gray-500",
    disabledBtn: isDark ? "bg-white/10 text-white/30" : "bg-gray-100 text-gray-400",
    creditBtn:   isDark ? "bg-white/5 text-white/20 border-white/10" : "bg-gray-100 text-gray-400 border-gray-200",
    modalText:   isDark ? "text-white/70"                    : "text-gray-600",
    modalMuted:  isDark ? "text-white/60"                    : "text-gray-500",
    modalFaint:  isDark ? "text-white/30"                    : "text-gray-400",
    modalBtn:    isDark ? "text-white/60 hover:bg-white/5"   : "text-gray-500 hover:bg-gray-100",
    modalSkip:   isDark ? "text-white/25 hover:text-white/50": "text-gray-300 hover:text-gray-500",
    epMuted:     isDark ? "text-white/50"                    : "text-gray-400",
    badgeBg:     isDark ? "bg-white/10"                      : "bg-gray-200",
  };
  const [userId, setUserId]         = useState("");
  const [status, setStatus]         = useState<BoostStatus | null>(null);
  const [busy, setBusy]             = useState(false);
  const [msg, setMsg]               = useState("");
  const [selected, setSelected]     = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [epBalance, setEpBalance]       = useState<number | null>(null);
  const [confirmPlan, setConfirmPlan]   = useState<typeof PLANS[number] | null>(null);
  const [tracks, setTracks]           = useState<{artist: string; album: string}[]>([]);
  const [newArtist, setNewArtist]     = useState("");
  const [newAlbum, setNewAlbum]       = useState("");
  const [tracksSaving, setTracksSaving] = useState(false);
  const [tracksLog, setTracksLog]     = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editArtist, setEditArtist]   = useState("");
  const [editAlbum, setEditAlbum]     = useState("");

  // チュートリアル初回表示チェック
  useEffect(() => {
    if (!localStorage.getItem(BOOST_TUTORIAL_KEY)) {
      setTutorialStep(0);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("addval_auth_v1");
      if (raw) { const auth = JSON.parse(raw); setUserId(String(auth?.id ?? "")); }
    } catch {}
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/music-boost/status?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setStatus(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/wallet/balance?id=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setEpBalance(Number(d.ep ?? 0)); })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId || !status?.current_boost) return;
    fetch(`/api/music-boost/info?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setTracks(Array.isArray(d.tracks) ? d.tracks : []);
        }
      })
      .catch(() => {});
  }, [userId, status]);

  const handleMusicBoostCheckout = async (plan: typeof PLANS[0]) => {
    if (!userId) {
      alert("ログインしてから購入してください");
      return;
    }
    const packId = `music_boost_${plan.id}`;
    try {
      const res = await fetch("/api/square/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          pack_id: packId,
          bp_amount: 0, // music-boost は BP付与なし（Webhook側でログ記録のみ）
          price_cents: Math.round(plan.price * 100),
          label: `Music Boost ${plan.label} (${plan.percent}% / ${plan.slots}枠)`,
          redirect_path: "/music-boost", // 決済後に music-boost ページへ戻る
        }),
      });
      const data = await res.json();
      if (!data.ok || !data.checkout_url) {
        alert("決済ページの準備に失敗しました。時間をおいて再試行してください。");
        return;
      }
      window.open(data.checkout_url, "_blank", "noopener,noreferrer");
    } catch {
      alert("エラーが発生しました。再試行してください。");
    }
  };

  const handleSubscribe = async (planId: string, paymentMethod = "ep") => {
    if (!userId || busy) return;
    setBusy(true); setMsg("");
    try {
      const res  = await fetch("/api/music-boost/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planId, paymentMethod })
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(`✅ ${PLANS.find(p => p.id === planId)?.label}プランを契約しました！`);
        const s = await fetch(`/api/music-boost/status?userId=${encodeURIComponent(userId)}`).then(r => r.json());
        if (s.ok) setStatus(s);
        const b = await fetch(`/api/wallet/balance?id=${encodeURIComponent(userId)}`).then(r => r.json()).catch(() => null);
        if (b?.ok) setEpBalance(Number(b.ep ?? 0));
      } else {
        if (data.error === "no_slots_available") setMsg(`❌ 枠が不足しています（残り${data.available}枠、必要${data.needed}枠）`);
        else if (data.error === "insufficient_ep") setMsg(`❌ EPが不足しています（残り${data.balance} EP、必要${data.needed} EP）`);
        else setMsg("❌ エラーが発生しました: " + data.error);
      }
    } catch { setMsg("❌ 通信エラーが発生しました"); }
    finally { setBusy(false); }
  };

  const handleCancel = async () => {
    if (!userId || busy || !confirm("本当に解約しますか？")) return;
    setBusy(true); setMsg("");
    try {
      const res  = await fetch("/api/music-boost/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.ok) {
        setMsg("✅ 解約しました");
        const s = await fetch(`/api/music-boost/status?userId=${encodeURIComponent(userId)}`).then(r => r.json());
        if (s.ok) setStatus(s);
      } else { setMsg("❌ エラー: " + data.error); }
    } catch { setMsg("❌ 通信エラー"); }
    finally { setBusy(false); }
  };

  const handleAddTrack = async () => {
    if (!userId || tracksSaving || !newArtist.trim()) return;
    const next = [...tracks, { artist: newArtist.trim(), album: newAlbum.trim() }];
    setTracksSaving(true);
    setTracksLog("保存中...");
    try {
      const res  = await fetch("/api/music-boost/info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tracks: next }),
      });
      const data = await res.json();
      if (data.ok) {
        setTracks(next);
        setNewArtist("");
        setNewAlbum("");
        setTracksLog("✅ 追加しました");
      } else {
        setTracksLog("❌ 保存に失敗しました");
      }
    } catch {
      setTracksLog("❌ 通信エラー");
    } finally {
      setTracksSaving(false);
      setTimeout(() => setTracksLog(""), 2000);
    }
  };

  const handleDeleteTrack = async (index: number) => {
    if (!userId || tracksSaving) return;
    const next = tracks.filter((_, i) => i !== index);
    setTracksSaving(true);
    setTracksLog("削除中...");
    try {
      const res  = await fetch("/api/music-boost/info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tracks: next }),
      });
      const data = await res.json();
      if (data.ok) {
        setTracks(next);
        if (editingIndex === index) setEditingIndex(null);
        setTracksLog("✅ 削除しました");
      } else {
        setTracksLog("❌ 削除に失敗しました");
      }
    } catch {
      setTracksLog("❌ 通信エラー");
    } finally {
      setTracksSaving(false);
      setTimeout(() => setTracksLog(""), 2000);
    }
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditArtist(tracks[index].artist);
    setEditAlbum(tracks[index].album);
  };

  const handleSaveEdit = async () => {
    if (editingIndex === null || !userId || tracksSaving || !editArtist.trim()) return;
    const next = tracks.map((t, i) =>
      i === editingIndex ? { artist: editArtist.trim(), album: editAlbum.trim() } : t
    );
    setTracksSaving(true);
    setTracksLog("保存中...");
    try {
      const res  = await fetch("/api/music-boost/info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tracks: next }),
      });
      const data = await res.json();
      if (data.ok) {
        setTracks(next);
        setEditingIndex(null);
        setTracksLog("✅ 保存しました");
      } else {
        setTracksLog("❌ 保存に失敗しました");
      }
    } catch {
      setTracksLog("❌ 通信エラー");
    } finally {
      setTracksSaving(false);
      setTimeout(() => setTracksLog(""), 2000);
    }
  };

  const currentPlan = status?.current_boost ? PLANS.find(p => p.id === status.current_boost!.plan_id) : null;

  return (
    <div className={`min-h-screen ${th.page} px-4 py-8 mx-auto transition-all ${status?.current_boost ? "max-w-3xl" : "max-w-lg"}`}>
      <div className={`${status?.current_boost ? "flex flex-col md:flex-row gap-6 md:gap-8 items-start" : ""}`}>
      <div className={status?.current_boost ? "flex-1 min-w-0" : ""}>
      <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/top" className={`${th.back} text-sm`}>← Back</Link>
        <h1 className="font-bold text-lg">🚀 Music Boost</h1>
        <button
          type="button"
          onClick={() => setTutorialStep(0)}
          title="使い方を見る"
          className={`flex h-7 w-7 items-center justify-center rounded-full border ${th.helpBtn} text-xs font-bold transition`}
        >
          ?
        </button>
      </div>

      {/* 説明 */}
      <div className={`${th.card} border ${th.cardBorder} rounded-xl p-4 mb-6 text-sm ${th.muted}`}>
        <p>音楽ブーストは、企業案件や協力依頼時の優先度を高める月額オプションです。</p>
        <p className="mt-1">ブースト率が高いほど優先的に提案されやすくなります。</p>
        <p className={`mt-1 ${th.ghost} text-xs`}>本機能は共有枠を使用するため、空きがない場合は新規契約・変更ができません。</p>
        {epBalance !== null && (
          <p className={`mt-2 ${th.epMuted} text-xs font-bold`}>
            現在のEP残高: <span className="text-purple-300">{epBalance.toLocaleString()} EP</span>
          </p>
        )}
      </div>

      {/* 枠状況 */}
      {status && (
        <div className={`${th.card} border ${th.cardBorder} rounded-xl p-4 mb-6`}>
          <div className="flex justify-between text-sm mb-2">
            <span className={th.muted}>全体枠</span>
            <span className="font-bold">{status.used_slots.toLocaleString()} / {status.total_slots.toLocaleString()}</span>
          </div>
          <div className={`w-full ${th.progressBg} rounded-full h-2`}>
            <div
              className="bg-gradient-to-r from-purple-600 to-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, (status.used_slots / status.total_slots) * 100)}%` }}
            />
          </div>
          <p className={`text-xs ${th.faint} mt-1`}>残り {status.available_slots.toLocaleString()} 枠</p>
        </div>
      )}

      {/* 現在のブースト */}
      {status?.current_boost && currentPlan && (
        <div className={`bg-gradient-to-r ${currentPlan.color} rounded-xl p-5 mb-6`}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-black text-xl">{currentPlan.label}</span>
            <span className="bg-white/20 text-xs px-2 py-1 rounded-full">契約中</span>
          </div>
          <p className="text-3xl font-black mb-1">{status.current_boost.percent}%</p>
          <p className="text-white/80 text-sm mb-3">${status.current_boost.price_usd}/月</p>
          <p className="text-white/60 text-xs">
            有効期限: {new Date(status.current_boost.expires_at).toLocaleDateString("ja-JP")}
          </p>
          <button onClick={handleCancel} disabled={busy}
            className="mt-4 w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition">
            解約する
          </button>
        </div>
      )}

      {msg && (
        <div className={`rounded-xl p-3 text-sm text-center mb-4 ${msg.startsWith("✅") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
          {msg}
        </div>
      )}

      {/* プラン一覧 */}
      <h2 className={`font-bold text-sm ${th.muted} mb-3`}>
        {status?.current_boost ? "プランを変更する" : "プランを選ぶ"}
      </h2>
      <div className="space-y-3">
        {PLANS.map(plan => {
          const isCurrent  = status?.current_boost?.plan_id === plan.id;
          const canAfford  = status ? plan.slots - (isCurrent ? plan.slots : 0) <= status.available_slots : true;
          return (
            <div key={plan.id}
              onClick={() => setSelected(selected === plan.id ? null : plan.id)}
              className={`rounded-xl p-4 border cursor-pointer transition ${th.planCard(isCurrent, selected === plan.id)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${plan.color}`} />
                  <div>
                    <p className="font-bold">{plan.label}</p>
                    <p className={`text-xs ${th.planSubText}`}>{plan.slots}枠使用</p>
                    <p className="text-[10px] text-purple-300/70 mt-0.5">{plan.recommend}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-purple-400">{plan.percent}%</p>
                  <p className={`text-sm ${th.planPrice}`}>${plan.price}/月</p>
                </div>
              </div>
              {selected === plan.id && !isCurrent && (
                <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
                  {/* EP決済ボタン */}
                  {(() => {
                    const epCost      = plan.price * 100;
                    const hasEnoughEp = epBalance !== null && epBalance >= epCost;
                    const epDisabled  = busy || !canAfford || !hasEnoughEp;
                    return (
                      <button
                        onClick={() => setConfirmPlan(plan)}
                        disabled={epDisabled}
                        className={`w-full py-2 rounded-lg text-sm font-bold transition ${
                          !canAfford
                            ? `${th.disabledBtn} cursor-not-allowed`
                            : !hasEnoughEp
                            ? `${th.disabledBtn} text-red-400/70 cursor-not-allowed`
                            : "bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105"
                        }`}>
                        {busy
                          ? "処理中..."
                          : !canAfford
                          ? "枠不足"
                          : !hasEnoughEp
                          ? `EP不足（残り ${epBalance?.toLocaleString() ?? "?"} EP）`
                          : `EPで支払う（${epCost.toLocaleString()} EP）`}
                      </button>
                    );
                  })()}
                  {/* クレジットカード（Square） */}
                  <button
                    onClick={() => handleMusicBoostCheckout(plan)}
                    className="w-full py-2 rounded-lg text-sm font-bold border border-white/20 bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 transition text-white/80"
                  >
                    💳 クレジットカードで購入
                  </button>
                </div>
              )}
              {isCurrent && (
                <p className="text-xs text-purple-400 mt-2">✓ 現在のプラン</p>
              )}
            </div>
          );
        })}
      </div>

      {/* 注意書き */}
      <div className={`mt-8 text-xs ${th.ghost} space-y-1`}>
        <p>• EPは換金不可です</p>
        <p>• ブースト率・枠数は予告なく変更される場合があります</p>
        <p>• 不正利用が確認された場合はアカウントを停止します</p>
        <p>• 運営判断で報酬・優先度の調整を行うことがあります</p>
      </div>
        </div>{/* left column */}

        {status?.current_boost && (
          <div className={`w-full md:w-72 md:shrink-0 ${th.card} border ${th.cardBorder} rounded-2xl p-5`}>
            <h2 className="font-bold text-sm mb-4">🎵 配信楽曲情報</h2>

            {/* 登録済みリスト */}
            <div className="space-y-2 mb-4">
              {tracks.length === 0 && (
                <p className={`text-xs ${th.faint}`}>まだ楽曲が登録されていません</p>
              )}
              {tracks.map((t, i) => (
                <div key={i} className={`rounded-lg border ${th.cardBorder} p-2`}>
                  {editingIndex === i ? (
                    /* インライン編集モード */
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={editArtist}
                        onChange={e => setEditArtist(e.target.value)}
                        placeholder="アーティスト名"
                        className={`w-full rounded border px-2 py-1 text-xs ${th.inputBg}`}
                      />
                      <input
                        type="text"
                        value={editAlbum}
                        onChange={e => setEditAlbum(e.target.value)}
                        placeholder="アルバム名"
                        className={`w-full rounded border px-2 py-1 text-xs ${th.inputBg}`}
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={handleSaveEdit}
                          disabled={tracksSaving || !editArtist.trim()}
                          className="flex-1 py-1 rounded bg-gradient-to-r from-purple-600 to-blue-600 text-xs font-bold text-white disabled:opacity-50 transition"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingIndex(null)}
                          disabled={tracksSaving}
                          className={`px-3 py-1 rounded text-xs ${th.disabledBtn} transition`}
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 通常表示モード */
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{t.artist}</p>
                        <p className={`text-xs ${th.muted} truncate`}>{t.album || "—"}</p>
                      </div>
                      <button
                        onClick={() => handleStartEdit(i)}
                        disabled={tracksSaving}
                        className={`shrink-0 text-xs px-2 py-1 rounded ${th.disabledBtn} hover:bg-blue-500/20 hover:text-blue-400 transition disabled:opacity-40`}
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteTrack(i)}
                        disabled={tracksSaving}
                        className={`shrink-0 text-xs px-2 py-1 rounded ${th.disabledBtn} hover:bg-red-500/20 hover:text-red-400 transition disabled:opacity-40`}
                      >
                        削除
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 追加フォーム */}
            <div className="space-y-2">
              <div>
                <label className={`text-xs ${th.muted} block mb-1`}>アーティスト名 *</label>
                <input
                  type="text"
                  value={newArtist}
                  onChange={e => setNewArtist(e.target.value)}
                  placeholder="例: 山田太郎"
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${th.inputBg}`}
                />
              </div>
              <div>
                <label className={`text-xs ${th.muted} block mb-1`}>アルバム名</label>
                <input
                  type="text"
                  value={newAlbum}
                  onChange={e => setNewAlbum(e.target.value)}
                  placeholder="例: 夜明けのメロディ"
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${th.inputBg}`}
                />
              </div>
              <button
                onClick={handleAddTrack}
                disabled={tracksSaving || !newArtist.trim()}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-bold text-white hover:opacity-90 transition disabled:opacity-50"
              >
                {tracksSaving ? "処理中..." : "+ 追加する"}
              </button>
              {tracksLog && (
                <p className={`text-xs text-center ${tracksLog.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>
                  {tracksLog}
                </p>
              )}
            </div>
          </div>
        )}
        </div>{/* flex wrapper */}

      {/* ── EP決済確認モーダル ─────────────────────────────────────── */}
      {confirmPlan !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setConfirmPlan(null)}
        >
          <div
            className={`relative w-full max-w-sm rounded-2xl ${th.modal} p-7 shadow-2xl`}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-extrabold text-white mb-5 text-center">ご確認ください</h2>

            <div className={`space-y-3 text-sm ${th.modalText}`}>
              <div className="flex justify-between">
                <span>プラン</span>
                <span className="font-bold text-white">{confirmPlan.label}（{confirmPlan.percent}%）</span>
              </div>
              <div className="flex justify-between">
                <span>費用</span>
                <span className="font-bold text-purple-300">{(confirmPlan.price * 100).toLocaleString()} EP</span>
              </div>
              <div className="flex justify-between">
                <span>有効期間</span>
                <span className="font-bold text-white">30日間</span>
              </div>
              <div className="flex justify-between">
                <span>有効期限</span>
                <span className="font-bold text-white">
                  {(() => {
                    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
                  })()}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 text-xs text-yellow-300/80 leading-relaxed">
              ⚠️ 本機能は収益・利益を保証するものではありません。<br />
              Music Boost は認知拡大を目的とした広告サービスです。<br />
              期限到来後は自動更新されません。
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setConfirmPlan(null)}
                className={`flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-semibold ${th.modalBtn} transition`}>
                キャンセル
              </button>
              <button
                onClick={() => {
                  const plan = confirmPlan;
                  setConfirmPlan(null);
                  handleSubscribe(plan.id, "ep");
                }}
                disabled={busy}
                className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-2.5 text-sm font-bold text-white hover:opacity-90 transition disabled:opacity-50">
                確認して支払う
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── チュートリアルオーバーレイ ──────────────────────────────────── */}
      {tutorialStep !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => {
            localStorage.setItem(BOOST_TUTORIAL_KEY, "true");
            setTutorialStep(null);
          }}
        >
          <div
            className={`relative w-full max-w-sm rounded-2xl ${th.modal} p-7 shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 進捗 */}
            <p className={`text-center text-xs font-semibold ${th.modalFaint} mb-4`}>
              {tutorialStep + 1} / {BOOST_TUTORIAL_SLIDES.length}
            </p>

            {/* スライドインジケーター */}
            <div className="flex justify-center gap-1.5 mb-6">
              {BOOST_TUTORIAL_SLIDES.map((_, i) => (
                <div
                  key={i}
                  className={[
                    "h-1.5 rounded-full transition-all",
                    i === tutorialStep ? "w-6 bg-purple-500" : "w-1.5 bg-white/15",
                  ].join(" ")}
                />
              ))}
            </div>

            {/* コンテンツ */}
            <div className="text-center">
              <div className="text-4xl mb-3">{BOOST_TUTORIAL_SLIDES[tutorialStep].icon}</div>
              <h2 className="text-base font-extrabold text-white mb-3 leading-snug">
                {BOOST_TUTORIAL_SLIDES[tutorialStep].title}
              </h2>
              <p className={`text-sm ${th.modalMuted} leading-relaxed whitespace-pre-line text-left`}>
                {BOOST_TUTORIAL_SLIDES[tutorialStep].body}
              </p>
            </div>

            {/* ナビゲーション */}
            <div className="mt-7 flex items-center gap-2">
              {tutorialStep > 0 && (
                <button
                  type="button"
                  onClick={() => setTutorialStep(tutorialStep - 1)}
                  className={`flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-semibold ${th.modalBtn} transition`}
                >
                  ← 戻る
                </button>
              )}
              {tutorialStep < BOOST_TUTORIAL_SLIDES.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setTutorialStep(tutorialStep + 1)}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-2.5 text-sm font-bold text-white hover:opacity-90 transition"
                >
                  次へ →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(BOOST_TUTORIAL_KEY, "true");
                    setTutorialStep(null);
                  }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-2.5 text-sm font-bold text-white hover:opacity-90 transition"
                >
                  Music Boostを始める
                </button>
              )}
            </div>

            {/* スキップ */}
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(BOOST_TUTORIAL_KEY, "true");
                setTutorialStep(null);
              }}
              className={`mt-3 w-full text-center text-xs ${th.modalSkip} transition`}
            >
              スキップ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "../../lib/useTheme";
import { getAuthSecret } from "../../lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, useReducedMotion } from "framer-motion";
import { TapFloatText } from "@/components/animations/TapFloatText";
import { LoadingCat } from "@/components/LoadingCat";

/* 1回にまとめて送るタップ数。サーバー側の上限と同じ値にしてある。
   ここを大きくすると、これを超えた分が 400 で弾かれる。 */
const TAP_BATCH_SIZE = 50;
/* 打ち終えてから送るまでの待ち。長くするほど通信は減るが、
   結果が画面に出るのも遅くなる。 */
const TAP_FLUSH_DELAY_MS = 5000;

type TapStatus = {
  today_taps:      number;
  today_bp:        number;
  today_ep:        number;
  taps_remaining:  number;
  max_combo:       number;
  today_max_combo: number;
  total_taps:      number;
  /* 時間帯（JST 0-6 / 6-12 / 12-18 / 18-24）ごとの枠。
     サーバーが持っている値をそのまま映す。画面では計算しない。 */
  slot?:                string;
  next_slot_at?:        string;
  slot_taps?:           number;
  slot_taps_remaining?: number;
  slot_ep_remaining?:   number;
  daily_ep_remaining?:  number;
  bp_per_tap?:          number;
  max_taps_per_day?:    number;
  max_taps_per_slot?:   number;
  slot_ep_cap?:         number;
  daily_ep_cap?:        number;
  bp_balance?:          number;
  ep_balance?:          number;
};

type BatchResult = {
  ok:                boolean;
  processedTapCount?: number;
  bpCost?:           number;
  bpReward?:         number;
  epReward?:         number;
  rareRewards?:      { type: string; amount: number }[];
  todayTaps?:        number;
  tapsRemaining?:    number;
  slotTaps?:         number;
  slotTapsRemaining?: number;
  slot?:             string;
  slotEpRemaining?:  number;
  dailyEpRemaining?: number;
  nextSlotAt?:       string;
  poolExhausted?:    boolean;
  bpBalance?:        number;
  epBalance?:        number;
  today_bp?:         number;
  today_ep?:         number;
  error?:            string;
};

type MiningLog = {
  id:       number;
  taps:     number;
  bp:       number;
  ep:       number;
  rare:     boolean;
  time:     string;
};

export default function TapMiningPage() {
  const { isDark, toggleTheme } = useTheme();
  const th = {
    page:        isDark ? "bg-[#0a0a0a] text-white"          : "bg-gray-50 text-gray-900",
    modal:       isDark ? "bg-[#1a1a2e] border-white/10"      : "bg-white border-gray-200",
    card:        isDark ? "bg-white/5"                        : "bg-white shadow-sm",
    cardBorder:  isDark ? "border-white/10"                   : "border-gray-200",
    muted:       isDark ? "text-white/70"                     : "text-gray-500",
    faint:       isDark ? "text-white/40"                     : "text-gray-400",
    ghost:       isDark ? "text-white/20"                     : "text-gray-300",
    dividerFaint:isDark ? "border-white/5"                    : "border-gray-100",
    logRow:      (rare: boolean) =>
      isDark
        ? `flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0 ${rare ? "text-yellow-400" : "text-white/60"}`
        : `flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0 ${rare ? "text-yellow-500" : "text-gray-500"}`,
    logTime:     isDark ? "text-white/30 w-16"                : "text-gray-300 w-16",
    back:        isDark ? "text-white/40"                     : "text-gray-400",
    helpBtn:     isDark ? "text-white/40 bg-white/5"          : "text-gray-400 bg-white border border-gray-200",
    statCard:    isDark ? "bg-white/5 rounded-xl p-3 text-center" : "bg-white border border-gray-200 rounded-xl p-3 text-center",
    statLabel:   isDark ? "text-xs text-white/40"             : "text-xs text-gray-400",
    recordCard:  isDark ? "bg-white/5 border border-white/10 rounded-xl p-4 mb-4" : "bg-white border border-gray-200 rounded-xl p-4 mb-4",
    recordLabel: isDark ? "text-white/40"                     : "text-gray-400",
    recordHead:  isDark ? "text-sm font-bold text-white/60 mb-3" : "text-sm font-bold text-gray-500 mb-3",
    totalText:   isDark ? "text-center text-xs text-white/20" : "text-center text-xs text-gray-300",
    logHead:     isDark ? "text-xs font-bold text-white/40 mb-2" : "text-xs font-bold text-gray-400 mb-2",
    limitCard:   isDark ? "bg-white/5 rounded-xl p-4 text-center text-sm text-white/50 mb-4" : "bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-400 mb-4",
    sidebar:     isDark ? "bg-[#0f0f1a] border-l border-white/5 rounded-xl p-4" : "bg-white border border-gray-200 rounded-xl p-4",
  };

  // ── コア State ──
  const [userId,              setUserId]              = useState("");
  const [authCode,            setAuthCode]            = useState("");
  const [group,               setGroup]               = useState("");
  const [status,              setStatus]              = useState<TapStatus | null>(null);
  const [optimisticRemaining, setOptimisticRemaining] = useState<number | null>(null);
  const [combo,               setCombo]               = useState(0);
  const [lastTapTime,         setLastTapTime]         = useState(0);
  const [isTapping,           setIsTapping]           = useState(false);
  const [floats,              setFloats]              = useState<{ id: number; text: string; color: string; x: number }[]>([]);
  const [rareEffect,          setRareEffect]          = useState(false);
  const [fever,               setFever]               = useState(false);
  const [feverTimer,          setFeverTimer]          = useState(0);
  const [ownRareEvents,       setOwnRareEvents]       = useState<{ id: number; amount: number; label: string }[]>([]);
  const ownRareIdRef = useRef(0);
  const [showHelp,            setShowHelp]            = useState(false);
  const [miningLogs,          setMiningLogs]          = useState<MiningLog[]>([]);
  const logIdRef = useRef(0);

  // ── バッチ用 Refs ──
  const pendingTapsRef      = useRef(0);
  const flushTimerRef       = useRef<NodeJS.Timeout | null>(null);
  const isFlushingRef       = useRef(false);
  /* バッチごとに作る。1ページ1個を使い回すと、サーバー側の二重処理防止が
     2回目以降を「同じバッチの再送」と見なして、すべて弾いてしまう。 */
  const newBatchId = () => `tap_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const batchStartRef       = useRef<number | null>(null);
  const maxComboInBatchRef  = useRef(0);
  const userIdRef           = useRef("");
  const codeRef             = useRef("");
  const groupRef            = useRef("");
  const floatIdRef          = useRef(0);
  const comboTimerRef       = useRef<NodeJS.Timeout | null>(null);
  const feverIntervalRef    = useRef<NodeJS.Timeout | null>(null);

  const reduced = useReducedMotion();

  /* サーバーは JST の "YYYY-MM-DDTHH:MM:SS" を返す。タイムゾーン記号が
     付いていないので Date に食わせると環境依存になる。文字列から切り出す。 */
  const fmtSlotTime = (iso?: string) => {
    if (!iso) return "次の時間帯";
    const m = /T(\d{2}):(\d{2})/.exec(iso);
    return m ? `${m[1]}:${m[2]}` : "次の時間帯";
  };

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { codeRef.current = authCode; }, [authCode]);
  useEffect(() => { groupRef.current = group; }, [group]);

  // ── 初期化 ──
  useEffect(() => {
    const seen = localStorage.getItem("tap_help_seen");
    if (!seen) setShowHelp(true);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("addval_auth_v1");
      if (raw) {
        const auth = JSON.parse(raw);
        setUserId(String(auth?.id ?? ""));
        setGroup(String(auth?.group ?? ""));
      }
      /* code は sessionStorage にあるので、ブラウザを閉じると消える。
         その場合は ID だけ残るため、黙って落とさず再ログインを促す。 */
      setAuthCode(getAuthSecret());
    } catch {}
  }, []);

  useEffect(() => {
    if (!userId || !authCode) return;
    fetch("/api/minigames/tap/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, code: authCode, group }),
    })
      .then(r => r.json())
      .then(d => { if (d.ok) setStatus(d); })
      .catch(() => {});
  }, [userId, authCode, group]);

  // status が来たら optimisticRemaining を初期化（一度だけ）
  useEffect(() => {
    if (status && optimisticRemaining === null) {
      setOptimisticRemaining(status.taps_remaining);
    }
  }, [status, optimisticRemaining]);


  // ── バッチ flush ──
  const flushTaps = useCallback(async () => {
    /* 送信中に叩かれた分は貯まり続ける。全部まとめて送ると 50 を超えて
       400 で弾かれるので、上限までを送り、余りは次の便に回す。 */
    const count = Math.min(pendingTapsRef.current, TAP_BATCH_SIZE);
    if (count === 0 || !userIdRef.current || !codeRef.current || isFlushingRef.current) return;

    isFlushingRef.current  = true;
    pendingTapsRef.current -= count;
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }

    const startedAt = batchStartRef.current ?? Date.now();
    const endedAt   = Date.now();
    batchStartRef.current       = null;
    const maxCombo              = maxComboInBatchRef.current;
    maxComboInBatchRef.current  = 0;

    try {
      const res  = await fetch("/api/minigames/tap/batch-play", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          userId:    userIdRef.current,
          code:      codeRef.current,
          group:     groupRef.current,
          batchId:   newBatchId(),
          tapCount:  count,
          maxCombo,
          startedAt,
          endedAt,
        }),
      });
      const data: BatchResult = await res.json();

      if (data.ok) {
        // サーバー値で状態を同期
        setStatus(prev => prev ? {
          ...prev,
          today_taps:      data.todayTaps      ?? prev.today_taps,
          today_bp:        data.today_bp        ?? prev.today_bp,
          today_ep:        data.today_ep        ?? prev.today_ep,
          taps_remaining:  data.tapsRemaining   ?? prev.taps_remaining,
          today_max_combo: Math.max(prev.today_max_combo, maxCombo),
          slot:                data.slot              ?? prev.slot,
          slot_taps:           data.slotTaps          ?? prev.slot_taps,
          slot_taps_remaining: data.slotTapsRemaining ?? prev.slot_taps_remaining,
          slot_ep_remaining:   data.slotEpRemaining   ?? prev.slot_ep_remaining,
          daily_ep_remaining:  data.dailyEpRemaining  ?? prev.daily_ep_remaining,
          next_slot_at:        data.nextSlotAt        ?? prev.next_slot_at,
          bp_balance:          data.bpBalance         ?? prev.bp_balance,
          ep_balance:          data.epBalance         ?? prev.ep_balance,
        } : prev);
        // optimisticRemaining を実残数で補正（必須）
        if (data.tapsRemaining !== undefined) setOptimisticRemaining(data.tapsRemaining);

        // マイニングログに追加
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
        setMiningLogs(prev => [{
          id:   logIdRef.current++,
          taps: data.processedTapCount ?? count,
          bp:   data.bpReward ?? 0,
          ep:   data.epReward ?? 0,
          rare: (data.rareRewards?.length ?? 0) > 0,
          time: timeStr,
        }, ...prev].slice(0, 15));

        // 自分のレア獲得をティッカーに追加
        data.rareRewards?.forEach(r => {
          const label = r.amount >= 100
            ? `🌟 +${r.amount}EP EPIC!!!`
            : `✨ +${r.amount}EP RARE!`;
          setOwnRareEvents(prev => [{ id: ownRareIdRef.current++, amount: r.amount, label }, ...prev].slice(0, 20));
        });

        // レア報酬演出（サーバー確認後のみ）
        data.rareRewards?.forEach(r => {
          const id = floatIdRef.current++;
          const x  = 40 + Math.random() * 20;
          let text: string, color: string;
          if (r.amount >= 100) {
            text = `🌟 +${r.amount}EP EPIC!!!`; color = "text-orange-400";
            setRareEffect(true); setTimeout(() => setRareEffect(false), 2000);
          } else {
            text = `✨ +${r.amount}EP RARE!`; color = "text-yellow-400";
            setRareEffect(true); setTimeout(() => setRareEffect(false), 1500);
          }
          setFloats(prev => [...prev, { id, text, color, x }].slice(-20));
          setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1500);
        });
      } else if (data.error === "daily_limit_reached") {
        setOptimisticRemaining(0);
        setStatus(prev => prev ? { ...prev, taps_remaining: 0 } : prev);
      } else if (data.error === "slot_limit_reached") {
        /* 日次はまだ残っていても、この時間帯はもう叩けない。
           残り回数を0にしてしまうと「今日はもう終わり」に見えるので、
           枠側だけ0にして、次の枠の時刻を出す。 */
        setOptimisticRemaining(0);
        setStatus(prev => prev ? {
          ...prev, slot_taps_remaining: 0,
          next_slot_at: data.nextSlotAt ?? prev.next_slot_at,
        } : prev);
      } else if (data.error === "pool_exhausted") {
        setOptimisticRemaining(0);
        setStatus(prev => prev ? {
          ...prev,
          slot_ep_remaining:  0,
          daily_ep_remaining: data.dailyEpRemaining ?? prev.daily_ep_remaining,
          next_slot_at:       data.nextSlotAt ?? prev.next_slot_at,
        } : prev);
      } else if (data.error === "authentication_required" || data.error === "authentication_failed") {
        setAuthCode("");
      }
    } catch {}
    finally {
      isFlushingRef.current = false;
      /* 持ち越した分があれば、続けて送る。放っておくと、
         次に叩くまで送られないまま残る。 */
      if (pendingTapsRef.current > 0) {
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        flushTimerRef.current = setTimeout(() => flushTaps(), 300);
      }
    }
  }, []);

  // ── 離脱時 flush（pagehide 最優先 / visibilitychange / beforeunload 補助） ──
  useEffect(() => {
    const buildPayload = () => ({
      userId:    userIdRef.current,
      code:      codeRef.current,
      group:     groupRef.current,
      batchId:   newBatchId(),
      tapCount:  Math.min(pendingTapsRef.current, TAP_BATCH_SIZE),
      maxCombo:  maxComboInBatchRef.current,
      startedAt: batchStartRef.current ?? Date.now(),
      endedAt:   Date.now(),
    });

    const sendBatch = () => {
      const count = Math.min(pendingTapsRef.current, TAP_BATCH_SIZE);
      if (count === 0 || !userIdRef.current || !codeRef.current) return;
      const payload = buildPayload();
      pendingTapsRef.current = 0;
      const blob    = new Blob([JSON.stringify(payload)], { type: "application/json" });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/minigames/tap/batch-play", blob);
      } else {
        fetch("/api/minigames/tap/batch-play", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), keepalive: true,
        }).catch(() => {});
      }
    };

    const onPageHide        = () => sendBatch();
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") sendBatch(); };
    const onBeforeUnload    = () => sendBatch();

    window.addEventListener("pagehide",         onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload",      onBeforeUnload);

    return () => {
      window.removeEventListener("pagehide",         onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload",      onBeforeUnload);
      // unmount 時は試行のみ（完了保証なし）
      flushTaps();
    };
  }, [flushTaps]);

  // ── コンボ・フィーバー ──
  const resetComboTimer = () => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => setCombo(0), 1200);
  };

  const startFever = () => {
    if (fever) return;
    setFever(true);
    setFeverTimer(10);
    if (feverIntervalRef.current) clearInterval(feverIntervalRef.current);
    feverIntervalRef.current = setInterval(() => {
      setFeverTimer(t => {
        if (t <= 1) { clearInterval(feverIntervalRef.current!); setFever(false); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  // ── メインタップ処理（バッチ版） ──
  const handleTap = () => {
    const effectiveRemaining = optimisticRemaining ?? (status?.taps_remaining ?? 0);
    if (!userId || !authCode || !status || effectiveRemaining <= 0) return;

    const now      = Date.now();
    const newCombo = (now - lastTapTime) < 1200 ? combo + 1 : 1;
    setCombo(newCombo);
    setLastTapTime(now);
    maxComboInBatchRef.current = Math.max(maxComboInBatchRef.current, newCombo);
    resetComboTimer();
    if (newCombo === 50) startFever();

    setIsTapping(true);
    setTimeout(() => setIsTapping(false), 100);

    // 即時フロートエフェクト（演出のみ・金額なし）
    const id = floatIdRef.current++;
    const x  = 40 + Math.random() * 20;
    setFloats(prev => [...prev, { id, text: "⛏️", color: isDark ? "text-white/50" : "text-gray-400", x }].slice(-20));
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 700);

    // 楽観的残数更新（0未満にしない）
    setOptimisticRemaining(r => Math.max(0, (r ?? (status?.taps_remaining ?? 0)) - 1));

    // バッチ蓄積
    if (!batchStartRef.current) batchStartRef.current = now;
    pendingTapsRef.current++;

    /* GAS は1回の送信ごとにロックを取ってシートを読み書きする。
       以前は10タップごと・打ち終え2秒後だったので、連打すると2秒に1回
       叩きに行っていた。まとめる数をサーバーの上限（50）まで引き上げ、
       打ち終えてからの待ちも延ばす。

       連打する人ほど間隔が空く（50回貯まるまで送らない）。ゆっくり叩く人は
       手を止めてから送られるので、どちらも回数が減る。
       途中で画面を離れても pagehide で送るので、取りこぼしはしない。 */
    if (pendingTapsRef.current >= TAP_BATCH_SIZE) {
      flushTaps();
    } else {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => flushTaps(), TAP_FLUSH_DELAY_MS);
    }
  };

  const comboMultiplier    = combo >= 100 ? 1.5 : combo >= 50 ? 1.2 : combo >= 20 ? 1.1 : 1.0;
  const effectiveRemaining = optimisticRemaining ?? (status?.taps_remaining ?? 0);

  if (!status) return <LoadingCat />;

  return (
    <div className={`min-h-screen ${th.page}${rareEffect ? " animate-pulse" : ""}`}>
    {/* グリッド外：fixed要素（モーダル・ticker） */}
      <ThemeToggle isDark={isDark} onToggle={toggleTheme} />

      {/* ルール説明モーダル */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className={`${th.modal} rounded-2xl p-6 max-w-sm w-full`}>
            <h2 className="text-lg font-black mb-4 text-center">⛏️ Tap Miningとは？</h2>
            <div className={`text-sm ${th.muted} space-y-3`}>
              <div>
                <p className="font-bold mb-1">■ 基本ルール</p>
                <p>・1タップ = 5BP消費</p>
                <p>・1日最大2,000回まで</p>
                <p>・時間帯ごとに500回まで（0-6 / 6-12 / 12-18 / 18-24時）</p>
                <p>・毎日リセット</p>
              </div>
              <div>
                <p className="font-bold mb-1">■ 報酬</p>
                <p>・BPまたはEPがランダムで獲得できます</p>
                <p>・最低でも0.1BPは必ずもらえます</p>
                <p>・最高報酬は100EPです</p>
                <p>・EPは時間帯ごとに配布量の上限があります</p>
                <p>・上限に達すると、その時間帯はEPが出ません（BPは消費しません）</p>
              </div>
              <div>
                <p className="font-bold mb-1">■ ポイント</p>
                <p>・EPはアプリ内ポイントです（換金不可）</p>
                <p>・運が良いと大当たりも…？</p>
              </div>
            </div>
            <button
              onClick={() => { localStorage.setItem("tap_help_seen", "1"); setShowHelp(false); }}
              className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 font-bold text-sm"
            >
              OK、はじめる！
            </button>
          </div>
        </div>
      )}

      {/* レア演出オーバーレイ */}
      {rareEffect && (
        <div className="fixed inset-0 bg-yellow-400/20 z-50 pointer-events-none flex items-center justify-center">
          <div className="text-4xl font-black text-yellow-400 animate-bounce">✨ RARE! EP獲得！</div>
        </div>
      )}

      {/* 自分のレア獲得ティッカー */}
      {ownRareEvents.length > 0 && (
        <div className="fixed top-0 left-0 right-0 bg-black/80 text-yellow-400 text-xs py-1 px-4 z-40 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap">
            {ownRareEvents.map(e => (
              <span key={e.id} className="mr-10">{e.label}</span>
            ))}
          </div>
        </div>
      )}

    {/* 2カラムグリッド */}
    <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-6 lg:max-w-3xl lg:mx-auto lg:px-4 lg:py-8">

    {/* ── 左カラム（メインコンテンツ） ── */}
    <div className="px-4 py-8 max-w-md mx-auto lg:max-w-none lg:px-0 lg:py-0 relative overflow-hidden">

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/mini-games" className={`${th.back} text-sm`}>← Arcade</Link>
        <h1 className="font-bold text-lg">⛏️ Tap Mining</h1>
        <button onClick={() => setShowHelp(true)} className={`${th.helpBtn} text-lg w-8 h-8 rounded-full flex items-center justify-center`}>?</button>
      </div>

      {/* ステータスバー */}
      {/* 残高と、今日の獲得を分けて出す。以前は「今日のBP」だけが並んでいて、
          これは獲得量なのに残高と読まれる。タップは5BP払って0.1BP前後を得るので、
          獲得だけ見ていると増え続けているように見えてしまう。 */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className={th.statCard}>
          <p className={th.statLabel}>BP残高</p>
          <p className="font-bold text-purple-400">{status?.bp_balance ?? "—"}</p>
        </div>
        <div className={th.statCard}>
          <p className={th.statLabel}>EP残高</p>
          <p className="font-bold text-yellow-400">{status?.ep_balance ?? "—"}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-6">
        <div className={th.statCard}>
          <p className={th.statLabel}>今日の獲得BP</p>
          <p className="font-bold text-purple-400/80 text-sm">+{status?.today_bp ?? 0}</p>
        </div>
        <div className={th.statCard}>
          <p className={th.statLabel}>今日の獲得EP</p>
          <p className="font-bold text-yellow-400/80 text-sm">+{status?.today_ep ?? 0}</p>
        </div>
      </div>

      {/* いまの時間帯と、配布できるEPの残り。
          サーバーが返した値をそのまま出す。画面で計算すると、
          リロードのたびに表示だけが変わって、実際とずれる。 */}
      {status && (
        <div className={`${th.statCard} mb-6`}>
          <div className="flex items-center justify-between mb-1">
            <p className={th.statLabel}>いまの時間帯</p>
            <p className="text-xs font-bold">{status.slot ? `${status.slot}時` : "—"}</p>
          </div>
          <div className="flex items-center justify-between mb-1">
            <p className={th.statLabel}>この時間帯のEP残り</p>
            <p className="text-xs font-bold text-yellow-400">
              {status.slot_ep_remaining ?? "—"} / {status.slot_ep_cap ?? 225} EP
            </p>
          </div>
          <div className="flex items-center justify-between mb-1">
            <p className={th.statLabel}>本日のEP残り</p>
            <p className="text-xs font-bold text-yellow-400">
              {status.daily_ep_remaining ?? "—"} / {status.daily_ep_cap ?? 900} EP
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className={th.statLabel}>この時間帯の残り回数</p>
            <p className="text-xs font-bold">
              {status.slot_taps_remaining ?? "—"} / {status.max_taps_per_slot ?? 500} 回
            </p>
          </div>
          {(status.slot_ep_remaining === 0) && (
            <p className="text-[11px] mt-2 text-orange-400">
              この時間帯のEPは配り切りました。{fmtSlotTime(status.next_slot_at)}に次の枠が始まります。
            </p>
          )}
        </div>
      )}

      {/* code は sessionStorage にあるので、ブラウザを閉じると消える。
          ID だけ残った状態で叩かせると、毎回401で理由も分からない。 */}
      {userId && !authCode && (
        <div className="mb-6 rounded-xl border border-orange-400/50 bg-orange-400/10 px-4 py-3 text-xs text-orange-300">
          ログイン情報の確認が切れています。お手数ですが、ログインし直してください。
        </div>
      )}

      {/* コンボ表示 */}
      <div className="text-center mb-4">
        {combo >= 20 && (
          <div className="text-sm font-bold text-orange-400 animate-pulse">
            🔥 {combo} COMBO! × {comboMultiplier}
          </div>
        )}
        {fever && (
          <div className="text-sm font-bold text-red-400">
            ⚡ FEVER! {feverTimer}s
          </div>
        )}
      </div>

      {/* メインタップボタン */}
      <div className="relative flex items-center justify-center my-8">
        <TapFloatText items={floats} />
        <motion.button
          onClick={handleTap}
          disabled={!userId || !authCode || !status || effectiveRemaining <= 0}
          animate={reduced ? {} : { scale: isTapping ? 0.88 : 1 }}
          whileHover={(!userId || !authCode || !status || effectiveRemaining <= 0) || reduced ? {} : { scale: 1.05 }}
          transition={{ type: "spring", damping: 14, stiffness: 420 }}
          className={`
            w-48 h-48 rounded-full font-black text-2xl select-none
            ${fever
              ? "bg-gradient-to-br from-red-500 to-orange-500 shadow-[0_0_40px_rgba(239,68,68,0.8)]"
              : "bg-gradient-to-br from-purple-600 to-blue-600 shadow-[0_0_30px_rgba(99,102,241,0.5)]"
            }
            ${(!userId || !authCode || !status || effectiveRemaining <= 0) ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          {effectiveRemaining <= 0 ? "🔒" : "⛏️"}
          <div className="text-sm font-normal mt-1">
            {effectiveRemaining <= 0 ? "明日また来てね" : "TAP!"}
          </div>
        </motion.button>
      </div>

      {/* 上限メッセージ */}
      {effectiveRemaining <= 0 && (
        <div className={th.limitCard}>
          本日のタップ上限に達しました🎉<br/>明日リセットされます
        </div>
      )}

      {/* 今日の記録 */}
      <div className={th.recordCard}>
        <h3 className={th.recordHead}>📊 今日の記録</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className={th.recordLabel}>タップ数</span>
            <span>{status?.today_taps ?? 0} / 500</span>
          </div>
          <div className="flex justify-between">
            <span className={th.recordLabel}>最大コンボ</span>
            <span>{status?.today_max_combo ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className={th.recordLabel}>獲得BP</span>
            <span className="text-purple-400">{status?.today_bp ?? 0} BP</span>
          </div>
          <div className="flex justify-between">
            <span className={th.recordLabel}>獲得EP</span>
            <span className="text-yellow-400">{status?.today_ep ?? 0} EP</span>
          </div>
        </div>
      </div>

      {/* 累計記録 */}
      <div className={th.totalText}>
        総タップ数: {status?.total_taps ?? 0} / 最大コンボ: {status?.max_combo ?? 0}
      </div>

      {/* モバイル：ログをインラインで表示 */}
      {miningLogs.length > 0 && (
        <div className={`lg:hidden mt-4 ${th.card} border ${th.cardBorder} rounded-xl p-3`}>
          <h3 className={th.logHead}>⛏️ マイニングログ</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {miningLogs.map(log => (
              <div key={log.id} className={th.logRow(log.rare)}>
                <span className={th.logTime}>{log.time}</span>
                <span>{log.taps}tap</span>
                {log.bp > 0 && <span className="text-purple-400">+{log.bp}BP</span>}
                {log.ep > 0 && <span className="text-yellow-400">+{log.ep}EP {log.rare ? "✨" : ""}</span>}
                {log.bp === 0 && log.ep === 0 && <span className={th.ghost}>—</span>}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>

    {/* ── 右カラム（デスクトップ専用ログパネル） ── */}
    <div className="hidden lg:block py-0 sticky top-4 h-fit">
      <div className={th.sidebar}>
        <h3 className={`${th.logHead} mb-3 flex items-center gap-1`}>
          <span>⛏️</span> マイニングログ
        </h3>
        {miningLogs.length === 0 ? (
          <p className={`text-xs ${th.ghost} text-center py-8`}>タップするとここに<br/>結果が表示されます</p>
        ) : (
          <div className="space-y-1 max-h-[calc(100vh-160px)] overflow-y-auto">
            {miningLogs.map(log => (
              <div key={log.id} className={`rounded-lg px-2 py-1.5 text-xs ${
                log.rare
                  ? isDark ? "bg-yellow-400/10 border border-yellow-400/30" : "bg-yellow-50 border border-yellow-200"
                  : isDark ? "bg-white/5" : "bg-gray-50"
              }`}>
                <div className="flex items-center justify-between">
                  <span className={th.logTime}>{log.time}</span>
                  <span>{log.taps}tap</span>
                  {log.bp > 0 && <span className="text-purple-400">+{log.bp}BP</span>}
                  {log.ep > 0 && <span className="text-yellow-400">+{log.ep}EP {log.rare ? "✨" : ""}</span>}
                  {log.bp === 0 && log.ep === 0 && <span className={th.ghost}>—</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    </div>
    </div>
  );
}

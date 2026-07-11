"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "../../lib/useTheme";
import { ThemeToggle } from "@/components/ThemeToggle";

/** JSTの今日の日付文字列 (YYYY-MM-DD) */
function getTodayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type RumbleStatus = {
  entered_today:          boolean;
  today_score:            number | null;
  today_rp:               number | null;
  week_rp:                number;
  week_id:                string;
  week_participant_count?: number;
};

type RankingEntry = { user_id: string; total_rp: number; display_name: string };

type Equipment = {
  id: string; slot: string; rarity: string;
  name: string; bonus: number; equipped: boolean;
  enhance_level?: number; luck?: number; stability?: number;
  locked?: boolean;
};

type GachaResult = {
  item: { id: string; slot: string; rarity: string; name: string; bonus: number };
  bp: number;
  auto_discarded?: number;
  auto_shard_gained?: number;
};

// 強化コストテーブル（GASのENHANCE_TABLEと同期）
const ENHANCE_TABLE = [
  { cost: 5,   rate: 100 },
  { cost: 8,   rate: 100 },
  { cost: 12,  rate: 100 },
  { cost: 18,  rate: 95  },
  { cost: 25,  rate: 90  },
  { cost: 35,  rate: 80  },
  { cost: 50,  rate: 70  },
  { cost: 70,  rate: 55  },
  { cost: 95,  rate: 40  },
  { cost: 130, rate: 25  },
];

// 観戦モード用型定義
type SpectatorPlayer = {
  id: string;
  display_name: string;
  score: number;
  rp: number;
  rank: number;
  is_self: boolean;
  status?: "alive" | "eliminated";
};

type SpectatorEvent = {
  type: "intro" | "batch_eliminate" | "battle" | "log" | "ranking" | "result";
  text?: string;
  ids?: string[];
  a?: string;
  b?: string;
  is_crit?: boolean;
  phase?: string;
  delay: number;
};

type SpectatorData = {
  ok: boolean;
  status: "ready" | "no_data";
  players: SpectatorPlayer[];
  events: SpectatorEvent[];
  self: (SpectatorPlayer & { week_rp: number; week_rank: number }) | null;
  ranking: { user_id: string; display_name: string; total_rp: number }[];
  total: number;
  date?: string;
};

type DailyResultData = {
  ok: boolean;
  status: "pending" | "ready";
  date: string;
  participant_count: number;
  winnerCount: number;
  isToday: boolean;
  participants?: Array<{ user_id: string; display_name: string }>;
  replay_seed?: string;
  winners?: Array<{ rank: number; user_id: string; display_name: string; bp_amount: number }>;
};

const SLOT_NORMALIZE: Record<string, string> = {
  head: "head", body: "body", hand: "hand", leg: "leg",
  helmet: "head", chest: "body", armor: "body",
  glove: "hand", gloves: "hand",
  boot: "leg", boots: "leg", feet: "leg",
};

function normalizeSlot(slot: string): string {
  return SLOT_NORMALIZE[slot?.toLowerCase()] ?? slot;
}

const RARITY_COLOR: Record<string, string> = {
  common:    "text-gray-400",
  rare:      "text-blue-400",
  epic:      "text-purple-400",
  legendary: "text-yellow-400",
  mythic:    "text-red-400",
};

const RARITY_BG: Record<string, string> = {
  common:    "border-gray-600",
  rare:      "border-blue-500",
  epic:      "border-purple-500",
  legendary: "border-yellow-500",
  mythic:    "border-red-500",
};

const TAB_LIST = ["バトル", "観戦", "ランキング", "装備", "ガチャ"] as const;
type Tab = typeof TAB_LIST[number];

export default function RumblePage() {
  const { isDark, toggleTheme } = useTheme();
  const th = {
    page:        isDark ? "bg-[#0a0a0a] text-white"          : "bg-gray-50 text-gray-900",
    modal:       isDark ? "bg-[#1a1a2e] border-white/10"      : "bg-white border-gray-200",
    modalDark:   isDark ? "bg-[#0d0d1a] border-purple-500/30" : "bg-white border-purple-200",
    card:        isDark ? "bg-white/5"                        : "bg-white shadow-sm",
    cardBorder:  isDark ? "border-white/10"                   : "border-gray-200",
    muted:       isDark ? "text-white/70"                     : "text-gray-500",
    faint:       isDark ? "text-white/40"                     : "text-gray-400",
    ghost:       isDark ? "text-white/20"                     : "text-gray-300",
    divider:     isDark ? "border-white/10"                   : "border-gray-200",
    dividerFaint:isDark ? "border-white/5"                    : "border-gray-100",
    progressBg:  isDark ? "bg-white/10"                       : "bg-gray-200",
    tab:         (active: boolean) =>
      isDark
        ? active ? "border-b-2 border-purple-400 text-white font-bold" : "text-white/40 hover:text-white/70"
        : active ? "border-b-2 border-purple-500 text-gray-900 font-bold" : "text-gray-400 hover:text-gray-600",
    statCard:    isDark ? "bg-white/5 rounded-xl p-3 text-center" : "bg-white border border-gray-200 rounded-xl p-3 text-center",
    statLabel:   isDark ? "text-xs text-white/40"             : "text-xs text-gray-400",
    rankRow:     (isSelf: boolean) =>
      isDark
        ? `flex items-center gap-3 py-2 px-3 rounded-xl text-sm ${isSelf ? "bg-purple-500/20 border border-purple-500/30" : ""}`
        : `flex items-center gap-3 py-2 px-3 rounded-xl text-sm ${isSelf ? "bg-purple-50 border border-purple-200" : ""}`,
    equipCard:   isDark ? "border border-white/10 rounded-xl p-3" : "border border-gray-200 rounded-xl p-3 bg-white",
    closeBtn:    isDark ? "bg-white/10 hover:bg-white/20 text-white/50" : "bg-gray-100 hover:bg-gray-200 text-gray-500",
    back:        isDark ? "text-white/40"                     : "text-gray-400",
    msgArea:     (ok: boolean) =>
      ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400",
    modalText:   isDark ? "text-white/70"                     : "text-gray-600",
    modalMuted:  isDark ? "text-white/60"                     : "text-gray-500",
    modalFaint:  isDark ? "text-white/40"                     : "text-gray-400",
  };
  const [userId, setUserId]       = useState("");
  const [tab, setTab]             = useState<Tab>("バトル");
  const [status, setStatus]       = useState<RumbleStatus | null>(null);
  const [ranking, setRanking]     = useState<RankingEntry[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [busy, setBusy]           = useState(false);
  const [gachaResult, setGachaResult] = useState<GachaResult | null>(null);
  const [msg, setMsg]             = useState("");
  const [countdown, setCountdown] = useState("");
  const [isAfter19Jst, setIsAfter19Jst] = useState(false);
  const [isAfter1850Jst, setIsAfter1850Jst] = useState(false);
  const [weekParticipantCount, setWeekParticipantCount] = useState(0);
  const [isFriAfter1850Jst,   setIsFriAfter1850Jst]    = useState(false);
  const [shards, setShards]       = useState(0);
  const [enhanceResult, setEnhanceResult] = useState<{result:string; after_level:number; shard_spent:number} | null>(null);
  // 強化モーダル
  const [enhanceModal, setEnhanceModal] = useState<{ itemId: string; itemName: string; currentLevel: number } | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceModalMsg, setEnhanceModalMsg] = useState("");
  const [dismantleModal, setDismantleModal] = useState<{ itemId: string; itemName: string } | null>(null);
  const [dismantling, setDismantling] = useState(false);
  const [dismantleMsg, setDismantleMsg] = useState("");
  const [rankContext, setRankContext] = useState<any>(null);
  const [showHelp, setShowHelp]         = useState(false);
  const [showEquipHelp, setShowEquipHelp] = useState(false);
  const [showRankHelp, setShowRankHelp]   = useState(false);
  const [bpBalance, setBpBalance]         = useState<number | null>(null);
  const [localEnteredToday, setLocalEnteredToday] = useState(false);
  const [displayName, setDisplayName]     = useState("");
  const [nameInput, setNameInput]         = useState("");
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameBusy, setNameBusy]           = useState(false);
  const [nameMsg, setNameMsg]             = useState("");
  // 観戦モード
  const [spectatorData,      setSpectatorData]      = useState<SpectatorData | null>(null);
  const [spectatorLoading,   setSpectatorLoading]   = useState(false);
  const [spectatorPlayers,   setSpectatorPlayers]   = useState<SpectatorPlayer[]>([]);
  const [battleLogs,         setBattleLogs]         = useState<{ text: string; color: string; id: number }[]>([]);
  // モーダル用の全件保持（ライブ表示のbattleLogsはslice(-20)で切り詰めるため別持ち）
  const [fullBattleLogs,     setFullBattleLogs]     = useState<{ text: string; color: string; id: number }[]>([]);
  const [spectatorPhase,     setSpectatorPhase]     = useState<"waiting" | "live" | "result">("waiting");
  const [isPlaying,          setIsPlaying]          = useState(false);
  const [logCounter,         setLogCounter]         = useState(0);
  const [spectatorFetchedAt, setSpectatorFetchedAt] = useState<number | null>(null);
  const [spectatorDate,      setSpectatorDate]      = useState<string | null>(null);
  const [dailyResult,        setDailyResult]        = useState<DailyResultData | null>(null);
  const [dailyResultLoading, setDailyResultLoading] = useState(false);
  const [showWinners,        setShowWinners]         = useState(false);
  // 前回バトル（pendingのとき直近の完了バトルを表示）
  const [prevBattleDate,     setPrevBattleDate]     = useState<string | null>(null);
  const [prevDailyResult,    setPrevDailyResult]    = useState<DailyResultData | null>(null);
  const [prevSpectatorData,  setPrevSpectatorData]  = useState<SpectatorData | null>(null);
  const [prevLoading,        setPrevLoading]        = useState(false);
  const [prevBattleLogs,     setPrevBattleLogs]     = useState<{ text: string; color: string; id: number }[]>([]);
  const [prevFullBattleLogs, setPrevFullBattleLogs] = useState<{ text: string; color: string; id: number }[]>([]);
  const [prevPhase,          setPrevPhase]          = useState<"waiting" | "live" | "result">("waiting");
  const [prevIsPlaying,      setPrevIsPlaying]      = useState(false);
  const [prevLogCounter,     setPrevLogCounter]     = useState(0);
  const [showBattleLogModal,   setShowBattleLogModal]   = useState(false);
  const [battleLogModalMode,   setBattleLogModalMode]   = useState<"today" | "prev">("today");

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seen = localStorage.getItem("rumble_help_seen");
    if (!seen) setShowHelp(true);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("addval_auth_v1");
      if (raw) { const auth = JSON.parse(raw); setUserId(String(auth?.id ?? "")); }
    } catch {}
  }, []);

  useEffect(() => {
    if (!userId) return;
    const saved = localStorage.getItem(`rumble_display_name_${userId}`);
    if (saved) { setDisplayName(saved); setNameInput(saved); }
  }, [userId]);

  // ローカルストレージで当日参加済みを即座に反映（サーバー応答前でも二重参加を防ぐ）
  useEffect(() => {
    if (!userId) return;
    if (localStorage.getItem(`rumble_entered_${userId}`) === getTodayJst()) {
      setLocalEnteredToday(true);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/minigames/rumble/status?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json()).then(d => {
        setStatus(d);
        if (d.bp_balance !== undefined) setBpBalance(d.bp_balance);
        if (d.week_participant_count !== undefined) {
          setWeekParticipantCount(d.week_participant_count);
        }
        // サーバー側で参加済みと確認できた場合、localStorageにも記録して次回リロード後も確実に保護
        if (d.entered_today) {
          localStorage.setItem(`rumble_entered_${userId}`, getTodayJst());
          setLocalEnteredToday(true);
        }
        // サーバーから表示名を取得してlocalStorageとstateに反映（別デバイス・キャッシュクリア後も正しく表示）
        if (d.display_name) {
          localStorage.setItem(`rumble_display_name_${userId}`, d.display_name);
          setDisplayName(d.display_name);
          setNameInput(d.display_name);
        }
      }).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (tab !== "ランキング") return;
    fetch("/api/minigames/rumble/ranking")
      .then(r => r.json()).then(d => { if (d.ok) setRanking(d.ranking); }).catch(() => {});
  }, [tab]);

  useEffect(() => {
    if (tab !== "装備") return;
    fetch(`/api/minigames/rumble/equipment?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json()).then(d => {
        if (d.ok) setEquipment((d.items as Equipment[]).map(item => ({ ...item, slot: normalizeSlot(item.slot) })));
      }).catch(() => {});
  }, [tab, userId]);

  useEffect(() => {
    const calcCountdown = () => {
      const now = new Date();
      // JST年月日をロケールで取得（UTC環境でもズレない）
      const jstParts = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", hour12: false,
      }).formatToParts(now);
      const jstYear  = jstParts.find(p => p.type === "year")!.value;
      const jstMonth = jstParts.find(p => p.type === "month")!.value;
      const jstDay   = jstParts.find(p => p.type === "day")!.value;
      const jstHour  = parseInt(jstParts.find(p => p.type === "hour")!.value, 10);
      const jstMinute = parseInt(new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", minute: "2-digit" }).format(now), 10);
      setIsAfter19Jst(jstHour >= 19);
      setIsAfter1850Jst(jstHour > 18 || (jstHour === 18 && jstMinute >= 50));
      // 現在時刻の曜日をJSTで取得（UTC環境でもズレない）
      const dowJst = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        weekday: "short",
      }).format(now);
      setIsFriAfter1850Jst(
        dowJst === "金" &&
        (jstHour > 18 || (jstHour === 18 && jstMinute >= 50))
      );

      // 目標日付の計算
      let targetDate = new Date(`${jstYear}-${jstMonth}-${jstDay}T19:00:00+09:00`);
      if (jstHour >= 19) targetDate = new Date(targetDate.getTime() + 86400000);
      // 土日スキップ（JSTで曜日取得）
      while (true) {
        const dow = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", weekday: "short" }).format(targetDate);
        if (dow !== "土" && dow !== "日") break;
        targetDate = new Date(targetDate.getTime() + 86400000);
      }

      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown("00:00:00");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    calcCountdown();
    const interval = setInterval(calcCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/minigames/rumble/shard-status?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json()).then(d => { if (d.ok) setShards(d.shards); }).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (tab !== "ランキング" || !userId) return;
    fetch(`/api/minigames/rumble/my-rank-context?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json()).then(d => { if (d.ok) setRankContext(d); }).catch(() => {});
  }, [tab, userId]);

  // 観戦タブに切り替えたときにデータ取得（キャッシュ30秒）
  useEffect(() => {
    if (tab !== "観戦" || !userId) return;
    const todayJst = getTodayJst();
    const needsFetch =
      spectatorData === null ||
      spectatorFetchedAt === null ||
      spectatorDate !== todayJst ||
      Date.now() - (spectatorFetchedAt ?? 0) > 30000;
    if (!needsFetch) return;
    setSpectatorLoading(true);
    fetch(`/api/minigames/rumble/spectator?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then((d: SpectatorData) => {
        if (d.ok) {
          setSpectatorData(d);
          setSpectatorFetchedAt(Date.now());
          setSpectatorDate(d.date ?? todayJst);
          if (d.status === "ready") {
            setSpectatorPlayers(d.players.map(p => ({ ...p, status: "alive" as const })));
            setSpectatorPhase("waiting");
            try { localStorage.setItem(`rumble_spectator_${d.date ?? todayJst}_${userId}`, JSON.stringify(d)); } catch {}
          }
        }
      })
      .catch(() => {})
      .finally(() => setSpectatorLoading(false));
  }, [tab, userId, spectatorData, spectatorFetchedAt, spectatorDate]);

  // 日次抽選結果を取得（観戦タブ表示のたびにリフレッシュ）
  useEffect(() => {
    if (tab !== "観戦") return;
    setDailyResultLoading(true);
    setShowWinners(false);
    fetch("/api/minigames/rumble/daily-result")
      .then(r => r.json())
      .then((d: DailyResultData) => {
        if (d.ok) {
          setDailyResult(d);
          if (d.status === "ready") {
            try { localStorage.setItem(`rumble_daily_result_${d.date}`, JSON.stringify(d)); } catch {}
          }
        }
      })
      .catch(() => {})
      .finally(() => setDailyResultLoading(false));
  }, [tab]);

  // 前回バトル取得（今日がpendingのとき直近の完了バトルを自動取得）
  useEffect(() => {
    if (tab !== "観戦") return;
    if (dailyResult?.status !== "pending") return;
    if (prevDailyResult || prevLoading) return;
    setPrevLoading(true);
    (async () => {
      try {
        for (let i = 1; i <= 10; i++) {
          const d = new Date(Date.now() - i * 86400000);
          const dateStr = new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

          // キャッシュ優先でdaily-resultを取得
          let data: DailyResultData | null = null;
          try {
            const cached = localStorage.getItem(`rumble_daily_result_${dateStr}`);
            if (cached) data = JSON.parse(cached) as DailyResultData;
          } catch {}
          if (!data) {
            const res = await fetch(`/api/minigames/rumble/daily-result?date=${dateStr}`);
            data = await res.json() as DailyResultData;
            if (data.ok && data.status === "ready") {
              try { localStorage.setItem(`rumble_daily_result_${dateStr}`, JSON.stringify(data)); } catch {}
            }
          }

          if (data.ok && data.status === "ready") {
            setPrevDailyResult(data);
            setPrevBattleDate(dateStr);

            // キャッシュ優先でspectatorを取得
            let sData: SpectatorData | null = null;
            try {
              const sCached = localStorage.getItem(`rumble_spectator_${dateStr}_${userId}`);
              if (sCached) sData = JSON.parse(sCached) as SpectatorData;
            } catch {}
            if (!sData) {
              const sRes = await fetch(`/api/minigames/rumble/spectator?userId=${encodeURIComponent(userId)}&date=${dateStr}`);
              sData = await sRes.json() as SpectatorData;
              if (sData.ok && sData.status === "ready") {
                try { localStorage.setItem(`rumble_spectator_${dateStr}_${userId}`, JSON.stringify(sData)); } catch {}
              }
            }
            if (sData.ok && sData.status === "ready") {
              setPrevSpectatorData(sData);
              setPrevPhase("waiting");
            }
            break;
          }
        }
      } catch {}
      finally { setPrevLoading(false); }
    })();
  }, [tab, dailyResult?.status, userId]);

  // 観戦タブがpendingかつ当日の場合、5秒ごとにdaily-resultを自動ポーリング（参加者が増えるたびに即反映）
  useEffect(() => {
    if (tab !== "観戦") return;
    if (dailyResult?.status !== "pending" || !dailyResult?.isToday) return;
    const interval = setInterval(() => {
      fetch("/api/minigames/rumble/daily-result")
        .then(r => r.json())
        .then((d: DailyResultData) => { if (d.ok) setDailyResult(d); })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [tab, dailyResult?.status, dailyResult?.isToday]);

  // バトルログモーダル：新しいログが追加されたら末尾にスクロール
  useEffect(() => {
    if (!showBattleLogModal) return;
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [battleLogs, prevBattleLogs, showBattleLogModal]);

  const handleSetName = async () => {
    const trimmed = nameInput.trim();
    if (!userId || nameBusy) return;
    setNameBusy(true); setNameMsg("");
    try {
      const res  = await fetch("/api/minigames/rumble/set-name", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, display_name: trimmed }) });
      const data = await res.json();
      if (data.ok) {
        setDisplayName(trimmed);
        localStorage.setItem(`rumble_display_name_${userId}`, trimmed);
        setNameMsg("保存しました！");
        setTimeout(() => { setShowNameModal(false); setNameMsg(""); }, 1000);
      } else {
        if (data.error === "name_too_long") setNameMsg("16文字以内で入力してください");
        else if (data.error === "invalid_chars") setNameMsg("使用できない文字が含まれています");
        else setNameMsg("エラーが発生しました");
      }
    } catch { setNameMsg("通信エラー"); }
    finally { setNameBusy(false); }
  };

  const handleSpectatorPlay = async () => {
    if (!spectatorData || isPlaying || spectatorData.status === "no_data") return;
    setIsPlaying(true);
    setSpectatorPhase("live");
    setBattleLogs([]);
    setFullBattleLogs([]);
    setSpectatorPlayers(spectatorData.players.map(p => ({ ...p, status: "alive" as const })));

    let counter = 0;
    const addLog = (text: string, color = "text-white") => {
      counter++;
      const id = counter;
      setBattleLogs(prev => {
        const next = [...prev, { text, color, id }];
        return next.slice(-20);
      });
      setFullBattleLogs(prev => [...prev, { text, color, id }]); // モーダル用は全件保持
      setLogCounter(id);
    };

    for (const event of spectatorData.events) {
      await new Promise(r => setTimeout(r, Math.min(event.delay > 0 ? event.delay : 800, 2000)));

      if (event.type === "intro" || event.type === "log") {
        addLog(event.text ?? "", th.muted);
      } else if (event.type === "batch_eliminate") {
        const ids = event.ids ?? [];
        setSpectatorPlayers(prev =>
          prev.map(p => ids.includes(p.id) ? { ...p, status: "eliminated" as const } : p)
        );
        addLog(event.text ?? "", "text-red-400/80");
      } else if (event.type === "battle") {
        const color = event.is_crit ? "text-yellow-400" : "text-purple-300";
        addLog(event.text ?? "", color);
      } else if (event.type === "ranking") {
        addLog("━━━━━━━━━━━━━━━━", th.ghost);
        addLog("🏆 今日の順位が確定！", "text-yellow-400");
      } else if (event.type === "result") {
        addLog(event.text ?? "バトル終了！", "text-yellow-300");
        setSpectatorPhase("result");
        setShowWinners(true);
      }
    }
    setIsPlaying(false);
  };

  const handleSpectatorRefresh = async () => {
    if (!userId || spectatorLoading) return;
    const todayJst = getTodayJst();
    setSpectatorLoading(true);
    try {
      const d: SpectatorData = await fetch(
        `/api/minigames/rumble/spectator?userId=${encodeURIComponent(userId)}`
      ).then(r => r.json());
      if (d.ok) {
        setSpectatorData(d);
        setSpectatorFetchedAt(Date.now());
        setSpectatorDate(d.date ?? todayJst);
        if (d.status === "ready") {
          setSpectatorPlayers(d.players.map(p => ({ ...p, status: "alive" as const })));
          setSpectatorPhase("waiting");
        }
      }
    } catch {}
    finally { setSpectatorLoading(false); }
  };

  const handlePrevPlay = async () => {
    if (!prevSpectatorData || prevIsPlaying || prevSpectatorData.status !== "ready") return;
    setPrevIsPlaying(true);
    setPrevPhase("live");
    setPrevBattleLogs([]);
    setPrevFullBattleLogs([]);
    let counter = 0;
    const addLog = (text: string, color = "text-white") => {
      counter++;
      const id = counter;
      setPrevBattleLogs(prev => [...prev, { text, color, id }].slice(-20));
      setPrevFullBattleLogs(prev => [...prev, { text, color, id }]); // モーダル用は全件保持
      setPrevLogCounter(id);
    };
    for (const event of prevSpectatorData.events) {
      await new Promise(r => setTimeout(r, Math.min(event.delay > 0 ? event.delay : 800, 2000)));
      if (event.type === "intro" || event.type === "log") {
        addLog(event.text ?? "", th.muted);
      } else if (event.type === "batch_eliminate") {
        addLog(event.text ?? "", "text-red-400/80");
      } else if (event.type === "battle") {
        addLog(event.text ?? "", event.is_crit ? "text-yellow-400" : "text-purple-300");
      } else if (event.type === "ranking") {
        addLog("━━━━━━━━━━━━━━━━", th.ghost);
        addLog("🏆 順位が確定！", "text-yellow-400");
      } else if (event.type === "result") {
        addLog(event.text ?? "バトル終了！", "text-yellow-300");
        setPrevPhase("result");
      }
    }
    setPrevIsPlaying(false);
  };

  const handleEntry = async () => {
    if (!userId || busy) return;
    setBusy(true); setMsg("");
    try {
      const res  = await fetch("/api/minigames/rumble/entry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem(`rumble_entered_${userId}`, getTodayJst());
        setLocalEnteredToday(true);
        setBpBalance(prev => prev !== null ? Math.max(0, prev - 100) : null);
        setStatus(prev => prev ? { ...prev, entered_today: true, today_score: data.score, today_rp: data.rp, week_rp: prev.week_rp + data.rp } : prev);
        setMsg("🎉 参加完了！スコアは18:50に公開されます");
      } else {
        if (data.error === "already_entered_today") setMsg("本日はすでに参加済みです");
        else if (data.error === "insufficient_bp")  setMsg(`BP不足です（残高: ${data.bp}BP）`);
        else setMsg("エラーが発生しました");
      }
    } catch { setMsg("通信エラーが発生しました"); }
    finally { setBusy(false); }
  };

  const handleGacha = async () => {
    if (!userId || busy) return;
    setBusy(true); setGachaResult(null); setMsg("");
    try {
      const res  = await fetch("/api/minigames/rumble/gacha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      const data = await res.json();
      if (data.ok) {
        setGachaResult(data);
        if ((data.auto_shard_gained ?? 0) > 0) {
          setShards(prev => prev + (data.auto_shard_gained ?? 0));
        }
      } else {
        if (data.error === "insufficient_bp") setMsg(`BP不足です（残高: ${data.bp}BP）`);
        else setMsg("エラーが発生しました");
      }
    } catch { setMsg("通信エラーが発生しました"); }
    finally { setBusy(false); }
  };

  const handleEquip = async (itemId: string) => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const res  = await fetch("/api/minigames/rumble/equip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, itemId }) });
      const data = await res.json();
      if (data.ok) {
        const eqRes  = await fetch(`/api/minigames/rumble/equipment?userId=${encodeURIComponent(userId)}`);
        const eqData = await eqRes.json();
        if (eqData.ok) setEquipment((eqData.items as Equipment[]).map((item: Equipment) => ({ ...item, slot: normalizeSlot(item.slot) })));
      }
    } catch {} finally { setBusy(false); }
  };

  const handleDismantle = (itemId: string) => {
    const item = equipment.find(e => e.id === itemId);
    if (!item || !userId || busy) return;
    setDismantleModal({ itemId, itemName: item.name });
    setDismantleMsg("");
  };

  const handleDismantleConfirm = async () => {
    if (!dismantleModal || !userId || dismantling) return;
    setDismantling(true);
    setDismantleMsg("");
    try {
      const res = await fetch("/api/minigames/rumble/dismantle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, itemId: dismantleModal.itemId }),
      });
      const data = await res.json();
      if (data.ok) {
        setShards(data.remaining_shard);
        setEquipment(prev => prev.filter(e => e.id !== dismantleModal.itemId));
        setMsg(`🔨 分解完了！ +${data.gained_shard} 力のかけら`);
        setDismantleModal(null);
      } else {
        setDismantleMsg(
          data.error === "item_locked"
            ? "ロック中は分解できません"
            : data.error === "item_equipped"
            ? "装備中は分解できません（先に別の装備に付け替えてください）"
            : "エラーが発生しました"
        );
      }
    } catch {
      setDismantleMsg("通信エラー");
    } finally {
      setDismantling(false);
    }
  };

  // 装備ロックのON/OFF切替（ロック中は分解・ガチャ上限超過時の自動変換から保護される）
  const handleToggleLock = async (item: Equipment) => {
    if (!userId || busy) return;
    const next = !item.locked;
    try {
      const res = await fetch("/api/minigames/rumble/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, itemId: item.id, locked: next }),
      });
      const data = await res.json();
      if (data.ok) {
        setEquipment(prev => prev.map(e => e.id === item.id ? { ...e, locked: !!data.locked } : e));
        setMsg(next ? "🔒 ロックしました（分解・自動変換から保護されます）" : "🔓 ロックを解除しました");
      } else {
        setMsg("ロックの切替に失敗しました");
      }
    } catch {
      setMsg("通信エラー");
    }
  };

  // 強化ボタン押下 → サーバーからかけら残高を再取得してからモーダルを開く
  const handleEnhance = async (itemId: string) => {
    const item = equipment.find(e => e.id === itemId);
    if (!item || !userId) return;
    // サーバーの最新値を取得してstateを更新してからモーダルを開く
    try {
      const res = await fetch(`/api/minigames/rumble/shard-status?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.ok) setShards(data.shards);
    } catch {}
    setEnhanceModal({ itemId, itemName: item.name, currentLevel: item.enhance_level ?? 0 });
    setEnhanceModalMsg("");
    setEnhanceResult(null);
  };

  // モーダル内「強化する」ボタン → 実際にAPI呼び出し
  const handleEnhanceConfirm = async () => {
    if (!enhanceModal || !userId || enhancing) return;
    setEnhancing(true); setEnhanceModalMsg("");
    try {
      const res  = await fetch("/api/minigames/rumble/enhance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, itemId: enhanceModal.itemId }) });
      const data = await res.json();
      if (data.ok) {
        setShards(data.remaining_shard);
        setEnhanceResult({ result: data.result, after_level: data.after_level, shard_spent: data.shard_spent });
        if (data.result === "success") {
          setEquipment(prev => prev.map(e => e.id === enhanceModal.itemId
            ? { ...e, bonus: data.updated.bonus, luck: data.updated.luck, stability: data.updated.stability, enhance_level: data.after_level }
            : e
          ));
          setEnhanceModal(prev => prev ? { ...prev, currentLevel: data.after_level } : null);
        }
        const msg = data.result === "success"
          ? `✨ 強化成功！ Lv${data.after_level}（${data.shard_spent} 力のかけら消費）`
          : `💨 強化失敗... （${data.shard_spent} 力のかけら消費）`;
        setEnhanceModalMsg(msg);
        // 結果表示後にモーダルを自動で閉じる
        setTimeout(() => { setEnhanceModal(null); setEnhanceModalMsg(""); }, 1800);
      } else {
        if (data.error === "insufficient_shard") {
          setShards(data.shards ?? shards);
          setEnhanceModalMsg(`力のかけらが不足しています（残高: ${data.shards} / 必要: ${ENHANCE_TABLE[enhanceModal.currentLevel]?.cost ?? "?"}）`);
        } else {
          setEnhanceModalMsg("エラーが発生しました");
        }
      }
    } catch { setEnhanceModalMsg("通信エラーが発生しました"); }
    finally { setEnhancing(false); }
  };

  return (
    <div className={`min-h-screen ${th.page} px-4 py-8 max-w-md mx-auto`}>
      <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
      {/* Rumbleルール説明モーダル */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className={`${th.modal} rounded-2xl p-6 max-w-sm w-full`}>
            <h2 className="text-lg font-black mb-4 text-center">⚔️ Rumble Leagueとは？</h2>
            <div className={`text-sm ${th.muted} space-y-3`}>
              <div>
                <p className="font-bold mb-1">■ 基本ルール</p>
                <p>・1日1回、100BPで参加</p>
                <p>・月〜金の5日間でランキングを競います</p>
                <p>・金曜日に最終順位が確定します</p>
              </div>
              <div>
                <p className="font-bold mb-1">■ 勝敗の仕組み</p>
                <p>・スコアで順位が決まります</p>
                <p>・スコアはレベル・装備・運で決まります</p>
              </div>
              <div>
                <p className="font-bold mb-1">■ 報酬</p>
                <p>・順位に応じてEPがもらえます</p>
                <p>・上位ほど報酬がアップ</p>
                <p>・報酬量はその週の参加人数によって変動します</p>
              </div>
              <div>
                <p className="font-bold mb-1">■ ポイント</p>
                <p>・毎日参加するほど有利</p>
                <p>・装備を強化すると順位が上がりやすくなります</p>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.setItem("rumble_help_seen", "1");
                setShowHelp(false);
              }}
              className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 font-bold text-sm"
            >
              OK、はじめる！
            </button>
          </div>
        </div>
      )}

      {/* 装備説明モーダル */}
      {showEquipHelp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className={`${th.modal} rounded-2xl p-6 max-w-sm w-full`}>
            <h2 className="text-lg font-black mb-4 text-center">🛡️ 装備について</h2>
            <div className={`text-sm ${th.muted} space-y-3`}>
              <div>
                <p className="font-bold mb-1">■ 装備の特徴</p>
                <p>・4部位（頭・胴・手・足）に装着できます</p>
                <p>・同じ装備でも性能はランダムです</p>
              </div>
              <div>
                <p className="font-bold mb-1">■ 強化</p>
                <p>・装備は強化してさらに強くできます</p>
                <p>・強化には力のかけらが必要です</p>
              </div>
              <div>
                <p className="font-bold mb-1">■ 分解</p>
                <p>・不要な装備は力のかけらに変換できます</p>
              </div>
              <div>
                <p className="font-bold mb-1">■ ポイント</p>
                <p>・良い数値の装備を厳選するのが重要です</p>
              </div>
            </div>
            <button onClick={() => setShowEquipHelp(false)}
              className={`w-full mt-5 py-3 rounded-xl ${th.closeBtn} font-bold text-sm`}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ランキング説明モーダル */}
      {showRankHelp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className={`${th.modal} rounded-2xl p-6 max-w-sm w-full`}>
            <h2 className="text-lg font-black mb-4 text-center">🏆 ランキングの見方</h2>
            <div className={`text-sm ${th.muted} space-y-3`}>
              <div>
                <p className="font-bold mb-1">■ ランキングの見方</p>
                <p>・現在順位：あなたの位置</p>
                <p>・RP：ランキングポイント</p>
                <p>・報酬帯：現在もらえる報酬</p>
              </div>
              <div>
                <p className="font-bold mb-1">■ ポイント</p>
                <p>・上の順位に近づくほど報酬アップ</p>
                <p>・参加しないと順位が下がることがあります</p>
              </div>
            </div>
            <button onClick={() => setShowRankHelp(false)}
              className={`w-full mt-5 py-3 rounded-xl ${th.closeBtn} font-bold text-sm`}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 表示名設定モーダル */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className={`${th.modal} rounded-2xl p-6 max-w-xs w-full`}>
            <h2 className="text-lg font-black mb-4 text-center">✏️ 表示名を設定</h2>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              maxLength={16}
              placeholder="16文字以内"
              className={`w-full ${th.card} border ${th.cardBorder} rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-purple-500`}
            />
            <p className={`text-xs ${th.faint} mb-4`}>{'使用不可: < > " \' & \\ /'}</p>
            {nameMsg && <p className={`text-xs text-center mb-3 ${nameMsg.includes("保存") ? "text-green-400" : "text-red-400"}`}>{nameMsg}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowNameModal(false); setNameMsg(""); }} className={`flex-1 py-3 rounded-xl ${th.closeBtn} text-sm font-bold`}>キャンセル</button>
              <button onClick={handleSetName} disabled={nameBusy || !nameInput.trim()} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-bold disabled:opacity-40">
                {nameBusy ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 強化モーダル */}
      {enhanceModal && (() => {
        const lvl  = enhanceModal.currentLevel;
        const next = lvl < 10 ? ENHANCE_TABLE[lvl] : null;
        const canEnhance = next !== null && shards >= (next?.cost ?? 0);
        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4">
            <div className={`${th.modal} rounded-2xl p-6 max-w-sm w-full`}>
              <h2 className="text-lg font-black mb-1 text-center">⚙️ 装備を強化</h2>
              <p className={`text-xs ${th.faint} text-center mb-5`}>{enhanceModal.itemName}</p>

              {next ? (
                <div className="space-y-3 mb-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className={th.statCard}>
                      <p className={`${th.statLabel} mb-1`}>現在Lv</p>
                      <p className="text-xl font-black">{lvl}</p>
                    </div>
                    <div className={th.statCard}>
                      <p className={`${th.statLabel} mb-1`}>強化後Lv</p>
                      <p className="text-xl font-black text-purple-400">{lvl + 1}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-center">
                      <p className={`${th.statLabel} mb-1`}>必要かけら</p>
                      <p className={`text-xl font-black ${shards >= next.cost ? "text-orange-400" : "text-red-400"}`}>{next.cost}</p>
                    </div>
                    <div className={th.statCard}>
                      <p className={`${th.statLabel} mb-1`}>成功率</p>
                      <p className={`text-xl font-black ${next.rate === 100 ? "text-green-400" : next.rate >= 70 ? "text-yellow-400" : "text-red-400"}`}>{next.rate}%</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs px-1">
                    <span className={th.faint}>所持かけら</span>
                    <span className={shards >= next.cost ? "text-orange-400 font-bold" : "text-red-400 font-bold"}>{shards} 個</span>
                  </div>
                  {!canEnhance && (
                    <p className="text-xs text-red-400 text-center bg-red-500/10 rounded-xl py-2">
                      力のかけらが不足しています（あと {next.cost - shards} 個必要）
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center text-yellow-400 font-bold mb-5">最大強化済みです</p>
              )}

              {enhanceModalMsg && (
                <p className={`text-sm text-center mb-4 rounded-xl py-2 ${
                  enhanceModalMsg.includes("成功") ? "bg-green-500/10 text-green-400" :
                  enhanceModalMsg.includes("失敗") ? "bg-red-500/10 text-red-400" :
                  "bg-red-500/10 text-red-400"
                }`}>
                  {enhanceModalMsg}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setEnhanceModal(null); setEnhanceModalMsg(""); }}
                  disabled={enhancing}
                  className={`flex-1 py-3 rounded-xl ${th.closeBtn} text-sm font-bold disabled:opacity-40`}
                >
                  閉じる
                </button>
                {next && (
                  <button
                    onClick={handleEnhanceConfirm}
                    disabled={enhancing || !canEnhance}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-yellow-600 text-sm font-bold disabled:opacity-40"
                  >
                    {enhancing ? "強化中..." : "強化する"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 分解確認モーダル */}
      {dismantleModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className={`${th.modal} rounded-2xl p-6 max-w-sm w-full`}>
            <h2 className="text-base font-black mb-1 text-center">🔨 装備を分解しますか？</h2>
            <p className={`text-sm ${th.muted} text-center mb-4`}>
              「{dismantleModal.itemName}」を分解します。<br />
              <span className="text-orange-400 font-bold">この操作は取り消せません。</span>
            </p>
            {dismantleMsg && (
              <p className="text-xs text-red-400 text-center mb-3">{dismantleMsg}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setDismantleModal(null); setDismantleMsg(""); }}
                disabled={dismantling}
                className={`flex-1 py-2.5 rounded-xl ${th.closeBtn} text-sm disabled:opacity-40`}
              >
                キャンセル
              </button>
              <button
                onClick={handleDismantleConfirm}
                disabled={dismantling}
                className="flex-1 py-2.5 rounded-xl bg-orange-700/80 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-40"
              >
                {dismantling ? "分解中…" : "分解する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* バトルログモーダル */}
      {showBattleLogModal && (() => {
        const isToday   = battleLogModalMode === "today";
        const logs      = isToday ? fullBattleLogs  : prevFullBattleLogs; // モーダルは全件表示（ライブ表示は20件のまま）
        const playing   = isToday ? isPlaying       : prevIsPlaying;
        const phase     = isToday ? spectatorPhase  : prevPhase;
        const sData     = isToday ? spectatorData   : prevSpectatorData;
        const hasData   = sData?.status === "ready";
        const handlePlay   = isToday ? handleSpectatorPlay : handlePrevPlay;
        const handleReplay = () => {
          if (isToday) {
            setBattleLogs([]);
            setFullBattleLogs([]);
            setShowWinners(false);
            setSpectatorPlayers((spectatorData?.players ?? []).map(p => ({ ...p, status: "alive" as const })));
            handleSpectatorPlay();
          } else {
            setPrevBattleLogs([]);
            setPrevFullBattleLogs([]);
            setPrevPhase("waiting");
            handlePrevPlay();
          }
        };

        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4">
            <div className={`${th.modalDark} rounded-2xl w-full max-w-sm flex flex-col`} style={{ maxHeight: "80vh" }}>
              {/* モーダルヘッダー */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${th.divider} shrink-0`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-purple-400/80 tracking-widest">
                    {isToday ? "TODAY" : "PREV"} BATTLE LOG
                  </span>
                  {playing && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
                      <span className="text-[9px] text-pink-400 font-black">LIVE</span>
                    </span>
                  )}
                  {phase === "result" && !playing && (
                    <span className="text-[9px] text-yellow-400 font-black">RESULT</span>
                  )}
                </div>
                <button
                  onClick={() => setShowBattleLogModal(false)}
                  className={`w-7 h-7 rounded-full ${th.closeBtn} flex items-center justify-center text-xs transition`}
                >
                  ✕
                </button>
              </div>

              {/* ログエリア */}
              <div className="overflow-y-auto px-4 py-3 flex-1 font-mono space-y-2 min-h-[200px]">
                {logs.length === 0 && !playing && (
                  <p className={`${th.ghost} text-sm text-center pt-8`}>▶ 再生してください</p>
                )}
                {logs.map(log => (
                  <p key={log.id} className={`text-sm leading-relaxed whitespace-pre-line ${log.color}`}>
                    {log.text}
                  </p>
                ))}
                {playing && (
                  <p className={`${th.faint} text-xs animate-pulse`}>▌</p>
                )}
                <div ref={logEndRef} />
              </div>

              {/* フッターボタン */}
              <div className={`px-4 pb-4 pt-2 border-t ${th.divider} shrink-0 space-y-2`}>
                {!playing && phase === "waiting" && hasData && (
                  <button
                    onClick={handlePlay}
                    className="w-full py-3 rounded-xl font-black text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 transition"
                  >
                    ⚔️ 再生スタート
                  </button>
                )}
                {!playing && phase === "result" && hasData && (
                  <button
                    onClick={handleReplay}
                    className={`w-full py-3 rounded-xl font-bold text-sm ${th.closeBtn} transition`}
                  >
                    🔄 もう一度見る
                  </button>
                )}
                {!hasData && (
                  <p className={`text-center ${th.faint} text-xs py-2`}>バトルデータがありません</p>
                )}
                <button
                  onClick={() => setShowBattleLogModal(false)}
                  className={`w-full py-2 rounded-xl text-xs ${th.faint} hover:opacity-70 transition`}
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/mini-games" className={`${th.back} text-sm`}>← Arcade</Link>
        <h1 className="font-bold text-lg">⚔️ Rumble League</h1>
        <div className="flex items-center gap-2">
          {bpBalance !== null && (
            <span className="text-xs font-bold text-yellow-400">{bpBalance.toLocaleString()}BP</span>
          )}
          <button onClick={() => setShowHelp(true)} className={`${th.faint} text-lg w-8 h-8 rounded-full ${th.card} flex items-center justify-center`}>?</button>
        </div>
      </div>

      {/* 表示名バッジ */}
      <div className="flex justify-center mb-4">
        <button onClick={() => setShowNameModal(true)} className={`flex items-center gap-2 ${th.card} border ${th.cardBorder} rounded-full px-4 py-1.5 text-xs ${th.muted} hover:opacity-80 transition`}>
          <span>👤</span>
          <span>{displayName || "表示名を設定"}</span>
          <span className={th.ghost}>✏️</span>
        </button>
      </div>

      {/* タブ */}
      <div className={`flex gap-1 mb-6 ${th.card} rounded-xl p-1`}>
        {TAB_LIST.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition relative ${tab === t ? "bg-purple-600 text-white" : th.faint}`}>
            {t === "観戦" && spectatorPhase === "live" ? (
              <span className="flex items-center justify-center gap-1">
                観戦
                <span className="inline-flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
                  <span className="text-[9px] text-pink-400 font-black">LIVE</span>
                </span>
              </span>
            ) : t === "観戦" && spectatorPhase === "result" ? (
              <span className="flex items-center justify-center gap-1">
                観戦
                <span className="text-[9px] text-yellow-400 font-black">RESULT</span>
              </span>
            ) : t}
          </button>
        ))}
      </div>

      {/* バトルタブ */}
      {tab === "バトル" && (
        <div className="space-y-4">
          {/* 週間RP */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`${th.card} rounded-xl p-4 text-center`}>
              <p className={`text-xs ${th.faint} mb-1`}>今週のRP</p>
              <p className="text-2xl font-black text-purple-400">{status?.week_rp ?? 0}</p>
            </div>
            <div className={`${th.card} rounded-xl p-4 text-center`}>
              <p className={`text-xs ${th.faint} mb-1`}>今日のスコア</p>
              <p className="text-2xl font-black text-white">
                {isAfter1850Jst ? (status?.today_score ?? "-") : (status?.entered_today || localEnteredToday ? "🔒" : "-")}
              </p>
              {!isAfter1850Jst && (status?.entered_today || localEnteredToday) && (
                <p className={`text-[10px] ${th.faint} mt-1`}>18:50に公開</p>
              )}
            </div>
          </div>

          {/* カウントダウン */}
          <div className={`${th.card} rounded-xl p-3 text-center`}>
            <p className={`text-xs ${th.faint}`}>次のバトルまで</p>
            <p className="text-2xl font-black text-purple-400 font-mono">{countdown}</p>
          </div>

          {/* 報酬帯 */}
          <div className={`${th.card} rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs font-bold ${th.muted}`}>🏆 週次報酬</p>
              {isFriAfter1850Jst
                ? <span className="text-[10px] font-black text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">✅ 確定</span>
                : <span className={`text-[10px] font-bold ${th.faint} ${th.card} px-2 py-0.5 rounded-full`}>📊 予測</span>
              }
            </div>
            {(() => {
              const n = weekParticipantCount;
              const tiers = n <= 2
                ? [{ label: "🥇 1位", ep: 400 }, { label: "🥈 2位", ep: 300 }]
                : n <= 4
                ? [{ label: "🥇 1位", ep: 350 }, { label: "🥈 2位", ep: 230 }, { label: "🥉 3位", ep: 120 }]
                : n <= 9
                ? [{ label: "🥇 1位", ep: 300 }, { label: "🥈 2位", ep: 200 }, { label: "🥉 3位", ep: 120 }, { label: "4〜5位", ep: 40 }]
                : [{ label: "🥇 1位", ep: 280 }, { label: "🥈 2位", ep: 190 }, { label: "🥉 3位", ep: 120 }, { label: "4〜5位", ep: 45 }, { label: "6〜10位", ep: 4 }];
              return tiers.map(r => (
                <div key={r.label} className="flex justify-between text-xs py-1">
                  <span className={th.muted}>{r.label}</span>
                  <span className={`font-bold ${isFriAfter1850Jst ? "text-yellow-400" : "text-yellow-400/50"}`}>
                    {r.ep.toLocaleString()} EP
                  </span>
                </div>
              ));
            })()}
            <p className={`text-[10px] ${th.ghost} mt-2 pt-2 border-t ${th.divider}`}>
              {isFriAfter1850Jst
                ? `今週の参加: ${weekParticipantCount}人`
                : `現在 ${weekParticipantCount}人参加中 / 金曜18:50に確定`
              }
            </p>
          </div>

          {/* 参加ボタン */}
          <div className={`${th.card} border ${th.cardBorder} rounded-2xl p-6 text-center`}>
            <p className={`text-sm ${th.muted} mb-2`}>参加費：100BP / 日</p>
            <p className={`text-xs ${th.faint} mb-4`}>月〜金 毎日19:00 JST</p>
            {(localEnteredToday || status?.entered_today) ? (
              <div>
                <div className="text-4xl mb-2">✅</div>
                <p className="font-bold text-green-400">本日参加済み</p>
                {isAfter1850Jst ? (
                  <p className={`text-sm ${th.faint} mt-1`}>スコア: {status?.today_score ?? "—"} / RP: {status?.today_rp ?? "—"}</p>
                ) : (
                  <p className={`text-sm ${th.faint} mt-1`}>🔒 スコアは18:50に公開されます</p>
                )}
              </div>
            ) : isAfter1850Jst ? (
              <div>
                <div className="text-4xl mb-2">⏳</div>
                <p className={`font-bold ${th.muted}`}>バトル準備中</p>
                <p className={`text-xs ${th.faint} mt-1`}>18:50 で参加締め切り済みです</p>
              </div>
            ) : (
              <button onClick={handleEntry} disabled={busy || !status}
                className={`w-full py-4 rounded-xl font-black text-lg transition ${(busy || !status) ? `${th.closeBtn} cursor-not-allowed` : "bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105"}`}>
                {busy ? "参加中..." : !status ? "確認中..." : "⚔️ バトル参加！"}
              </button>
            )}
          </div>

          {msg && (
            <div className={`rounded-xl p-3 text-sm text-center ${msg.includes("🎉") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {msg}
            </div>
          )}

          {/* ルール説明 */}
          <div className={`${th.card} rounded-xl p-4 text-xs ${th.faint} space-y-1`}>
            <p>• スコア = 100 + レベルボーナス + 装備ボーナス + 乱数（0〜50）</p>
            <p>• 月〜金の累計RPで週次ランキング決定</p>
            <p>• 金曜終了後にランキングリセット</p>
          </div>
        </div>
      )}

      {/* ランキングタブ */}
      {tab === "ランキング" && (
        <div className="space-y-3">
          {/* 自分の順位カード */}
          {rankContext && !rankContext.not_entered && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-2xl text-purple-400">{rankContext.my_rank}位</span>
                <span className="text-white font-bold">{Number(Number(rankContext.my_rp).toFixed(2))} RP</span>
              </div>
              <p className={`text-xs ${th.muted} mb-3`}>現在の報酬帯: <span className="text-yellow-400">{rankContext.current_tier?.label}{isFriAfter1850Jst ? ` (${rankContext.current_tier?.ep?.toLocaleString()}EP)` : " (🔒)"}</span></p>
              {rankContext.next_better_tier && (
                <p className="text-xs text-green-400">▲ {rankContext.next_better_tier.label}まであと {Number(Number(rankContext.next_better_tier.rp_needed).toFixed(2))} RP</p>
              )}
              {rankContext.next_worse_tier && (
                <p className="text-xs text-red-400/70">▼ {rankContext.next_worse_tier.label}まで余裕 {Number(Number(rankContext.next_worse_tier.rp_buffer).toFixed(2))} RP</p>
              )}
              {rankContext.surrounding && (
                <div className="mt-3 space-y-1">
                  {rankContext.surrounding.map((r: any) => (
                    <div key={r.rank} className={`flex justify-between text-xs py-1 px-2 rounded ${r.is_me ? "bg-purple-500/20 text-white font-bold" : th.faint}`}>
                      <span>{r.rank}位 {r.is_me ? "👤 " : ""}{r.display_name || r.user_id}</span>
                      <span>{Number(Number(r.total_rp).toFixed(2))} RP</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <p className={`text-xs ${th.faint}`}>週間累計RPランキング</p>
            <button onClick={() => setShowRankHelp(true)} className={`${th.faint} text-xs`}>？ 見方</button>
          </div>
          {ranking.length === 0 ? (
            <p className={`text-center ${th.faint} text-sm py-8`}>まだ参加者がいません</p>
          ) : ranking.map((r, i) => (
            <div key={r.user_id} className={`flex items-center justify-between p-3 rounded-xl ${r.user_id === userId ? "bg-purple-500/20 border border-purple-500/30" : th.card}`}>
              <div className="flex items-center gap-3">
                <span className={`text-lg font-black ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : th.faint}`}>
                  {i + 1}
                </span>
                <span className="text-sm">{r.user_id === userId ? "👤 " + (r.display_name || r.user_id) : (r.display_name || r.user_id)}</span>
              </div>
              <span className="font-bold text-purple-400">{r.total_rp} RP</span>
            </div>
          ))}
        </div>
      )}

      {/* 装備タブ */}
      {tab === "装備" && (
        <div className="space-y-3">
          {/* シャード残高 */}
          <div className={`${th.card} rounded-xl p-3 flex items-center justify-between`}>
            <span className={`text-sm ${th.muted}`}>⚙️ 力のかけら</span>
            <span className="font-bold text-orange-400">{shards}</span>
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className={`text-xs ${th.faint}`}>装備してスコアを強化しよう</p>
            <button onClick={() => setShowEquipHelp(true)} className={`${th.faint} text-xs`}>？ 装備とは</button>
          </div>
          {msg && (
            <div className={`rounded-xl p-3 text-sm text-center ${(msg.includes("🔒") || msg.includes("🔓") || msg.includes("🔨")) ? "bg-amber-500/10 text-amber-300" : "bg-red-500/10 text-red-400"}`}>
              {msg}
            </div>
          )}
          {["head","body","hand","leg"].map(slot => {
            const slotItems = equipment.filter(e => e.slot === slot);
            return (
              <div key={slot} className={`${th.card} rounded-xl p-4`}>
                <p className={`text-xs ${th.faint} mb-2`}>
                  {slot === "head" ? "🪖 頭" : slot === "body" ? "🛡️ 胴" : slot === "hand" ? "🧤 手" : "👢 足"}
                </p>
                <div className="space-y-2">
                  {slotItems.map(item => (
                    <div key={item.id} className={`p-3 rounded-lg border ${item.equipped ? "border-green-500/60 bg-green-500/5 shadow-[0_0_8px_rgba(34,197,94,0.15)]" : `${RARITY_BG[item.rarity]} bg-white/3`}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${RARITY_COLOR[item.rarity]}`}>
                          {item.name}{(item.enhance_level ?? 0) > 0 ? ` [+${item.enhance_level}]` : ""} (+{item.bonus})
                        </span>
                        <span className="flex items-center gap-1">
                          {item.locked && (
                            <span className="text-[9px] font-black text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded-full">🔒 ロック中</span>
                          )}
                          {item.equipped && (
                            <span className="text-[9px] font-black text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded-full">✓ 装備中</span>
                          )}
                        </span>
                      </div>
                      {((item.luck ?? 0) > 0 || (item.stability ?? 0) > 0) && (
                        <div className={`flex gap-3 text-xs ${th.faint} mb-2`}>
                          {(item.luck ?? 0) > 0 && <span>🍀 運 {item.luck}%</span>}
                          {(item.stability ?? 0) > 0 && <span>🛡 安定 {item.stability}%</span>}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => handleEquip(item.id)} disabled={item.equipped || busy}
                          className={`flex-1 text-xs py-1 rounded ${item.equipped ? "bg-green-500/20 text-green-400" : "bg-purple-600 text-white"}`}>
                          {item.equipped ? "装備中" : "装備"}
                        </button>
                        <button onClick={() => handleEnhance(item.id)} disabled={(item.enhance_level ?? 0) >= 10}
                          className="text-xs px-2 py-1 rounded bg-orange-600/80 text-white disabled:opacity-40">
                          強化
                        </button>
                        <button onClick={() => handleToggleLock(item)} disabled={busy}
                          title={item.locked ? "ロック解除" : "ロック（分解・自動変換から保護）"}
                          className={`text-xs px-2 py-1 rounded ${item.locked ? "bg-amber-500/30 text-amber-300" : th.closeBtn}`}>
                          {item.locked ? "🔒" : "🔓"}
                        </button>
                        <button onClick={() => handleDismantle(item.id)} disabled={item.equipped || item.locked || busy}
                          className={`text-xs px-2 py-1 rounded ${th.closeBtn} disabled:opacity-40`}>
                          分解
                        </button>
                      </div>
                    </div>
                  ))}
                  {slotItems.length === 0 && <p className={`text-xs ${th.ghost}`}>なし（ガチャで入手）</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ガチャタブ */}
      {tab === "ガチャ" && (
        <div className="space-y-4">
          <div className={`${th.card} border ${th.cardBorder} rounded-2xl p-6 text-center`}>
            <p className="text-4xl mb-3">🎲</p>
            <p className="font-bold text-lg mb-1">装備ガチャ</p>
            <p className={`text-sm ${th.faint} mb-4`}>100BP / 1回</p>
            <button onClick={handleGacha} disabled={busy}
              className={`w-full py-4 rounded-xl font-black text-lg transition ${busy ? th.closeBtn : "bg-gradient-to-r from-yellow-600 to-orange-600 hover:scale-105"}`}>
              {busy ? "抽選中..." : "🎲 ガチャを引く！"}
            </button>
          </div>

          {gachaResult && (
            <div className={`${th.card} border-2 ${RARITY_BG[gachaResult.item.rarity]} rounded-2xl p-6 text-center`}>
              <p className={`text-xs font-bold uppercase mb-1 ${RARITY_COLOR[gachaResult.item.rarity]}`}>{gachaResult.item.rarity}</p>
              <p className="text-2xl font-black mb-1">{gachaResult.item.name}</p>
              <p className={`text-sm ${th.muted}`}>
                {(() => { const s = normalizeSlot(gachaResult.item.slot); return s === "head" ? "頭" : s === "body" ? "胴" : s === "hand" ? "手" : "足"; })()} / +{gachaResult.item.bonus}ボーナス
              </p>
              {(gachaResult.auto_discarded ?? 0) > 0 && (
                <p className="mt-2 text-xs text-orange-400/80">
                  ⚠️ 上限超過のため古い装備{gachaResult.auto_discarded}個を分解しました（+{gachaResult.auto_shard_gained} 力のかけら）
                </p>
              )}
            </div>
          )}

          {msg && <div className="bg-red-500/10 text-red-400 rounded-xl p-3 text-sm text-center">{msg}</div>}

          {/* 注意書き */}
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3">
            <p className="text-xs text-orange-300/80 font-bold mb-1">⚠️ ストック上限について</p>
            <p className={`text-xs ${th.faint}`}>各部位（頭・胴・手・足）につき10個まで保持できます。超えた場合、最も古い未装備・未ロックの装備が自動的に力のかけらに変換されます。</p>
          </div>

          {/* 排出率 */}
          <div className={`${th.card} rounded-xl p-4`}>
            <p className={`text-xs font-bold ${th.muted} mb-2`}>排出率</p>
            {[
              { rarity: "Common",    prob: "80%",      color: "text-gray-400" },
              { rarity: "Rare",      prob: "15%",      color: "text-blue-400" },
              { rarity: "Epic",      prob: "4%",       color: "text-purple-400" },
              { rarity: "Legendary", prob: "0.9995%",  color: "text-yellow-400" },
              { rarity: "Mythic",    prob: "0.0005%",  color: "text-red-400" },
            ].map(r => (
              <div key={r.rarity} className="flex justify-between text-xs py-1">
                <span className={r.color}>{r.rarity}</span>
                <span className={th.faint}>{r.prob}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 観戦タブ */}
      {tab === "観戦" && (
        <div className="space-y-4">

          {/* テスト用：モックデータ読み込み（使うときはコメントアウトを外す）
          {process.env.NODE_ENV !== "production" && (
            <button
              onClick={async () => {
                const d: SpectatorData = await fetch(`/api/minigames/rumble/spectator?userId=${encodeURIComponent(userId)}&mock=1`).then(r => r.json());
                if (d.ok) {
                  setSpectatorData(d);
                  setSpectatorPlayers(d.players.map(p => ({ ...p, status: "alive" as const })));
                  setSpectatorPhase("waiting");
                  setBattleLogs([]);
                  setDailyResult({ ok: true, status: "ready", date: d.date ?? "", participant_count: d.players.length, winnerCount: 1, isToday: true });
                }
              }}
              className="w-full py-2 rounded-xl text-xs text-white/30 border border-white/10 hover:bg-white/5 transition"
            >
              🧪 テストデータで確認
            </button>
          )}
          */}

          {/* ローディング */}
          {(spectatorLoading || dailyResultLoading) && (
            <div className={`text-center ${th.faint} text-sm py-12`}>読み込み中...</div>
          )}

          {/* 抽選前（pending）：参加者一覧 */}
          {!spectatorLoading && !dailyResultLoading && dailyResult?.status === "pending" && (
            <div className="space-y-4">
              <div className={`${th.card} border ${th.cardBorder} rounded-2xl p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-xs font-bold ${th.muted}`}>本日の参加者</p>
                  <p className={`text-xs ${th.faint}`}>{dailyResult.participant_count}人</p>
                </div>
                {dailyResult.participant_count === 0 ? (
                  <p className={`${th.faint} text-sm text-center py-4`}>まだ参加者がいません</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(dailyResult.participants ?? []).map(p => (
                      <span
                        key={p.user_id}
                        className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          p.user_id === userId
                            ? "bg-gradient-to-r from-purple-600/40 to-blue-600/40 text-white border border-purple-500/50"
                            : `${th.card} ${th.muted}`
                        }`}
                      >
                        {p.display_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className={`${th.card} rounded-2xl p-4 text-center`}>
                <p className={`text-xs ${th.faint}`}>⏰ バトル実行後に下の「最新を取得」を押してください</p>
                <div className="mt-2">
                  <p className={`text-xs ${th.faint} mb-1`}>次のバトルまで</p>
                  <p className="text-2xl font-black text-purple-400 font-mono">{countdown}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setDailyResult(null);
                  setDailyResultLoading(true);
                  fetch("/api/minigames/rumble/daily-result")
                    .then(r => r.json())
                    .then((d: DailyResultData) => { if (d.ok) setDailyResult(d); })
                    .catch(() => {})
                    .finally(() => setDailyResultLoading(false));
                }}
                disabled={dailyResultLoading}
                className="w-full py-3 rounded-xl font-bold text-sm bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 transition text-purple-300 disabled:opacity-40"
              >
                {dailyResultLoading ? "取得中..." : "🔃 最新を取得（バトル後にタップ）"}
              </button>
              {/* バトルログ再生ボタン（pending状態：前回バトル） */}
              <button
                onClick={() => {
                  setBattleLogModalMode("prev");
                  setShowBattleLogModal(true);
                }}
                disabled={prevLoading || !prevSpectatorData || prevSpectatorData.status !== "ready"}
                className="w-full py-3 rounded-xl font-bold text-sm bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/20 transition text-purple-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {prevLoading ? "読み込み中..." : "⚔️ バトルログを再生"}
              </button>

              {/* 前回バトル当選者（観戦データ不要、すぐ表示） */}
              {!prevLoading && prevDailyResult?.winners && prevDailyResult.winners.length > 0 && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 mt-2">
                  <p className="text-xs font-bold text-yellow-400/60 mb-3 text-center">
                    🎰 前回({prevBattleDate})のBP抽選結果
                  </p>
                  <div className="space-y-1">
                    {prevDailyResult.winners.map(w => (
                      <div key={w.rank} className="flex justify-between text-xs px-2 py-1">
                        <span className={`${th.muted} ${w.user_id === userId ? "text-purple-300 font-bold" : ""}`}>
                          {w.rank}位 {w.display_name}
                        </span>
                        <span className="text-yellow-400">+{w.bp_amount.toLocaleString()} BP</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 抽選後（ready）：バトル演出 + 当選者発表 */}
          {!spectatorLoading && !dailyResultLoading && dailyResult?.status === "ready" && (
            <>
              {/* 観戦ステータスカード */}
              <div className={`${th.card} border ${th.cardBorder} rounded-2xl p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {spectatorPhase === "live" ? (
                      <span className="flex items-center gap-1 text-xs font-black text-pink-400">
                        <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
                        観戦中
                      </span>
                    ) : spectatorPhase === "result" ? (
                      <span className="text-xs font-black text-yellow-400">🏆 結果確定</span>
                    ) : spectatorData?.status === "no_data" ? (
                      <span className="text-xs text-red-400/70">バトルデータが見つかりません</span>
                    ) : spectatorLoading ? (
                      <span className={`text-xs ${th.faint}`}>取得中…</span>
                    ) : (
                      <span className={`text-xs ${th.faint}`}>観戦データを読み込み中…</span>
                    )}
                  </div>
                  <span className={`text-xs ${th.faint}`}>参加者 {dailyResult.participant_count}人</span>
                </div>
                {spectatorData?.status === "ready" && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className={`text-xs ${th.faint}`}>生存中</p>
                      <p className="text-xl font-black text-purple-400">
                        {spectatorPlayers.filter(p => p.status !== "eliminated").length}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs ${th.faint}`}>脱落</p>
                      <p className="text-xl font-black text-red-400/70">
                        {spectatorPlayers.filter(p => p.status === "eliminated").length}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs ${th.faint}`}>あなた</p>
                      <p className={`text-sm font-black ${
                        spectatorData.self
                          ? spectatorPlayers.find(p => p.is_self)?.status === "eliminated"
                            ? "text-red-400"
                            : "text-green-400"
                          : th.faint
                      }`}>
                        {spectatorData.self
                          ? spectatorPlayers.find(p => p.is_self)?.status === "eliminated"
                            ? "脱落"
                            : "生存中"
                          : "未参加"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* アクションボタン群 */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setBattleLogModalMode("today");
                    setShowBattleLogModal(true);
                    // まだ未再生なら自動でplay開始
                    if (!isPlaying && spectatorPhase === "waiting" && spectatorData?.status === "ready") {
                      handleSpectatorPlay();
                    }
                  }}
                  disabled={spectatorData?.status !== "ready"}
                  className="w-full py-4 rounded-xl font-black text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  ⚔️ バトルログを再生
                </button>
                <button
                  onClick={handleSpectatorRefresh}
                  disabled={spectatorLoading}
                  className={`w-full py-2 rounded-xl font-bold text-xs ${th.card} hover:opacity-80 transition ${th.muted} disabled:opacity-40`}
                >
                  {spectatorLoading ? "取得中..." : "🔃 最新を取得"}
                </button>
              </div>

              {/* 生存者一覧カード */}
              {spectatorData?.status === "ready" && (
                <div className={`${th.card} rounded-2xl p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-xs font-bold ${th.muted}`}>生存者</p>
                    <p className={`text-xs ${th.faint}`}>
                      {spectatorPlayers.filter(p => p.status !== "eliminated").length} / {dailyResult.participant_count}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {spectatorPlayers.map(p => (
                      <span
                        key={p.id}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all duration-500 ${
                          p.is_self
                            ? p.status === "eliminated"
                              ? "bg-red-900/40 text-red-400/60 line-through border border-red-500/20"
                              : "bg-gradient-to-r from-purple-600/40 to-blue-600/40 text-white border border-purple-500/50"
                            : p.status === "eliminated"
                              ? `${th.ghost} line-through`
                              : p.rank <= 10
                                ? "bg-yellow-500/10 text-yellow-400/80 border border-yellow-500/20"
                                : `${th.card} ${th.muted}`
                        }`}
                      >
                        {p.display_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 日次BP当選者発表（バトル演出後に表示） */}
              {showWinners && dailyResult.winners && dailyResult.winners.length > 0 && (
                <div className="bg-gradient-to-b from-yellow-500/10 to-transparent border border-yellow-500/30 rounded-2xl p-5">
                  <p className="text-xs font-bold text-yellow-400/80 mb-4 tracking-widest text-center">🎰 日次BP抽選結果</p>
                  <div className="space-y-2">
                    {dailyResult.winners.map(w => (
                      <div
                        key={w.rank}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl ${
                          w.rank === 1 ? "bg-yellow-500/20 border border-yellow-500/40" :
                          w.rank === 2 ? "bg-slate-400/10 border border-slate-400/30" :
                          w.rank === 3 ? "bg-amber-700/10 border border-amber-700/30" :
                          th.card
                        }`}
                      >
                        <span className={`text-sm font-bold ${th.muted}`}>
                          {w.rank === 1 ? "🏆" : w.rank === 2 ? "🥈" : w.rank === 3 ? "🥉" : `${w.rank}位`}{" "}
                          <span className={w.user_id === userId ? "text-purple-300" : ""}>{w.display_name}</span>
                        </span>
                        <span className="text-sm font-black text-yellow-400">+{w.bp_amount.toLocaleString()} BP</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 今週のランキング簡易 */}
              {spectatorData?.ranking && spectatorData.ranking.length > 0 && (
                <div className={`${th.card} rounded-2xl p-4`}>
                  <p className={`text-xs font-bold ${th.muted} mb-3`}>📊 今週ランキング TOP5</p>
                  <div className="space-y-1">
                    {spectatorData.ranking.map((r, i) => (
                      <div key={r.user_id} className={`flex justify-between text-xs py-1 px-2 rounded ${r.user_id === userId ? "bg-purple-500/20 text-white font-bold" : th.muted}`}>
                        <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}位`} {r.display_name}</span>
                        <span className="text-purple-400">{r.total_rp} RP</span>
                      </div>
                    ))}
                    {spectatorData.self && (spectatorData.self.week_rank ?? 0) > 5 && (
                      <div className={`flex justify-between text-xs py-1 px-2 rounded bg-purple-500/20 text-white font-bold mt-2 border-t ${th.divider} pt-2`}>
                        <span>👤 {spectatorData.self.week_rank}位 {spectatorData.self.display_name}</span>
                        <span className="text-purple-400">{spectatorData.self.week_rp} RP</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

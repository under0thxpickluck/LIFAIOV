"use client";

import { useEffect, useMemo, useState } from "react";

// ─── 型定義 ───────────────────────────────────────────────
type SellRequest = {
  request_id: string;
  user_id: string;
  seller_id?: string;
  user_name?: string;
  item_id: string;
  item_title?: string;
  requested_at: string;
  status?: string;
};

type MusicSellRequest = {
  request_id: string;
  login_id: string;
  title: string;
  music_url: string;
  price_usdt: string;
  memo: string;
  status: string;
  created_at: string;
};

type ApplyRow = {
  created_at?: string;
  plan?: string | number;
  email?: string;
  name?: string;
  name_kana?: string;
  ref_name?: string;
  ref_id?: string | number;
  region?: string;
  status?: string;
  rowIndex?: number;
  [k: string]: any;
};

type MemberRow = {
  login_id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  created_at: string;
  bp_balance: number;
  ep_balance: number;
  login_streak: number;
  total_login_count: number;
  subscription_plan: string;
  last_login_at: string;
  music_boost_plan?: string | null;
  music_boost_expires_at?: string | null;
  music_boost_artist?: string | null;
  music_boost_album?: string | null;
};

type Summary = {
  total_members: number;
  pending_count: number;
  total_bp_issued: number;
  total_ep_issued: number;
};

type StakingSummary = {
  active_count: number;
  total_staked_bp: number;
  claimable_count: number;
};

type GachaSummary = {
  total_spins: number;
  total_cost_bp: number;
  total_prize_bp: number;
};

type RadioSummary = {
  total_submissions: number;
  total_ep_granted: number;
};

type DashboardData = {
  summary: Summary;
  staking_summary: StakingSummary;
  gacha_summary: GachaSummary;
  radio_summary: RadioSummary;
};

type MusicReviewJob = {
  jobId: string;
  userId?: string;
  status: string;
  audioUrl?: string;
  displayLyrics?: string;
  distributionLyrics?: string;
  masterLyrics?: string;
  singableLyrics?: string;
  asrLyrics?: string;
  mergedLyrics?: string;
  lyricsQualityScore?: number | null;
  repeatScore?: number | null;
  lyricsGateResult?: "pass" | "review" | "reject" | null;
  repeatDetected?: boolean | null;
  anchorWordsJson?: string | null;
  hookLinesJson?: string | null;
  repeatSegmentsJson?: string | null;
  generationAttempt?: number;
  regenerationReason?: string | null;
  prompt?: { theme?: string; genre?: string; mood?: string };
  structureData?: { title?: string };
};

// ─── ユーティリティ ────────────────────────────────────────
function clsx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function formatDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh  = String(d.getHours()).padStart(2, "0");
  const mm  = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

// ─── サブコンポーネント ────────────────────────────────────
function SummaryCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-zinc-900 p-4">
      <p className="mb-1 text-sm text-zinc-400">{icon} {label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className={clsx("text-sm font-bold", color ?? "text-white")}>{value}</span>
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-24 animate-pulse rounded-2xl bg-zinc-800" />;
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={clsx("whitespace-nowrap px-3 py-3 text-left text-xs font-bold text-zinc-400", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={clsx("px-3 py-3 align-top text-sm text-zinc-200", className)}>{children}</td>;
}

function SortTh({
  children, sortKey, currentSortKey, currentSortOrder, onSort, className,
}: {
  children: React.ReactNode;
  sortKey: string;
  currentSortKey: string;
  currentSortOrder: "asc" | "desc";
  onSort: (key: string) => void;
  className?: string;
}) {
  const isActive = currentSortKey === sortKey;
  return (
    <th
      className={clsx(
        "whitespace-nowrap px-3 py-3 text-left text-xs font-bold text-zinc-400 cursor-pointer select-none hover:text-zinc-200 transition",
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      {children}
      <span className="ml-1 text-zinc-600">
        {isActive ? (currentSortOrder === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </th>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-6">
      <p className="text-sm font-bold text-zinc-200">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{desc}</p>
    </div>
  );
}

// ─── メインコンポーネント ──────────────────────────────────
export default function AdminPage() {
  // --- 既存: pending 申請 ---
  const [rows,     setRows]     = useState<ApplyRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [busyKey,  setBusyKey]  = useState<string | null>(null);
  const [msg,      setMsg]      = useState<string | null>(null);
  const [err,      setErr]      = useState<string | null>(null);

  // --- 楽曲売却申請 ---
  const [musicSellRequests, setMusicSellRequests] = useState<MusicSellRequest[]>([]);
  const [musicSellLoading,  setMusicSellLoading]  = useState(false);
  const [musicSellErr,      setMusicSellErr]      = useState<string | null>(null);
  const [musicSellMsg,      setMusicSellMsg]      = useState<string | null>(null);
  const [updatingMusicId,   setUpdatingMusicId]   = useState<string | null>(null);
  const [deletingMusicId,   setDeletingMusicId]   = useState<string | null>(null);

  // --- 既存: 売却申請 ---
  const [sellRequests, setSellRequests] = useState<SellRequest[]>([]);
  const [sellLoading,  setSellLoading]  = useState(false);
  const [sellErr,      setSellErr]      = useState<string | null>(null);
  const [sellMsg,      setSellMsg]      = useState<string | null>(null);
  const [grantingId,   setGrantingId]   = useState<string | null>(null);
  const [bpInputs,     setBpInputs]     = useState<Record<string, string>>({});

  // --- 新規: ダッシュボード ---
  const [dashboard,    setDashboard]    = useState<DashboardData | null>(null);
  const [dashLoading,  setDashLoading]  = useState(true);

  // --- 新規: 会員一覧 ---
  const [members,      setMembers]      = useState<MemberRow[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersPage,  setMembersPage]  = useState(0);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersSortKey,   setMembersSortKey]   = useState<string>("created_at");
  const [membersSortOrder, setMembersSortOrder] = useState<"asc" | "desc">("desc");
  const PAGE_SIZE = 20;

  // --- 新規: 音楽レビュー ---
  const [musicReviews,    setMusicReviews]    = useState<MusicReviewJob[]>([]);
  const [musicReviewLoading, setMusicReviewLoading] = useState(false);
  const [musicReviewErr,  setMusicReviewErr]  = useState<string | null>(null);
  const [musicReviewMsg,  setMusicReviewMsg]  = useState<string | null>(null);
  const [musicReviewBusy, setMusicReviewBusy] = useState<string | null>(null);
  const [editLyrics,      setEditLyrics]      = useState<Record<string, string>>({});

  // ── データ取得 ────────────────────────────────────────────
  const load = async () => {
    setErr(null); setMsg(null); setLoading(true);
    try {
      const res  = await fetch("/api/admin/list", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "failed");
      const arr = Array.isArray(json.items) ? json.items : Array.isArray(json.rows) ? json.rows : [];
      setRows(arr);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const loadMusicSellRequests = async () => {
    setMusicSellLoading(true); setMusicSellErr(null);
    try {
      const res  = await fetch("/api/admin/music-sell-requests", { cache: "no-store" });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "failed");
      setMusicSellRequests(Array.isArray(json.requests) ? json.requests : []);
    } catch (e: any) {
      setMusicSellErr(String(e?.message ?? e));
    } finally {
      setMusicSellLoading(false);
    }
  };

  const handleMusicSellUpdate = async (requestId: string, status: "approved" | "rejected") => {
    setUpdatingMusicId(requestId); setMusicSellErr(null); setMusicSellMsg(null);
    try {
      const res  = await fetch("/api/admin/music-sell-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "update_failed");
      setMusicSellMsg(status === "approved" ? "✅ 承認しました" : "❌ 却下しました");
      await loadMusicSellRequests();
    } catch (e: any) {
      setMusicSellErr(String(e?.message ?? e));
    } finally {
      setUpdatingMusicId(null);
    }
  };

  const handleMusicSellDelete = async (requestId: string) => {
    setDeletingMusicId(requestId); setMusicSellErr(null); setMusicSellMsg(null);
    try {
      const res  = await fetch("/api/admin/music-sell-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "delete_failed");
      setMusicSellMsg("🗑 削除しました");
      await loadMusicSellRequests();
    } catch (e: any) {
      setMusicSellErr(String(e?.message ?? e));
    } finally {
      setDeletingMusicId(null);
    }
  };

  const loadSellRequests = async () => {
    setSellLoading(true); setSellErr(null);
    try {
      const res  = await fetch("/api/admin/sell-requests", { cache: "no-store" });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "failed");
      const arr = Array.isArray(json.items) ? json.items : Array.isArray(json.requests) ? json.requests : [];
      setSellRequests(arr);
    } catch (e: any) {
      setSellErr(String(e?.message ?? e));
    } finally {
      setSellLoading(false);
    }
  };

  const loadDashboard = async () => {
    setDashLoading(true);
    try {
      const res  = await fetch("/api/admin/dashboard", { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (json?.ok) setDashboard(json as DashboardData);
    } catch {
      // サイレント失敗
    } finally {
      setDashLoading(false);
    }
  };

  const loadMembers = async (page = 0, sortKey = membersSortKey, sortOrder = membersSortOrder) => {
    setMembersLoading(true);
    try {
      const res  = await fetch(
        `/api/admin/members?page=${page}&pageSize=${PAGE_SIZE}&sortKey=${encodeURIComponent(sortKey)}&sortOrder=${encodeURIComponent(sortOrder)}`,
        { credentials: "include", cache: "no-store" }
      );
      const json = await res.json();
      if (json?.ok) {
        setMembers(json.members ?? []);
        setMembersTotal(json.total ?? 0);
        setMembersPage(page);
      }
    } catch {
      // サイレント失敗
    } finally {
      setMembersLoading(false);
    }
  };

  const handleMembersSort = (key: string) => {
    const nextOrder = membersSortKey === key && membersSortOrder === "desc" ? "asc" : "desc";
    setMembersSortKey(key);
    setMembersSortOrder(nextOrder);
    loadMembers(0, key, nextOrder);
  };

  const loadMusicReviews = async () => {
    setMusicReviewLoading(true); setMusicReviewErr(null);
    try {
      const res  = await fetch("/api/admin/music-review", { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "failed");
      setMusicReviews(Array.isArray(json.jobs) ? json.jobs : []);
    } catch (e: any) {
      setMusicReviewErr(String(e?.message ?? e));
    } finally {
      setMusicReviewLoading(false);
    }
  };

  const handleMusicReview = async (jobId: string, action: "confirm_distribution" | "reject_distribution" | "update_lyrics") => {
    setMusicReviewBusy(jobId); setMusicReviewMsg(null); setMusicReviewErr(null);
    try {
      const body: Record<string, unknown> = { jobId, action };
      if (action === "update_lyrics") {
        body.displayLyrics      = editLyrics[`display_${jobId}`] ?? undefined;
        body.distributionLyrics = editLyrics[`distribution_${jobId}`] ?? undefined;
      }
      const res  = await fetch("/api/admin/music-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "failed");
      setMusicReviewMsg(`完了: ${jobId} → ${action}`);
      await loadMusicReviews();
    } catch (e: any) {
      setMusicReviewErr(String(e?.message ?? e));
    } finally {
      setMusicReviewBusy(null);
    }
  };

  useEffect(() => {
    load();
    loadMusicSellRequests();
    loadSellRequests();
    loadDashboard();
    loadMembers(0);
    loadMusicReviews();
  }, []);

  // ── pending 一覧 ──────────────────────────────────────────
  const pendingRows = useMemo(
    () => rows.filter((r) => {
      const st = String(r.status ?? "pending");
      return st === "pending" || st === "paid" || st === "pending_payment";
    }),
    [rows]
  );

  const approve = async (row: ApplyRow) => {
    setErr(null); setMsg(null);
    const key = `${row.email ?? ""}_${row.created_at ?? ""}`;
    setBusyKey(key);
    try {
      const rowIndex = Number(row.rowIndex || 0);
      if (!rowIndex || rowIndex < 2) throw new Error("rowIndex_missing");
      const res  = await fetch("/api/admin/approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "approve_failed");
      const loginId      = String(json?.loginId || "");
      const tempPassword = String(json?.tempPassword || "");
      const code         = String(json?.oneTimeCode || json?.code || "");
      if (loginId && tempPassword) {
        const payload = `ID: ${loginId}\nPW: ${tempPassword}`;
        await copyToClipboard(payload);
        setMsg(`承認しました。ワンタイムコードをコピーしました：${payload}`);
      } else if (code) {
        await copyToClipboard(code);
        setMsg(`承認しました。ワンタイムコードをコピーしました：${code}`);
      } else {
        setMsg("承認しました。");
      }
      await load();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusyKey(null);
    }
  };

  // ── Rumble: 強制バトル参加 ────────────────────────────────
  const handleForceEntry = async () => {
    if (!forceEntryUserId.trim() || forceEntryBusy) return;
    setForceEntryBusy(true); setForceEntryMsg(null);
    try {
      const res  = await fetch("/api/minigames/rumble/force-entry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: forceEntryUserId.trim() }),
      });
      const json = await res.json();
      if (json?.ok) setForceEntryMsg(`完了：スコア ${json.score} / RP ${json.rp} (${json.week_id})`);
      else setForceEntryMsg(`エラー：${json?.error ?? "unknown"}`);
    } catch (e: any) {
      setForceEntryMsg(`エラー：${e?.message}`);
    } finally {
      setForceEntryBusy(false);
    }
  };

  // ── Rumble: 今の参加者で即時バトル ──────────────────────
  const handleRunNow = async () => {
    if (runNowBusy) return;
    if (!confirm("現在のエントリー済み参加者のみでバトルを即時開始します。よろしいですか？")) return;
    setRunNowBusy(true); setRunNowMsg(null);
    try {
      const res  = await fetch("/api/admin/rumble-run-now", { method: "POST" });
      const json = await res.json();
      if (json?.ok) setRunNowMsg(`完了：バトル実行 (${json.date ?? json.today ?? ""})`);
      else setRunNowMsg(`エラー：${json?.error ?? "unknown"}`);
    } catch (e: any) {
      setRunNowMsg(`エラー：${e?.message}`);
    } finally {
      setRunNowBusy(false);
    }
  };

  // ── Rumble: 週次報酬配布 ──────────────────────────────────
  const handleRewardDistribute = async () => {
    if (rewardBusy) return;
    if (!confirm("週次報酬を配布しますか？（配布済みユーザーへの二重付与防止機能はありません）")) return;
    setRewardBusy(true); setRewardMsg(null);
    try {
      const body: Record<string, string> = {};
      if (rewardWeekId.trim()) body.weekId = rewardWeekId.trim();
      const res  = await fetch("/api/admin/rumble-reward", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json?.ok) setRewardMsg(`配布完了：${json.distributed}人に付与 (${json.week_id})`);
      else setRewardMsg(`エラー：${json?.error ?? "unknown"}`);
    } catch (e: any) {
      setRewardMsg(`エラー：${e?.message}`);
    } finally {
      setRewardBusy(false);
    }
  };

  // ── BP付与 ────────────────────────────────────────────────
  const handleGrantBp = async (req: SellRequest) => {
    const bp = Number(bpInputs[req.request_id] ?? "");
    if (!bp || bp <= 0) { setSellErr("BP数を正しく入力してください"); return; }
    setSellErr(null); setSellMsg(null); setGrantingId(req.request_id);
    try {
      const res  = await fetch("/api/admin/grant-bp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: req.request_id, user_id: req.seller_id, bp_amount: bp }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "grant_failed");
      setSellMsg(`BP付与完了：${req.user_name || req.user_id} に ${bp}BP`);
      await loadSellRequests();
    } catch (e: any) {
      setSellErr(String(e?.message ?? e));
    } finally {
      setGrantingId(null);
    }
  };

  // --- Rumble管理 ---
  const [forceEntryUserId, setForceEntryUserId] = useState("");
  const [forceEntryBusy,   setForceEntryBusy]   = useState(false);
  const [forceEntryMsg,    setForceEntryMsg]     = useState<string | null>(null);
  const [rewardWeekId,     setRewardWeekId]      = useState("");
  const [rewardBusy,       setRewardBusy]        = useState(false);
  const [rewardMsg,        setRewardMsg]         = useState<string | null>(null);
  const [runNowBusy,       setRunNowBusy]       = useState(false);
  const [runNowMsg,        setRunNowMsg]         = useState<string | null>(null);

  // ── ページネーション ──────────────────────────────────────
  const totalPages = Math.ceil(membersTotal / PAGE_SIZE);

  // ─────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-[1200px] px-4 py-8">

        {/* ヘッダー */}
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">LIFAI 管理</h1>
          <button
            onClick={() => { load(); loadMusicSellRequests(); loadSellRequests(); loadDashboard(); loadMembers(membersPage); }}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-600"
          >
            再読み込み
          </button>
        </header>

        {/* 通知 */}
        {msg && <div className="mb-4 rounded-xl bg-emerald-900/50 px-4 py-3 text-sm font-bold text-emerald-300">{msg}</div>}
        {err && <div className="mb-4 rounded-xl bg-red-900/50 px-4 py-3 text-sm font-bold text-red-300">エラー：{err}</div>}

        {/* ═══ セクション1: サマリーカード ═══════════════════════ */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {dashLoading ? (
            <>{[0,1,2,3].map(i => <SkeletonCard key={i} />)}</>
          ) : dashboard ? (
            <>
              <SummaryCard icon="👥" label="会員数"       value={`${dashboard.summary.total_members}人`} />
              <SummaryCard icon="⏳" label="承認待ち"     value={`${dashboard.summary.pending_count}件`} />
              <SummaryCard icon="💎" label="総BP発行量"   value={`${dashboard.summary.total_bp_issued.toLocaleString()} BP`} />
              <SummaryCard icon="⭐" label="総EP発行量"   value={`${dashboard.summary.total_ep_issued.toLocaleString()} EP`} />
            </>
          ) : (
            <p className="col-span-4 text-sm text-zinc-500">ダッシュボードの読み込みに失敗しました</p>
          )}
        </section>

        {/* ═══ セクション2: 機能別統計 ══════════════════════════ */}
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* ガチャ統計 */}
          <div className="rounded-2xl bg-zinc-900 p-4">
            <p className="mb-3 text-base font-semibold text-zinc-200">🎰 ガチャ統計</p>
            {dashLoading ? <div className="h-20 animate-pulse rounded bg-zinc-800" /> : dashboard ? (
              <>
                <StatBlock label="総スピン数"  value={`${dashboard.gacha_summary.total_spins}回`} />
                <StatBlock label="総消費BP"    value={`${dashboard.gacha_summary.total_cost_bp.toLocaleString()} BP`} />
                <StatBlock label="総獲得BP"    value={`${dashboard.gacha_summary.total_prize_bp.toLocaleString()} BP`} />
                <StatBlock
                  label="収支"
                  value={`${dashboard.gacha_summary.total_cost_bp - dashboard.gacha_summary.total_prize_bp >= 0 ? "+" : ""}${(dashboard.gacha_summary.total_cost_bp - dashboard.gacha_summary.total_prize_bp).toLocaleString()} BP`}
                  color={dashboard.gacha_summary.total_cost_bp - dashboard.gacha_summary.total_prize_bp >= 0 ? "text-emerald-400" : "text-red-400"}
                />
              </>
            ) : null}
          </div>

          {/* ステーキング統計 */}
          <div className="rounded-2xl bg-zinc-900 p-4">
            <p className="mb-3 text-base font-semibold text-zinc-200">🔒 ステーキング統計</p>
            {dashLoading ? <div className="h-20 animate-pulse rounded bg-zinc-800" /> : dashboard ? (
              <>
                <StatBlock label="アクティブ数"   value={`${dashboard.staking_summary.active_count}件`} />
                <StatBlock label="ロック中BP"     value={`${dashboard.staking_summary.total_staked_bp.toLocaleString()} BP`} />
                <StatBlock label="受け取り可能"   value={`${dashboard.staking_summary.claimable_count}件`} color="text-amber-400" />
              </>
            ) : null}
          </div>

          {/* RADIO統計 */}
          <div className="rounded-2xl bg-zinc-900 p-4">
            <p className="mb-3 text-base font-semibold text-zinc-200">📻 RADIO統計</p>
            {dashLoading ? <div className="h-20 animate-pulse rounded bg-zinc-800" /> : dashboard ? (
              <>
                <StatBlock label="総申請数"   value={`${dashboard.radio_summary.total_submissions}回`} />
                <StatBlock label="総EP付与"   value={`${dashboard.radio_summary.total_ep_granted.toLocaleString()} EP`} />
              </>
            ) : null}
          </div>
        </section>

        {/* ═══ セクション3: pending承認一覧 ════════════════════ */}
        <section className="mb-6 rounded-2xl bg-zinc-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-lg font-semibold text-zinc-200">⏳ pending 一覧</p>
            <button
              onClick={load}
              disabled={loading}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "読み込み中…" : "更新"}
            </button>
          </div>

          {loading ? (
            <div className="h-20 animate-pulse rounded-xl bg-zinc-800" />
          ) : pendingRows.length === 0 ? (
            <EmptyState title="pending はありません" desc="申請が入るとここに表示されます。" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[800px] text-left">
                <thead className="bg-zinc-800">
                  <tr>
                    <Th>日時</Th><Th>プラン</Th><Th>氏名</Th>
                    <Th>メール</Th><Th>紹介</Th><Th>地域</Th>
                    <Th className="text-right">操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.map((r, i) => {
                    const key  = `${r.email ?? ""}_${r.created_at ?? ""}_${i}`;
                    const busy = busyKey === `${r.email ?? ""}_${r.created_at ?? ""}`;
                    return (
                      <tr key={key} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                        <Td className="whitespace-nowrap">{formatDate(r.created_at)}</Td>
                        <Td className="font-bold">{String(r.plan ?? "")}</Td>
                        <Td>
                          <div className="font-bold">{r.name ?? ""}</div>
                          <div className="text-xs text-zinc-500">{r.name_kana ?? ""}</div>
                        </Td>
                        <Td>
                          <div className="truncate max-w-[200px] text-zinc-200">{r.email ?? ""}</div>
                          <button className="mt-1 text-xs text-amber-400 hover:underline"
                            onClick={async () => { if (!r.email) return; await copyToClipboard(String(r.email)); setMsg("メールをコピーしました"); }}>
                            コピー
                          </button>
                        </Td>
                        <Td>
                          {r.ref_name ? <span className="font-semibold">{r.ref_name}</span> : <span className="text-zinc-600">（なし）</span>}
                          {r.ref_id ? <div className="text-xs text-zinc-500">ID: {r.ref_id}</div> : null}
                        </Td>
                        <Td>{r.region ?? ""}</Td>
                        <Td className="text-right">
                          <button
                            onClick={() => approve(r)}
                            disabled={busy}
                            className={clsx(
                              "rounded-lg px-4 py-2 text-sm font-bold transition",
                              busy ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
                                   : "bg-amber-500 text-black hover:bg-amber-600"
                            )}
                          >
                            {busy ? "処理中…" : "承認して発行"}
                          </button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ═══ セクション4: 楽曲売却申請管理 ══════════════════ */}
        <section className="mb-6 rounded-2xl bg-zinc-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-lg font-semibold text-zinc-200">🎵 楽曲売却申請管理</p>
            <button
              onClick={loadMusicSellRequests}
              disabled={musicSellLoading}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              {musicSellLoading ? "読み込み中…" : "更新"}
            </button>
          </div>

          {musicSellMsg && <div className="mb-3 rounded-xl bg-emerald-900/50 px-4 py-2 text-sm font-bold text-emerald-300">{musicSellMsg}</div>}
          {musicSellErr && <div className="mb-3 rounded-xl bg-red-900/50 px-4 py-2 text-sm font-bold text-red-300">エラー：{musicSellErr}</div>}

          {musicSellLoading ? (
            <div className="h-20 animate-pulse rounded-xl bg-zinc-800" />
          ) : musicSellRequests.length === 0 ? (
            <EmptyState title="申請はありません" desc="楽曲売却申請が入るとここに表示されます。" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-zinc-800">
                  <tr>
                    <Th>申請日時</Th><Th>ユーザー</Th><Th>楽曲タイトル</Th>
                    <Th>URL</Th><Th>希望価格</Th><Th>メモ</Th>
                    <Th>ステータス</Th><Th className="text-right">操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {musicSellRequests.map((req, i) => {
                    const busy = updatingMusicId === req.request_id;
                    const isPending = req.status === "pending";
                    return (
                      <tr key={req.request_id || i} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                        <Td className="whitespace-nowrap">{formatDate(String(req.created_at))}</Td>
                        <Td>{req.login_id}</Td>
                        <Td className="max-w-[160px]"><div className="truncate">{req.title}</div></Td>
                        <Td className="max-w-[140px]">
                          {req.music_url ? (
                            <a href={req.music_url} target="_blank" rel="noopener noreferrer"
                               className="truncate block text-indigo-400 hover:underline text-xs">
                              リンク
                            </a>
                          ) : "—"}
                        </Td>
                        <Td>{req.price_usdt ? `${req.price_usdt} EP` : "—"}</Td>
                        <Td className="max-w-[140px]"><div className="truncate text-xs text-zinc-400">{req.memo || "—"}</div></Td>
                        <Td>
                          <span className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            req.status === "approved" ? "bg-emerald-900/60 text-emerald-300"
                            : req.status === "rejected" ? "bg-zinc-700 text-zinc-400"
                            : "bg-amber-900/60 text-amber-300"
                          ].join(" ")}>
                            {req.status === "approved" ? "承認済" : req.status === "rejected" ? "却下済" : "審査中"}
                          </span>
                        </Td>
                        <Td className="text-right">
                          {isPending && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleMusicSellUpdate(req.request_id, "approved")}
                                disabled={busy}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {busy ? "…" : "承認"}
                              </button>
                              <button
                                onClick={() => handleMusicSellUpdate(req.request_id, "rejected")}
                                disabled={busy}
                                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                              >
                                {busy ? "…" : "却下"}
                              </button>
                            </div>
                          )}
                          {req.status === "approved" && (
                            <button
                              onClick={() => handleMusicSellDelete(req.request_id)}
                              disabled={deletingMusicId === req.request_id}
                              className="rounded-lg border border-red-800 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-900/30 disabled:opacity-50"
                            >
                              {deletingMusicId === req.request_id ? "…" : "🗑 削除"}
                            </button>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ═══ セクション4: 売却申請管理 ═══════════════════════ */}
        <section className="mb-6 rounded-2xl bg-zinc-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-lg font-semibold text-zinc-200">💰 売却申請管理</p>
            <button
              onClick={loadSellRequests}
              disabled={sellLoading}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              {sellLoading ? "読み込み中…" : "更新"}
            </button>
          </div>

          {sellMsg && <div className="mb-3 rounded-xl bg-emerald-900/50 px-4 py-2 text-sm font-bold text-emerald-300">{sellMsg}</div>}
          {sellErr && <div className="mb-3 rounded-xl bg-red-900/50 px-4 py-2 text-sm font-bold text-red-300">エラー：{sellErr}</div>}

          {sellLoading ? (
            <div className="h-20 animate-pulse rounded-xl bg-zinc-800" />
          ) : sellRequests.length === 0 ? (
            <EmptyState title="申請はありません" desc="売却申請が入るとここに表示されます。" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[640px] text-left">
                <thead className="bg-zinc-800">
                  <tr>
                    <Th>申請日時</Th><Th>申請者</Th><Th>アイテム</Th>
                    <Th>ステータス</Th><Th className="text-right">BP付与</Th>
                  </tr>
                </thead>
                <tbody>
                  {sellRequests.map((req, i) => {
                    const busy = grantingId === req.request_id;
                    return (
                      <tr key={req.request_id || i} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                        <Td className="whitespace-nowrap">{formatDate(req.requested_at)}</Td>
                        <Td>
                          <div className="font-bold">{req.user_name || req.user_id}</div>
                          <div className="text-xs text-zinc-500">{req.user_id}</div>
                        </Td>
                        <Td className="max-w-[200px]">
                          <div className="truncate">{req.item_title || req.item_id}</div>
                        </Td>
                        <Td>
                          <span className={clsx(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            req.status === "granted"
                              ? "bg-emerald-900/60 text-emerald-300"
                              : "bg-amber-900/60 text-amber-300"
                          )}>
                            {req.status === "granted" ? "付与済" : "未処理"}
                          </span>
                        </Td>
                        <Td className="text-right">
                          {req.status !== "granted" && (
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="number" min={1} placeholder="BP数"
                                value={bpInputs[req.request_id] ?? ""}
                                onChange={e => setBpInputs(prev => ({ ...prev, [req.request_id]: e.target.value }))}
                                className="w-20 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                              />
                              <button
                                onClick={() => handleGrantBp(req)}
                                disabled={busy}
                                className={clsx(
                                  "rounded-lg px-3 py-1.5 text-sm font-bold transition",
                                  busy ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
                                       : "bg-amber-500 text-black hover:bg-amber-600"
                                )}
                              >
                                {busy ? "処理中…" : "BP付与"}
                              </button>
                            </div>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ═══ セクション5: 会員一覧テーブル ══════════════════ */}
        <section className="rounded-2xl bg-zinc-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-lg font-semibold text-zinc-200">👥 会員一覧</p>
            <button
              onClick={() => loadMembers(membersPage)}
              disabled={membersLoading}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              {membersLoading ? "読み込み中…" : "再読み込み"}
            </button>
          </div>

          {membersLoading ? (
            <div className="space-y-2">
              {[0,1,2,3].map(i => <div key={i} className="h-10 animate-pulse rounded bg-zinc-800" />)}
            </div>
          ) : members.length === 0 ? (
            <EmptyState title="会員がいません" desc="承認済み会員がいるとここに表示されます。" />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full min-w-[1100px] text-left">
                  <thead className="bg-zinc-800">
                    <tr>
                      <Th>ログインID</Th>
                      <Th>氏名</Th>
                      <Th>プラン</Th>
                      <Th>サブスク</Th>
                      <SortTh sortKey="bp_balance"        currentSortKey={membersSortKey} currentSortOrder={membersSortOrder} onSort={handleMembersSort}>BP残高</SortTh>
                      <SortTh sortKey="ep_balance"        currentSortKey={membersSortKey} currentSortOrder={membersSortOrder} onSort={handleMembersSort}>EP残高</SortTh>
                      <SortTh sortKey="login_streak"      currentSortKey={membersSortKey} currentSortOrder={membersSortOrder} onSort={handleMembersSort}>連続ログイン</SortTh>
                      <SortTh sortKey="total_login_count" currentSortKey={membersSortKey} currentSortOrder={membersSortOrder} onSort={handleMembersSort}>累計ログイン</SortTh>
                      <SortTh sortKey="last_login_at"     currentSortKey={membersSortKey} currentSortOrder={membersSortOrder} onSort={handleMembersSort}>最終ログイン</SortTh>
                      <Th>ステータス</Th>
                      <Th>Music Boost</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m, i) => (
                      <tr key={m.login_id || i} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                        <Td className="font-mono text-xs text-zinc-300">{m.login_id || "—"}</Td>
                        <Td>{m.name || "—"}</Td>
                        <Td>{m.plan || "—"}</Td>
                        <Td className="text-xs text-zinc-400">{m.subscription_plan || "free"}</Td>
                        <Td className={m.bp_balance >= 500 ? "font-bold text-amber-400" : ""}>{m.bp_balance.toLocaleString()}</Td>
                        <Td>{m.ep_balance.toLocaleString()}</Td>
                        <Td className={m.login_streak >= 7 ? "font-bold text-emerald-400" : ""}>{m.login_streak}日</Td>
                        <Td>{m.total_login_count}回</Td>
                        <Td className="whitespace-nowrap text-xs text-zinc-400">{formatDate(m.last_login_at)}</Td>
                        <Td>
                          <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            {m.status}
                          </span>
                        </Td>
                        <Td>
                          {m.music_boost_plan ? (
                            <span className="inline-flex flex-col gap-0.5">
                              <span className="rounded-full bg-purple-900/50 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                                {m.music_boost_plan}
                              </span>
                              {m.music_boost_expires_at && (
                                <span className="text-[10px] text-zinc-500">
                                  〜{new Date(m.music_boost_expires_at).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })}
                                </span>
                              )}
                              {m.music_boost_artist && (
                                <span className="text-[10px] text-zinc-400">
                                  🎤 {m.music_boost_artist}
                                </span>
                              )}
                              {m.music_boost_album && (
                                <span className="text-[10px] text-zinc-400">
                                  🎵 {m.music_boost_album}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ページネーション */}
              <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
                <span>{membersTotal}人中 {membersPage * PAGE_SIZE + 1}〜{Math.min((membersPage + 1) * PAGE_SIZE, membersTotal)}件</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadMembers(membersPage - 1)}
                    disabled={membersPage === 0 || membersLoading}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    ← 前へ
                  </button>
                  <span className="flex items-center text-xs text-zinc-500">{membersPage + 1} / {totalPages || 1}</span>
                  <button
                    onClick={() => loadMembers(membersPage + 1)}
                    disabled={membersPage >= totalPages - 1 || membersLoading}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    次へ →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ═══ セクション6: Rumble管理 ══════════════════════════ */}
        <section className="mt-6 rounded-2xl bg-zinc-900 p-5">
          <p className="mb-4 text-lg font-semibold text-zinc-200">⚔️ Rumble League 管理</p>

          {/* 今の参加者で即時バトル */}
          <div className="mb-4 rounded-xl border border-orange-900 bg-orange-950/30 p-4">
            <p className="mb-3 text-sm font-bold text-orange-300">⚡ 今の参加者で即時バトル</p>
            <p className="mb-3 text-xs text-zinc-400">現在エントリー済みの参加者のみでバトルを即時実行します（強制エントリーなし）。</p>
            <button
              onClick={handleRunNow}
              disabled={runNowBusy}
              className={clsx(
                "rounded-lg px-4 py-2 text-sm font-bold transition",
                runNowBusy
                  ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
                  : "bg-orange-600 text-white hover:bg-orange-700"
              )}
            >
              {runNowBusy ? "処理中…" : "即時バトル開始"}
            </button>
            {runNowMsg && (
              <p className={clsx("mt-2 text-xs", runNowMsg.startsWith("エラー") ? "text-red-400" : "text-emerald-400")}>
                {runNowMsg}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 強制バトル参加 */}
            <div className="rounded-xl border border-zinc-800 p-4">
              <p className="mb-3 text-sm font-bold text-zinc-300">🔧 強制バトル参加（BP消費なし）</p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="ログインID"
                  value={forceEntryUserId}
                  onChange={e => setForceEntryUserId(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                />
                <button
                  onClick={handleForceEntry}
                  disabled={forceEntryBusy || !forceEntryUserId.trim()}
                  className={clsx(
                    "rounded-lg px-4 py-2 text-sm font-bold transition",
                    forceEntryBusy || !forceEntryUserId.trim()
                      ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
                      : "bg-purple-600 text-white hover:bg-purple-700"
                  )}
                >
                  {forceEntryBusy ? "処理中…" : "実行"}
                </button>
              </div>
              {forceEntryMsg && (
                <p className={clsx("text-xs", forceEntryMsg.startsWith("エラー") ? "text-red-400" : "text-emerald-400")}>
                  {forceEntryMsg}
                </p>
              )}
            </div>

            {/* 週次報酬配布 */}
            <div className="rounded-xl border border-zinc-800 p-4">
              <p className="mb-3 text-sm font-bold text-zinc-300">🏆 週次報酬配布</p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="weekId（空欄=今週）"
                  value={rewardWeekId}
                  onChange={e => setRewardWeekId(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
                <button
                  onClick={handleRewardDistribute}
                  disabled={rewardBusy}
                  className={clsx(
                    "rounded-lg px-4 py-2 text-sm font-bold transition",
                    rewardBusy
                      ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
                      : "bg-amber-500 text-black hover:bg-amber-600"
                  )}
                >
                  {rewardBusy ? "配布中…" : "配布実行"}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mb-2">※ 二重付与チェックなし。金曜終了後に1回のみ実行してください</p>
              {rewardMsg && (
                <p className={clsx("text-xs", rewardMsg.startsWith("エラー") ? "text-red-400" : "text-emerald-400")}>
                  {rewardMsg}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            音楽レビュー（review_required な曲の手動確認）
        ══════════════════════════════════════════════════ */}
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-white">🎵 音楽レビュー（要確認曲）</h2>

          {musicReviewMsg && (
            <div className="mb-3 rounded-lg bg-emerald-900 px-4 py-2 text-sm text-emerald-300">{musicReviewMsg}</div>
          )}
          {musicReviewErr && (
            <div className="mb-3 rounded-lg bg-red-900 px-4 py-2 text-sm text-red-300">エラー: {musicReviewErr}</div>
          )}

          {musicReviewLoading ? (
            <SkeletonCard />
          ) : musicReviews.length === 0 ? (
            <EmptyState title="レビュー待ち曲なし" desc="review_required な曲はありません。" />
          ) : (
            <div className="flex flex-col gap-6">
              {musicReviews.map((job) => {
                const isBusy    = musicReviewBusy === job.jobId;
                const gateColor = job.lyricsGateResult === "pass"
                  ? "text-emerald-400"
                  : job.lyricsGateResult === "review"
                  ? "text-amber-400"
                  : "text-red-400";

                let anchorWords: string[] = [];
                let hookLines: string[]   = [];
                let repeatSegments: Array<{ text: string; count: number }> = [];
                try { anchorWords     = job.anchorWordsJson    ? JSON.parse(job.anchorWordsJson)    : []; } catch {}
                try { hookLines       = job.hookLinesJson      ? JSON.parse(job.hookLinesJson)      : []; } catch {}
                try { repeatSegments  = job.repeatSegmentsJson ? JSON.parse(job.repeatSegmentsJson) : []; } catch {}

                return (
                  <div key={job.jobId} className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
                    {/* ヘッダー */}
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <p className="text-sm font-bold text-white">
                        {job.structureData?.title ?? job.prompt?.theme ?? job.jobId}
                      </p>
                      <span className={clsx("text-xs font-bold", gateColor)}>
                        [{job.lyricsGateResult ?? "—"}]
                      </span>
                      <span className="text-xs text-zinc-400">
                        品質: {job.lyricsQualityScore ?? "—"} / 反復: {job.repeatScore ?? "—"}
                        {job.generationAttempt && job.generationAttempt > 1 && (
                          <span className="ml-2 text-amber-400">（再生成: {job.generationAttempt}回目）</span>
                        )}
                      </span>
                      <span className="text-xs text-zinc-500">{job.jobId}</span>
                    </div>

                    {/* 音源 */}
                    {job.audioUrl && (
                      <audio controls src={job.audioUrl} className="mb-3 w-full" />
                    )}

                    {/* 品質詳細 */}
                    <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {anchorWords.length > 0 && (
                        <div className="rounded-lg bg-zinc-800 p-3">
                          <p className="mb-1 text-xs font-bold text-zinc-400">anchorWords</p>
                          <p className="text-xs text-zinc-300">{anchorWords.join("、")}</p>
                        </div>
                      )}
                      {hookLines.length > 0 && (
                        <div className="rounded-lg bg-zinc-800 p-3">
                          <p className="mb-1 text-xs font-bold text-zinc-400">hookLines</p>
                          <p className="text-xs text-zinc-300 whitespace-pre-line">{hookLines.join("\n")}</p>
                        </div>
                      )}
                      {repeatSegments.length > 0 && (
                        <div className="rounded-lg bg-zinc-800 p-3 sm:col-span-2">
                          <p className="mb-1 text-xs font-bold text-red-400">反復検知</p>
                          {repeatSegments.map((seg, i) => (
                            <p key={i} className="text-xs text-red-300">「{seg.text}」×{seg.count}</p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 歌詞比較 */}
                    <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {job.masterLyrics && (
                        <div className="rounded-lg bg-zinc-800 p-3">
                          <p className="mb-1 text-xs font-bold text-zinc-400">masterLyrics</p>
                          <pre className="text-xs text-zinc-300 whitespace-pre-wrap break-words">{job.masterLyrics}</pre>
                        </div>
                      )}
                      {job.asrLyrics && (
                        <div className="rounded-lg bg-zinc-800 p-3">
                          <p className="mb-1 text-xs font-bold text-zinc-400">asrLyrics（実際に歌われた内容）</p>
                          <pre className="text-xs text-zinc-300 whitespace-pre-wrap break-words">{job.asrLyrics}</pre>
                        </div>
                      )}
                      {job.mergedLyrics && (
                        <div className="rounded-lg bg-zinc-800 p-3">
                          <p className="mb-1 text-xs font-bold text-zinc-400">mergedLyrics（補正候補）</p>
                          <pre className="text-xs text-zinc-300 whitespace-pre-wrap break-words">{job.mergedLyrics}</pre>
                        </div>
                      )}
                    </div>

                    {/* 手動編集 */}
                    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-bold text-zinc-400">displayLyrics（表示用・編集可）</p>
                        <textarea
                          rows={8}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                          value={editLyrics[`display_${job.jobId}`] ?? job.displayLyrics ?? ""}
                          onChange={e => setEditLyrics(prev => ({ ...prev, [`display_${job.jobId}`]: e.target.value }))}
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-bold text-zinc-400">distributionLyrics（配信用・編集可）</p>
                        <textarea
                          rows={8}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                          value={editLyrics[`distribution_${job.jobId}`] ?? job.distributionLyrics ?? ""}
                          onChange={e => setEditLyrics(prev => ({ ...prev, [`distribution_${job.jobId}`]: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* アクションボタン */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleMusicReview(job.jobId, "confirm_distribution")}
                        disabled={isBusy}
                        className={clsx(
                          "rounded-lg px-4 py-2 text-xs font-bold transition",
                          isBusy ? "cursor-not-allowed bg-zinc-700 text-zinc-500" : "bg-emerald-600 text-white hover:bg-emerald-700"
                        )}
                      >
                        {isBusy ? "処理中…" : "✅ 配信可にする"}
                      </button>
                      <button
                        onClick={() => handleMusicReview(job.jobId, "update_lyrics")}
                        disabled={isBusy}
                        className={clsx(
                          "rounded-lg px-4 py-2 text-xs font-bold transition",
                          isBusy ? "cursor-not-allowed bg-zinc-700 text-zinc-500" : "bg-indigo-600 text-white hover:bg-indigo-700"
                        )}
                      >
                        {isBusy ? "処理中…" : "💾 歌詞を編集して保存"}
                      </button>
                      <button
                        onClick={() => handleMusicReview(job.jobId, "reject_distribution")}
                        disabled={isBusy}
                        className={clsx(
                          "rounded-lg px-4 py-2 text-xs font-bold transition",
                          isBusy ? "cursor-not-allowed bg-zinc-700 text-zinc-500" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                        )}
                      >
                        {isBusy ? "処理中…" : "🚫 配信不可のまま完了"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ═══ 財務管理ゲートウェイ ════════════════════════════ */}
        <section className="mt-10 rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
          <p className="mb-1 text-lg font-semibold text-zinc-200">財務管理</p>
          <p className="mb-4 text-xs text-zinc-500">
            財務管理ページへ移動します。
          </p>
          <a
            href="/admin/finance"
            className="inline-block rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-black hover:bg-amber-600 transition"
          >
            財務管理へ →
          </a>
        </section>

        <footer className="mt-8 text-center text-xs text-zinc-600">© LIFAI</footer>
      </div>
    </main>
  );
}

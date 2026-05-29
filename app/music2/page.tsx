"use client";
import { shareOrDownloadAudio, shareOrDownloadText } from "@/app/lib/music-download";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, getAuthSecret } from "../lib/auth";
import { AppSidebar } from "@/components/AppSidebar";

// ── 定数 ────────────────────────────────────────────────────────────────────

const GENRES = [
  // メジャー
  "ポップ", "ロック", "ジャズ", "クラシック", "EDM",
  "ヒップホップ", "R&B", "アニメ", "ローファイ", "シネマティック",
  // サブジャンル
  "アンビエント", "チルアウト", "ニューエイジ", "ボサノバ", "フォーク",
  "ネオソウル", "トロピカルハウス", "ドラムンベース", "メタル", "ダークエレクトロ",
];

const MOODS = [
  // 基本
  "さわやか", "クール", "エモい", "明るい", "落ち着いた",
  "ロマンチック", "激しい", "切ない",
  // 追加
  "神秘的", "ダーク", "壮大", "かわいい", "夏っぽい",
  "夜っぽい", "前向き", "集中できる", "緊張感", "ホラー",
  "ファンタジー", "リラックス",
];

const PRO_PLANS = ["500", "1000"];

const BPM_OPTIONS = [
  { label: "スロー (60-80)",      value: 70  },
  { label: "ミディアム (90-110)", value: 100 },
  { label: "アップテンポ (120-140)", value: 130 },
  { label: "激速 (150+)",         value: 160 },
];

const VOCAL_STYLES = ["女性ボーカル", "男性ボーカル", "混声", "ボーカルなし"];
const VOCAL_MOODS  = ["甘い", "クール", "パワフル", "ウィスパー", "エモーショナル"];

const INSTRUMENTS = [
  { label: "🎹 ピアノ",      value: "ピアノ" },
  { label: "🎸 ギター",      value: "ギター" },
  { label: "🎻 ストリングス", value: "ストリングス" },
  { label: "🎺 ブラス",      value: "ブラス" },
  { label: "🎷 サックス",    value: "サックス" },
];

const DURATION_OPTIONS = [
  { label: "30秒", value: 30 },
  { label: "1分",  value: 60 },
  { label: "2分",  value: 120 },
  { label: "3分",  value: 180 },
];

const BGM_DURATION_OPTIONS = [
  { label: "45秒",          value: 45 },
  { label: "60秒（標準）",  value: 60 },
  { label: "75秒",          value: 75 },
  { label: "90秒",          value: 90 },
];

const proChipBase     = "rounded-full border px-3 py-1 text-xs font-semibold transition";
const proChipActive   = "border-violet-500 bg-violet-600 text-white";
const proChipInactive = "border-[#3730a3] bg-[#1e1b4b] text-indigo-300 hover:border-violet-500 hover:text-violet-300";

type Step = 0 | 1 | 2 | 3;
type GenerationMode = "song" | "bgm";

type StructureData = {
  bpm: number;
  key: string;
  sections: string[];
  hookSummary: string;
  title: string;
};

// ── チュートリアル ────────────────────────────────────────────────────────────

const TUTORIAL_KEY = "lifai_music2_tutorial_v1";

const TUTORIAL_SLIDES = [
  {
    icon: "✏️",
    title: "テーマ・ジャンル・雰囲気を入力",
    body: "作りたい曲のイメージをテーマに書いてください。ジャンルと雰囲気（複数可）も選ぶと、AIがより好みに合った曲を作ります。",
  },
  {
    icon: "📋",
    title: "AIが構成案を提案します",
    body: "BPM・キー・セクション構成・サビのポイントをAIが考えます。気に入らなければ「作り直す」で再提案できます。",
  },
  {
    icon: "⏳",
    title: "曲の生成が始まります",
    body: "生成には2〜3分かかります。ページを開いたままお待ちください。進捗バーで状況を確認できます。",
  },
  {
    icon: "🎵",
    title: "完成！聴いて・ダウンロードしよう",
    body: "再生プレイヤーで試聴し、MP3ダウンロードもできます。表示用歌詞・配信用歌詞もここから確認できます。",
  },
];

// ── 履歴 ─────────────────────────────────────────────────────────────────────

const HISTORY_KEY = "lifai_music2_history_v1";
const HISTORY_MAX = 50;
const HISTORY_EXPIRE_DAYS = 31;

type MusicHistoryEntry = {
  jobId: string;
  title: string;
  audioUrl: string;
  downloadUrl: string;
  lyrics: string;
  createdAt: string; // ISO string
  expiresAt?: string; // ISO string (31日後)
};

function loadHistory(): MusicHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const all: MusicHistoryEntry[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    return all.filter((e) =>
      !e.expiresAt || new Date(e.expiresAt).getTime() > now
    );
  } catch {
    return [];
  }
}

function saveToHistory(entry: MusicHistoryEntry): MusicHistoryEntry[] {
  const expiresAt = new Date(
    Date.now() + HISTORY_EXPIRE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const withExpiry = { ...entry, expiresAt };
  const prev = loadHistory().filter((e) => e.jobId !== withExpiry.jobId);
  const next = [withExpiry, ...prev].slice(0, HISTORY_MAX);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

// サーバーに履歴を保存（fire-and-forget）
async function saveToServer(entry: MusicHistoryEntry, userId: string): Promise<void> {
  try {
    await fetch("/api/music/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        jobId:       entry.jobId,
        title:       entry.title,
        audioUrl:    entry.audioUrl,
        downloadUrl: entry.downloadUrl,
        lyrics:      entry.lyrics,
        createdAt:   entry.createdAt,
        expiresAt:   entry.expiresAt ?? "",
      }),
    });
  } catch {
    // サーバー保存失敗はサイレントに無視（localStorage に保存済みなので問題なし）
  }
}

// サーバーから履歴を取得してlocalStorageとマージ（jobId で重複排除、createdAt降順）
async function fetchAndMergeHistory(userId: string): Promise<MusicHistoryEntry[]> {
  try {
    const res  = await fetch(`/api/music/history?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    if (!data.ok) return loadHistory();
    const serverItems: MusicHistoryEntry[] = data.items ?? [];
    const local  = loadHistory();
    const merged = new Map<string, MusicHistoryEntry>();
    // ローカルを先に入れてサーバーで上書き（サーバーが正）
    local.forEach((e)  => merged.set(e.jobId, e));
    serverItems.forEach((e) => merged.set(e.jobId, e));
    const result = Array.from(merged.values())
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
      .slice(0, 50);
    // マージ結果をlocalStorageにキャッシュ
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(result)); } catch {}
    return result;
  } catch {
    return loadHistory(); // サーバー取得失敗時はlocalStorage fallback
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

// ── ユーティリティ ───────────────────────────────────────────────────────────

// ── メインコンポーネント ─────────────────────────────────────────────────────

export default function Music2Page() {
  const router = useRouter();

  // フォーム
  const [generationMode, setGenerationMode] = useState<GenerationMode>("song");
  const [theme, setTheme] = useState("");
  const [genre, setGenre] = useState("");
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);

  // ステップ制御
  const [step, setStep] = useState<Step>(0);

  // ジョブ
  const [jobId, setJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 構成
  const [structureData, setStructureData] = useState<StructureData | null>(null);

  // 完成
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState("");
  const [resultLyrics, setResultLyrics] = useState("");
  const [displayLyrics, setDisplayLyrics] = useState("");
  const [distributionLyrics, setDistributionLyrics] = useState("");
  const [distributionReady, setDistributionReady] = useState(false);
  const [lyricsGateResult, setLyricsGateResult] = useState<"pass" | "review" | "reject" | null>(null);
  const [lyricsReviewRequired, setLyricsReviewRequired] = useState(false);
  const [jacketImageUrl, setJacketImageUrl] = useState<string | null>(null);
  const [jacketLoading, setJacketLoading] = useState(false);
  const [jacketError, setJacketError] = useState<string | null>(null);

  // UI状態
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [audioStage, setAudioStage] = useState<string | null>(null);
  const [stageLabel, setStageLabel] = useState<string | null>(null);

  // プラン
  const [plan, setPlan] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  // 履歴
  const [history, setHistory] = useState<MusicHistoryEntry[]>([]);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [editedDisplayLyrics, setEditedDisplayLyrics] = useState("");
  const [editedDistribLyrics, setEditedDistribLyrics] = useState("");
  const [userId, setUserId] = useState<string>("");
  useEffect(() => { setEditedDisplayLyrics(displayLyrics); }, [displayLyrics]);
  useEffect(() => { setEditedDistribLyrics(distributionLyrics); }, [distributionLyrics]);

  // チュートリアル (null=非表示, 0〜3=スライド番号)
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);

  // Pro 追加入力
  const [bpmHint, setBpmHint] = useState<number | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [vocalStyle, setVocalStyle] = useState<string>("");
  const [vocalMood, setVocalMood] = useState<string>("");
  const [instruments, setInstruments] = useState<string[]>([]);
  const [duration,    setDuration]    = useState<number | null>(null);

  const isPro = plan !== null && PRO_PLANS.includes(plan);

  const isProSettingsActive =
    isPro && (!!bpmHint || !!vocalStyle || !!vocalMood || instruments.length > 0 || !!duration);

  const isBgmMode = generationMode === "bgm";

  // ── 認証チェック & プラン取得 ───────────────────────────────────────────

  useEffect(() => {
    const auth = getAuth();
    if (!auth) {
      router.replace("/login");
      return;
    }
    // まずlocalStorageを即時表示（高速表示）してからサーバーマージ
    setHistory(loadHistory());

    // チュートリアル: 未表示なら自動表示
    if (!localStorage.getItem(TUTORIAL_KEY)) {
      setTutorialStep(0);
    }

    const id   = (auth as any)?.id || (auth as any)?.loginId || "";
    if (id) {
      setUserId(id);
      fetchAndMergeHistory(id).then(setHistory).catch(() => {});
    }
    const code = getAuthSecret() || (auth as any)?.token || "";

    const cachedPlan = String((auth as any)?.plan ?? "");
    if (cachedPlan) setPlan(cachedPlan);

    if (!id || !code) {
      setPlanLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ id, code, group: (auth as any)?.group || "" }),
        });
        const data = await res.json().catch(() => ({ ok: false }));
        if (data?.ok && data?.me?.plan) {
          setPlan(String(data.me.plan));
        } else {
          setPlan(cachedPlan || "");
        }
      } catch {
        setPlan(cachedPlan || "");
      } finally {
        setPlanLoading(false);
      }
    })();

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [router]);

  // ── ポーリング停止 ────────────────────────────────────────────────────────

  function stopPoll() {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }

  // ── ステータスポーリング（completed まで） ────────────────────────────────

  const pollUntilCompleted = useCallback((jid: string) => {
    let ticks = 0;
    const INFO_TICKS = 100;
    const MAX_TICKS  = 200;

    const poll = async () => {
      if (!pollRef.current) return;
      ticks++;
      setProgress(Math.min(90, 5 + ticks * 0.425));

      try {
        const res  = await fetch(`/api/song/status?jobId=${jid}`, { cache: "no-store" });
        const data = await res.json();

        if (!data.ok) {
          if (ticks >= MAX_TICKS) {
            stopPoll();
            setErrorMsg("生成に失敗しました。もう一度お試しください。");
          } else {
            pollRef.current = setTimeout(poll, 3000);
          }
          return;
        }

        if (data.stage)                      setAudioStage(data.stage);
        if (data.stageLabel)                 setStageLabel(data.stageLabel);
        if (typeof data.progress === "number") setProgress(data.progress);

        if (data.status === "completed" || data.status === "review_required") {
          const rRes  = await fetch(`/api/song/result?jobId=${jid}`, { cache: "no-store" });
          const rData = await rRes.json();
          stopPoll();
          setProgress(100);
          if (rData.ok) {
            setResultTitle(rData.title ?? "");
            setAudioUrl(rData.audioUrl ?? null);
            setDownloadUrl(rData.downloadUrl ?? null);
            setResultLyrics(rData.lyrics ?? "");
            setDisplayLyrics(rData.displayLyrics ?? rData.lyrics ?? "");
            setDistributionLyrics(rData.distributionLyrics ?? "");
            setDistributionReady(!!rData.distributionReady);
            setLyricsGateResult(rData.lyricsGateResult ?? null);
            setLyricsReviewRequired(!!rData.lyricsReviewRequired);
            setInfoMsg(null);
            setStep(3);
            if (rData.audioUrl) {
              const updated = saveToHistory({
                jobId:       jid,
                title:       rData.title || "無題",
                audioUrl:    rData.audioUrl,
                downloadUrl: rData.downloadUrl ?? rData.audioUrl,
                lyrics:      rData.displayLyrics ?? rData.lyrics ?? "",
                createdAt:   new Date().toISOString(),
              });
              setHistory(updated);
              if (userId) saveToServer(updated[0], userId).catch(() => {});
            }
          } else {
            setErrorMsg("曲の取得に失敗しました。");
          }
          return;
        }

        if (data.status === "failed" || data.status === "cancelled") {
          stopPoll();
          setErrorMsg("曲の生成に失敗しました。");
          return;
        }

        if (ticks >= MAX_TICKS) {
          stopPoll();
          setErrorMsg("生成に失敗しました。もう一度お試しください。");
          return;
        }

        if (ticks === INFO_TICKS) {
          setInfoMsg("曲の生成に時間がかかっています。このままお待ちください...");
        }
      } catch {
        // ネットワークエラーは無視
      }

      pollRef.current = setTimeout(poll, 3000);
    };

    pollRef.current = setTimeout(poll, 3000);
  }, []);

  const pollBgmUntilCompleted = useCallback((predictionId: string, mode = "standard_loop") => {
    let ticks = 0;
    const MAX_TICKS = 120;

    const poll = async () => {
      if (!pollRef.current) return;
      ticks++;
      setProgress(Math.min(94, 15 + ticks * 0.65));

      try {
        const res = await fetch(`/api/bgm/status?id=${encodeURIComponent(predictionId)}&mode=${encodeURIComponent(mode)}`, { cache: "no-store" });
        const data = await res.json();

        if (!data.ok) {
          if (ticks >= MAX_TICKS) {
            stopPoll();
            setErrorMsg("BGM生成に失敗しました。もう一度お試しください。");
          } else {
            pollRef.current = setTimeout(poll, 2500);
          }
          return;
        }

        if (data.stage) setStageLabel(data.stage);
        if (typeof data.progress === "number") setProgress(Math.round(data.progress * 100));

        if (data.status === "succeeded" && data.outputUrl) {
          stopPoll();
          setProgress(100);
          const title = theme.trim() || "BGM";
          setResultTitle(title);
          setAudioUrl(data.outputUrl);
          setDownloadUrl(data.outputUrl);
          setResultLyrics("");
          setDisplayLyrics("");
          setDistributionLyrics("");
          setDistributionReady(false);
          setLyricsGateResult(null);
          setLyricsReviewRequired(false);
          setInfoMsg(null);
          setStep(3);

          const updated = saveToHistory({
            jobId: predictionId,
            title,
            audioUrl: data.outputUrl,
            downloadUrl: data.outputUrl,
            lyrics: "",
            createdAt: new Date().toISOString(),
          });
          setHistory(updated);
          if (userId) saveToServer(updated[0], userId).catch(() => {});
          return;
        }

        if (data.status === "failed" || data.status === "canceled") {
          stopPoll();
          setErrorMsg("BGM生成に失敗しました。");
          return;
        }

        if (ticks >= MAX_TICKS) {
          stopPoll();
          setErrorMsg("BGM生成に時間がかかりすぎています。もう一度お試しください。");
          return;
        }
      } catch {
        // 一時的な通信エラーは次回ポーリングで回復する可能性がある
      }

      pollRef.current = setTimeout(poll, 2500);
    };

    pollRef.current = setTimeout(poll, 2500);
  }, [genre, selectedMoods, theme]);

  // ── Step 0: 曲を作る（構成生成まで一気に） ──────────────────────────────

  async function handleStart() {
    const auth = getAuth();
    const code = getAuthSecret();
    const id = (auth as any)?.id || (auth as any)?.loginId || "";
    if (!auth || !code || !id) {
      router.replace("/login");
      return;
    }
    if (!theme.trim() || !genre || selectedMoods.length === 0) return;

    stopPoll();
    setLoading(true);
    setErrorMsg(null);
    setProgress(10);

    const moodStr = selectedMoods.join("・");

    try {
      if (generationMode === "bgm") {
        setProgress(20);
        const res = await fetch("/api/bgm/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            code,
            isPro,
            theme: theme.trim(),
            genre,
            mood: moodStr,
            bpm: bpmHint ?? undefined,
            key: selectedKey || undefined,
            duration: isPro && duration ? duration : undefined,
          }),
        });
        const data = await res.json();

        if (!data.ok) {
          setErrorMsg(
            data.error === "insufficient_bp"
              ? `BPが不足しています（現在: ${data.bp ?? "?"}BP、必要: ${data.required ?? 80}BP）`
              : `BGM生成に失敗しました（${data.error ?? "unknown"}）`
          );
          setLoading(false);
          return;
        }

        setJobId(data.predictionId);
        setResultTitle(theme.trim() || "BGM");
        setAudioUrl(null);
        setDownloadUrl(null);
        setStageLabel("BGM生成中");
        setStep(2);
        setLoading(false);
        pollBgmUntilCompleted(data.predictionId, data.mode ?? "standard_loop");
        return;
      }

      // start API が同期的に structure_ready まで実行して返す
      setProgress(30);
      const res  = await fetch("/api/song/start", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          id, code, theme: theme.trim(), genre, mood: moodStr, isPro,
          bpmHint:     isPro && bpmHint                 ? bpmHint     : undefined,
          vocalStyle:  isPro && vocalStyle               ? vocalStyle  : undefined,
          vocalMood:   isPro && vocalMood                ? vocalMood   : undefined,
          instruments: isPro && instruments.length > 0  ? instruments : undefined,
          duration:    isPro && duration                 ? duration    : undefined,
          language:    "ja",
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        const msg =
          data.error === "insufficient_bp"
            ? `BPが不足しています（現在: ${data.bp ?? "?"}BP、必要: ${isProSettingsActive ? 250 : 100}BP）`
            : data.error === "job_create_failed"
            ? "サーバー設定のエラーが発生しました。管理者に連絡してください。（GAS未デプロイの可能性）"
            : `エラーが発生しました（${data.error ?? "unknown"}）`;
        setErrorMsg(msg);
        setLoading(false);
        return;
      }

      setJobId(data.jobId);
      setProgress(100);

      // structure データを取得して Step 1 へ
      if (data.structureData) {
        setStructureData({
          bpm:         data.structureData.bpm  ?? 120,
          key:         data.structureData.key  ?? "C major",
          sections:    data.structureData.sections ?? [],
          hookSummary: data.structureData.hookSummary ?? "",
          title:       data.structureData.title ?? "",
        });
        setLoading(false);
        setStep(1);
      } else {
        // フォールバック: structure API で取得
        const sRes  = await fetch(`/api/song/structure?jobId=${data.jobId}`, { cache: "no-store" });
        const sData = await sRes.json();
        if (sData.ok) {
          setStructureData({
            bpm:         sData.bpm  ?? 120,
            key:         sData.key  ?? "C major",
            sections:    sData.sections ?? [],
            hookSummary: sData.hookSummary ?? "",
            title:       sData.title ?? "",
          });
          setLoading(false);
          setStep(1);
        } else {
          setErrorMsg("構成の取得に失敗しました。");
          setLoading(false);
        }
      }
    } catch {
      setErrorMsg("ネットワークエラーが発生しました。");
      setLoading(false);
    }
  }

  // ── Step 1: 構成を作り直す ────────────────────────────────────────────────

  function handleRedoStructure() {
    stopPoll();
    setLoading(false);
    setProgress(0);
    setErrorMsg(null);
    setStructureData(null);
    setJobId(null);
    setStep(0);
  }

  // ── Step 1: キャンセル ────────────────────────────────────────────────────

  async function handleCancelFromStep1() {
    if (jobId) {
      await fetch("/api/song/cancel", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ jobId }),
      }).catch(() => {});
    }
    handleFullReset();
  }

  // ── Step 1: 構成承認して音楽生成へ ────────────────────────────────────────

  async function handleApproveStructure() {
    if (!jobId) return;
    setLoading(true);
    setErrorMsg(null);
    setProgress(5);

    // approve-structure は完了まで数分かかるため、待機中も進捗を少しずつ進める
    let fakeP = 5;
    const fakeTimer = setInterval(() => {
      fakeP = Math.min(45, fakeP + 0.4);
      setProgress(fakeP);
    }, 2000);

    try {
      const res  = await fetch("/api/song/approve-structure", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ jobId, approved: true }),
      });
      const data = await res.json();

      if (!data.ok) {
        setErrorMsg(`エラー: ${data.error ?? "unknown"}${data.status ? ` (status: ${data.status})` : ""}`);
        setLoading(false);
        return;
      }

      // すでにパイプライン進行中（二重クリック等）→ そのままポーリングへ
      setStep(2);
      pollRef.current = setTimeout(() => {}, 0);
      pollUntilCompleted(jobId);
    } catch {
      // ネットワークエラーが発生してもサーバー側でパイプラインが継続している可能性があるため、
      // jobId があればポーリングを継続して完了を検知する（履歴への保存を確実にする）
      setInfoMsg("接続が一時的に途切れました。生成は継続中です...");
      setStep(2);
      pollRef.current = setTimeout(() => {}, 0);
      pollUntilCompleted(jobId);
    } finally {
      clearInterval(fakeTimer);
    }
  }

  // ── 全リセット ────────────────────────────────────────────────────────────

  function handleFullReset() {
    stopPoll();
    setStep(0);
    setJobId(null);
    setTheme("");
    setGenre("");
    setSelectedMoods([]);
    setStructureData(null);
    setAudioUrl(null);
    setDownloadUrl(null);
    setResultTitle("");
    setResultLyrics("");
    setDisplayLyrics("");
    setDistributionLyrics("");
    setDistributionReady(false);
    setJacketImageUrl(null);
    setJacketLoading(false);
    setJacketError(null);
    setLoading(false);
    setProgress(0);
    setErrorMsg(null);
    setInfoMsg(null);
    setAudioStage(null);
    setStageLabel(null);
    setBpmHint(null);
    setSelectedKey("");
    setVocalStyle("");
    setVocalMood("");
    setInstruments([]);
    setDuration(null);
  }

  // ── ムード切り替え ────────────────────────────────────────────────────────

  function toggleMood(mood: string) {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  }

  async function handleGenerateJacket() {
    const auth = getAuth();
    const code = getAuthSecret() || (auth as any)?.token || "";
    const id = (auth as any)?.id || (auth as any)?.loginId || "";

    if (!auth || !id || !code || !jobId) {
      router.replace("/login");
      return;
    }

    setJacketLoading(true);
    setJacketError(null);

    try {
      const res = await fetch("/api/image/jacket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          code,
          jobId,
          theme,
          genre,
          mood: selectedMoods.join("・"),
          title: resultTitle || structureData?.title || "LIFAI Song",
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setJacketImageUrl(data.imageUrl);
        return;
      }

      setJacketError(
        data.error === "insufficient_bp"
          ? `BPが不足しています。必要BP: ${data.required ?? 100}BP`
          : "ジャケット画像の生成に失敗しました。"
      );
    } catch {
      setJacketError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setJacketLoading(false);
    }
  }

  const canStart = theme.trim().length > 0 && genre !== "" && selectedMoods.length > 0 && !loading && !planLoading;

  // ── 共通スタイル ──────────────────────────────────────────────────────────

  const chipBase    = "rounded-full border px-3 py-1 text-xs font-semibold transition";
  const chipActive  = "border-indigo-500 bg-indigo-600 text-white";
  const chipInactive = "border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700";

  const btnPrimary =
    "w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-extrabold text-white shadow-[0_10px_30px_rgba(99,102,241,.25)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
  const btnSecondary =
    "rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50";
  const btnDanger =
    "rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50";

  // ── プログレスバー ────────────────────────────────────────────────────────

  const ProgressBar = ({ label }: { label: string }) => (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="relative mt-2 h-2 w-full rounded-full border border-slate-200 bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
        <span
          className="absolute -top-3 text-base transition-all duration-500"
          style={{ left: `calc(${progress}% - 10px)` }}
        >
          🐱
        </span>
      </div>
    </div>
  );

  // ── エラー表示 ────────────────────────────────────────────────────────────

  const ErrorBox = () =>
    errorMsg ? (
      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
        <p className="text-sm font-semibold text-rose-700">{errorMsg}</p>
        <button onClick={handleFullReset} className={`mt-3 ${btnDanger}`}>
          最初からやり直す
        </button>
      </div>
    ) : null;

  // ── レンダリング ──────────────────────────────────────────────────────────

  // ── 履歴サイドバー ────────────────────────────────────────────────────────


  return (
    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.16),transparent_60%),radial-gradient(900px_520px_at_112%_0%,rgba(34,211,238,.12),transparent_55%),linear-gradient(180deg,#FFFFFF,#F6F7FB_55%,#FFFFFF)]" />

      <div className="mx-auto max-w-[1100px] px-4 py-10 lg:flex lg:gap-5 lg:items-start">
        {/* 左サイドバー（共通） */}
        <div className="hidden lg:block">
          <AppSidebar activePage="/music2" />
        </div>

        {/* メインカード */}
        <div className="flex-1 min-w-0">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_26px_70px_rgba(2,6,23,.10)]">

          {/* ヘッダー */}
          <div className="flex items-center gap-3">
            <Link
              href="/top"
              className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              ← ホーム
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              <span className="text-base">🎵</span>
              音楽生成 NEW
            </div>
            {/* Pro バッジ */}
            {!planLoading && isPro && (
              <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                PRO
              </span>
            )}
            {/* ステップインジケーター */}
            {step > 0 && (
              <div className="flex items-center gap-1">
                {([1, 2, 3] as const).map((s) => (
                  <div
                    key={s}
                    className={[
                      "h-2 w-2 rounded-full transition",
                      step >= s ? "bg-indigo-500" : "bg-slate-200",
                    ].join(" ")}
                  />
                ))}
              </div>
            )}
            {/* チュートリアルボタン */}
            <button
              type="button"
              onClick={() => setTutorialStep(0)}
              title="使い方を見る"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition"
            >
              ?
            </button>
          </div>

          <h1 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">
            {step === 0 && (isBgmMode ? "BGMを作る" : "新しい曲を作る")}
            {step === 1 && "構成案を確認"}
            {step === 2 && (isBgmMode ? "BGMを生成しています…" : "曲を生成しています…")}
            {step === 3 && (isBgmMode ? "BGMが完成しました！" : "曲が完成しました！")}
          </h1>

          <ErrorBox />

          {/* ════════════════════════════════════════════════════
              Step 0：入力フォーム
          ════════════════════════════════════════════════════ */}
          {step === 0 && (
            <>
              <div className="mt-5 grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {([
                  { value: "song", label: "曲生成", sub: "歌詞・構成あり" },
                  { value: "bgm", label: "BGM生成", sub: "ボーカルなし｜試験運転中" },
                ] as const).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      if (item.value !== generationMode) {
                        setBpmHint(null);
                        setVocalStyle("");
                        setVocalMood("");
                        setInstruments([]);
                        setDuration(null);
                      }
                      setGenerationMode(item.value);
                      setErrorMsg(null);
                      setProgress(0);
                    }}
                    disabled={loading}
                    className={[
                      "rounded-xl px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                      generationMode === item.value
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800",
                    ].join(" ")}
                  >
                    <span className="block text-sm font-extrabold">{item.label}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold">{item.sub}</span>
                  </button>
                ))}
              </div>

              <p className="mt-2 text-sm text-slate-600">
                {isBgmMode
                  ? "テーマ・ジャンル・雰囲気を選ぶと、ボーカルなしのBGMを生成します。"
                  : "テーマ・ジャンル・雰囲気を選ぶと、AIが構成を提案してから曲を生成します。"}
              </p>

              {isBgmMode && (
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
                  ⚠ BGM生成は現在試験運転中です。成果物の品質を保証することはできません。ご留意のうえご利用ください。
                </p>
              )}

              {/* テーマ */}
              <div className="mt-6">
                <label className="block text-xs font-bold text-slate-700">
                  テーマ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  disabled={loading}
                  placeholder="例: 夏の終わり、新しい出会い、宇宙の旅…"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
                />
              </div>

              {/* ジャンル */}
              <div className="mt-5">
                <label className="block text-xs font-bold text-slate-700">
                  ジャンル <span className="text-rose-500">*</span>
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenre(genre === g ? "" : g)}
                      disabled={loading}
                      className={[chipBase, genre === g ? chipActive : chipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 雰囲気 */}
              <div className="mt-5">
                <label className="block text-xs font-bold text-slate-700">
                  雰囲気 <span className="text-rose-500">*</span>
                  <span className="ml-2 text-[10px] font-normal text-slate-400">複数選択可</span>
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {MOODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMood(m)}
                      disabled={loading}
                      className={[chipBase, selectedMoods.includes(m) ? chipActive : chipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* BGM設定 */}
              {isBgmMode && (
                <div className={`mt-5 rounded-[18px] border p-4 ${isPro ? "border-violet-500/30 bg-[#0d0d1a]" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🎚️</span>
                    <span className={`text-[11px] font-black tracking-widest ${isPro ? "text-violet-400" : "text-slate-600"}`}>BGM SETTINGS</span>
                    {isPro && (
                      <span className="ml-auto rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 px-2.5 py-0.5 text-[9px] font-bold text-white">PRO</span>
                    )}
                  </div>
                  <div className="mt-4">
                    <label className={`block text-[11px] font-bold mb-1.5 ${isPro ? "text-violet-400" : "text-slate-600"}`}>BPM目安</label>
                    <div className="flex flex-wrap gap-1.5">
                      {BPM_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={loading}
                          onClick={() => setBpmHint(bpmHint === opt.value ? null : opt.value)}
                          className={isPro
                            ? [proChipBase, bpmHint === opt.value ? proChipActive : proChipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")
                            : [chipBase, bpmHint === opt.value ? chipActive : chipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* KEY 選択 */}
                  <div className="mt-3">
                    <label className={`block text-[11px] font-bold mb-1.5 ${isPro ? "text-violet-400" : "text-slate-600"}`}>
                      KEY（任意）
                    </label>
                    <select
                      value={selectedKey}
                      onChange={(e) => setSelectedKey(e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${
                        isPro ? "border-violet-500/30 bg-[#12122a] text-white" : "border-slate-300 bg-white text-slate-800"
                      }`}
                    >
                      <option value="">自動</option>
                      {["C_major","G_major","D_major","A_major","F_major","A_minor","E_minor","D_minor","C_minor"].map((k) => (
                        <option key={k} value={k}>
                          {k.replace("_major"," major").replace("_minor"," minor")}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isPro && (
                    <div className="mt-4">
                      <label className="block text-[11px] font-bold text-violet-400 mb-1.5">曲の長さ</label>
                      <div className="flex flex-wrap gap-1.5">
                        {BGM_DURATION_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={loading}
                            onClick={() => setDuration(duration === opt.value ? null : opt.value)}
                            className={[proChipBase, duration === opt.value ? proChipActive : proChipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[10px] text-violet-400/50">未選択の場合は60秒（最終出力は3分に自動拡張）</p>
                    </div>
                  )}
                  {!isPro && (
                    <p className="mt-3 text-[10px] text-slate-400">シームレスループ対応BGM（約45秒生成、ブラウザでループ再生）</p>
                  )}
                </div>
              )}

              {/* Pro追加設定（isPro === true の場合のみ表示） */}
              {isPro && !isBgmMode && (
                <div className="mt-5 rounded-[18px] border border-violet-500/30 bg-[#0d0d1a] p-4 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                  {/* ヘッダー */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm">🎛️</span>
                    <span className="text-[11px] font-black text-violet-400 tracking-widest">PRO SETTINGS</span>
                    <span className="ml-auto rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 px-2.5 py-0.5 text-[9px] font-bold text-white">
                      PRO
                    </span>
                  </div>

                  {/* BPMヒント */}
                  <div className="mb-4">
                    <label className="block text-[11px] font-bold text-violet-400 mb-1.5">BPM目安</label>
                    <div className="flex flex-wrap gap-1.5">
                      {BPM_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={loading}
                          onClick={() => setBpmHint(bpmHint === opt.value ? null : opt.value)}
                          className={[proChipBase, bpmHint === opt.value ? proChipActive : proChipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ボーカルスタイル */}
                  <div className="mb-4">
                    <label className="block text-[11px] font-bold text-violet-400 mb-1.5">ボーカルスタイル</label>
                    <div className="flex flex-wrap gap-1.5">
                      {VOCAL_STYLES.map((v) => (
                        <button
                          key={v}
                          type="button"
                          disabled={loading}
                          onClick={() => setVocalStyle(vocalStyle === v ? "" : v)}
                          className={[proChipBase, vocalStyle === v ? proChipActive : proChipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ボーカルムード */}
                  <div className="mb-4">
                    <label className="block text-[11px] font-bold text-violet-400 mb-1.5">ボーカルムード</label>
                    <div className="flex flex-wrap gap-1.5">
                      {VOCAL_MOODS.map((v) => (
                        <button
                          key={v}
                          type="button"
                          disabled={loading}
                          onClick={() => setVocalMood(vocalMood === v ? "" : v)}
                          className={[proChipBase, vocalMood === v ? proChipActive : proChipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 楽器（NEW） */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <label className="text-[11px] font-bold text-violet-400">楽器</label>
                      <span className="rounded bg-[#312e81] px-1.5 py-0.5 text-[8px] font-bold text-[#a5b4fc]">NEW</span>
                      <span className="text-[10px] text-violet-400/50">複数選択可</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {INSTRUMENTS.map((inst) => (
                        <button
                          key={inst.value}
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            setInstruments((prev) =>
                              prev.includes(inst.value)
                                ? prev.filter((i) => i !== inst.value)
                                : [...prev, inst.value]
                            )
                          }
                          className={[proChipBase, instruments.includes(inst.value) ? proChipActive : proChipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                        >
                          {inst.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 曲の長さ（NEW） */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <label className="text-[11px] font-bold text-violet-400">曲の長さ</label>
                      <span className="rounded bg-[#312e81] px-1.5 py-0.5 text-[8px] font-bold text-[#a5b4fc]">NEW</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DURATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={loading}
                          onClick={() => setDuration(duration === opt.value ? null : opt.value)}
                          className={[proChipBase, duration === opt.value ? proChipActive : proChipInactive, "disabled:cursor-not-allowed disabled:opacity-50"].join(" ")}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* BP表示 */}
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <span className="text-xs font-bold text-indigo-700">必要BP</span>
                <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                  {isBgmMode ? (isPro ? "150 BP" : "80 BP") : isProSettingsActive ? "250 BP" : "100 BP"}
                </span>
                {isBgmMode ? (
                  <span className="ml-auto text-[11px] text-indigo-500">{isPro ? "🎛️ Pro BGM（時間指定）" : "2〜3分半のBGMをランダム生成"}</span>
                ) : isPro ? (
                  isProSettingsActive ? (
                    <span className="ml-auto text-[11px] text-violet-600 font-semibold">🎛️ Pro設定使用中（250BP）</span>
                  ) : (
                    <span className="ml-auto text-[11px] text-violet-500">Pro設定を使うと250BP</span>
                  )
                ) : (
                  <span className="ml-auto text-[11px] text-indigo-500">構成生成→音楽生成の2ステップ</span>
                )}
              </div>

              {/* ローディング中のプログレス */}
              {loading && <ProgressBar label={isBgmMode ? "BGM生成を開始しています…" : "楽曲構成を生成しています…"} />}

              {/* リリース・申請案内 */}
              {!isBgmMode && (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-slate-500 mb-2">📋 作った曲はリリース・売却できます</p>
                  <div className="flex flex-col gap-1.5 sm:flex-row">
                    <Link
                      href="/music-release-guide"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 text-center transition hover:bg-slate-100"
                    >
                      🎵 リリース申請方法を見る
                    </Link>
                    <Link
                      href="/apply-sell"
                      className="flex-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 text-center transition hover:bg-violet-50"
                    >
                      💰 売却申請はこちら
                    </Link>
                  </div>
                  <Link
                    href="/narasu-agency"
                    className="mt-1.5 block w-full rounded-xl border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-700 text-center transition hover:bg-teal-50"
                  >
                    📋 narasu配信代理申請（代行サービス）
                  </Link>
                </div>
              )}

              {/* 生成ボタン */}
              <div className="mt-4">
                <button
                  onClick={handleStart}
                  disabled={!canStart}
                  className={btnPrimary}
                >
                  {loading
                    ? isBgmMode ? "BGM生成を開始中…" : "構成を生成中…"
                    : isBgmMode ? "BGMを生成する" : "曲を作る"}
                </button>
                {!canStart && !loading && (
                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    テーマ・ジャンル・雰囲気をすべて選択してください
                  </p>
                )}
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════
              Step 1：構成確認
          ════════════════════════════════════════════════════ */}
          {step === 1 && !loading && structureData && (
            <>
              <p className="mt-2 text-sm text-slate-600">
                AIが楽曲構成を提案しました。確認してから「これで曲を作る」を押してください。
              </p>

              <div className="mt-5 space-y-3">
                {/* タイトル */}
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <p className="text-[10px] font-bold text-indigo-500">タイトル</p>
                  <p className="mt-1 text-base font-extrabold text-slate-900">{structureData.title}</p>
                </div>

                {/* BPM / Key */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-bold text-slate-500">BPM</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-900">{structureData.bpm}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-bold text-slate-500">Key</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-900">{structureData.key}</p>
                  </div>
                </div>

                {/* セクション */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold text-slate-500">セクション構成</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {structureData.sections.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* hookSummary */}
                {structureData.hookSummary && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-bold text-slate-500">サビのポイント</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">{structureData.hookSummary}</p>
                  </div>
                )}
              </div>

              {/* ボタン群 */}
              <div className="mt-5 flex flex-col gap-2">
                <button onClick={handleApproveStructure} disabled={loading} className={btnPrimary}>
                  これで曲を作る →
                </button>
                <p className="text-xs text-orange-400 text-center mt-2">
                  ⚠️ Beta版のため、現在は2分〜3分の生成となります
                </p>
                <div className="flex gap-2">
                  <button onClick={handleRedoStructure} className={`flex-1 ${btnSecondary}`}>
                    作り直す
                  </button>
                  <button onClick={handleCancelFromStep1} className={`flex-1 ${btnDanger}`}>
                    キャンセル
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 1 && loading && (
            <ProgressBar label="音楽生成を開始しています…" />
          )}

          {/* ════════════════════════════════════════════════════
              Step 2：曲生成中
          ════════════════════════════════════════════════════ */}
          {step === 2 && (
            <>
              <p className="mt-2 text-sm text-slate-600">
                {isBgmMode
                  ? "AIがBGMを生成しています。完成までこのページを閉じずにお待ちください。"
                  : "AIが曲を生成しています。完成まで約8分かかります。このページを閉じずにお待ちください。"}
              </p>

              <ProgressBar label={stageLabel ?? (isBgmMode ? "BGMを生成しています…" : "音楽を生成しています…")} />

              <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <p className="text-xs font-semibold leading-relaxed text-indigo-700">
                  {stageLabel
                    ? stageLabel
                    : audioStage === "intro"   ? "イントロ生成中... (1/4)"
                    : audioStage === "verse"   ? "Verse生成中... (2/4)"
                    : audioStage === "chorus"  ? "サビ生成中... (3/4)"
                    : audioStage === "outro"   ? "アウトロ生成中... (4/4)"
                    : audioStage === "merging" ? "仕上げ中..."
                    : isBgmMode ? "BGMを作っています..." : "りふぁねこが一生懸命作曲中です🎵"
                  }
                  <br />
                  完成すると自動的に次のステップに進みます。
                </p>
              </div>

              {infoMsg && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-700">{infoMsg}</p>
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════
              Step 3：完成
          ════════════════════════════════════════════════════ */}
          {step === 3 && audioUrl && (
            <>
              <p className="mt-2 text-sm text-slate-600">
                {isBgmMode ? "BGMが完成しました！再生・ダウンロードできます。" : "曲が完成しました！再生・ダウンロードできます。"}
              </p>

              <div className="mt-5 rounded-[20px] border border-indigo-100 bg-indigo-50 p-4">
                {/* タイトル + 品質バッジ（SONGモードのみ） */}
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-extrabold text-slate-900">{resultTitle}</p>
                  {!isBgmMode && lyricsGateResult === "pass" && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      ✓ 品質 良好
                    </span>
                  )}
                  {!isBgmMode && lyricsGateResult === "review" && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      ⚠ 要確認
                    </span>
                  )}
                  {!isBgmMode && lyricsGateResult === "reject" && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      ✕ 品質不足
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">使用BP：{isBgmMode ? (isPro ? 150 : 80) : (isProSettingsActive ? 250 : 100)}BP</p>

                {/* 品質警告 */}
                {!isBgmMode && (lyricsReviewRequired || !distributionReady) && audioUrl && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-[11px] font-semibold text-amber-800">
                      ⚠ この曲は歌詞一致または反復に問題があるため、配信提出前に確認してください。
                    </p>
                  </div>
                )}

                {/* オーディオプレイヤー */}
                {isBgmMode ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        シームレスループ
                      </span>
                      <span className="text-xs text-slate-400">ループ再生中</span>
                    </div>
                    <audio controls loop src={audioUrl} className="w-full" />
                  </div>
                ) : (
                  <audio controls src={audioUrl} className="mt-3 w-full" />
                )}

                {/* ジャケット画像生成 */}
                {!isBgmMode && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:w-28 sm:shrink-0">
                        {jacketImageUrl ? (
                          <img
                            src={jacketImageUrl}
                            alt="生成されたジャケット画像"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-3xl text-slate-300">
                            ♪
                          </div>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <p className="text-xs font-extrabold text-slate-900">ジャケット画像</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                          曲のテーマ・ジャンル・雰囲気からアルバムカバーを生成します。
                        </p>
                        {jacketError && (
                          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">
                            {jacketError}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={handleGenerateJacket}
                          disabled={jacketLoading}
                          className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {jacketLoading ? "ジャケット生成中..." : jacketImageUrl ? "ジャケットを再生成する（100BP）" : "ジャケットを生成する（100BP）"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ボタン */}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {downloadUrl && (
                    <button
                      onClick={() => shareOrDownloadAudio(
                        downloadUrl,
                        `${resultTitle || "lifai_song"}.wav`
                      )}
                      className="flex-1 rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 transition active:bg-indigo-100"
                    >
                      📤 WAVを保存 / シェア
                    </button>
                  )}
                  <button
                    onClick={handleFullReset}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white transition active:opacity-80"
                  >
                    {isBgmMode ? "もう1つBGMを作る" : "もう1曲作る"}
                  </button>
                </div>

                {/* リリース・売却申請ボタン */}
                {!isBgmMode && (
                  <>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Link
                        href="/music-release-guide"
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 text-center transition hover:bg-slate-50"
                      >
                        🎵 リリースガイドを見る
                      </Link>
                      <Link
                        href="/apply-sell"
                        className="flex-1 rounded-2xl border border-violet-200 bg-white px-4 py-2.5 text-xs font-semibold text-violet-700 text-center transition hover:bg-violet-50"
                      >
                        💰 売却申請
                      </Link>
                    </div>
                    <Link
                      href="/narasu-agency"
                      className="mt-2 block w-full rounded-2xl border border-teal-200 bg-white px-4 py-2.5 text-xs font-semibold text-teal-700 text-center transition hover:bg-teal-50"
                    >
                      📋 narasu配信代理申請（代行サービス）
                    </Link>
                  </>
                )}

                {/* 歌詞エディター + 保存 */}
                {displayLyrics && (
                  <div className="mt-3 flex flex-col gap-2">
                    {/* 表示用歌詞 インライン編集 */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm font-bold text-slate-600">歌詞（表示用）</span>
                        {editingLyrics ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setDisplayLyrics(editedDisplayLyrics); setEditingLyrics(false); }}
                              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white active:opacity-80"
                            >
                              ✅ 保存
                            </button>
                            <button
                              onClick={() => { setEditedDisplayLyrics(displayLyrics); setEditingLyrics(false); }}
                              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 active:bg-slate-100"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingLyrics(true)}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 active:bg-slate-100"
                          >
                            ✏️ 編集
                          </button>
                        )}
                      </div>
                      <div className="border-t border-slate-100 px-4 pb-3 pt-2">
                        {editingLyrics ? (
                          <textarea
                            value={editedDisplayLyrics}
                            onChange={(e) => {
                              setEditedDisplayLyrics(e.target.value);
                              e.target.style.height = "auto";
                              e.target.style.height = e.target.scrollHeight + "px";
                            }}
                            onFocus={(e) => {
                              e.target.style.height = "auto";
                              e.target.style.height = e.target.scrollHeight + "px";
                            }}
                            className="w-full rounded-xl border border-indigo-200 p-3 leading-relaxed outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                            style={{ fontSize: "16px", minHeight: "180px", resize: "none" }}
                          />
                        ) : (
                          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                            {editedDisplayLyrics}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 表示用 保存/シェアボタン */}
                    <button
                      onClick={() => shareOrDownloadText(
                        `${resultTitle}\n\n${editedDisplayLyrics}`,
                        `lyrics-display-${jobId || "song"}.txt`
                      )}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition active:bg-slate-100"
                    >
                      📄 歌詞を保存 / シェア（表示用）
                    </button>

                    {/* 配信用 */}
                    {distributionLyrics ? (
                      <button
                        onClick={() => shareOrDownloadText(
                          `${resultTitle}\n\n${editedDistribLyrics}`,
                          `lyrics-distribution-${jobId || "song"}.txt`
                        )}
                        className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition active:opacity-70 ${
                          distributionReady
                            ? "border-violet-200 bg-white text-violet-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        {distributionReady ? "✅ 配信用歌詞を保存 / シェア" : "📋 配信用歌詞を保存 / シェア（要確認）"}
                      </button>
                    ) : (
                      <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-600">
                        🚫 配信用歌詞：品質確認が必要なため提出前に手動確認が必要です
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── 生成ログ ────────────────────────────────────────────── */}
        {history.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-extrabold text-slate-700">🎵 生成ログ（{history.length}件）</h2>
              <p className="text-[11px] text-slate-400">ログは31日後に自動的に削除されます</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map((entry) => (
                <div key={entry.jobId} className="rounded-[18px] border border-slate-200 bg-white p-3.5 shadow-sm">
                  <p className="text-[12px] font-bold text-slate-800 truncate" title={entry.title}>
                    {entry.title || "無題"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{formatDate(entry.createdAt)}</p>
                  <audio controls src={entry.audioUrl} className="mt-2 w-full" style={{ height: "32px" }} />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => shareOrDownloadAudio(
                        entry.downloadUrl,
                        `${entry.title || "lifai_song"}.${entry.downloadUrl?.includes(".mp3") ? "mp3" : "wav"}`
                      )}
                      className="rounded-lg border border-indigo-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-indigo-600 active:bg-indigo-50 transition"
                    >
                      📤 {entry.downloadUrl?.includes(".mp3") ? "MP3" : "WAV"}
                    </button>
                    {entry.lyrics && (
                      <button
                        onClick={() => shareOrDownloadText(
                          `${entry.title}\n\n${entry.lyrics}`,
                          `${entry.title || "lyrics"}_lyrics.txt`
                        )}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-600 active:bg-slate-50 transition"
                      >
                        📄 歌詞
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(entry.downloadUrl).then(() => {
                          setCopiedJobId(entry.jobId);
                          setTimeout(() => setCopiedJobId(null), 2000);
                        });
                      }}
                      className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition ${
                        copiedJobId === entry.jobId
                          ? "border-green-300 bg-green-50 text-green-600"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {copiedJobId === entry.jobId ? "コピー済み✓" : "URLコピー"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </div>

    {/* ── チュートリアルオーバーレイ ─────────────────────────────────────── */}
    {tutorialStep !== null && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        onClick={() => {
          localStorage.setItem(TUTORIAL_KEY, "1");
          setTutorialStep(null);
        }}
      >
        <div
          className="relative w-full max-w-sm rounded-[24px] bg-white p-7 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* スライドインジケーター */}
          <div className="flex justify-center gap-1.5 mb-5">
            {TUTORIAL_SLIDES.map((_, i) => (
              <div
                key={i}
                className={[
                  "h-1.5 rounded-full transition-all",
                  i === tutorialStep ? "w-6 bg-indigo-500" : "w-1.5 bg-slate-200",
                ].join(" ")}
              />
            ))}
          </div>

          {/* コンテンツ */}
          <div className="text-center">
            <div className="text-4xl mb-3">{TUTORIAL_SLIDES[tutorialStep].icon}</div>
            <h2 className="text-base font-extrabold text-slate-900 mb-2">
              {TUTORIAL_SLIDES[tutorialStep].title}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {TUTORIAL_SLIDES[tutorialStep].body}
            </p>
          </div>

          {/* ナビゲーション */}
          <div className="mt-7 flex items-center gap-2">
            {tutorialStep > 0 && (
              <button
                type="button"
                onClick={() => setTutorialStep(tutorialStep - 1)}
                className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                ← 戻る
              </button>
            )}
            {tutorialStep < TUTORIAL_SLIDES.length - 1 ? (
              <button
                type="button"
                onClick={() => setTutorialStep(tutorialStep + 1)}
                className="flex-1 rounded-2xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition"
              >
                次へ →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(TUTORIAL_KEY, "1");
                  setTutorialStep(null);
                }}
                className="flex-1 rounded-2xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition"
              >
                はじめる
              </button>
            )}
          </div>

          {/* スキップ */}
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(TUTORIAL_KEY, "1");
              setTutorialStep(null);
            }}
            className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600 transition"
          >
            スキップ
          </button>
        </div>
      </div>
    )}
    </main>
  );
}

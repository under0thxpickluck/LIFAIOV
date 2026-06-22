"use client";

import Link from "next/link";
import { shareOrDownloadAudio, shareOrDownloadText } from "@/app/lib/music-download";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, getAuthSecret, setAuth } from "../../lib/auth";

const PRO_PLANS = ["2000", "3000", "5000"];

type GenStatus = "idle" | "generating" | "succeeded" | "failed";

const MOOD_TAGS = [
  "さわやか", "クール", "エモい", "明るい", "落ち着いた",
  "ロマンチック", "激しい", "切ない", "楽しい", "神秘的",
  "ジャズ", "ロック", "ポップ", "チル", "ダーク",
  "壮大", "かわいい", "夏っぽい", "夜っぽい", "前向き",
];

const GENRES = [
  "ポップ", "ロック", "ジャズ", "クラシック", "EDM",
  "ヒップホップ", "R&B", "アニメ", "ローファイ", "シネマティック",
];

const BPM_OPTIONS = [
  { label: "スロー(60-80)", value: 70 },
  { label: "ミディアム(90-110)", value: 100 },
  { label: "アップテンポ(120-140)", value: 130 },
  { label: "激速(150+)", value: 160 },
];

const VOCAL_STYLES = ["女性ボーカル", "男性ボーカル", "混声", "ボーカルなし"];
const VOCAL_MOODS = ["甘い", "クール", "パワフル", "ウィスパー", "エモーショナル"];
const INSTRUMENTS = ["ピアノ", "ギター", "ストリングス", "シンセ", "ドラム", "ベース", "ブラス", "アコースティック"];

const GENRE_EN: Record<string, string> = {
  "ポップ": "pop music",
  "ロック": "rock music",
  "ジャズ": "jazz music",
  "クラシック": "classical orchestral music",
  "EDM": "EDM electronic dance music",
  "ヒップホップ": "hip hop music",
  "R&B": "R&B soul music",
  "アニメ": "anime style music J-pop",
  "ローファイ": "lo-fi hip hop chill beats",
  "シネマティック": "cinematic film score music",
};

const VOCAL_MOOD_EN: Record<string, string> = {
  "甘い": "sweet gentle vocals",
  "クール": "cool stylish vocals",
  "パワフル": "powerful strong vocals",
  "ウィスパー": "soft whisper vocals",
  "エモーショナル": "emotional heartfelt vocals",
};

const INSTRUMENT_EN: Record<string, string> = {
  "ピアノ": "piano",
  "ギター": "guitar",
  "ストリングス": "strings orchestra",
  "シンセ": "synthesizer",
  "ドラム": "drums percussion",
  "ベース": "bass guitar",
  "ブラス": "brass horns",
  "アコースティック": "acoustic instruments",
};

const VOCAL_STYLE_API: Record<string, string> = {
  "女性ボーカル": "pop",
  "男性ボーカル": "none",
  "混声": "none",
  "ボーカルなし": "none",
};

const VOCAL_STYLE_EN: Record<string, string> = {
  "女性ボーカル": "",
  "男性ボーカル": "male vocals male singer",
  "混声": "mixed chorus male and female vocals",
  "ボーカルなし": "",
};

// ── 波形タイプ ──────────────────────────────────────
const WAVEFORM_TYPES = ["サイン波", "矩形波", "三角波", "ノコギリ波", "ノイズ", "オーガニック"];
const WAVEFORM_API_MAP: Record<string, string> = {
  "サイン波": "sine",
  "矩形波": "square",
  "三角波": "triangle",
  "ノコギリ波": "sawtooth",
  "ノイズ": "noise",
  "オーガニック": "organic",
};

// ── ヒューマナイズ強度 ──────────────────────────────
const HUMANIZE_LEVELS = ["なし", "弱（プロ向け）", "中（自然な揺れ）", "強（ライブ感）"];
const HUMANIZE_EN: Record<string, string> = {
  "なし": "",
  "弱（プロ向け）": "subtle timing variations, minimal humanization",
  "中（自然な揺れ）": "natural timing rubato, moderate humanization, organic feel",
  "強（ライブ感）": "strong live feel, heavy rubato, expressive timing, imperfect timing",
};

// ── タイミングのゆらぎ ──────────────────────────────
const TIMING_OPTIONS = ["タイト", "普通", "ルーズ", "グルーヴィー"];
const TIMING_EN: Record<string, string> = {
  "タイト": "tight quantized timing",
  "普通": "normal timing",
  "ルーズ": "loose relaxed timing",
  "グルーヴィー": "groovy swung rhythm",
};

// ── ベロシティの強弱 ────────────────────────────────
const VELOCITY_OPTIONS = ["均一", "自然", "ダイナミック", "エクスプレッシブ"];
const VELOCITY_EN: Record<string, string> = {
  "均一": "uniform velocity",
  "自然": "natural velocity variations",
  "ダイナミック": "dynamic velocity range",
  "エクスプレッシブ": "expressive velocity, dramatic dynamics",
};

// ── 曲の構成 ────────────────────────────────────────
const SONG_STRUCTURES = [
  "Aメロ→サビ",
  "Aメロ→Bメロ→サビ",
  "イントロ→Aメロ→Bメロ→サビ→アウトロ",
  "インスト",
];
const STRUCTURE_EN: Record<string, string> = {
  "Aメロ→サビ": "verse chorus structure",
  "Aメロ→Bメロ→サビ": "verse pre-chorus chorus structure",
  "イントロ→Aメロ→Bメロ→サビ→アウトロ": "intro verse pre-chorus chorus outro full song structure",
  "インスト": "instrumental no vocals",
};

// ── 歌詞のテーマ ────────────────────────────────────
const LYRICS_THEMES = ["愛", "別れ", "夢", "自由", "孤独", "希望", "青春", "挑戦", "夜", "自然"];
const LYRICS_THEME_EN: Record<string, string> = {
  "愛": "love",
  "別れ": "farewell separation",
  "夢": "dreams aspirations",
  "自由": "freedom independence",
  "孤独": "loneliness solitude",
  "希望": "hope future",
  "青春": "youth coming of age",
  "挑戦": "challenge determination",
  "夜": "night darkness",
  "自然": "nature landscape",
};

// ── 歌詞の言語 ──────────────────────────────────────
const LYRICS_LANGS = ["日本語", "英語", "日英混合"];
const LYRICS_LANG_EN: Record<string, string> = {
  "日本語": "Japanese lyrics",
  "英語": "English lyrics",
  "日英混合": "mixed Japanese English lyrics",
};

// ── 歌詞のトーン ────────────────────────────────────
const LYRICS_TONES = ["ポジティブ", "ネガティブ", "ニュートラル", "ストーリー仕立て"];
const LYRICS_TONE_EN: Record<string, string> = {
  "ポジティブ": "positive uplifting message",
  "ネガティブ": "melancholic sad tone",
  "ニュートラル": "neutral balanced tone",
  "ストーリー仕立て": "narrative storytelling",
};

// ── プリセット（8種） ───────────────────────────────
const PRESETS = [
  { label: "🌃 夜のドライブ", prompt: "dark synthwave, night driving, neon city lights, atmospheric electronic" },
  { label: "☀️ 夏のポップ", prompt: "bright summer pop, catchy hooks, beach vibes, upbeat cheerful" },
  { label: "🎷 ジャズカフェ", prompt: "smooth jazz, cafe atmosphere, laid-back piano, warm bass, relaxing" },
  { label: "⚡ エピックバトル", prompt: "epic orchestral, battle theme, powerful brass, dramatic strings, intense" },
  { label: "🌿 癒しの自然", prompt: "healing ambient, nature sounds, peaceful acoustic guitar, soft piano, meditation" },
  { label: "🔥 ヒップホップ", prompt: "hip hop beat, urban rhythm, trap drums, 808 bass, cool flow" },
  { label: "💫 アニメOP", prompt: "anime opening theme, J-pop energetic, catchy chorus, electric guitar, exciting" },
  { label: "🌙 ローファイ学習", prompt: "lo-fi hip hop, study beats, mellow piano, soft drums, chill atmosphere" },
];

// ── ダークテーマカラー定数 ──────────────────────────
const C = {
  bg: "#0a0a0a",
  card: "#1a1a1a",
  section: "#111111",
  inner: "#222222",
  border: "#333333",
  borderSubtle: "#2a2a2a",
  borderAccent: "#f0c040",
  textPrimary: "#ffffff",
  textSecondary: "#e0e0e0",
  textMuted: "#888888",
  textDim: "#555555",
  gold: "#f0c040",
  goldDark: "#d4a017",
  btnBg: "#1a1a1a",
  btnBorder: "#444444",
  btnText: "#e0e0e0",
} as const;

function musicError(code: "MUSIC-001" | "MUSIC-002" | "MUSIC-003"): string {
  return `エラーが発生しました（エラーコード: ${code}）\n公式LINEにお問い合わせください。`;
}

export default function MusicProPage() {
  const router = useRouter();
  const [planChecked, setPlanChecked] = useState(false);

  const [prompt, setPrompt] = useState("");

  const [genre, setGenre] = useState<string>("");
  const [bpmRange, setBpmRange] = useState<string>("ミディアム(90-110)");
  const [vocalStyle, setVocalStyle] = useState<string>("女性ボーカル");
  const [vocalMood, setVocalMood] = useState<string>("");
  const [instruments, setInstruments] = useState<string[]>([]);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);

  // 波形・ヒューマナイズ設定
  const [waveformType, setWaveformType] = useState<string>("サイン波");
  const [humanizeLevel, setHumanizeLevel] = useState<string>("中（自然な揺れ）");
  const [timing, setTiming] = useState<string>("普通");
  const [velocity, setVelocity] = useState<string>("自然");

  // 歌詞・構成設定
  const [songStructure, setSongStructure] = useState<string>("Aメロ→Bメロ→サビ");
  const [lyricsThemes, setLyricsThemes] = useState<string[]>([]);
  const [lyricsLang, setLyricsLang] = useState<string>("日本語");
  const [lyricsTone, setLyricsTone] = useState<string>("ニュートラル");

  const [status, setStatus] = useState<GenStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("生成中…");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) {
      router.replace("/login");
      return;
    }

    const id =
      (auth as any)?.id ||
      (auth as any)?.loginId ||
      (auth as any)?.login_id ||
      (auth as any)?.email ||
      "";
    const code = getAuthSecret() || (auth as any)?.token || "";

    if (!id || !code) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ id, code, group: (getAuth() as any)?.group || "" }),
        });
        const data = await res.json().catch(() => ({ ok: false }));

        const rawPlan = data?.me?.plan;
        const plan = data?.ok && rawPlan != null ? String(rawPlan) : "";

        if (!PRO_PLANS.includes(plan)) {
          router.replace("/music");
          return;
        }

        const cur = getAuth();
        if (cur && plan) {
          setAuth({ status: cur.status, id: cur.id, token: cur.token, plan });
        }
        setPlanChecked(true);
      } catch {
        router.replace("/music");
      }
    })();

    return () => {
      if (pollRef.current) {
        clearTimeout(pollRef.current as unknown as ReturnType<typeof setTimeout>);
        pollRef.current = null;
      }
    };
  }, [router]);

  useEffect(() => {
    setEditedLyrics(lyrics ?? "");
  }, [lyrics]);

  function appendMood(mood: string) {
    setPrompt((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed) return mood;
      return trimmed + "、" + mood;
    });
  }

  function toggleInstrument(instr: string) {
    setInstruments((prev) =>
      prev.includes(instr) ? prev.filter((i) => i !== instr) : [...prev, instr]
    );
  }

  function toggleLyricsTheme(theme: string) {
    setLyricsThemes((prev) =>
      prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]
    );
  }

  function buildCombinedPrompt(): string {
    const parts: string[] = [];
    if (genre) parts.push(GENRE_EN[genre] || genre);
    const vocalExtra = VOCAL_STYLE_EN[vocalStyle];
    if (vocalExtra) parts.push(vocalExtra);
    if (vocalMood && vocalStyle !== "ボーカルなし") {
      parts.push(VOCAL_MOOD_EN[vocalMood] || vocalMood);
    }
    if (instruments.length > 0) {
      parts.push(instruments.map((i) => INSTRUMENT_EN[i] || i).join(", "));
    }
    const humanizeEn = HUMANIZE_EN[humanizeLevel];
    if (humanizeEn) parts.push(humanizeEn);
    const timingEn = TIMING_EN[timing];
    if (timingEn) parts.push(timingEn);
    const velocityEn = VELOCITY_EN[velocity];
    if (velocityEn) parts.push(velocityEn);
    if (songStructure && STRUCTURE_EN[songStructure]) parts.push(STRUCTURE_EN[songStructure]);
    if (lyricsThemes.length > 0) {
      parts.push(lyricsThemes.map((t) => LYRICS_THEME_EN[t] || t).join(", "));
    }
    if (lyricsLang) parts.push(LYRICS_LANG_EN[lyricsLang] || lyricsLang);
    if (lyricsTone) parts.push(LYRICS_TONE_EN[lyricsTone] || lyricsTone);
    if (prompt.trim()) parts.push(prompt.trim());
    return parts.filter(Boolean).join(", ");
  }

  async function handleGenerate() {
    const combinedPrompt = buildCombinedPrompt();
    if (!combinedPrompt || status === "generating") return;

    setStatus("generating");
    setProgress(5);
    setOutputUrl(null);
    setErrorMsg(null);
    setLyrics(null);
    setLyricsOpen(false);
    setReleaseModalOpen(false);

    const bpmValue = BPM_OPTIONS.find((o) => o.label === bpmRange)?.value ?? 120;

    let predictionId: string;

    try {
      const authNow = getAuth();
      const res = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: combinedPrompt,
          mode: "pro",
          bpm: bpmValue,
          waveform: WAVEFORM_API_MAP[waveformType] ?? "sine",
          vocal: VOCAL_STYLE_API[vocalStyle] || "none",
          userId: authNow?.id || "",
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.error === "rate_limited") {
          setErrorMsg("現在ジョブが込み合っております。しばらくたってからお試しください。");
        } else {
          setErrorMsg(musicError("MUSIC-001"));
        }
        setStatus("failed");
        return;
      }
      predictionId = data.predictionId;
      if (data.lyrics) setLyrics(data.lyrics);
    } catch {
      setErrorMsg(musicError("MUSIC-003"));
      setStatus("failed");
      return;
    }

    setProgress(15);

    let ticks = 0;
    let consecutiveErrors = 0;
    const MAX_TICKS = 210;
    const MAX_ERRORS = 3;

    const poll = async () => {
      if (!pollRef.current) return;

      ticks++;
      setProgress(Math.min(90, 15 + ticks * 0.625));

      try {
        const res = await fetch(`/api/music/status?id=${predictionId}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!data.ok) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_ERRORS) {
            pollRef.current = null;
            setErrorMsg(musicError("MUSIC-003"));
            setStatus("failed");
            return;
          }
        } else {
          consecutiveErrors = 0;

          // サーバー提供の進捗・ステージを反映
          if (typeof data.progress === "number") {
            setProgress(Math.round(data.progress * 100));
          }
          if (data.stage) {
            setStageLabel(data.stage);
          }

          if (data.status === "succeeded") {
            pollRef.current = null;
            setProgress(100);
            setOutputUrl(data.outputUrl ?? null);
            if (data.lyrics) setLyrics(data.lyrics);
            setStatus("succeeded");
            return;
          } else if (data.status === "failed" || data.status === "canceled") {
            pollRef.current = null;
            setErrorMsg(musicError("MUSIC-001"));
            setStatus("failed");
            return;
          }
        }
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_ERRORS) {
          pollRef.current = null;
          setErrorMsg(musicError("MUSIC-003"));
          setStatus("failed");
          return;
        }
      }

      if (ticks >= MAX_TICKS) {
        pollRef.current = null;
        setErrorMsg("生成に時間がかかっています。もうしばらくお待ちください（最大7分）");
        setStatus("failed");
        return;
      }

      const timerId = setTimeout(poll, 2000) as unknown as ReturnType<typeof setInterval>;
      pollRef.current = timerId;
    };

    const timerId = setTimeout(poll, 2000) as unknown as ReturnType<typeof setInterval>;
    pollRef.current = timerId;
  }

  function handleReset() {
    if (pollRef.current) {
      clearTimeout(pollRef.current as unknown as ReturnType<typeof setTimeout>);
      pollRef.current = null;
    }
    setStatus("idle");
    setProgress(0);
    setStageLabel("生成中…");
    setOutputUrl(null);
    setErrorMsg(null);
    setLyrics(null);
    setLyricsOpen(false);
    setEditingLyrics(false);
    setReleaseModalOpen(false);
    setWaveformType("サイン波");
    setHumanizeLevel("中（自然な揺れ）");
    setTiming("普通");
    setVelocity("自然");
    setSongStructure("Aメロ→Bメロ→サビ");
    setLyricsThemes([]);
    setLyricsLang("日本語");
    setLyricsTone("ニュートラル");
  }

  if (!planChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ backgroundColor: C.bg }}>
        <p className="text-sm" style={{ color: C.textMuted }}>プランを確認中…</p>
      </main>
    );
  }

  const canGenerate = !!buildCombinedPrompt() && status !== "generating";

  // ── ボタンスタイルヘルパー ──
  const pillBtn = (active: boolean) =>
    active
      ? { backgroundColor: C.gold, borderColor: C.gold, color: "#000000" }
      : { backgroundColor: C.btnBg, borderColor: C.btnBorder, color: C.btnText };

  const rectBtn = (active: boolean) =>
    active
      ? { backgroundColor: C.gold, borderColor: C.gold, color: "#000000" }
      : { backgroundColor: C.inner, borderColor: C.btnBorder, color: C.btnText };

  return (
    <main className="min-h-screen" style={{ backgroundColor: C.bg }}>
      {/* 背景グラデーション */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 520px at 12% -10%, rgba(240,192,64,.07), transparent 60%), radial-gradient(900px 520px at 112% 0%, rgba(155,89,182,.07), transparent 55%)",
        }}
      />

      <div className="mx-auto max-w-[720px] px-4 py-10">
        <div
          className="rounded-[28px] p-6"
          style={{
            backgroundColor: C.card,
            border: `1px solid ${C.border}`,
            boxShadow: "0 26px 70px rgba(0,0,0,.6)",
          }}
        >
          {/* ヘッダー */}
          <div className="flex items-center gap-3">
            <Link
              href="/music"
              className="rounded-2xl border px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
              style={{ backgroundColor: C.inner, borderColor: C.btnBorder, color: C.btnText }}
            >
              ← 戻る
            </Link>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: "rgba(240,192,64,.1)", borderColor: C.gold, color: C.gold }}
            >
              <span className="text-base">🎛️</span>
              PRO
            </div>
          </div>

          <h1 className="mt-6 text-xl font-extrabold tracking-tight" style={{ color: C.textPrimary }}>
            BGM生成 — PRO
          </h1>
          <p className="mt-2 text-sm" style={{ color: C.textMuted }}>
            ジャンル・BPM・ボーカル・楽器を選択して高品質な音楽を生成します。
          </p>

          {/* ── ジャンル ── */}
          <div className="mt-6">
            <label className="block text-xs font-bold" style={{ color: C.textSecondary }}>ジャンル</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenre(genre === g ? "" : g)}
                  disabled={status === "generating"}
                  className="rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                  style={pillBtn(genre === g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* ── BPM ── */}
          <div className="mt-5">
            <label className="block text-xs font-bold" style={{ color: C.textSecondary }}>BPM</label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BPM_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setBpmRange(opt.label)}
                  disabled={status === "generating"}
                  className="rounded-2xl border px-3 py-2 text-xs font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                  style={rectBtn(bpmRange === opt.label)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── ボーカルスタイル ── */}
          <div className="mt-5">
            <label className="block text-xs font-bold" style={{ color: C.textSecondary }}>ボーカルスタイル</label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {VOCAL_STYLES.map((vs) => (
                <button
                  key={vs}
                  type="button"
                  onClick={() => setVocalStyle(vs)}
                  disabled={status === "generating"}
                  className="rounded-2xl border px-3 py-2 text-xs font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                  style={rectBtn(vocalStyle === vs)}
                >
                  {vs}
                </button>
              ))}
            </div>
          </div>

          {/* ── ボーカルの雰囲気 ── */}
          {vocalStyle !== "ボーカルなし" && (
            <div className="mt-5">
              <label className="block text-xs font-bold" style={{ color: C.textSecondary }}>ボーカルの雰囲気</label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {VOCAL_MOODS.map((vm) => (
                  <button
                    key={vm}
                    type="button"
                    onClick={() => setVocalMood(vocalMood === vm ? "" : vm)}
                    disabled={status === "generating"}
                    className="rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                    style={pillBtn(vocalMood === vm)}
                  >
                    {vm}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 楽器構成 ── */}
          <div className="mt-5">
            <label className="block text-xs font-bold" style={{ color: C.textSecondary }}>
              楽器構成{" "}
              <span className="font-normal" style={{ color: C.textDim }}>（複数選択可）</span>
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {INSTRUMENTS.map((instr) => (
                <button
                  key={instr}
                  type="button"
                  onClick={() => toggleInstrument(instr)}
                  disabled={status === "generating"}
                  className="rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                  style={pillBtn(instruments.includes(instr))}
                >
                  {instr}
                </button>
              ))}
            </div>
          </div>

          {/* ── 波形・ヒューマナイズ設定 ── */}
          <div
            className="mt-6 rounded-2xl p-4"
            style={{ backgroundColor: C.section, border: `1px solid ${C.borderSubtle}` }}
          >
            <p className="text-xs font-bold" style={{ color: C.gold }}>波形・ヒューマナイズ設定</p>

            {/* 波形タイプ */}
            <div className="mt-3">
              <label className="block text-[11px] font-semibold" style={{ color: C.textMuted }}>波形タイプ</label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {WAVEFORM_TYPES.map((wt) => (
                  <button
                    key={wt}
                    type="button"
                    onClick={() => setWaveformType(wt)}
                    disabled={status === "generating"}
                    className="rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                    style={pillBtn(waveformType === wt)}
                  >
                    {wt}
                  </button>
                ))}
              </div>
            </div>

            {/* ヒューマナイズ強度 */}
            <div className="mt-3">
              <label className="block text-[11px] font-semibold" style={{ color: C.textMuted }}>ヒューマナイズ強度</label>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {HUMANIZE_LEVELS.map((hl) => (
                  <button
                    key={hl}
                    type="button"
                    onClick={() => setHumanizeLevel(hl)}
                    disabled={status === "generating"}
                    className="rounded-2xl border px-2 py-2 text-[11px] font-semibold leading-tight transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                    style={rectBtn(humanizeLevel === hl)}
                  >
                    {hl}
                  </button>
                ))}
              </div>
            </div>

            {/* タイミングのゆらぎ */}
            <div className="mt-3">
              <label className="block text-[11px] font-semibold" style={{ color: C.textMuted }}>タイミングのゆらぎ</label>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {TIMING_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTiming(t)}
                    disabled={status === "generating"}
                    className="rounded-2xl border px-2 py-2 text-[11px] font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                    style={rectBtn(timing === t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* ベロシティの強弱 */}
            <div className="mt-3">
              <label className="block text-[11px] font-semibold" style={{ color: C.textMuted }}>ベロシティの強弱</label>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {VELOCITY_OPTIONS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVelocity(v)}
                    disabled={status === "generating"}
                    className="rounded-2xl border px-2 py-2 text-[11px] font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                    style={rectBtn(velocity === v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── 歌詞・構成設定 ── */}
          <div
            className="mt-4 rounded-2xl p-4"
            style={{ backgroundColor: C.section, border: `1px solid ${C.borderSubtle}` }}
          >
            <p className="text-xs font-bold" style={{ color: C.gold }}>歌詞・構成設定</p>

            {/* 曲の構成 */}
            <div className="mt-3">
              <label className="block text-[11px] font-semibold" style={{ color: C.textMuted }}>曲の構成</label>
              <div className="mt-2 flex flex-col gap-1.5">
                {SONG_STRUCTURES.map((ss) => (
                  <button
                    key={ss}
                    type="button"
                    onClick={() => setSongStructure(ss)}
                    disabled={status === "generating"}
                    className="rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                    style={rectBtn(songStructure === ss)}
                  >
                    {ss}
                  </button>
                ))}
              </div>
            </div>

            {/* 歌詞のテーマ */}
            <div className="mt-3">
              <label className="block text-[11px] font-semibold" style={{ color: C.textMuted }}>
                歌詞のテーマ{" "}
                <span className="font-normal" style={{ color: C.textDim }}>（複数選択可）</span>
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {LYRICS_THEMES.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => toggleLyricsTheme(theme)}
                    disabled={status === "generating"}
                    className="rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                    style={pillBtn(lyricsThemes.includes(theme))}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>

            {/* 歌詞の言語 */}
            <div className="mt-3">
              <label className="block text-[11px] font-semibold" style={{ color: C.textMuted }}>歌詞の言語</label>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {LYRICS_LANGS.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLyricsLang(lang)}
                    disabled={status === "generating"}
                    className="rounded-2xl border px-2 py-2 text-xs font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                    style={rectBtn(lyricsLang === lang)}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* 歌詞のトーン */}
            <div className="mt-3">
              <label className="block text-[11px] font-semibold" style={{ color: C.textMuted }}>歌詞のトーン</label>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {LYRICS_TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setLyricsTone(tone)}
                    disabled={status === "generating"}
                    className="rounded-2xl border px-2 py-2 text-[11px] font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                    style={rectBtn(lyricsTone === tone)}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── プロンプト ── */}
          <div className="mt-5">
            <label className="block text-xs font-bold" style={{ color: C.textSecondary }}>
              プロンプト{" "}
              <span className="font-normal" style={{ color: C.textDim }}>（テーマ・ムード・追記）</span>
            </label>

            {/* クイックプリセット */}
            <div className="mt-2">
              <p className="mb-1.5 text-[11px] font-semibold" style={{ color: C.textMuted }}>クイックプリセット</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setPrompt(preset.prompt)}
                    disabled={status === "generating"}
                    className="rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ backgroundColor: "rgba(240,192,64,.08)", borderColor: C.gold, color: C.gold }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ムードタグ */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {MOOD_TAGS.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => appendMood(mood)}
                  disabled={status === "generating"}
                  className="rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: C.inner, borderColor: C.btnBorder, color: C.textMuted }}
                >
                  {mood}
                </button>
              ))}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={status === "generating"}
              placeholder="例: 夜の都市を走る、ダークでクールなシンセサイザー音楽…"
              rows={4}
              className="mt-3 w-full resize-none rounded-2xl border px-4 py-3 text-sm focus:outline-none disabled:opacity-60"
              style={{
                backgroundColor: C.section,
                borderColor: C.btnBorder,
                color: C.textSecondary,
              }}
            />
          </div>

          {/* プログレスバー */}
          {status === "generating" && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs font-semibold" style={{ color: C.textMuted }}>
                <span>{stageLabel}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: C.inner, border: `1px solid ${C.border}` }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: `linear-gradient(to right, ${C.gold}, ${C.goldDark})` }}
                />
              </div>
              <div
                className="mt-3 rounded-2xl border px-4 py-3"
                style={{ backgroundColor: "rgba(240,192,64,.07)", borderColor: "rgba(240,192,64,.3)" }}
              >
                <p className="text-xs font-semibold leading-relaxed" style={{ color: C.gold }}>
                  生成を開始しました。完成まで約3〜4分かかります。<br />
                  Verse → Chorus → Bridge の順に生成後、結合します。<br />
                  このページを閉じずにお待ちください。
                </p>
              </div>
            </div>
          )}

          {/* エラー */}
          {status === "failed" && (
            <div
              className="mt-4 rounded-2xl border px-4 py-3"
              style={{ backgroundColor: "rgba(127,29,29,.3)", borderColor: "#7f1d1d" }}
            >
              <p className="whitespace-pre-line text-sm font-semibold" style={{ color: "#fca5a5" }}>
                {errorMsg || musicError("MUSIC-001")}
              </p>
              <button
                onClick={handleReset}
                className="mt-3 rounded-2xl border px-4 py-2 text-xs font-semibold transition hover:opacity-80"
                style={{ backgroundColor: C.inner, borderColor: "#7f1d1d", color: "#fca5a5" }}
              >
                もう一度試す
              </button>
            </div>
          )}

          {/* 完了後 */}
          {status === "succeeded" && outputUrl && (
            <div
              className="mt-6 rounded-[20px] border p-4"
              style={{ backgroundColor: "rgba(240,192,64,.07)", borderColor: "rgba(240,192,64,.4)" }}
            >
              <p className="text-xs font-bold" style={{ color: C.gold }}>約3分の楽曲が完成しました！</p>
              <audio controls src={outputUrl} className="mt-3 w-full" />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => shareOrDownloadAudio(outputUrl, "lifai_music_pro.wav")}
                  className="flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition active:opacity-70"
                  style={{ backgroundColor: C.inner, borderColor: C.gold, color: C.gold }}
                >
                  📤 WAVを保存 / シェア
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-2xl px-4 py-3 text-sm font-extrabold transition active:opacity-80"
                  style={{ background: `linear-gradient(to right, ${C.gold}, ${C.goldDark})`, color: "#000" }}
                >
                  もう一度生成する
                </button>
              </div>
              {lyrics && (
                <div className="mt-2">
                  <button
                    onClick={() => shareOrDownloadText(editedLyrics, `lifai_lyrics_pro_${Date.now()}.txt`)}
                    className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition active:opacity-70"
                    style={{ backgroundColor: C.inner, borderColor: C.gold, color: C.gold }}
                  >
                    📄 歌詞を保存 / シェア
                  </button>
                </div>
              )}

              {/* 歌詞折りたたみ + 編集 */}
              {lyrics && (
                <div
                  className="mt-3 overflow-hidden rounded-2xl border"
                  style={{ backgroundColor: C.inner, borderColor: C.border }}
                >
                  <button
                    onClick={() => { setLyricsOpen((v) => !v); setEditingLyrics(false); }}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold transition active:opacity-70"
                    style={{ color: C.gold }}
                  >
                    <span>歌詞を見る / 編集</span>
                    <span className="text-[11px]">{lyricsOpen ? "▲ 閉じる" : "▼ 開く"}</span>
                  </button>
                  {lyricsOpen && (
                    <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: C.border }}>
                      {editingLyrics ? (
                        <>
                          <div className="mb-3 flex gap-2">
                            <button
                              onClick={() => setEditingLyrics(false)}
                              className="flex-1 rounded-2xl py-3 text-sm font-semibold text-black active:opacity-80"
                              style={{ background: `linear-gradient(to right, ${C.gold}, ${C.goldDark})` }}
                            >
                              ✅ 保存
                            </button>
                            <button
                              onClick={() => { setEditedLyrics(lyrics ?? ""); setEditingLyrics(false); }}
                              className="flex-1 rounded-2xl border py-3 text-sm font-semibold active:opacity-70"
                              style={{ borderColor: C.border, color: C.textSecondary, backgroundColor: C.section }}
                            >
                              ✕ キャンセル
                            </button>
                          </div>
                          <textarea
                            value={editedLyrics}
                            onChange={(e) => {
                              setEditedLyrics(e.target.value);
                              e.target.style.height = "auto";
                              e.target.style.height = e.target.scrollHeight + "px";
                            }}
                            onFocus={(e) => {
                              e.target.style.height = "auto";
                              e.target.style.height = e.target.scrollHeight + "px";
                            }}
                            className="w-full rounded-xl border p-3 leading-relaxed outline-none"
                            style={{
                              fontSize: "16px",
                              minHeight: "180px",
                              resize: "none",
                              borderColor: C.gold,
                              backgroundColor: C.bg,
                              color: C.textPrimary,
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <div className="mb-2 flex justify-end">
                            <button
                              onClick={() => setEditingLyrics(true)}
                              className="rounded-xl border px-4 py-2 text-sm font-semibold active:opacity-70"
                              style={{ borderColor: C.gold, color: C.gold, backgroundColor: C.inner }}
                            >
                              ✏️ 編集
                            </button>
                          </div>
                          <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: C.textSecondary }}>
                            {editedLyrics}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* この曲をどうする？ */}
              <div className="mt-5 border-t pt-5" style={{ borderColor: C.border }}>
                <p className="text-xs font-bold" style={{ color: C.textSecondary }}>この曲をどうする？</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Card 1: 準備中 */}
                  <div className="rounded-2xl border p-4" style={{ backgroundColor: C.section, borderColor: C.border }}>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                      style={{ backgroundColor: C.inner, color: C.textDim }}
                    >
                      🔧 準備中
                    </span>
                    <p className="mt-2 text-xs font-bold" style={{ color: C.textSecondary }}>LIFAIマーケットで売却</p>
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: C.textDim }}>
                      LIFAIの専用売買プラットフォームに出品できます。準備中のためもうしばらくお待ちください。
                    </p>
                    <button
                      disabled
                      className="mt-3 w-full cursor-not-allowed rounded-2xl border px-4 py-2 text-xs font-semibold"
                      style={{ backgroundColor: C.inner, borderColor: C.border, color: C.textDim }}
                    >
                      マーケットで売却
                    </button>
                  </div>

                  {/* Card 2: 利用可能 */}
                  <div
                    className="rounded-2xl border p-4"
                    style={{ backgroundColor: C.section, borderColor: C.gold }}
                  >
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                      style={{ backgroundColor: "rgba(240,192,64,.15)", color: C.gold }}
                    >
                      ✅ 利用可能
                    </span>
                    <p className="mt-2 text-xs font-bold" style={{ color: C.textSecondary }}>自分でリリース</p>
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: C.textMuted }}>
                      TuneCore・NaraSuなど配信サービスを使って自分でリリースできます。
                    </p>
                    <button
                      onClick={() => setReleaseModalOpen(true)}
                      className="mt-3 w-full rounded-2xl border px-4 py-2 text-xs font-semibold transition hover:opacity-80"
                      style={{ backgroundColor: C.inner, borderColor: C.gold, color: C.gold }}
                    >
                      リリース方法を見る
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 生成ボタン */}
          {status !== "succeeded" && (
            <div className="mt-6">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full rounded-2xl px-6 py-3 text-sm font-extrabold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: canGenerate
                    ? `linear-gradient(to right, ${C.gold}, ${C.goldDark})`
                    : C.inner,
                  color: canGenerate ? "#000000" : C.textDim,
                  border: canGenerate ? "none" : `1px solid ${C.border}`,
                  boxShadow: canGenerate ? "0 10px 30px rgba(240,192,64,.25)" : "none",
                }}
              >
                {status === "generating" ? "生成中…" : "生成する"}
              </button>
              {!canGenerate && status === "idle" && (
                <p className="mt-2 text-center text-[11px]" style={{ color: C.textDim }}>
                  ジャンル・楽器・プロンプトのいずれかを選択してください
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs" style={{ color: C.textDim }}>© LIFAI</div>
      </div>

      {/* リリースモーダル */}
      {releaseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          style={{ backgroundColor: "rgba(0,0,0,.7)" }}
          onClick={() => setReleaseModalOpen(false)}
        >
          <div
            className="w-full max-w-[480px] rounded-[24px] p-6 shadow-2xl"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold" style={{ color: C.textPrimary }}>自分でリリースする方法</p>
              <button
                onClick={() => setReleaseModalOpen(false)}
                className="rounded-full p-1.5 transition hover:opacity-70"
                style={{ color: C.textMuted }}
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border p-4" style={{ backgroundColor: C.section, borderColor: C.border }}>
                <p className="text-xs font-bold" style={{ color: C.textSecondary }}>TuneCoreへの申請手順</p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: C.textDim }}>準備中・近日公開予定</p>
              </div>
              <div className="rounded-2xl border p-4" style={{ backgroundColor: C.section, borderColor: C.border }}>
                <p className="text-xs font-bold" style={{ color: C.textSecondary }}>NaraSuへの申請手順</p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: C.textDim }}>準備中・近日公開予定</p>
              </div>
              <p className="text-center text-[11px]" style={{ color: C.textDim }}>
                詳細はLIFAIコミュニティで案内します
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

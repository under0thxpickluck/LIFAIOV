"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import InputPanel from "./components/InputPanel";
import PreviewPanel from "./components/PreviewPanel";
import { getAuth, getAuthSecret } from "@/app/lib/auth";
import { BP_COSTS } from "@/app/lib/bp-config";

// ── チュートリアル ────────────────────────────────────────────────────────────

const NOTE_TUTORIAL_KEY = "lifai_tutorial_seen";

const NOTE_TUTORIAL_SLIDES = [
  {
    icon: "📝",
    title: "3ステップで売れるnote記事を作れます",
    body: `この機能では、テーマを入力するだけで\n売れるnote記事を自動生成できます。\n\n流れはとてもシンプルです👇\n\n① 記事の設定を入力\n② タイトルと構成を選ぶ\n③ 本文を生成する\n\n初心者でも3分で完成します。`,
  },
  {
    icon: "⚙️",
    title: "STEP1：記事の方向性を決める",
    body: `まずは記事の基本情報を入力します。\nここで入力した内容によって、記事の質と売れやすさが大きく変わります。\n\n▼入力項目\n・テーマ（何について書くか）\n・対象読者（誰に向けるか）\n・文章スタイル（雰囲気）\n・専門性（初心者向けなど）\n\n💡 迷ったらシンプルでOK\n「副業」「ダイエット」などでも問題ありません`,
  },
  {
    icon: "💡",
    title: "ここが重要：売れる記事にするコツ",
    body: `少し工夫するだけで、記事の質が一気に上がります👇\n\n✔ テーマは具体的にする\n　例）× 副業　→　○ 副業で月5万円稼ぐ方法\n\n✔ 対象読者を明確にする\n　例）会社員 / 主婦 / 初心者 など\n\n✔ 有料モードを選ぶ\n　・導入無料＋本文有料 → 一番おすすめ`,
  },
  {
    icon: "🎯",
    title: "STEP2：タイトルと構成を選ぶ",
    body: `AIが「売れやすいタイトル」を自動で提案します。\nその中から1つ選ぶだけでOKです。\n\n▼ここでできること\n・売れやすさスコア確認\n・価格の目安\n・ターゲットの確認\n・記事の見出し構成チェック\n\n💡 迷ったら「おすすめの切り口」を選べばOK`,
  },
  {
    icon: "✨",
    title: "STEP3：本文を生成する",
    body: `タイトルを選んだら「本文を生成」を押すだけ。\n数秒で記事が完成します。\n\n生成される内容👇\n・本文（note用）\n・SNS投稿文（X / LINE）\n・説明文\n\nそのまま使ってもOK、\n少し編集してもOKです。`,
  },
  {
    icon: "🚀",
    title: "もっと売れる記事にするために",
    body: `さらに成果を出すコツ👇\n\n✔ 少しだけ自分の言葉を加える\n　→ オリジナル感UP\n\n✔ SNS投稿も一緒に使う\n　→ 集客が一気に増える\n\n✔ 何度でも生成してOK\n　→ 良いタイトルを見つけるのが重要\n\nこのツールは「量産」が強いです。\nまずは1記事作ってみましょう。`,
  },
] as const;

type PlanData = {
  plan_id: string;
  data: {
    recommended_angle: string;
    sellability_score: number;
    suggested_price_yen: number;
    target_persona: string;
    title_candidates: string[];
    outline: { heading: string; purpose: string; target_length: number }[];
  };
};

type ArticleData = {
  markdown: string;
  sections: { heading: string; body_markdown: string; is_paid: boolean }[];
  note_description: string;
  x_post: string;
  line_copy: string;
};

export default function NoteGeneratorPage() {
  const router = useRouter();
  const [step, setStep] = useState<"input" | "plan" | "article">("input");
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [articleData, setArticleData] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginId, setLoginId] = useState<string>("");

  // チュートリアル (null=非表示, 0〜5=スライド番号)
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) {
      router.replace("/login");
      return;
    }
    const id = (auth as any)?.id || (auth as any)?.loginId || "";
    setLoginId(id);

    if (!localStorage.getItem(NOTE_TUTORIAL_KEY)) {
      setTutorialStep(0);
    }
  }, [router]);

  async function handleGeneratePlan(formValues: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/note/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formValues, loginId }),
      });
      const json = await res.json();
      if (json.ok) {
        setPlanData(json);
        setStep("plan");
      } else if (json.error === "insufficient_bp") {
        setError(`BPが不足しています（必要: 150BP、残高: ${json.bp_balance ?? "?"}BP）`);
      } else {
        setError(json.error || "企画生成に失敗しました");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateArticle(
    planId: string,
    selectedTitle: string,
    outline: { heading: string; purpose: string; target_length: number }[]
  ) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/note/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: planId,
          selected_title: selectedTitle,
          outline,
          tone: "note売れ筋風",
          length: 8000,
          paywall_mode: "intro_free_main_paid",
          loginId,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setArticleData(json.data);
        setStep("article");
      } else if (json.error === "insufficient_bp") {
        setError(`BPが不足しています（必要: ${BP_COSTS.note_full}BP、残高: ${json.bp_balance ?? "?"}BP）`);
      } else {
        setError(json.error || "本文生成に失敗しました");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Link href="/top" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
            ← LIFAIに戻る
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">note記事ジェネレーター</h1>
            <button
              type="button"
              onClick={() => setTutorialStep(0)}
              title="使い方を見る"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-bold text-gray-500 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-600 transition"
            >
              ?
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">テーマを入力するだけで、売れるnote記事を自動生成します</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-180px)]">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${step === "input" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                {step === "input" ? "STEP 1" : step === "plan" ? "STEP 2" : "完了"}
              </span>
              <span className="text-sm font-semibold text-gray-700">
                {step === "input" ? "記事の設定" : step === "plan" ? "企画・タイトル選択" : "生成完了"}
              </span>
              {step !== "input" && (
                <button
                  onClick={() => { setStep("input"); setPlanData(null); setArticleData(null); }}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                >
                  最初からやり直す
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              <InputPanel
                step={step}
                planData={planData}
                loading={loading}
                onGeneratePlan={handleGeneratePlan}
                onGenerateArticle={handleGenerateArticle}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 overflow-hidden flex flex-col">
            <p className="text-sm font-semibold text-gray-700 mb-4">プレビュー</p>
            <div className="flex-1 overflow-hidden flex flex-col">
              <PreviewPanel
                step={step}
                planData={planData}
                articleData={articleData}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── チュートリアルオーバーレイ ───────────────────────────────────── */}
      {tutorialStep !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => {
            localStorage.setItem(NOTE_TUTORIAL_KEY, "true");
            setTutorialStep(null);
          }}
        >
          <div
            className="relative w-full max-w-sm rounded-[24px] bg-white p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 進捗 */}
            <p className="text-center text-xs font-semibold text-gray-400 mb-4">
              {tutorialStep + 1} / {NOTE_TUTORIAL_SLIDES.length}
            </p>

            {/* スライドインジケーター */}
            <div className="flex justify-center gap-1.5 mb-5">
              {NOTE_TUTORIAL_SLIDES.map((_, i) => (
                <div
                  key={i}
                  className={[
                    "h-1.5 rounded-full transition-all",
                    i === tutorialStep ? "w-6 bg-purple-600" : "w-1.5 bg-gray-200",
                  ].join(" ")}
                />
              ))}
            </div>

            {/* コンテンツ */}
            <div className="text-center">
              <div className="text-4xl mb-3">{NOTE_TUTORIAL_SLIDES[tutorialStep].icon}</div>
              <h2 className="text-base font-extrabold text-gray-900 mb-3">
                {NOTE_TUTORIAL_SLIDES[tutorialStep].title}
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line text-left">
                {NOTE_TUTORIAL_SLIDES[tutorialStep].body}
              </p>
            </div>

            {/* ナビゲーション */}
            <div className="mt-7 flex items-center gap-2">
              {tutorialStep > 0 && (
                <button
                  type="button"
                  onClick={() => setTutorialStep(tutorialStep - 1)}
                  className="flex-1 rounded-2xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                >
                  ← 戻る
                </button>
              )}
              {tutorialStep < NOTE_TUTORIAL_SLIDES.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setTutorialStep(tutorialStep + 1)}
                  className="flex-1 rounded-2xl bg-purple-600 py-2.5 text-sm font-bold text-white hover:bg-purple-700 transition"
                >
                  次へ →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(NOTE_TUTORIAL_KEY, "true");
                    setTutorialStep(null);
                  }}
                  className="flex-1 rounded-2xl bg-purple-600 py-2.5 text-sm font-bold text-white hover:bg-purple-700 transition"
                >
                  記事を作ってみる
                </button>
              )}
            </div>

            {/* スキップ */}
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(NOTE_TUTORIAL_KEY, "true");
                setTutorialStep(null);
              }}
              className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition"
            >
              スキップ
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

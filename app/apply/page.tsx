"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { StepHeader } from "@/components/StepHeader";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { loadDraft, saveDraft, type Draft, type Plan } from "@/components/storage";


const AGE_BANDS = [
  { value: "10s", label: "10代" },
  { value: "20s", label: "20代" },
  { value: "30s", label: "30代" },
  { value: "40s", label: "40代" },
  { value: "50s", label: "50代" },
  { value: "60s", label: "60代〜" },
];

const JOBS = [
  { value: "company_employee", label: "会社員" },
  { value: "freelance", label: "フリーランス" },
  { value: "self_employed", label: "自営業" },
  { value: "management", label: "経営者" },
  { value: "student", label: "学生" },
  { value: "housework", label: "主婦・主夫" },
  { value: "part_time", label: "アルバイト・パート" },
  { value: "public_servant", label: "公務員" },
  { value: "engineer", label: "エンジニア" },
  { value: "creator", label: "クリエイター" },
  { value: "sales", label: "営業" },
  { value: "medical", label: "医療・福祉" },
  { value: "education", label: "教育" },
  { value: "other", label: "その他" },
];

const PREFS = [
  { value: "hokkaido", label: "北海道" },
  { value: "aomori", label: "青森県" },
  { value: "iwate", label: "岩手県" },
  { value: "miyagi", label: "宮城県" },
  { value: "akita", label: "秋田県" },
  { value: "yamagata", label: "山形県" },
  { value: "fukushima", label: "福島県" },
  { value: "ibaraki", label: "茨城県" },
  { value: "tochigi", label: "栃木県" },
  { value: "gunma", label: "群馬県" },
  { value: "saitama", label: "埼玉県" },
  { value: "chiba", label: "千葉県" },
  { value: "tokyo", label: "東京都" },
  { value: "kanagawa", label: "神奈川県" },
  { value: "niigata", label: "新潟県" },
  { value: "toyama", label: "富山県" },
  { value: "ishikawa", label: "石川県" },
  { value: "fukui", label: "福井県" },
  { value: "yamanashi", label: "山梨県" },
  { value: "nagano", label: "長野県" },
  { value: "gifu", label: "岐阜県" },
  { value: "shizuoka", label: "静岡県" },
  { value: "aichi", label: "愛知県" },
  { value: "mie", label: "三重県" },
  { value: "shiga", label: "滋賀県" },
  { value: "kyoto", label: "京都府" },
  { value: "osaka", label: "大阪府" },
  { value: "hyogo", label: "兵庫県" },
  { value: "nara", label: "奈良県" },
  { value: "wakayama", label: "和歌山県" },
  { value: "tottori", label: "鳥取県" },
  { value: "shimane", label: "島根県" },
  { value: "okayama", label: "岡山県" },
  { value: "hiroshima", label: "広島県" },
  { value: "yamaguchi", label: "山口県" },
  { value: "tokushima", label: "徳島県" },
  { value: "kagawa", label: "香川県" },
  { value: "ehime", label: "愛媛県" },
  { value: "kochi", label: "高知県" },
  { value: "fukuoka", label: "福岡県" },
  { value: "saga", label: "佐賀県" },
  { value: "nagasaki", label: "長崎県" },
  { value: "kumamoto", label: "熊本県" },
  { value: "oita", label: "大分県" },
  { value: "miyazaki", label: "宮崎県" },
  { value: "kagoshima", label: "鹿児島県" },
  { value: "okinawa", label: "沖縄県" },
];

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-slate-300/60 bg-white p-5 shadow-[0_18px_45px_rgba(2,6,23,.10)]">
      <div className="mb-4">
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
      </div>
      {children}
    </section>
  );
}

function InputWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-300/70 bg-slate-50 px-4 py-3">
      {children}
    </div>
  );
}

export default function ApplyPage() {
  // ✅ 重要：初回レンダーは常に同じ値（SSRと一致）にしておく
  const emptyDraft = useMemo<Draft>(
    () => ({
      plan: undefined,
      email: "",
      name: "",
      nameKana: "",
      discordId: "",
      refName: "",
      refId: "",
      // 追加
      ageBand: "",
      prefecture: "",
      city: "",
      job: "",
      // applyId（Draftに追加済み前提）
      applyId: "",
    }),
    []
  );

  const [draft, setDraft] = useState<Draft>(emptyDraft);

  // applyId復帰フォーム用state
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryChecking, setRecoveryChecking] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");

  // ✅ 重要：localStorage の読み込みは「マウント後」に行う（Hydration対策）
  useEffect(() => {
    const initial = loadDraft();

    // ✅ URLの applyId / plan / refCode を draft に反映
    const qs = new URLSearchParams(window.location.search);
    const applyIdFromUrl = qs.get("applyId") ?? "";
    const planFromUrl = qs.get("plan");
    const refCodeFromUrl = qs.get("refCode") ?? "";

    const merged: Draft = {
      ...emptyDraft,
      ...initial,

      // null/undefined の保険
      email: initial.email ?? "",
      name: initial.name ?? "",
      nameKana: initial.nameKana ?? "",
      discordId: initial.discordId ?? "",
      refName: initial.refName ?? "",
      // refId が未入力の場合のみ URL の refCode を補完（既入力は維持）
      refId: (initial.refId ?? "") || refCodeFromUrl,
      ageBand: initial.ageBand ?? "",
      prefecture: initial.prefecture ?? "",
      city: initial.city ?? "",
      job: initial.job ?? "",

      // ✅ applyId は URL 優先で上書き
      applyId: applyIdFromUrl || (initial.applyId ?? ""),

      // ✅ plan は「すでに入ってるなら維持」、無ければ URL が数値なら採用
      plan:
        initial.plan ??
        (planFromUrl && /^\d+$/.test(planFromUrl)
          ? (planFromUrl as Plan)
          : undefined),
    };

    setDraft(merged);

    // ✅ URLから来た applyId/plan を確実に次画面へ渡すため保存
    saveDraft(merged);

    // applyId がどこにもない場合は復帰フォームを表示
    if (!merged.applyId) {
      setShowRecovery(true);
    }
  }, [emptyDraft]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    saveDraft(next);
  };

  const errors = {
    email: !draft.email ? "メールアドレスは必須です" : !isEmail(draft.email) ? "メール形式が正しくありません" : "",
    name: !draft.name ? "お名前は必須です" : "",
    nameKana: !draft.nameKana ? "カタカナは必須です" : "",
    discordId: !draft.discordId ? "Discord ID は必須です" : "",
    plan: !draft.plan ? "権利（プラン）が未選択です（前のページで選択してください）" : "",
    ageBand: !draft.ageBand ? "年齢帯を選択してください" : "",
    prefecture: !draft.prefecture ? "都道府県を選択してください" : "",
    city: !draft.city ? "市町村を入力してください" : "",
    job: !draft.job ? "職業を選択してください" : "",
  };

  const canGoNext =
    !errors.email &&
    !errors.name &&
    !errors.nameKana &&
    !errors.discordId &&
    !errors.plan &&
    !errors.ageBand &&
    !errors.prefecture &&
    !errors.city &&
    !errors.job;

  // applyId復帰フォームの確認処理
  async function handleRecoveryCheck() {
    const id = recoveryInput.trim();
    if (!id) {
      setRecoveryError("注文IDを入力してください");
      return;
    }
    setRecoveryChecking(true);
    setRecoveryError("");
    try {
      const res = await fetch(`/api/apply/status?applyId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!data.ok || data.status === "not_found") {
        setRecoveryError("その注文IDは見つかりませんでした。お確かめのうえ再入力してください。");
        return;
      }
      // 見つかった → applyId を draft に保存してフォームへ進む
      const next = { ...draft, applyId: id };
      setDraft(next);
      saveDraft(next);
      setShowRecovery(false);
    } catch {
      setRecoveryError("確認中にエラーが発生しました。しばらくしてから再試行してください。");
    } finally {
      setRecoveryChecking(false);
    }
  }

  return (
    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.22),transparent_60%),radial-gradient(900px_600px_at_115%_0%,rgba(34,211,238,.18),transparent_55%),linear-gradient(180deg,#F4F6FB,#FFFFFF_45%,#F4F6FB)]" />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(2,6,23,.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(2,6,23,.12) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />

      <div className="mx-auto max-w-[920px] px-4 py-10">
        {showRecovery && (
          <div className="mb-6 rounded-[22px] border border-amber-300 bg-amber-50 p-6 shadow-sm">
            <div className="text-sm font-extrabold text-amber-900">支払い後にページを閉じてしまった方へ</div>
            <p className="mt-2 text-xs text-amber-800 leading-relaxed">
              支払い時に発行された注文IDを入力すると、申請フォームに進めます。<br />
              注文IDは「lifai_」で始まる番号です（例：lifai_1234567890）。
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
              <input
                type="text"
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value)}
                placeholder="例：lifai_1234567890"
                className="flex-1 rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={handleRecoveryCheck}
                disabled={recoveryChecking}
                className="rounded-2xl bg-amber-600 px-6 py-3 text-sm font-extrabold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {recoveryChecking ? "確認中…" : "確認する"}
              </button>
            </div>
            {recoveryError && (
              <div className="mt-3 text-xs font-semibold text-rose-700">{recoveryError}</div>
            )}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/5000"
            className="text-sm font-semibold text-slate-700 hover:text-slate-900 underline decoration-slate-300 hover:decoration-slate-500"
          >
            ← 戻る（権利購入）
          </Link>

          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
              <Image src="/lifai.png" alt="LIFAI" fill className="object-contain p-1" />
            </div>

            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-wide text-slate-900">LIFAI</div>
              <div className="text-[11px] font-semibold text-slate-600">AI教育サロン</div>
            </div>

            <Link
              href="/login"
              className="ml-2 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold text-slate-800 hover:bg-slate-50"
            >
              ログイン
            </Link>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-300/70 bg-white p-6 shadow-[0_28px_80px_rgba(2,6,23,.14)]">
          <StepHeader step={2} total={3} title="参加申請フォーム" subtitle="必要情報を入力して、最終確認へ進みます" />

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            <Box title="基本情報（必須）">
              <div className="mb-4 text-xs font-semibold text-slate-600">
                入力内容は端末内に一時保存されます。
              </div>

              <div className="grid gap-4">
                <InputWrap>
                  <Field
                    label="メールアドレス"
                    required
                    type="email"
                    value={draft.email ?? ""}
                    onChange={(v) => set("email", v)}
                    placeholder="example@gmail.com"
                    maxLength={254}
                  />
                  {errors.email ? <div className="mt-1 text-xs font-semibold text-rose-700">{errors.email}</div> : null}
                </InputWrap>

                <InputWrap>
                  <Field
                    label="お名前"
                    required
                    value={draft.name ?? ""}
                    onChange={(v) => set("name", v)}
                    placeholder="例：山田太郎（スペースなし）"
                    hint="姓と名の間はスペースを空けずに入力してください。"
                    maxLength={50}
                  />
                  {errors.name ? <div className="mt-1 text-xs font-semibold text-rose-700">{errors.name}</div> : null}
                </InputWrap>

                <InputWrap>
                  <Field
                    label="お名前（カタカナ）"
                    required
                    value={draft.nameKana ?? ""}
                    onChange={(v) => set("nameKana", v)}
                    placeholder="例：ヤマダタロウ（スペースなし）"
                    hint="姓と名の間はスペースを空けずに入力してください。"
                    maxLength={50}
                  />
                  {errors.nameKana ? <div className="mt-1 text-xs font-semibold text-rose-700">{errors.nameKana}</div> : null}
                </InputWrap>

                <InputWrap>
                  <Field
                    label="Discord ID"
                    required
                    value={draft.discordId ?? ""}
                    onChange={(v) => set("discordId", v)}
                    placeholder="例：lifai_member"
                    maxLength={100}
                  />
                  {errors.discordId ? <div className="mt-1 text-xs font-semibold text-rose-700">{errors.discordId}</div> : null}
                </InputWrap>
              </div>
            </Box>

            <aside className="grid gap-5">
              <Box title="プロフィール（必須）">
                <div className="grid gap-4">
                  <InputWrap>
                    <Select
                      label="年齢帯"
                      value={draft.ageBand ?? ""}
                      onChange={(v) => set("ageBand", v)}
                      options={AGE_BANDS}
                      placeholder="選択"
                    />
                    {errors.ageBand ? <div className="mt-1 text-xs font-semibold text-rose-700">{errors.ageBand}</div> : null}
                  </InputWrap>

                  <InputWrap>
                    <Select
                      label="都道府県"
                      value={draft.prefecture ?? ""}
                      onChange={(v) => set("prefecture", v)}
                      options={PREFS}
                      placeholder="選択"
                    />
                    {errors.prefecture ? <div className="mt-1 text-xs font-semibold text-rose-700">{errors.prefecture}</div> : null}
                  </InputWrap>

                  <InputWrap>
                    <Field
                      label="市町村"
                      value={draft.city ?? ""}
                      onChange={(v) => set("city", v)}
                      placeholder="例：札幌市 / 渋谷区 など"
                      maxLength={50}
                    />
                    {errors.city ? <div className="mt-1 text-xs font-semibold text-rose-700">{errors.city}</div> : null}
                  </InputWrap>

                  <InputWrap>
                    <Select
                      label="職業"
                      value={draft.job ?? ""}
                      onChange={(v) => set("job", v)}
                      options={JOBS}
                      placeholder="選択"
                    />
                    {errors.job ? <div className="mt-1 text-xs font-semibold text-rose-700">{errors.job}</div> : null}
                  </InputWrap>
                </div>
              </Box>

              <Box title="紹介情報（任意）">
                <div className="grid gap-4">
                  <InputWrap>
                    <Field label="ご紹介者名" value={draft.refName ?? ""} onChange={(v) => set("refName", v)} placeholder="例：山田花子" maxLength={50} />
                  </InputWrap>

                  <InputWrap>
                    <Field
                      label="ご紹介者ID"
                      value={draft.refId ?? ""}
                      onChange={(v) => set("refId", v)}
                      placeholder="例：001234"
                      hint="不明なら空欄でOK。"
                      maxLength={20}
                    />
                  </InputWrap>
                </div>
              </Box>

              <section className="rounded-[22px] border border-slate-300/60 bg-white p-5 shadow-[0_18px_45px_rgba(2,6,23,.10)]">
                {errors.plan ? (
                  <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
                    {errors.plan}
                  </div>
                ) : null}

                <Link
                  href="/confirm"
                  className={[
                    "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-extrabold transition",
                    canGoNext
                      ? "bg-slate-900 text-white hover:opacity-95 active:scale-[0.99]"
                      : "pointer-events-none bg-slate-200 text-slate-500",
                  ].join(" ")}
                  aria-disabled={!canGoNext}
                >
                  最終確認へ（Step3） →
                </Link>

                <div className="mt-3 text-xs font-semibold text-slate-600">
                  ※ ここではまだ送信されません。次の画面で確認→送信します。
                </div>

                <div className="mt-4 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-700">
                  <div className="font-extrabold text-slate-900">ヒント</div>
                  <div className="mt-1">
                    「権利（プラン）」未選択の場合は、前のページでプランを選択してから戻ってきてください。
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>

        <div className="mt-6 text-center text-xs font-semibold text-slate-500">© LIFAI</div>
      </div>
    </main>
  );
}

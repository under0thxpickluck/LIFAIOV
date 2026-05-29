// app/narasu-agency/form/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isGatePassed, loadDraft, saveDraft } from "@/lib/narasu-agency/storage";
import { validateDraft, type ValidationErrors } from "@/lib/narasu-agency/validation";
import type { NarasuAgencyDraft, AudioUrlEntry } from "@/lib/narasu-agency/types";
import { NARASU_TERMS_VERSION } from "@/lib/narasu-agency/constants";

function newAudioEntry(): AudioUrlEntry {
  return { id: crypto.randomUUID(), url: "" };
}

function emptyDraft(): NarasuAgencyDraft {
  return {
    narasuLoginId: "",
    narasuPassword: "",
    audioUrls: [newAudioEntry()],
    lyricsText: "",
    jacketImageUrl: "",
    jacketNote: "",
    artistName: "",
    artistNameKana: "",
    artistNameAlpha: "",
    albumName: "",
    albumNameKana: "",
    albumNameAlpha: "",
    note: "",
    agreedTermsVersion: NARASU_TERMS_VERSION,
    agreedAt: "",
  };
}

export default function NarasuFormPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<NarasuAgencyDraft>(emptyDraft);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    if (!isGatePassed()) { router.replace("/narasu-agency"); return; }
    const saved = loadDraft();
    if (saved) setDraft(saved);
  }, [router]);

  function update(key: keyof NarasuAgencyDraft, value: unknown) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      saveDraft(next);
      return next;
    });
  }

  function updateAudioUrl(id: string, url: string) {
    setDraft((prev) => {
      const next = { ...prev, audioUrls: prev.audioUrls.map((e) => e.id === id ? { ...e, url } : e) };
      saveDraft(next);
      return next;
    });
  }

  function addAudioUrl() {
    setDraft((prev) => {
      const next = { ...prev, audioUrls: [...prev.audioUrls, newAudioEntry()] };
      saveDraft(next);
      return next;
    });
  }

  function removeAudioUrl(id: string) {
    setDraft((prev) => {
      if (prev.audioUrls.length <= 1) return prev;
      const next = { ...prev, audioUrls: prev.audioUrls.filter((e) => e.id !== id) };
      saveDraft(next);
      return next;
    });
  }

  function handleNext() {
    const errs = validateDraft(draft);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    saveDraft(draft);
    router.push("/narasu-agency/confirm");
  }

  const inputCls = "mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200";
  const labelCls = "block text-xs font-bold text-slate-700";
  const errorCls = "mt-1 text-xs text-rose-600";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-4">
          <button
            onClick={() => router.push("/top")}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            ← TOPに戻る
          </button>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-extrabold text-slate-900">narasu代理申請フォーム</h1>
          <p className="mt-1 text-sm text-slate-600">必要事項を入力してください。音源URLは複数追加できます。</p>

          <div className="mt-6 space-y-5">
            {/* narasuアカウント情報 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500">narasuアカウント情報（必須）</p>
                <a
                  href="https://narasu.jp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold text-indigo-600 hover:underline"
                >
                  まだ持っていない方はこちら →
                </a>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>ログインID（メールアドレス）<span className="text-rose-500"> *</span></label>
                  <input
                    type="text"
                    value={draft.narasuLoginId}
                    onChange={(e) => update("narasuLoginId", e.target.value)}
                    className={inputCls}
                    placeholder="例: yourname@example.com"
                    autoComplete="off"
                  />
                  {errors.narasuLoginId && <p className={errorCls}>{errors.narasuLoginId}</p>}
                </div>
                <div>
                  <label className={labelCls}>パスワード<span className="text-rose-500"> *</span></label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={draft.narasuPassword}
                      onChange={(e) => update("narasuPassword", e.target.value)}
                      className={inputCls + " pr-12"}
                      placeholder="narasuのパスワード"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? "隠す" : "表示"}
                    </button>
                  </div>
                  {errors.narasuPassword && <p className={errorCls}>{errors.narasuPassword}</p>}
                </div>
              </div>
            </div>

            {/* 音源URL */}
            <div>
              <label className={labelCls}>音源URL<span className="text-rose-500"> *</span></label>
              <p className="mt-0.5 text-[11px] text-slate-400">複数追加できます</p>
              <div className="mt-2 space-y-2">
                {draft.audioUrls.map((entry, idx) => (
                  <div key={entry.id} className="flex gap-2 items-center">
                    <input
                      type="url"
                      value={entry.url}
                      onChange={(e) => updateAudioUrl(entry.id, e.target.value)}
                      className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder={`音源URL ${idx + 1}`}
                    />
                    {draft.audioUrls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAudioUrl(entry.id)}
                        className="flex-shrink-0 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        －
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAudioUrl}
                  className="w-full rounded-2xl border border-dashed border-indigo-300 bg-white px-4 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  ＋ 音源URLを追加
                </button>
              </div>
              {errors.audioUrls && <p className={errorCls}>{errors.audioUrls}</p>}
              {errors.audioUrls_items && <p className={errorCls}>{errors.audioUrls_items}</p>}
            </div>

            {/* アーティスト名 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500">申請アーティスト名（必須）</p>
              <div>
                <label className={labelCls}>アーティスト名<span className="text-rose-500"> *</span></label>
                <input
                  type="text"
                  value={draft.artistName}
                  onChange={(e) => update("artistName", e.target.value)}
                  className={inputCls}
                  placeholder="例: LIFAI Studio"
                />
                {errors.artistName && <p className={errorCls}>{errors.artistName}</p>}
              </div>
              <div>
                <label className={labelCls}>アーティスト名（仮名）<span className="text-rose-500"> *</span></label>
                <input
                  type="text"
                  value={draft.artistNameKana}
                  onChange={(e) => update("artistNameKana", e.target.value)}
                  className={inputCls}
                  placeholder="例: ライファイスタジオ"
                />
                {errors.artistNameKana && <p className={errorCls}>{errors.artistNameKana}</p>}
              </div>
              <div>
                <label className={labelCls}>アーティスト名（アルファベット）<span className="text-rose-500"> *</span></label>
                <input
                  type="text"
                  value={draft.artistNameAlpha}
                  onChange={(e) => update("artistNameAlpha", e.target.value)}
                  className={inputCls}
                  placeholder="例: LIFAI Studio"
                />
                {errors.artistNameAlpha && <p className={errorCls}>{errors.artistNameAlpha}</p>}
              </div>
            </div>

            {/* アルバム情報 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500">アルバム名（必須）</p>
              <div>
                <label className={labelCls}>アルバム名<span className="text-rose-500"> *</span></label>
                <input
                  type="text"
                  value={draft.albumName}
                  onChange={(e) => update("albumName", e.target.value)}
                  className={inputCls}
                  placeholder="例: First Light"
                />
                {errors.albumName && <p className={errorCls}>{errors.albumName}</p>}
              </div>
              <div>
                <label className={labelCls}>アルバム名（仮名）<span className="text-rose-500"> *</span></label>
                <input
                  type="text"
                  value={draft.albumNameKana}
                  onChange={(e) => update("albumNameKana", e.target.value)}
                  className={inputCls}
                  placeholder="例: ファーストライト"
                />
                {errors.albumNameKana && <p className={errorCls}>{errors.albumNameKana}</p>}
              </div>
              <div>
                <label className={labelCls}>アルバム名（アルファベット）<span className="text-rose-500"> *</span></label>
                <input
                  type="text"
                  value={draft.albumNameAlpha}
                  onChange={(e) => update("albumNameAlpha", e.target.value)}
                  className={inputCls}
                  placeholder="例: First Light"
                />
                {errors.albumNameAlpha && <p className={errorCls}>{errors.albumNameAlpha}</p>}
              </div>
            </div>

            {/* ジャケット画像 */}
            <div>
              <label className={labelCls}>ジャケット画像URL<span className="text-rose-500"> *</span></label>
              <p className="mt-0.5 text-[11px] text-slate-400">Google ドライブ・Dropbox 等にアップロードした画像の共有URLを貼り付けてください</p>
              <input
                type="url"
                value={draft.jacketImageUrl}
                onChange={(e) => update("jacketImageUrl", e.target.value)}
                className={inputCls}
                placeholder="https://drive.google.com/..."
              />
              {errors.jacketImageUrl && <p className={errorCls}>{errors.jacketImageUrl}</p>}
            </div>

            {/* 補足事項 */}
            <div>
              <label className={labelCls}>補足事項 <span className="text-slate-400 font-normal">（任意）</span></label>
              <textarea
                value={draft.note}
                onChange={(e) => update("note", e.target.value)}
                className={inputCls + " h-24 resize-none"}
                placeholder="申請時の注意や希望があればご記入ください"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleNext}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-90"
            >
              確認画面へ進む →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

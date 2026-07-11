// app/narasu-agency/form/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isGatePassed, loadDraft, saveDraft } from "@/lib/narasu-agency/storage";
import { validateDraft, type ValidationErrors } from "@/lib/narasu-agency/validation";
import type { NarasuAgencyDraft, AudioUrlEntry } from "@/lib/narasu-agency/types";
import { NARASU_TERMS_VERSION } from "@/lib/narasu-agency/constants";
import { getAuth } from "@/app/lib/auth";

const MAX_AUDIO_ENTRIES = 15;

function newAudioEntry(): AudioUrlEntry {
  return { id: crypto.randomUUID(), url: "", title: "", lyrics: "" };
}

// /api/music/history が返す生成履歴1件分（GAS music_history_list）
type MusicHistoryItem = {
  jobId: string;
  title: string;
  audioUrl: string;
  downloadUrl: string;
  lyrics: string;
  createdAt: string;
  expiresAt: string;
};

function emptyDraft(): NarasuAgencyDraft {
  return {
    narasuLoginId: "",
    narasuPassword: "",
    audioUrls: [newAudioEntry()],
    lyricsText: "",
    jacketImageUrl: "",
    jacketNote: "",
    artistPhotoUrl: "",
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
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  // 「自分の生成曲から選ぶ」ピッカー
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerItems, setPickerItems] = useState<MusicHistoryItem[]>([]);
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const lifaiLoginIdRef = useRef("");
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!isGatePassed()) { router.replace("/narasu-agency"); return; }
    const auth = getAuth();
    lifaiLoginIdRef.current = (auth as any)?.loginId ?? (auth as any)?.login_id ?? (auth as any)?.id ?? "";
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

  function updateAudioTitle(id: string, title: string) {
    setDraft((prev) => {
      const next = { ...prev, audioUrls: prev.audioUrls.map((e) => e.id === id ? { ...e, title } : e) };
      saveDraft(next);
      return next;
    });
  }

  function updateAudioLyrics(id: string, lyrics: string) {
    setDraft((prev) => {
      const next = { ...prev, audioUrls: prev.audioUrls.map((e) => e.id === id ? { ...e, lyrics } : e) };
      saveDraft(next);
      return next;
    });
  }

  const resolveTitle = useCallback(async (id: string, url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setResolvingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch("/api/narasu-agency/resolve-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, loginId: lifaiLoginIdRef.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.title) {
        setDraft((prev) => {
          const entry = prev.audioUrls.find((e) => e.id === id);
          if (!entry || entry.title) return prev;
          const next = { ...prev, audioUrls: prev.audioUrls.map((e) => e.id === id ? { ...e, title: data.title } : e) };
          saveDraft(next);
          return next;
        });
      }
    } catch {
      // resolve失敗は無視
    } finally {
      setResolvingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, []);

  function scheduleResolveTitle(id: string, url: string) {
    clearTimeout(debounceTimers.current[id]);
    debounceTimers.current[id] = setTimeout(() => resolveTitle(id, url), 800);
  }

  function addAudioUrl() {
    setDraft((prev) => {
      if (prev.audioUrls.length >= MAX_AUDIO_ENTRIES) return prev;
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

  // ── 「自分の生成曲から選ぶ」ピッカー ─────────────────────────
  async function openPicker() {
    setPickerOpen(true);
    setPickerSelected(new Set());
    setPickerError(null);
    const userId = lifaiLoginIdRef.current;
    if (!userId) {
      setPickerError("ログイン情報が取得できませんでした。ログインし直してください。");
      return;
    }
    setPickerLoading(true);
    try {
      const res = await fetch(`/api/music/history?userId=${encodeURIComponent(userId)}`);
      const data = await res.json().catch(() => ({}));
      if (data.ok && Array.isArray(data.items)) {
        setPickerItems(data.items as MusicHistoryItem[]);
        if (data.items.length === 0) {
          setPickerError("生成履歴がありません。AI音楽生成で曲を作ると、ここから選べるようになります。");
        }
      } else {
        setPickerError("履歴の取得に失敗しました。時間をおいて再度お試しください。");
      }
    } catch {
      setPickerError("履歴の取得に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setPickerLoading(false);
    }
  }

  function togglePicked(jobId: string) {
    setPickerSelected((prev) => {
      const s = new Set(prev);
      if (s.has(jobId)) { s.delete(jobId); } else { s.add(jobId); }
      return s;
    });
  }

  function addPickedSongs() {
    const picked = pickerItems.filter((it) => pickerSelected.has(it.jobId));
    if (picked.length === 0) { setPickerOpen(false); return; }
    setDraft((prev) => {
      // 既に入力済みのURLはスキップ（重複追加防止）
      const existingUrls = new Set(prev.audioUrls.map((e) => e.url.trim()).filter(Boolean));
      const newEntries: AudioUrlEntry[] = [];
      for (const it of picked) {
        const url = (it.downloadUrl || it.audioUrl || "").trim();
        if (!url || existingUrls.has(url)) continue;
        existingUrls.add(url);
        newEntries.push({ ...newAudioEntry(), url, title: it.title || "", lyrics: it.lyrics || "" });
      }
      // 完全に空の初期エントリ1件だけの場合は置き換える
      let base = prev.audioUrls;
      if (base.length === 1 && !base[0].url.trim() && !(base[0].title ?? "").trim() && !(base[0].lyrics ?? "").trim()) {
        base = [];
      }
      const merged = [...base, ...newEntries].slice(0, MAX_AUDIO_ENTRIES);
      const next = { ...prev, audioUrls: merged.length > 0 ? merged : [newAudioEntry()] };
      saveDraft(next);
      return next;
    });
    setPickerOpen(false);
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

          {/* 重要なお知らせ */}
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-1.5">
            <p className="text-xs font-extrabold text-amber-800">申請前にご確認ください</p>
            <ul className="space-y-1 text-xs text-amber-700 leading-relaxed list-disc list-inside">
              <li>LIFAI運営がnarasuに<b>下書き保存</b>を行います。その後、<b>ご自身でnarasuにログインして本申請を上げてください。</b></li>
              <li>本申請時にnarasu側で<b>別途申請費用が発生</b>します（LIFAI代行費用とは別）。</li>
            </ul>
          </div>

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
              <div className="flex items-center justify-between gap-2">
                <label className={labelCls}>音源URL<span className="text-rose-500"> *</span></label>
                <button
                  type="button"
                  onClick={openPicker}
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-600 hover:bg-indigo-100"
                >
                  🎵 自分の生成曲から選ぶ
                </button>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">複数追加できます</p>
              <div className="mt-2 space-y-3">
                {draft.audioUrls.map((entry, idx) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      <input
                        type="url"
                        value={entry.url}
                        onChange={(e) => { updateAudioUrl(entry.id, e.target.value); scheduleResolveTitle(entry.id, e.target.value); }}
                        onBlur={(e) => { clearTimeout(debounceTimers.current[entry.id]); resolveTitle(entry.id, e.target.value); }}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={entry.title ?? ""}
                        onChange={(e) => updateAudioTitle(entry.id, e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        placeholder="曲名（必須・URLを貼ると自動入力）"
                      />
                      {resolvingIds.has(entry.id) && (
                        <span className="text-xs text-slate-400 animate-pulse">取得中…</span>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 mb-1">歌詞（任意）</p>
                      <p className="text-[11px] text-slate-400 mb-1 leading-relaxed">
                        歌詞はLIFAI運営が簡易的に確認しますが、表現・言い回しの細かいチェックは対応範囲外です。<b>事前にご自身でご確認ください。</b>
                      </p>
                      <textarea
                        value={entry.lyrics ?? ""}
                        onChange={(e) => updateAudioLyrics(entry.id, e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 h-28 resize-none"
                        placeholder="この曲の歌詞を入力してください（任意）"
                      />
                    </div>
                  </div>
                ))}
                {draft.audioUrls.length < MAX_AUDIO_ENTRIES ? (
                  <button
                    type="button"
                    onClick={addAudioUrl}
                    className="w-full rounded-2xl border border-dashed border-indigo-300 bg-white px-4 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                  >
                    ＋ 音源URLを追加（{draft.audioUrls.length} / {MAX_AUDIO_ENTRIES}）
                  </button>
                ) : (
                  <p className="text-center text-xs text-slate-400 py-2">上限（{MAX_AUDIO_ENTRIES}曲）に達しました</p>
                )}
              </div>
              {errors.audioUrls && <p className={errorCls}>{errors.audioUrls}</p>}
              {errors.audioUrls_items && <p className={errorCls}>{errors.audioUrls_items}</p>}
            </div>

            {/* アーティスト名 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500">申請アーティスト名（必須）</p>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 space-y-1.5 text-xs text-indigo-700 leading-relaxed">
                <p>💡 <b>一人のアーティストを集中して育てるのがおすすめです。</b>複数のアーティスト名に分散させるより、同一ブランドを強化した方が効果的です。</p>
                <p>🎵 <b>曲調はなるべく揃えましょう。</b>同じアーティストで曲のジャンルやテイストを統一すると、ファンがつきやすくなります。</p>
                <p>📁 <b>過去に申請したことがあるアーティストは、同じ名前で申請してください。</b>既存のアーティストページにアルバムを追加する形で対応します。</p>
              </div>
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
              <div>
                <label className={labelCls}>アーティスト写真URL <span className="text-slate-400 font-normal">（任意）</span></label>
                <p className="mt-0.5 text-[11px] text-slate-400">Google ドライブ・Dropbox 等にアップロードした写真の共有URLを貼り付けてください</p>
                <p className="mt-0.5 text-[11px] font-semibold text-amber-600">⚠️ 写真がない場合、narasu審査の通過率が下がる可能性があります。できる限りご用意ください。</p>
                <input
                  type="url"
                  value={draft.artistPhotoUrl}
                  onChange={(e) => update("artistPhotoUrl", e.target.value)}
                  className={inputCls}
                  placeholder="https://drive.google.com/..."
                />
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

      {/* 「自分の生成曲から選ぶ」モーダル */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <p className="text-sm font-extrabold text-slate-900">🎵 自分の生成曲から選ぶ</p>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
              >
                ✕ 閉じる
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {pickerLoading && (
                <p className="py-6 text-center text-sm text-slate-400">読み込み中…</p>
              )}
              {!pickerLoading && pickerError && (
                <p className="py-6 text-center text-xs leading-relaxed text-slate-500">{pickerError}</p>
              )}
              {!pickerLoading && !pickerError && pickerItems.length > 0 && (
                <div className="space-y-2">
                  {pickerItems.map((it) => (
                    <label
                      key={it.jobId}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
                        pickerSelected.has(it.jobId)
                          ? "border-indigo-400 bg-indigo-50"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={pickerSelected.has(it.jobId)}
                        onChange={() => togglePicked(it.jobId)}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-800">{it.title || "（無題）"}</span>
                        <span className="block text-[11px] text-slate-400">
                          {it.createdAt ? it.createdAt.slice(0, 10) : ""}
                          {(it.lyrics ?? "").trim() ? " ・歌詞あり" : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={addPickedSongs}
                disabled={pickerSelected.size === 0}
                className="w-full rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                選んだ曲を追加する{pickerSelected.size > 0 ? `（${pickerSelected.size}曲）` : ""}
              </button>
              <p className="mt-2 text-center text-[10px] text-slate-400">
                曲名・歌詞も自動で入力されます（音源URLは最大{MAX_AUDIO_ENTRIES}曲まで）
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

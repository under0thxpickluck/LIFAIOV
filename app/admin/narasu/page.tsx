// app/admin/narasu/page.tsx
// narasu代理申請 作業用ページ（管理画面）
// スプレッドシート「narasu_agency」の申請内容を、代理申請の作業順にそのまま使える形で表示する。
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function clsx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

// ─── 型定義 ───────────────────────────────────────────────
type NarasuRow = {
  _row?: number;
  request_id?: string;
  created_at?: string;
  status?: string;
  narasu_login_id?: string;
  narasu_password?: string;
  audio_urls?: string;
  audio_titles?: string;
  audio_lyrics?: string;
  song_titles?: string;
  lyrics_text?: string;
  jacket_image_url?: string;
  jacket_note?: string;
  artist_photo_url?: string;
  artist_name?: string;
  artist_name_kana?: string;
  artist_name_alpha?: string;
  album_name?: string;
  album_name_kana?: string;
  album_name_alpha?: string;
  note?: string;
  agreed_terms_version?: string;
  agreed_at?: string;
  admin_memo?: string;
  admin_updated_at?: string;
  applied_at?: string;
  login_id?: string;
  payment_status?: string;
  payment_method?: string;
  paid_at?: string;
  [k: string]: any;
};

type TrackSource = "form" | "history" | "none";

type ResolvedTrack = {
  url?: string;
  songId?: string;
  title?: string;
  titleSource?: TrackSource;
  lyrics?: string;
  lyricsSource?: TrackSource;
};

type Track = {
  index: number;
  url: string;
  title: string;
  titleSource: TrackSource;
  lyrics: string;
  lyricsSource: TrackSource;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  submitted:    { label: "未対応",   cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  under_review: { label: "対応中",   cls: "bg-sky-500/20 text-sky-300 border-sky-500/40" },
  completed:    { label: "申請済み", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  rejected:     { label: "却下",     cls: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
  draft:        { label: "下書き",   cls: "bg-zinc-700 text-zinc-300 border-zinc-600" },
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "all",          label: "すべて" },
  { key: "submitted",    label: "未対応" },
  { key: "under_review", label: "対応中" },
  { key: "completed",    label: "申請済み" },
  { key: "rejected",     label: "却下" },
];

// ─── ユーティリティ ────────────────────────────────────────
function splitLines(v?: string): string[] {
  if (!v) return [];
  return String(v).split(/\r?\n/).map((s) => s.trim());
}

/** 曲別歌詞は "\n---\n" 区切りで保存されている */
function splitLyrics(v?: string): string[] {
  if (!v) return [];
  return String(v).split(/\r?\n---\r?\n/);
}

function buildTracks(row: NarasuRow): Track[] {
  const resolved = Array.isArray(row._resolved_tracks)
    ? (row._resolved_tracks as ResolvedTrack[])
    : null;

  if (resolved) {
    return resolved.map((t, i) => ({
      index: i + 1,
      url: String(t.url ?? ""),
      title: String(t.title ?? "").trim(),
      titleSource: (t.titleSource ?? "none") as TrackSource,
      lyrics: String(t.lyrics ?? "").trim(),
      lyricsSource: (t.lyricsSource ?? "none") as TrackSource,
    }));
  }

  // GAS が未デプロイの場合のフォールバック（従来の挙動）
  const urls = splitLines(row.audio_urls).filter((u) => u);
  const titles = splitLines(row.audio_titles ?? row.song_titles);
  const lyrics = splitLyrics(row.audio_lyrics);
  return urls.map((url, i) => {
    const title = (titles[i] ?? "").trim();
    const lyric = (lyrics[i] ?? "").trim();
    return {
      index: i + 1,
      url,
      title,
      titleSource: (title ? "form" : "none") as TrackSource,
      lyrics: lyric,
      lyricsSource: (lyric ? "form" : "none") as TrackSource,
    };
  });
}

/** music_history から自動補完した値であることを示すバッジ */
function AutoBadge() {
  return (
    <span className="mt-0.5 shrink-0 rounded border border-sky-500/30 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
      自動取得
    </span>
  );
}

function fmtDate(v?: string): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** 代理申請の作業に必要な情報を1つのテキストにまとめる（丸ごとコピー用） */
function buildFullText(row: NarasuRow, tracks: Track[]): string {
  const lines: string[] = [];
  lines.push(`【申請ID】${row.request_id ?? ""}`);
  lines.push(`【申請日時】${fmtDate(row.created_at)}`);
  lines.push(`【LIFAIログインID】${row.login_id ?? ""}`);
  lines.push("");
  lines.push("■ narasuアカウント");
  lines.push(`ログインID: ${row.narasu_login_id ?? ""}`);
  lines.push(`パスワード: ${row.narasu_password ?? ""}`);
  lines.push("");
  lines.push("■ アーティスト");
  lines.push(`名前: ${row.artist_name ?? ""}`);
  lines.push(`かな: ${row.artist_name_kana ?? ""}`);
  lines.push(`英字: ${row.artist_name_alpha ?? ""}`);
  if (row.artist_photo_url) lines.push(`写真URL: ${row.artist_photo_url}`);
  lines.push("");
  lines.push("■ アルバム");
  lines.push(`名前: ${row.album_name ?? ""}`);
  lines.push(`かな: ${row.album_name_kana ?? ""}`);
  lines.push(`英字: ${row.album_name_alpha ?? ""}`);
  if (row.jacket_image_url) lines.push(`ジャケットURL: ${row.jacket_image_url}`);
  if (row.jacket_note) lines.push(`ジャケット備考: ${row.jacket_note}`);
  lines.push("");
  lines.push(`■ 楽曲（${tracks.length}曲）`);
  tracks.forEach((t) => {
    lines.push(`--- ${t.index}曲目 ---`);
    lines.push(`曲名: ${t.title || "（未入力）"}`);
    lines.push(`音源URL: ${t.url}`);
    lines.push(`歌詞: ${t.lyrics ? "\n" + t.lyrics : "（なし）"}`);
  });
  if (row.lyrics_text) {
    lines.push("");
    lines.push("■ 歌詞（共通欄・曲別歌詞がない場合の参照用）");
    lines.push(String(row.lyrics_text));
  }
  if (row.note) {
    lines.push("");
    lines.push("■ 補足事項");
    lines.push(String(row.note));
  }
  return lines.join("\n");
}

// ─── 小物コンポーネント ────────────────────────────────────
function CopyButton({ text, label = "コピー", disabled }: { text: string; label?: string; disabled?: boolean }) {
  const [done, setDone] = useState(false);
  const isEmpty = disabled || !text;
  return (
    <button
      type="button"
      disabled={isEmpty}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          alert("コピーに失敗しました。手動で選択してコピーしてください。");
        }
      }}
      className={clsx(
        "shrink-0 rounded-md border px-2 py-1 text-[11px] font-bold transition",
        isEmpty
          ? "cursor-not-allowed border-zinc-800 text-zinc-600"
          : done
            ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
            : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
      )}
    >
      {done ? "✓ コピー済" : label}
    </button>
  );
}

function CopyField({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  const v = (value ?? "").toString();
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
        <p className={clsx("break-all text-sm", mono && "font-mono", v ? "text-zinc-100" : "text-zinc-600")}>
          {v || "（未入力）"}
        </p>
      </div>
      <CopyButton text={v} />
    </div>
  );
}

function LinkField({ label, value }: { label: string; value?: string }) {
  const v = (value ?? "").toString();
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
        {v ? (
          <a href={v} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-sky-400 underline hover:text-sky-300">
            {v}
          </a>
        ) : (
          <p className="text-sm text-zinc-600">（未入力）</p>
        )}
      </div>
      <CopyButton text={v} />
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const meta = STATUS_META[String(status ?? "")] ?? { label: String(status || "不明"), cls: "bg-zinc-700 text-zinc-300 border-zinc-600" };
  return (
    <span className={clsx("rounded-full border px-2.5 py-0.5 text-[11px] font-bold", meta.cls)}>
      {meta.label}
    </span>
  );
}

// ─── 申請カード ───────────────────────────────────────────
function RequestCard({
  row,
  onUpdate,
  busy,
}: {
  row: NarasuRow;
  onUpdate: (requestId: string, patch: { status?: string; adminMemo?: string }) => Promise<void>;
  busy: boolean;
}) {
  const tracks = useMemo(() => buildTracks(row), [row]);
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [memo, setMemo] = useState(String(row.admin_memo ?? ""));
  const [openLyrics, setOpenLyrics] = useState<Record<number, boolean>>({});

  useEffect(() => { setMemo(String(row.admin_memo ?? "")); }, [row.admin_memo]);

  const requestId = String(row.request_id ?? "");
  const fullText = useMemo(() => buildFullText(row, tracks), [row, tracks]);
  const lyricsCount = tracks.filter((t) => t.lyrics).length;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
      {/* ヘッダー行 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4">
        <StatusBadge status={row.status} />
        <span className="font-mono text-xs text-zinc-500">{requestId}</span>
        <span className="text-sm font-bold text-zinc-100">
          {row.artist_name || "（アーティスト名なし）"}
          <span className="text-zinc-500"> / </span>
          {row.album_name || "（アルバム名なし）"}
        </span>
        <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-zinc-300">{tracks.length}曲</span>
        <span
          className={clsx(
            "rounded-md px-2 py-0.5 text-[11px] font-bold",
            lyricsCount === tracks.length && tracks.length > 0
              ? "bg-emerald-500/15 text-emerald-300"
              : lyricsCount > 0
                ? "bg-amber-500/15 text-amber-300"
                : "bg-zinc-800 text-zinc-500"
          )}
        >
          歌詞 {lyricsCount}/{tracks.length}
        </span>
        <span
          className={clsx(
            "rounded-md px-2 py-0.5 text-[11px] font-bold",
            row.payment_status === "paid" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
          )}
        >
          {row.payment_status === "paid" ? `支払済${row.payment_method ? `（${row.payment_method}）` : ""}` : "未払い"}
        </span>
        <span className="text-xs text-zinc-500">{fmtDate(row.created_at)}</span>
        <div className="ml-auto flex items-center gap-2">
          <CopyButton text={fullText} label="📋 全部コピー" />
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
          >
            {open ? "閉じる" : "開く"}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-zinc-800 px-5 py-5">
          {/* narasuアカウント */}
          <section className="mb-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="mb-3 text-xs font-bold text-zinc-400">① narasuアカウント（ログイン用）</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyField label="ログインID" value={row.narasu_login_id} mono />
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">パスワード</p>
                  <p className="break-all font-mono text-sm text-zinc-100">
                    {showPw ? (row.narasu_password || "（未入力）") : "•".repeat(Math.max(8, String(row.narasu_password ?? "").length))}
                  </p>
                </div>
                <button
                  onClick={() => setShowPw((v) => !v)}
                  className="shrink-0 rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-bold text-zinc-300 hover:bg-zinc-800"
                >
                  {showPw ? "隠す" : "表示"}
                </button>
                <CopyButton text={String(row.narasu_password ?? "")} />
              </div>
            </div>
          </section>

          {/* アーティスト・アルバム */}
          <section className="mb-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="mb-3 text-xs font-bold text-zinc-400">② アーティスト情報</p>
              <div className="space-y-3">
                <CopyField label="アーティスト名" value={row.artist_name} />
                <CopyField label="アーティスト名（かな）" value={row.artist_name_kana} />
                <CopyField label="アーティスト名（英字）" value={row.artist_name_alpha} />
                <LinkField label="アーティスト写真URL" value={row.artist_photo_url} />
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="mb-3 text-xs font-bold text-zinc-400">③ アルバム情報</p>
              <div className="space-y-3">
                <CopyField label="アルバム名" value={row.album_name} />
                <CopyField label="アルバム名（かな）" value={row.album_name_kana} />
                <CopyField label="アルバム名（英字）" value={row.album_name_alpha} />
                <LinkField label="ジャケット画像URL" value={row.jacket_image_url} />
                {row.jacket_note ? <CopyField label="ジャケット備考" value={row.jacket_note} /> : null}
              </div>
            </div>
          </section>

          {/* 楽曲リスト */}
          <section className="mb-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="mb-3 text-xs font-bold text-zinc-400">④ 楽曲リスト（{tracks.length}曲）</p>
            {tracks.length === 0 ? (
              <p className="text-sm text-zinc-500">音源URLが登録されていません。</p>
            ) : (
              <div className="space-y-3">
                {tracks.map((t) => {
                  const lyricsOpen = !!openLyrics[t.index];
                  return (
                    <div key={t.index} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-zinc-300">
                          {t.index}
                        </span>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-start gap-2">
                            <p className={clsx("min-w-0 flex-1 break-all text-sm font-bold", t.title ? "text-zinc-100" : "text-zinc-600")}>
                              {t.title || "（曲名未入力）"}
                            </p>
                            {t.titleSource === "history" && <AutoBadge />}
                            <CopyButton text={t.title} label="曲名" />
                          </div>
                          <div className="flex items-start gap-2">
                            <a
                              href={t.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-w-0 flex-1 break-all text-xs text-sky-400 underline hover:text-sky-300"
                            >
                              {t.url}
                            </a>
                            <CopyButton text={t.url} label="URL" />
                          </div>
                          <div className="flex items-center gap-2">
                            {t.lyrics ? (
                              <>
                                <button
                                  onClick={() => setOpenLyrics((p) => ({ ...p, [t.index]: !p[t.index] }))}
                                  className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20"
                                >
                                  {lyricsOpen ? "▲ 歌詞を閉じる" : `▼ この曲の歌詞（${t.lyrics.length}文字）`}
                                </button>
                                {t.lyricsSource === "history" && <AutoBadge />}
                                <CopyButton text={t.lyrics} label="歌詞" />
                              </>
                            ) : (
                              <span className="rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-500">
                                曲別の歌詞なし
                              </span>
                            )}
                          </div>
                          {t.lyrics && lyricsOpen && (
                            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-200">
                              {t.lyrics}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 共通歌詞欄 */}
            {row.lyrics_text ? (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-xs font-bold text-amber-300">
                    共通歌詞欄（曲別の歌詞がない曲は、こちらを確認してください）
                  </p>
                  <CopyButton text={String(row.lyrics_text)} label="歌詞" />
                </div>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-zinc-200">
                  {String(row.lyrics_text)}
                </pre>
              </div>
            ) : lyricsCount < tracks.length ? (
              <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-500">
                歌詞未入力の曲があります。共通歌詞欄も空のため、申請者への確認が必要です。
              </p>
            ) : null}
          </section>

          {/* 補足・申請者情報 */}
          <section className="mb-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="mb-3 text-xs font-bold text-zinc-400">⑤ 補足事項</p>
              <p className={clsx("whitespace-pre-wrap text-sm", row.note ? "text-zinc-100" : "text-zinc-600")}>
                {row.note || "（なし）"}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="mb-3 text-xs font-bold text-zinc-400">⑥ 申請者・支払い</p>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">LIFAIログインID</dt>
                  <dd className="break-all font-mono text-zinc-200">{row.login_id || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">支払い状況</dt>
                  <dd className="text-zinc-200">{row.payment_status || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">支払い方法</dt>
                  <dd className="text-zinc-200">{row.payment_method || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">支払い日時</dt>
                  <dd className="text-zinc-200">{fmtDate(row.paid_at)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">規約同意</dt>
                  <dd className="text-zinc-200">{row.agreed_terms_version || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">申請済み日時</dt>
                  <dd className="text-zinc-200">{fmtDate(row.applied_at)}</dd>
                </div>
              </dl>
            </div>
          </section>

          {/* ステータス操作 */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="mb-3 text-xs font-bold text-zinc-400">⑦ 進捗の記録</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "under_review", label: "🛠 対応中にする", cls: "bg-sky-600 hover:bg-sky-500 text-white" },
                { key: "completed",    label: "✅ 申請済みにする", cls: "bg-emerald-600 hover:bg-emerald-500 text-white" },
                { key: "rejected",     label: "🚫 却下にする", cls: "bg-rose-700 hover:bg-rose-600 text-white" },
                { key: "submitted",    label: "↩ 未対応に戻す", cls: "bg-zinc-700 hover:bg-zinc-600 text-zinc-100" },
              ].map((b) => (
                <button
                  key={b.key}
                  disabled={busy || row.status === b.key}
                  onClick={() => onUpdate(requestId, { status: b.key })}
                  className={clsx(
                    "rounded-lg px-3 py-2 text-xs font-bold transition",
                    busy || row.status === b.key ? "cursor-not-allowed bg-zinc-800 text-zinc-600" : b.cls
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-zinc-500">管理メモ</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                placeholder="例: 3曲目の歌詞が未入力のため本人に確認中"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
              />
              <button
                disabled={busy || memo === String(row.admin_memo ?? "")}
                onClick={() => onUpdate(requestId, { adminMemo: memo })}
                className={clsx(
                  "mt-2 rounded-lg px-4 py-2 text-xs font-bold transition",
                  busy || memo === String(row.admin_memo ?? "")
                    ? "cursor-not-allowed bg-zinc-800 text-zinc-600"
                    : "bg-amber-500 text-black hover:bg-amber-600"
                )}
              >
                メモを保存
              </button>
              {row.admin_updated_at ? (
                <span className="ml-3 text-[11px] text-zinc-500">最終更新: {fmtDate(row.admin_updated_at)}</span>
              ) : null}
            </div>
          </section>
        </div>
      )}

      {/* 折りたたみ時のメモ表示 */}
      {!open && row.admin_memo ? (
        <p className="border-t border-zinc-800 px-5 py-2 text-xs text-zinc-400">📝 {String(row.admin_memo)}</p>
      ) : null}
    </div>
  );
}

// ─── ページ本体 ───────────────────────────────────────────
export default function AdminNarasuPage() {
  const [rows, setRows] = useState<NarasuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/narasu-agency", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error ?? "読み込みに失敗しました");
      const list: NarasuRow[] = Array.isArray(data.requests) ? data.requests : [];
      // 新しい申請を上に
      list.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
      setRows(list);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, submitted: 0, under_review: 0, completed: 0, rejected: 0 };
    rows.forEach((r) => {
      const s = String(r.status ?? "");
      if (c[s] !== undefined) c[s] += 1;
    });
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && String(r.status ?? "") !== filter) return false;
      if (!needle) return true;
      const hay = [
        r.request_id, r.artist_name, r.artist_name_kana, r.artist_name_alpha,
        r.album_name, r.album_name_kana, r.album_name_alpha,
        r.narasu_login_id, r.login_id, r.audio_titles, r.song_titles, r.note, r.admin_memo,
      ].map((v) => String(v ?? "").toLowerCase()).join(" ");
      return hay.includes(needle);
    });
  }, [rows, filter, q]);

  async function handleUpdate(requestId: string, patch: { status?: string; adminMemo?: string }) {
    if (!requestId) return;
    setBusyId(requestId);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/narasu-agency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, ...patch }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error ?? "更新に失敗しました");
      setRows((prev) =>
        prev.map((r) =>
          String(r.request_id ?? "") === requestId
            ? {
                ...r,
                ...(patch.status ? { status: patch.status } : {}),
                ...(patch.adminMemo !== undefined ? { admin_memo: patch.adminMemo } : {}),
                admin_updated_at: new Date().toISOString(),
                ...(patch.status === "completed" && !r.applied_at ? { applied_at: new Date().toISOString() } : {}),
              }
            : r
        )
      );
      setMsg(patch.status ? "ステータスを更新しました" : "メモを保存しました");
      setTimeout(() => setMsg(null), 2500);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">narasu代理申請 一覧</h1>
            <p className="mt-1 text-xs text-zinc-500">
              スプレッドシート「narasu_agency」の申請内容を、代理申請の作業順に表示します。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/admin"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              ← 管理トップ
            </a>
            <button
              onClick={load}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-600"
            >
              再読み込み
            </button>
          </div>
        </header>

        {msg && <div className="mb-4 rounded-xl bg-emerald-900/50 px-4 py-3 text-sm font-bold text-emerald-300">{msg}</div>}
        {err && <div className="mb-4 rounded-xl bg-red-900/50 px-4 py-3 text-sm font-bold text-red-300">エラー：{err}</div>}

        {/* フィルター */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={clsx(
                "rounded-lg px-3 py-2 text-xs font-bold transition",
                filter === f.key ? "bg-amber-500 text-black" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              )}
            >
              {f.label}（{counts[f.key] ?? 0}）
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="アーティスト名・アルバム名・申請ID などで検索"
            className="ml-auto w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
          />
        </div>

        {/* 一覧 */}
        {loading ? (
          <p className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">読み込み中…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
            該当する申請はありません。
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((r) => (
              <RequestCard
                key={String(r.request_id ?? r._row)}
                row={r}
                onUpdate={handleUpdate}
                busy={busyId === String(r.request_id ?? "")}
              />
            ))}
          </div>
        )}

        <footer className="mt-8 text-center text-xs text-zinc-600">© LIFAI</footer>
      </div>
    </main>
  );
}

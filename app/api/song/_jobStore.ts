// app/api/song/_jobStore.ts
// GAS song_jobs シートによるジョブ永続化版
// Vercelサーバーレスのインスタンス切れによるjob_not_foundを解消

const GAS_URL     = process.env.GAS_WEBAPP_URL!;
const GAS_API_KEY = process.env.GAS_API_KEY!;

async function callGas(action: string, params: Record<string, unknown>) {
  const url = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}key=${encodeURIComponent(GAS_API_KEY)}`;
  const bodyStr = JSON.stringify({ action, key: GAS_API_KEY, ...params });
  const res = await fetch(url, {
    method:   "POST",
    headers:  {
      "Content-Type":   "application/json",
      "Content-Length": String(Buffer.byteLength(bodyStr)),
    },
    body:     bodyStr,
    cache:    "no-store",
    redirect: "follow",
  });
  return res.json();
}

// ========== 型定義（既存と互換） ==========

export type JobStatus =
  | "queued" | "lyrics_generating" | "lyrics_ready"
  | "structure_generating" | "structure_ready"
  | "audio_generating"        // 旧ステータス（後方互換）
  | "generating_audio"        // ElevenLabs 音声生成中
  | "postprocessing"          // EQ/Comp/Reverb/Loudness 処理中
  | "uploading_result"        // final 音源を R2 へ保存中
  | "transcribing_lyrics"     // ASR で歌詞書き起こし中（Phase 2）
  | "merging_lyrics"          // 歌詞マージ中（Phase 2）
  | "quality_checking"        // 反復検知・品質スコア計算中（Phase 1）
  | "regenerating_audio"      // 品質不足による自動再生成中（Phase 3）
  | "review_required"         // 一致率低・人手確認要
  | "completed" | "failed" | "cancelled";

export type SongJob = {
  jobId:          string;
  userId?:        string;
  status:         JobStatus;
  stage?:         string;
  lyricsData?:    { title?: string; lyrics?: string } | null;
  structureData?: { bpm?: number; key?: string; sections?: string[]; hook?: string; hookSummary?: string; title?: string } | null;
  prompt:         {
    theme?: string; genre?: string; mood?: string;
    language?: string; durationTargetSec?: number;
    structurePreset?: string; moodTags?: string[];
    isPro?: boolean;
    bpmHint?: number;       // Pro: BPMヒント
    vocalStyle?: string;    // Pro: ボーカルスタイル
    vocalMood?: string;     // Pro: ボーカルムード
    instruments?: string[]; // Pro: 楽器指定
    duration?: number;      // Pro: 曲の長さ（秒）
  };
  audioUrl?:      string;
  downloadUrl?:   string;
  error?:         string;
  bpLocked?:      number;
  bpFinal?:       number;
  rightsLog?:     {
    lyricsApproved?: boolean;
    structureApproved?: boolean;
    humanEdited?: boolean;
    postprocessApplied?: boolean;
    postprocessPreset?: string;
    postprocessVersion?: string;
    postprocessFallbackRaw?: boolean;
    fallbackReason?: string;
  };
  // 後加工パイプライン追加フィールド
  rawAudioUrl?:           string;
  processedAudioUrl?:     string;
  postprocessStatus?:     "pending" | "running" | "done" | "failed";
  postprocessPreset?:     string;
  postprocessVersion?:    string;
  analysisJson?:          string;
  postprocessStartedAt?:  string;
  postprocessCompletedAt?: string;
  postprocessError?:      string;
  finalLufs?:             number | null;
  finalPeakDb?:           number | null;
  humanizeLevel?:         number;
  // 歌詞パイプライン（Phase 1〜）
  masterLyrics?:          string;   // OpenAI 生成歌詞（原本）
  singableLyrics?:        string;   // ElevenLabs 向け発音最適化版
  asrLyrics?:             string;   // ASR 書き起こし（Phase 2）
  displayLyrics?:         string;   // ユーザー表示用（確定版）
  distributionLyrics?:    string;   // 配信提出用（確定版）
  lyricsMatchScore?:      number | null;   // 一致率 0〜100（Phase 2）
  lyricsReviewRequired?:  boolean;
  distributionReady?:     boolean;
  lyricsSource?:          "master" | "singable" | "asr_merged" | "manual";
  asrStatus?:             "pending" | "running" | "done" | "failed";
  asrError?:              string | null;
  asrStartedAt?:          string | null;
  asrCompletedAt?:        string | null;
  lyricsDiffJson?:        string | null;
  lyricsTimestampsJson?:  string | null;
  // Phase 1 追加フィールド
  anchorWordsJson?:       string | null;   // 意味拘束キーワード一覧 JSON
  hookLinesJson?:         string | null;   // サビ固定行 JSON
  repeatScore?:           number | null;   // 反復スコア 0-100
  repeatDetected?:        boolean | null;  // 反復検知フラグ
  repeatSegmentsJson?:    string | null;   // 反復セグメント JSON
  lyricsQualityScore?:    number | null;   // 統合品質スコア 0-100
  lyricsGateResult?:      "pass" | "review" | "reject" | null;
  mergedLyrics?:          string | null;   // ASR 補正後の候補歌詞
  distributionReviewReason?: string | null; // 配信提出 NG 理由
  generationAttempt?:     number;          // 何回目の生成か
  regenerationReason?:    string | null;   // 再生成した理由
};

// ========== CRUD ==========

export async function createJob(
  jobId: string,
  userId: string,
  prompt: SongJob["prompt"],
  bpLocked: number
): Promise<void> {
  const res = await callGas("create_music_job", { jobId, userId, prompt, bpLocked });
  if (!res.ok) throw new Error(`create_music_job_failed: ${res.error ?? "unknown"}`);
}

export async function getJob(jobId: string): Promise<SongJob | null> {
  const res = await callGas("get_music_job", { jobId });
  if (!res.ok) return null;
  return res as SongJob;
}

export async function updateJob(
  jobId: string,
  fields: Partial<Omit<SongJob, "jobId">>
): Promise<void> {
  await callGas("update_music_job", { jobId, fields });
}

// listUserJobs は今は未使用だがシグネチャ維持
export async function listUserJobs(_userId: string): Promise<SongJob[]> {
  return [];
}

// app/api/song/approve-structure/route.ts
// 後加工パイプライン付き音楽生成（Phase 3: 自動再生成対応）
// ElevenLabs → raw保存 → postprocess → final保存 → ASR → 品質チェック → [再生成] → completed/review_required

import { NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs";
import { getJob, updateJob, refundBpToUser, type SongJob, type JobStatus } from "../_jobStore";
import { BP_COSTS } from "@/app/lib/bp-config";
import {
  ElevenLabsProvider,
  type MusicGenerateInput,
} from "@/app/features/music/providers/elevenlabsProvider";
import { choosePostprocessPreset, type PostprocessPreset } from "@/lib/music/presets";
import { runPostprocess } from "@/lib/music/postprocess";
import { uploadRawAudio, uploadFinalAudio, uploadAnalysisJson, cleanupTempFiles } from "@/lib/music/storage";
import { mergeRightsLog } from "@/lib/music/rights-log";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;

// ── 構成プリセット選択 ──────────────────────────────────────────────────────────

function chooseStructurePreset(mood?: string, isPro?: boolean): string {
  if (!mood) return isPro ? "short_pop" : "hook_only";
  if (isPro) {
    if (/激しい|明るい|さわやか/.test(mood)) return "upbeat";
    if (/ロマンチック|切ない|エモい/.test(mood))  return "ballad";
    if (/クール|落ち着いた/.test(mood))         return "cinematic";
    return "short_pop";
  }
  return "hook_only";
}

// ── 曲の長さ決定 ──────────────────────────────────────────────────────────────
// Proでユーザーが明示的に長さを指定した場合はそれを優先。
// 未指定時は毎回ランダムで2分30秒〜3分30秒（150〜210秒）。
function chooseSongDurationSec(userDuration?: number): number {
  if (userDuration && Number.isFinite(userDuration) && userDuration > 0) {
    return Math.round(userDuration);
  }
  return 150 + Math.floor(Math.random() * 61); // 150〜210秒（2分30秒〜3分30秒）
}

// ── Helper 1: ElevenLabs 生成 + postprocess + R2 アップロード ───────────────────

type GenerateAttemptResult = {
  rawUrl:         string | null;
  finalUrl:       string | null;
  postprocessOk:  boolean;
  preset:         PostprocessPreset | "";
  audioAvailable: boolean;
};

async function generateAudioAttempt(
  job: SongJob,
  apiKey: string,
  opts: { maxChorusRepeats?: number; attemptNum?: number; durationTargetSec?: number } = {}
): Promise<GenerateAttemptResult> {
  const { jobId, structureData, prompt, singableLyrics } = job;
  const { attemptNum = 1, maxChorusRepeats = 2 } = opts;
  const isPro = !!prompt.isPro;
  const durationTargetSec = opts.durationTargetSec ?? chooseSongDurationSec(prompt.duration);

  const rawTempPath   = path.join(os.tmpdir(), `${jobId}_attempt${attemptNum}_raw.wav`);
  const finalTempPath = path.join(os.tmpdir(), `${jobId}_attempt${attemptNum}_final.wav`);

  // anchorWords / hookLines を取得
  let anchorWords: string[] = [];
  let hookLines: string[] = [];
  try { anchorWords = job.anchorWordsJson ? JSON.parse(job.anchorWordsJson) : []; } catch (e) {
    console.warn(`[Job ${jobId}][attempt${attemptNum}] failed to parse anchorWordsJson`, e);
  }
  try { hookLines   = job.hookLinesJson   ? JSON.parse(job.hookLinesJson)   : []; } catch (e) {
    console.warn(`[Job ${jobId}][attempt${attemptNum}] failed to parse hookLinesJson`, e);
  }

  // ── Phase 1: ElevenLabs 音声生成 ────────────────────────────────────────────
  console.log(`[Job ${jobId}][attempt${attemptNum}] singableLyrics from GAS: ${singableLyrics ? `${singableLyrics.length}chars → "${singableLyrics.slice(0, 80).replace(/\n/g, "\\n")}"` : "EMPTY/UNDEFINED ← 歌詞がGASから返ってきていない"}`);
  console.log(`[Job ${jobId}][attempt${attemptNum}] prompt.vocalStyle: ${prompt.vocalStyle ?? "(none)"}, prompt.isPro: ${isPro}`);

  let audioBuffer: ArrayBuffer;
  try {
    const hasSingable = !!(singableLyrics && singableLyrics.trim().length > 0);
    const vocalStyle = prompt.vocalStyle;
    const vocalMode: "vocal" | "instrumental" =
      vocalStyle === "ボーカルなし" ? "instrumental" : "vocal";

    const input: MusicGenerateInput = {
      prompt:            prompt.theme ?? prompt.genre ?? "",
      genre:             prompt.genre,
      mood:              prompt.mood,
      bpm:               structureData?.bpm ?? 120,
      key:               structureData?.key ?? "C major",
      lyrics:            hasSingable ? singableLyrics : undefined,
      lyricsMode:        hasSingable ? "manual" : "auto",
      language:          prompt.language ?? "ja",
      durationTargetSec,
      vocalMode,
      vocalStyle,
      structurePreset:   chooseStructurePreset(prompt.mood, isPro),
      moodTags:          prompt.moodTags ?? [],
      isPro,
      anchorWords:       anchorWords.length > 0 ? anchorWords : undefined,
      hookLines:         hookLines.length > 0   ? hookLines   : undefined,
      maxChorusRepeats,
    };

    const provider = new ElevenLabsProvider(apiKey);
    const result   = await provider.generateMusic(input);
    audioBuffer    = result.audioBuffer;

    fs.writeFileSync(rawTempPath, Buffer.from(audioBuffer));
    console.log(`[Job ${jobId}][attempt${attemptNum}] ElevenLabs raw generated: ${audioBuffer.byteLength} bytes`);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    console.error(`[Job ${jobId}][attempt${attemptNum}] ElevenLabs failed:`, msg);
    await updateJob(jobId, {
      status:            "failed",
      postprocessStatus: "failed",
      postprocessError:  `audio_generation_failed: ${msg}`,
    });
    return { rawUrl: null, finalUrl: null, postprocessOk: false, preset: "natural" as PostprocessPreset, audioAvailable: false };
  }

  // raw を R2 に保存
  const rawUrl = await uploadRawAudio(audioBuffer, jobId);
  if (rawUrl) {
    await updateJob(jobId, { rawAudioUrl: rawUrl });
    console.log(`[Job ${jobId}][attempt${attemptNum}] raw uploaded: ${rawUrl}`);
  } else {
    console.warn(`[Job ${jobId}][attempt${attemptNum}] raw R2 upload failed (continuing)`);
  }

  // ── Phase 2: postprocess ────────────────────────────────────────────────────
  const preset = choosePostprocessPreset({
    genre:           prompt.genre,
    mood:            prompt.mood,
    structurePreset: prompt.structurePreset,
  });

  await updateJob(jobId, {
    status:               "postprocessing",
    postprocessStatus:    "running",
    postprocessPreset:    preset,
    postprocessStartedAt: new Date().toISOString(),
    humanizeLevel:        0,
  });

  let postprocessOk = false;
  let finalUrl: string | null = null;

  try {
    const ppResult = await runPostprocess({ inputPath: rawTempPath, jobId, preset });

    console.log(`[Job ${jobId}][attempt${attemptNum}] postprocess done: lufs=${ppResult.finalLufs} peak=${ppResult.finalPeakDb}`);

    await updateJob(jobId, { status: "uploading_result" });

    finalUrl = await uploadFinalAudio(ppResult.outputPath, jobId);

    await uploadAnalysisJson(ppResult.analysis as Record<string, unknown>, jobId).catch(() => {});

    postprocessOk = !!finalUrl;

    await updateJob(jobId, {
      postprocessStatus:      "done",
      postprocessVersion:     ppResult.version,
      postprocessCompletedAt: new Date().toISOString(),
      analysisJson:           JSON.stringify(ppResult.analysis),
      finalLufs:              ppResult.finalLufs,
      finalPeakDb:            ppResult.finalPeakDb,
    });

    if (finalUrl) {
      await updateJob(jobId, { processedAudioUrl: finalUrl });
    }
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    console.error(`[Job ${jobId}][attempt${attemptNum}] postprocess failed:`, msg);
    await updateJob(jobId, { postprocessStatus: "failed", postprocessError: msg });
  } finally {
    cleanupTempFiles(rawTempPath, finalTempPath);
  }

  return {
    rawUrl,
    finalUrl,
    postprocessOk,
    preset,
    audioAvailable: !!(finalUrl ?? rawUrl),
  };
}

// ── Helper 2: ASR + 品質チェック ─────────────────────────────────────────────

type QualityCheckResult = {
  gate:               "pass" | "review" | "reject" | null;
  lyricsQualityScore: number;
  repeatScore:        number;
  qualityUnavailable: boolean;  // ASR未実施等で品質スコアが信頼できない場合 true
};

async function runAsrAndQuality(
  job: SongJob,
  apiKey: string,
  audioUrl: string
): Promise<QualityCheckResult> {
  const { jobId } = job;

  let anchorWords: string[] = [];
  let hookLines: string[] = [];
  try { anchorWords = job.anchorWordsJson ? JSON.parse(job.anchorWordsJson) : []; } catch (e) {
    console.warn(`[Job ${jobId}][asr] failed to parse anchorWordsJson`, e);
  }
  try { hookLines   = job.hookLinesJson   ? JSON.parse(job.hookLinesJson)   : []; } catch (e) {
    console.warn(`[Job ${jobId}][asr] failed to parse hookLinesJson`, e);
  }

  const singable = job.singableLyrics ?? job.masterLyrics ?? "";

  // ── Phase 4: transcribing_lyrics（ASR）────────────────────────────────────
  try {
    await updateJob(jobId, {
      status:       "transcribing_lyrics",
      asrStatus:    "running",
      asrStartedAt: new Date().toISOString(),
    });

    const { transcribeSongLyrics } = await import("@/lib/music/asr");
    const asrResult = await transcribeSongLyrics({
      audioUrl,
      // languageHint を渡さず自動検出（UI と同条件）
      apiKey,
    });

    await updateJob(jobId, {
      asrLyrics:            asrResult.text,
      lyricsTimestampsJson: asrResult.timestampsJson,
      asrStatus:            "done",
      asrCompletedAt:       new Date().toISOString(),
    });

    // ── Phase 5: merging_lyrics → quality_checking ───────────────────────────
    await updateJob(jobId, { status: "merging_lyrics" });

    const { compareLyrics }        = await import("@/lib/music/lyrics-compare");
    const { mergeLyricsForDisplay } = await import("@/lib/music/lyrics-merge");
    const { detectRepetition }     = await import("@/lib/music/lyrics-repeat");
    const { computeLyricsQuality } = await import("@/lib/music/lyrics-quality");
    const { gateLyricsQuality }    = await import("@/lib/music/lyrics-gate");

    const compareResult = compareLyrics({ singableLyrics: singable, asrLyrics: asrResult.text });

    await updateJob(jobId, { status: "quality_checking" });

    const repeatResult  = detectRepetition({ asrLyrics: asrResult.text, chorusLines: hookLines });
    const mergeResult   = mergeLyricsForDisplay({
      singableLyrics: singable,
      asrLyrics:      asrResult.text,
      score:          compareResult.score,
      repeatScore:    repeatResult.repeatScore,
      anchorWords,
      hookLines,
      jobId,
      timestampsJson: asrResult.timestampsJson,
    });
    const qualityResult = computeLyricsQuality({
      singableLyrics:   singable,
      asrLyrics:        asrResult.text,
      anchorWords,
      hookLines,
      baseCompareScore: compareResult.score,
      repeatScore:      repeatResult.repeatScore,
    });
    const gateResult    = gateLyricsQuality({
      lyricsQualityScore: qualityResult.lyricsQualityScore,
      repeatScore:        repeatResult.repeatScore,
    });

    console.log(`[merge][jobId=${jobId}] final_display source=${mergeResult.lyricsSource} len=${mergeResult.displayLyrics.length} preview=${mergeResult.displayLyrics.slice(0, 120)}`);

    // manual歌詞の場合はユーザー提供歌詞を保持し、ASRでの上書きをしない
    const isManualLyrics = job.lyricsSource === "manual";
    if (isManualLyrics) {
      console.log(`[Job ${jobId}][asr] lyricsSource=manual: skipping displayLyrics overwrite to preserve user lyrics`);
    }

    await updateJob(jobId, {
      lyricsMatchScore:     compareResult.score,
      lyricsDiffJson:       compareResult.diffJson,
      displayLyrics:        isManualLyrics ? (singable || mergeResult.displayLyrics) : mergeResult.displayLyrics,
      distributionLyrics:   isManualLyrics ? (singable || mergeResult.distributionLyrics) : mergeResult.distributionLyrics,
      mergedLyrics:         mergeResult.mergedLyrics,
      lyricsReviewRequired: isManualLyrics ? false : gateResult.reviewRequired,
      distributionReady:    isManualLyrics ? true  : gateResult.distributionReady,
      lyricsSource:         isManualLyrics ? "manual" : mergeResult.lyricsSource,
      lyricsGateResult:     gateResult.gate,
      lyricsQualityScore:   qualityResult.lyricsQualityScore,
      repeatScore:          repeatResult.repeatScore,
      repeatDetected:       repeatResult.repeatDetected,
      repeatSegmentsJson:   JSON.stringify(repeatResult.repeatSegments),
    });

    console.log(`[Job ${jobId}] quality done: matchScore=${compareResult.score} qualityScore=${qualityResult.lyricsQualityScore} repeatScore=${repeatResult.repeatScore} gate=${gateResult.gate}`);

    return {
      gate:               gateResult.gate,
      lyricsQualityScore: qualityResult.lyricsQualityScore,
      repeatScore:        repeatResult.repeatScore,
      qualityUnavailable: false,
    };

  } catch (asrErr: any) {
    const msg = String(asrErr?.message ?? asrErr);
    console.warn(`[Job ${jobId}] ASR failed — qualityUnavailable=true (reason: ${msg})`);
    await updateJob(jobId, {
      asrStatus:            "failed",
      asrError:             msg,
      asrCompletedAt:       new Date().toISOString(),
      lyricsSource:         "singable",
      distributionReady:    false,
      lyricsReviewRequired: true,
      lyricsGateResult:     null,   // スコア不明なので reject と断定しない
    });
    return { gate: null, lyricsQualityScore: 0, repeatScore: 0, qualityUnavailable: true };
  }
}

// ── メイン生成パイプライン ────────────────────────────────────────────────────

async function runAudioPipeline(job: SongJob, apiKey: string): Promise<void> {
  const { jobId } = job;

  // 曲の長さをジョブ単位で1回決定（attempt1 / attempt2 で同一の長さを使う）
  const durationTargetSec = chooseSongDurationSec(job.prompt.duration);
  console.log(`[Job ${jobId}] durationTargetSec=${durationTargetSec} (userSpecified=${!!job.prompt.duration})`);

  // ── Attempt 1 ──────────────────────────────────────────────────────────────
  await updateJob(jobId, { status: "generating_audio", stage: "generating" });

  const attempt1 = await generateAudioAttempt(job, apiKey, { attemptNum: 1, maxChorusRepeats: 2, durationTargetSec });
  if (!attempt1.audioAvailable) {
    await refundBpToUser(job.userId ?? "", job.bpLocked ?? 0, "音楽生成失敗（ElevenLabs音声生成エラー）");
    return;
  }

  const audioForAsr1 = attempt1.finalUrl ?? attempt1.rawUrl ?? null;
  let quality1: QualityCheckResult = { gate: null, lyricsQualityScore: 0, repeatScore: 0, qualityUnavailable: true };

  if (audioForAsr1) {
    const asrUrlType = attempt1.finalUrl ? "final" : "raw";
    console.log(`[Job ${jobId}] ASR input: type=${asrUrlType} url=${audioForAsr1}`);
    quality1 = await runAsrAndQuality(job, apiKey, audioForAsr1);
  } else {
    console.warn(`[Job ${jobId}] ASR skipped — no audio URL available (qualityUnavailable=true)`);
    await updateJob(jobId, {
      asrStatus:            "failed",
      asrError:             "no_audio_url",
      lyricsSource:         "singable",
      distributionReady:    false,
      lyricsReviewRequired: true,
      lyricsGateResult:     null,  // スコア不明なので reject と断定しない
    });
    // qualityUnavailable=true のまま（デフォルト値を使用）
  }

  // ── 自動再生成チェック ──────────────────────────────────────────────────────
  const currentJob1       = await getJob(jobId);
  const generationAttempt = currentJob1?.generationAttempt ?? 1;
  // qualityUnavailable の場合は品質スコアが信頼できないため再生成しない
  const shouldRegenerate  =
    generationAttempt === 1 &&
    !quality1.qualityUnavailable &&
    (quality1.lyricsQualityScore < 65 || quality1.repeatScore >= 60);

  if (quality1.qualityUnavailable) {
    console.log(`[Job ${jobId}] Skipping auto-regeneration — quality unavailable (ASR not executed)`);
  }

  let usedFinalUrl      = attempt1.finalUrl;
  let usedRawUrl        = attempt1.rawUrl;
  let usedPostprocessOk = attempt1.postprocessOk;
  let usedPreset: PostprocessPreset = (attempt1.preset as PostprocessPreset) || "natural";
  let finalGate         = quality1.gate;

  if (shouldRegenerate) {
    const regenReason = `qualityScore=${quality1.lyricsQualityScore} repeatScore=${quality1.repeatScore}`;
    console.log(`[Job ${jobId}] Auto-regenerating — reason: ${regenReason}`);

    await updateJob(jobId, {
      status:             "regenerating_audio",
      generationAttempt:  2,
      regenerationReason: regenReason,
    });

    // ── Attempt 2: 強化された拘束プロンプトで再生成 ─────────────────────────
    console.log(`[Job ${jobId}] attempt2 started`);
    const attempt2 = await generateAudioAttempt(job, apiKey, { attemptNum: 2, maxChorusRepeats: 1, durationTargetSec });

    let attempt2Adopted = false;  // 実際に attempt2 を最終採用したかどうか

    if (!attempt2.audioAvailable) {
      console.warn(`[Job ${jobId}] attempt2 generation failed — falling back to attempt1 results`);
      // attempt1 の usedFinalUrl / usedRawUrl はそのまま維持
    } else {
      const audioForAsr2 = attempt2.finalUrl ?? attempt2.rawUrl ?? null;
      if (audioForAsr2) {
        console.log(`[Job ${jobId}] attempt2 audio available — running ASR quality check`);
        const quality2 = await runAsrAndQuality(job, apiKey, audioForAsr2);
        if (!quality2.qualityUnavailable) {
          console.log(`[Job ${jobId}] attempt2 quality: score=${quality2.lyricsQualityScore} repeat=${quality2.repeatScore} gate=${quality2.gate} — adopting attempt2`);
          finalGate         = quality2.gate;
          usedFinalUrl      = attempt2.finalUrl;
          usedRawUrl        = attempt2.rawUrl;
          usedPostprocessOk = attempt2.postprocessOk;
          usedPreset        = (attempt2.preset as PostprocessPreset) || "natural";
          attempt2Adopted   = true;
        } else {
          console.warn(`[Job ${jobId}] attempt2 ASR unavailable — falling back to attempt1 results`);
        }
      } else {
        console.warn(`[Job ${jobId}] attempt2 no audio URL for ASR — falling back to attempt1 results`);
      }
    }

    const selectedAttempt = attempt2Adopted ? 2 : 1;
    console.log(`[Job ${jobId}] final selected attempt=${selectedAttempt} finalGate=${finalGate}`);
  }

  // ── Phase 6: completed / review_required 決定 ────────────────────────────
  const currentJob = await getJob(jobId);
  const rawAudioUrl = currentJob?.rawAudioUrl ?? usedRawUrl ?? undefined;

  const hasAudioUrl = !!(usedFinalUrl ?? usedRawUrl ?? rawAudioUrl);

  // 音源URLが存在しない場合は completed にしない
  if (!hasAudioUrl) {
    console.error(`[Job ${jobId}] No audio URL available — forcing review_required instead of completed`);
  }

  const finalStatus = hasAudioUrl && (finalGate === "pass" || finalGate === "review")
    ? "completed"
    : "review_required";

  console.log(`[Job ${jobId}] finalStatus=${finalStatus} hasAudioUrl=${hasAudioUrl} gate=${finalGate}`);

  const audioFinalUrl = usedPostprocessOk && usedFinalUrl
    ? usedFinalUrl
    : rawAudioUrl;

  if (usedPostprocessOk && usedFinalUrl) {
    const updatedRightsLog = mergeRightsLog(currentJob?.rightsLog, {
      type:    "postprocessApplied",
      preset:  usedPreset,
      version: "v1",
    });
    await updateJob(jobId, {
      status:      finalStatus,
      audioUrl:    usedFinalUrl,
      downloadUrl: usedFinalUrl,
      bpFinal:     currentJob?.bpLocked ?? BP_COSTS.music_full,
      rightsLog:   updatedRightsLog,
    });
    console.log(`[Job ${jobId}] ${finalStatus} (gate=${finalGate}) with final: ${usedFinalUrl}`);
  } else {
    const fallbackReason = usedPostprocessOk ? "final_upload_failed" : "postprocess_failed";
    const updatedRightsLog = mergeRightsLog(currentJob?.rightsLog, {
      type:   "postprocessFallbackRaw",
      reason: fallbackReason,
    });
    await updateJob(jobId, {
      status:      finalStatus,
      audioUrl:    audioFinalUrl,
      downloadUrl: audioFinalUrl,
      bpFinal:     currentJob?.bpLocked ?? BP_COSTS.music_full,
      rightsLog:   updatedRightsLog,
    });
    console.log(`[Job ${jobId}] ${finalStatus} (gate=${finalGate}) with raw fallback (${fallbackReason}): ${audioFinalUrl}`);
  }
}

// ── Route Handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { jobId, approved } = body ?? {};
  if (!jobId)            return NextResponse.json({ ok: false, error: "jobId_required" },        { status: 400 });
  if (approved !== true) return NextResponse.json({ ok: false, error: "approved_must_be_true" }, { status: 400 });

  const job = await getJob(String(jobId));
  if (!job) return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  if (job.prompt.vocalStyle === "ボーカルなし") {
    await updateJob(String(jobId), {
      status: "failed",
      error: "invalid_vocal_style_for_song",
    });
    await refundBpToUser(job.userId ?? "", job.bpLocked ?? 0, "音楽生成失敗（song生成でボーカルなしは使用不可）");
    return NextResponse.json({
      ok: false,
      error: "invalid_vocal_style_for_song",
      message: "song生成ではボーカルなしは使えません。BGM生成を使用してください。",
    }, { status: 400 });
  }
  if (job.status !== "structure_ready") {
    // すでにパイプライン進行中 or 完了済みの場合は冪等処理（二重クリック対策）
    const IN_PROGRESS_STATUSES: JobStatus[] = [
      "generating_audio", "postprocessing", "uploading_result",
      "transcribing_lyrics", "merging_lyrics", "quality_checking",
      "regenerating_audio", "completed", "review_required",
    ];
    if (IN_PROGRESS_STATUSES.includes(job.status as JobStatus)) {
      return NextResponse.json({ ok: true, status: job.status, alreadyInProgress: true });
    }
    return NextResponse.json({ ok: false, error: "invalid_status", status: job.status }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("[ElevenLabs] ELEVENLABS_API_KEY is not set");
    await updateJob(String(jobId), { status: "failed", error: "elevenlabs_api_key_missing" });
    await refundBpToUser(job.userId ?? "", job.bpLocked ?? 0, "音楽生成失敗（ElevenLabs APIキー未設定）");
    return NextResponse.json({
      ok:      false,
      error:   "elevenlabs_api_key_missing",
      message: "ElevenLabs APIキーが設定されていません。管理者に連絡してください。",
    }, { status: 500 });
  }

  // structure 承認ログを記録してからパイプライン開始
  const rightsLog = mergeRightsLog(job.rightsLog, { type: "structureApproved" });
  await updateJob(String(jobId), {
    status:            "generating_audio",
    postprocessStatus: "pending",
    generationAttempt: 1,
    rightsLog,
  });

  const updatedJob = await getJob(String(jobId));
  if (!updatedJob) {
    return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  }

  await runAudioPipeline(updatedJob, apiKey);

  const finalJob = await getJob(String(jobId));
  return NextResponse.json({ ok: true, status: finalJob?.status ?? "completed" });
}

// app/api/song/cancel/route.ts
import { NextResponse } from "next/server";
import { getJob, updateJob, refundBpToUser } from "../_jobStore";
import { BP_COSTS } from "@/app/lib/bp-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBpRefund(status: string): number {
  switch (status) {
    case "lyrics_generating":
    case "lyrics_ready":
      return BP_COSTS.music_full;                               // 全額返金
    case "structure_generating":
    case "structure_ready":
      return Math.round(BP_COSTS.music_full * 0.7);            // 70%返金
    case "audio_generating":
      return Math.round(BP_COSTS.music_full * 0.3);            // 30%返金
    default:
      return 0;
  }
}

const CANCELLABLE = new Set([
  "lyrics_generating",
  "lyrics_ready",
  "structure_generating",
  "structure_ready",
  "audio_generating",
]);

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { jobId } = body ?? {};

  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId_required" }, { status: 400 });
  }

  const job = await getJob(String(jobId));
  if (!job) {
    return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  }

  if (!CANCELLABLE.has(job.status)) {
    return NextResponse.json(
      { ok: false, error: "cannot_cancel", status: job.status },
      { status: 400 }
    );
  }

  const bpRefunded = getBpRefund(job.status);
  await updateJob(String(jobId), { status: "cancelled" });

  if (bpRefunded > 0 && job.userId) {
    await refundBpToUser(job.userId, bpRefunded, `キャンセル返還（${job.status}）`);
  }

  return NextResponse.json({ ok: true, status: "cancelled", bpRefunded });
}

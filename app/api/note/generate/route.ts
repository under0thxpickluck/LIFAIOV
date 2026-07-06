import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { NOTE_ARTICLE_SCHEMA } from "@/lib/ai/schemas";
import { NOTE_SYSTEM_PROMPT, buildArticlePrompt } from "@/lib/ai/prompts/note";
import { BP_COSTS } from "@/app/lib/bp-config";

const NOTE_BP_COST = BP_COSTS.note_full; // フル生成料金（本文生成時に課金 / plan と同額）

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { plan_id, selected_title, outline, tone, length, paywall_mode, loginId } = body;

  if (!plan_id || !selected_title || !outline || !tone || !length || !paywall_mode) {
    return NextResponse.json({ ok: false, error: "必須パラメータが不足しています" }, { status: 400 });
  }
  if (!loginId) {
    return NextResponse.json({ ok: false, error: "loginId_required" }, { status: 400 });
  }

  // ── BP 消費（GAS deduct_bp / plan ルートと同じ方式。OpenAI 呼び出し前に確定）──────
  const gasUrl      = process.env.GAS_WEBAPP_URL;
  const gasKey      = process.env.GAS_API_KEY;
  const gasAdminKey = process.env.GAS_ADMIN_KEY;

  if (!gasUrl || !gasKey || !gasAdminKey) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }

  try {
    const gasEndpoint = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
    const deductRes = await fetch(gasEndpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      cache:   "no-store",
      body: JSON.stringify({
        action:   "deduct_bp",
        adminKey: gasAdminKey,
        loginId,
        amount:   NOTE_BP_COST,
        memo:     "note本文生成",
      }),
    });
    const deductData = await deductRes.json().catch(() => ({ ok: false, error: "invalid_response" }));
    if (!deductData.ok) {
      const reason = deductData.error || "deduct_failed";
      if (reason === "insufficient_bp") {
        return NextResponse.json({ ok: false, error: "insufficient_bp", bp_balance: deductData.bp_balance }, { status: 402 });
      }
      return NextResponse.json({ ok: false, error: reason }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "bp_deduct_failed" }, { status: 502 });
  }

  const client = getOpenAIClient();
  const userPrompt = buildArticlePrompt({ selected_title, outline, tone, length, paywall_mode });

  const model = length >= 8000 ? "gpt-4o" : "gpt-4o-mini";

  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: NOTE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "note_article",
            strict: true,
            schema: NOTE_ARTICLE_SCHEMA,
          },
        },
        temperature: 0.75,
        max_tokens: Math.min(length * 2, 8000),
      });

      const content = response.choices[0].message.content;
      result = JSON.parse(content!);
      break;
    } catch (err) {
      if (attempt === 2) {
        return NextResponse.json({ ok: false, error: "本文生成に失敗しました。再試行してください" }, { status: 500 });
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }

  const markdown = result.sections
    .map((s: { heading: string; body_markdown: string; is_paid: boolean }) => {
      const paidMarker = s.is_paid ? "\n\n---\n> ここから先は有料記事です\n\n" : "";
      return `${paidMarker}## ${s.heading}\n\n${s.body_markdown}`;
    })
    .join("\n\n");

  const job_id = `note_${Date.now()}`;
  // TODO: saveArticle(job_id, { plan_id, markdown, ...result })
  // TODO: consumeBP(userId, calcBP(length))

  return NextResponse.json({
    ok: true,
    job_id,
    data: {
      markdown,
      sections: result.sections,
      note_description: result.note_description,
      x_post: result.x_post,
      line_copy: result.line_copy,
    },
  });
}

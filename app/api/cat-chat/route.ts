import { NextResponse } from "next/server";
import OpenAI from "openai";
import { BP_COSTS } from "@/app/lib/bp-config";
import { isDateTimeQuestion, buildDateTimeAnswer, getNowInJST } from "@/lib/cat/datetime";

const BASE_SYSTEM_PROMPT = `あなたは「リファ猫」というAIサロン「LIFAI」のマスコットキャラクターです。
フレンドリーで親しみやすいトーンで、何でも日本語で答えてください。
AI・副業・プログラミング・日常の悩みなど、幅広い質問に対応します。
LIFAIの機能（団子占い・BGM生成・マーケット・ガチャ・ミッション・ステーキング・ノート生成・ランブル・タップマイニング・紹介制度）についても詳しいです。
回答は簡潔にまとめつつ、必要なら詳しく説明してください。
ページ文脈が与えられた場合は、そのページに関連した回答を優先してください。
日付・曜日・時刻に関する質問では、必ずsystem promptで与えられた現在時刻情報を優先してください。現在時刻を推測で答えてはいけません。`;

const replyCache = new Map<string, string>();

// シンプルなインメモリFAQキャッシュ（GASから取得して5分間保持）
let faqCache: { items: { question_pattern: string; answer: string }[]; fetchedAt: number } | null = null;
const FAQ_TTL_MS = 5 * 60 * 1000;

async function fetchFaqs(gasUrl: string, gasKey: string) {
  if (faqCache && Date.now() - faqCache.fetchedAt < FAQ_TTL_MS) return faqCache.items;
  try {
    const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "cat_faq_list", key: gasKey }),
    });
    const data = await r.json().catch(() => ({ ok: false }));
    if (data.ok && Array.isArray(data.items)) {
      faqCache = { items: data.items, fetchedAt: Date.now() };
      return data.items as { question_pattern: string; answer: string }[];
    }
  } catch { /* ignore */ }
  return [];
}

function matchFaq(message: string, faqs: { question_pattern: string; answer: string }[]): string | null {
  const lower = message.toLowerCase();
  for (const faq of faqs) {
    const patterns = faq.question_pattern.split(/[,，|｜]/).map(p => p.trim().toLowerCase());
    if (patterns.some(p => p && lower.includes(p))) return faq.answer;
  }
  return null;
}

async function callGasBalance(id: string, gasUrl: string, gasKey: string): Promise<number> {
  const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ action: "get_balance", id }),
  });
  const data = await r.json().catch(() => ({ ok: false }));
  if (!data.ok) throw new Error("balance_fetch_failed");
  return Number(data.bp ?? 0);
}

async function deductBp(id: string, amount: number, gasUrl: string, gasKey: string, gasAdminKey: string): Promise<void> {
  const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ action: "deduct_bp", adminKey: gasAdminKey, loginId: String(id), amount }),
  });
  const data = await r.json().catch(() => ({ ok: false }));
  if (!data.ok) throw new Error(data.error || "deduct_bp_failed");
}

// fire-and-forget: GASにログ保存（レスポンスをブロックしない）
function saveLog(params: {
  logId: string; userId: string; sessionId: string; pagePath: string;
  widgetMode: string; userMessage: string; assistantMessage: string;
  sourceType: string; confidence: number; gasUrl: string; gasKey: string;
}) {
  const url = `${params.gasUrl}${params.gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(params.gasKey)}`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      action: "cat_log_create",
      key: params.gasKey,
      log_id: params.logId,
      user_id: params.userId,
      session_id: params.sessionId,
      page_path: params.pagePath,
      widget_mode: params.widgetMode,
      user_message: params.userMessage,
      assistant_message: params.assistantMessage,
      source_type: params.sourceType,
      confidence: params.confidence,
    }),
  }).catch(() => {});
}

// fire-and-forget: unknown質問を記録
function saveUnknown(userMessage: string, pagePath: string, gasUrl: string, gasKey: string) {
  const url = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(gasKey)}`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ action: "cat_unknown_upsert", key: gasKey, user_message: userMessage, page_path: pagePath }),
  }).catch(() => {});
}

export async function POST(req: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const {
      message, history, images, id,
      pagePath = "", widgetMode = "popup", sessionId = "",
    } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ ok: false, error: "empty message" }, { status: 400 });
    }

    const gasUrl = process.env.GAS_WEBAPP_URL;
    const gasKey = process.env.GAS_API_KEY;
    const gasAdminKey = process.env.GAS_ADMIN_KEY;

    // BP 残高チェック & 消化（id がある場合のみ）
    if (id && gasUrl && gasKey && gasAdminKey) {
      let bp: number;
      try {
        bp = await callGasBalance(String(id), gasUrl, gasKey);
      } catch {
        return NextResponse.json({ ok: false, error: "balance_check_failed" }, { status: 502 });
      }
      if (bp < BP_COSTS.chat_message) {
        return NextResponse.json({ ok: false, error: "insufficient_bp", bp }, { status: 400 });
      }
      try {
        await deductBp(String(id), BP_COSTS.chat_message, gasUrl, gasKey, gasAdminKey);
      } catch {
        return NextResponse.json({ ok: false, error: "deduct_bp_failed" }, { status: 502 });
      }
    }

    const safeImages = Array.isArray(images)
      ? (images as string[]).filter((img) => typeof img === "string" && img.startsWith("data:image/"))
      : undefined;

    const logId = `CL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let sourceType = "ai";
    let confidence = 0.8;
    let reply: string;

    // 1. datetime系ルール判定（最優先・OpenAIへ流さない）
    if (isDateTimeQuestion(message)) {
      reply = buildDateTimeAnswer(message);
      sourceType = "rule_datetime";
      confidence = 1.0;
      if (gasUrl && gasKey) {
        saveLog({ logId, userId: String(id || ""), sessionId, pagePath, widgetMode, userMessage: message, assistantMessage: reply, sourceType, confidence, gasUrl, gasKey });
      }
      return NextResponse.json({ ok: true, reply, sourceType, confidence, logId, cached: false });
    }

    // 2. FAQ参照（GASが設定済みの場合）
    if (gasUrl && gasKey && !safeImages?.length) {
      const faqs = await fetchFaqs(gasUrl, gasKey);
      const faqAnswer = matchFaq(message, faqs);
      if (faqAnswer) {
        reply = faqAnswer;
        sourceType = "faq";
        confidence = 1.0;
        if (gasUrl && gasKey) {
          saveLog({ logId, userId: String(id || ""), sessionId, pagePath, widgetMode, userMessage: message, assistantMessage: reply, sourceType, confidence, gasUrl, gasKey });
        }
        return NextResponse.json({ ok: true, reply, sourceType, confidence, logId, cached: false });
      }
    }

    // キャッシュ（履歴なし・画像なしの場合のみ）
    const cacheKey = `${pagePath}::${message.trim().toLowerCase()}`;
    if (!history?.length && !safeImages?.length && replyCache.has(cacheKey)) {
      const cached = replyCache.get(cacheKey)!;
      return NextResponse.json({ ok: true, reply: cached, sourceType: "ai", confidence: 0.8, logId, cached: true });
    }

    // ページ文脈 + 現在日時をsystem promptに追加
    const nowJst = getNowInJST();
    const datetimeHint = `\n現在の日本時間は ${nowJst.full} です。`;
    const contextHint = pagePath
      ? `\n現在ユーザーがいるページ: ${pagePath}。このページに関連した回答を優先してください。`
      : "";
    const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT + datetimeHint + contextHint;

    let userMessageContent: string | OpenAI.Chat.ChatCompletionContentPart[];
    if (safeImages?.length) {
      const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
      for (const img of safeImages.slice(0, 3)) {
        parts.push({ type: "image_url", image_url: { url: img, detail: "auto" } });
      }
      parts.push({ type: "text", text: message });
      userMessageContent = parts;
    } else {
      userMessageContent = message;
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT + contextHint },
      ...((history ?? []).slice(-10).map((h: { role: string; content: string }) => ({
        role: h.role === "user" ? "user" as const : "assistant" as const,
        content: h.content || "",
      }))),
      { role: "user" as const, content: userMessageContent },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 800,
      temperature: 0.7,
    });

    reply = completion.choices[0]?.message?.content ?? "ごめんね、うまく答えられなかったよ🙀";

    // キャッシュ保存
    if (!history?.length && !safeImages?.length) {
      if (replyCache.size >= 200) {
        const firstKey = replyCache.keys().next().value;
        if (firstKey) replyCache.delete(firstKey);
      }
      replyCache.set(cacheKey, reply);
    }

    // GASログ保存（fire-and-forget）
    if (gasUrl && gasKey) {
      saveLog({ logId, userId: String(id || ""), sessionId, pagePath, widgetMode, userMessage: message, assistantMessage: reply, sourceType, confidence, gasUrl, gasKey });
    }

    return NextResponse.json({ ok: true, reply, sourceType, confidence, logId, cached: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("cat-chat error:", err);

    // unknown登録（fire-and-forget）
    try {
      const body = await (err as any)?.request?.json?.().catch?.(() => null);
      const gasUrl = process.env.GAS_WEBAPP_URL;
      const gasKey = process.env.GAS_API_KEY;
      if (gasUrl && gasKey && body?.message) {
        saveUnknown(body.message, body.pagePath || "", gasUrl, gasKey);
      }
    } catch { /* ignore */ }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import type { ImageChatState } from "@/app/lib/image/image_types";

export const maxDuration = 30;

const FIELDS = ["character", "scene", "atmosphere", "style", "composition", "detail"] as const;
type Field = typeof FIELDS[number];

const FIELD_LABELS: Record<Field, string> = {
  character: "何を描く？",
  scene: "背景・環境",
  atmosphere: "雰囲気・ムード",
  style: "画風・スタイル",
  composition: "構図・アングル",
  detail: "追加ディテール",
};

const SUGGESTIONS: Record<Field, string[]> = {
  character: ["柴犬の子犬", "アニメの女の子", "古代の龍", "満開の桜の木", "宇宙飛行士"],
  scene: ["雪山", "夜の海辺", "深海", "未来都市", "秋の森"],
  atmosphere: ["幻想的", "神秘的", "明るく暖かい", "ダーク", "壮大"],
  style: ["アニメ風", "リアルな写真風", "水彩画", "油絵", "ピクセルアート"],
  composition: ["クローズアップ", "全体像", "俯瞰", "広角", "ポートレート"],
  detail: ["光のエフェクト", "霧", "ボケ背景", "星空", "水の反射"],
};

function getNextField(state: Partial<ImageChatState>): Field | null {
  for (const field of FIELDS) {
    if (!state[field as keyof ImageChatState]) return field;
  }
  return null;
}

function parseStateUpdates(message: string, currentField: Field | null): Partial<ImageChatState> {
  if (!currentField) return {};
  return { [currentField]: message.trim() };
}

export async function POST(req: NextRequest) {
  try {
    const { id, code, message, state } = await req.json() as {
      id: string;
      code: string;
      message: string;
      state: Partial<ImageChatState>;
    };

    if (!id || !code) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      return NextResponse.json({ ok: false, error: "openai_not_configured" }, { status: 500 });
    }

    // GPTで状態更新と次の質問を生成
    const systemPrompt = `You are an assistant that helps users design AI-generated images of ANYTHING — animals, people, landscapes, objects, abstract art, food, vehicles, fantasy creatures, architecture, etc. No restrictions on subject matter.

You extract image details from conversation and store them as English keywords optimized for image generation.

Current confirmed fields (JSON): ${JSON.stringify(state)}

Valid field names (use ONLY these):
- character: The main subject — can be ANYTHING. Examples: "golden retriever puppy", "ancient dragon breathing fire", "cherry blossom tree in full bloom", "futuristic cityscape", "cup of matcha tea", "anime schoolgirl", "astronaut floating in space", "cute cat wearing glasses", "giant whale underwater", "old lighthouse on rocky coast"
- hair: Texture/surface/fur details — use ONLY if relevant to subject (e.g. "fluffy golden fur", "long silver hair", "rough stone texture", "smooth chrome surface")
- outfit: Clothing/accessories/natural features — ONLY if relevant (e.g. "red collar with bell", "samurai armor", "autumn-colored leaves", "glowing runes on skin")
- emotion: Expression/pose/state (e.g. "playful and energetic", "fierce and roaring", "sleeping peacefully", "looking curiously", "mid-leap")
- scene: Setting/environment (e.g. "snowy mountain peak", "cozy cafe interior", "deep ocean floor", "outer space nebula", "enchanted forest")
- timeOfDay: Lighting/time condition (e.g. "golden hour sunset", "blue hour twilight", "midday harsh sunlight", "moonlit night", "stormy overcast")
- atmosphere: Overall mood (e.g. "peaceful and serene", "epic and grand", "dark and mysterious", "whimsical and magical")
- style: Visual style (e.g. "photorealistic", "anime style", "watercolor painting", "oil painting", "3D render", "pixel art", "sketch", "cinematic")
- composition: Framing and perspective (e.g. "close-up portrait", "wide establishing shot", "bird's eye view", "macro photography", "dynamic action angle")
- detail: Additional elements (e.g. "glowing eyes", "falling snow", "lens flare", "bokeh background", "mist and fog", "particles of light")

Rules:
1. If "character" is not yet set, ALWAYS ask what the user wants to draw first — accept any subject with no restrictions.
2. Skip fields that don't apply to the subject (e.g. skip "hair" and "outfit" for a landscape or building).
3. Values MUST be in English — translate Japanese input to English image-generation keywords.
4. Ask follow-up questions in Japanese, tailored to the subject type.
5. Reply in JSON: {"reply": "Japanese question for next relevant field", "field": "field_name", "value": "English descriptive value"}`;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    let reply = "";
    let updatedState = { ...state };
    let suggestedNextField: string | null = null;

    if (gptRes.ok) {
      const gptData = await gptRes.json();
      let parsed: any = {};
      try { parsed = JSON.parse(gptData.choices?.[0]?.message?.content ?? "{}"); } catch {}
      reply = parsed.reply ?? "";
      if (parsed.field && parsed.value) {
        updatedState = { ...updatedState, [parsed.field]: parsed.value };
      }
    }

    // GPT失敗時はルールベースで補完
    if (!reply) {
      const currentField = getNextField(state);
      const stateUpdates = parseStateUpdates(message, currentField);
      updatedState = { ...updatedState, ...stateUpdates };
      const nextField = getNextField(updatedState);
      if (nextField) {
        const suggestions = SUGGESTIONS[nextField].slice(0, 3).join("、");
        reply = `${FIELD_LABELS[nextField]}はどうする？ 例: ${suggestions}`;
        suggestedNextField = nextField;
      } else {
        reply = "いいね。全部決まったよ。準備ができたら生成してみて！";
      }
    } else {
      const nextField = getNextField(updatedState);
      suggestedNextField = nextField;
    }

    const newState: ImageChatState = {
      ...updatedState,
      turns: (state.turns ?? 0) + 1,
      textLength: (state.textLength ?? 0) + message.length,
    };

    return NextResponse.json({
      ok: true,
      reply,
      state: newState,
      stateUpdate: newState,
      suggestedNextField,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

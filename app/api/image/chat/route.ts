import { NextRequest, NextResponse } from "next/server";
import type { ImageChatState } from "@/app/lib/image/image_types";

export const maxDuration = 30;

const FIELDS = ["character", "hair", "outfit", "emotion", "scene", "timeOfDay", "atmosphere", "style", "composition", "detail"] as const;
type Field = typeof FIELDS[number];

const FIELD_LABELS: Record<Field, string> = {
  character: "キャラクター",
  hair: "髪型",
  outfit: "服装",
  emotion: "表情",
  scene: "背景",
  timeOfDay: "時間帯",
  atmosphere: "雰囲気",
  style: "画風",
  composition: "構図",
  detail: "追加ディテール",
};

const SUGGESTIONS: Record<Field, string[]> = {
  character: ["女の子", "男の子", "猫耳の女の子", "魔法少女"],
  hair: ["ロング", "ボブ", "ポニーテール", "ツインテール"],
  outfit: ["制服", "私服", "和服", "ドレス"],
  emotion: ["笑顔", "泣きそう", "無表情", "驚き"],
  scene: ["教室", "夜の街", "森", "空"],
  timeOfDay: ["昼", "夕方", "夜", "朝"],
  atmosphere: ["切ない", "明るい", "神秘的", "幻想的"],
  style: ["アニメ風", "水彩画風", "ファンタジー", "シネマティック"],
  composition: ["上半身", "全身", "アップ", "俯瞰"],
  detail: ["星空", "花びら", "光のエフェクト", "雨粒"],
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
    const systemPrompt = `You are an assistant that helps users define the content of an AI-generated image through conversation.
You extract image details from the user's message and store them as English keywords suitable for image generation.

Current confirmed fields (JSON): ${JSON.stringify(state)}

Valid field names (use ONLY these):
- character: subject/character description (e.g. "cat-eared girl", "wizard boy")
- hair: hair style (e.g. "long black hair", "twin tails")
- outfit: clothing (e.g. "school uniform", "kimono")
- emotion: facial expression (e.g. "smiling", "crying")
- scene: background/setting (e.g. "classroom", "night city", "forest")
- timeOfDay: time of day (e.g. "dusk", "night", "morning")
- atmosphere: mood/atmosphere (e.g. "melancholic", "mysterious", "dreamy")
- style: art style (e.g. "anime style", "watercolor", "cinematic")
- composition: framing (e.g. "upper body", "full body", "close-up")
- detail: additional details (e.g. "falling petals", "light effects")

Rules:
1. Extract the relevant field and value from the user's message.
2. The "value" MUST be in English (translate from Japanese if needed).
3. Ask the user in Japanese about the next undefined field.
4. Reply in JSON: {"reply": "Japanese question for next field", "field": "field_name", "value": "English value"}`;

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

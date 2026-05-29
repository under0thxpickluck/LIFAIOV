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
    const systemPrompt = `あなたは画像生成AIのアシスタントです。
ユーザーと会話しながら、画像の内容を段階的に決めていきます。
現在確定している項目: ${JSON.stringify(state)}
まだ未確定の項目から次の1つを質問してください。
返答はJSON形式で: {"reply": "AIの返答", "field": "更新するフィールド名", "value": "抽出した値"}`;

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
      turns: (state.turns ?? 0) + 1,
      textLength: (state.textLength ?? 0) + message.length,
      ...updatedState,
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

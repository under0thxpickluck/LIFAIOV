import type { ImageChatState } from "./image_types";

export function buildPrompt(state: ImageChatState): string {
  return [
    state.character ?? "",
    state.hair ?? "",
    state.outfit ?? "",
    state.emotion ?? "",
    state.scene ?? "",
    state.timeOfDay ?? "",
    state.atmosphere ?? "",
    state.style ?? "",
    state.composition ?? "",
    state.detail ?? "",
    state.hq ? "high quality, detailed, masterpiece" : "high quality",
  ]
    .filter(Boolean)
    .join(", ");
}

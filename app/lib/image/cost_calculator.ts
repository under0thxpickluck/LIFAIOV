import type { ImageChatState, ImagePreviewCost } from "./image_types";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function calcImageCost(state: ImageChatState): ImagePreviewCost {
  const base = 60;
  const turn = (state.turns || 0) * 15;
  const text = Math.ceil((state.textLength || 0) / 120) * 15;
  const style = state.style ? 30 : 0;
  const hq = state.hq ? 60 : 0;
  const edit = state.edit ? 90 : 0;

  const totalBp = clamp(base + turn + text + style + hq + edit, 150, 450);

  return {
    totalBp,
    breakdown: { base, turn, text, style, hq, edit },
  };
}

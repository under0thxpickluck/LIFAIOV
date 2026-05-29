import type { ImageChatState, ImagePreviewCost } from "./image_types";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function calcImageCost(state: ImageChatState): ImagePreviewCost {
  const base = 20;
  const turn = (state.turns || 0) * 5;
  const text = Math.ceil((state.textLength || 0) / 120) * 5;
  const style = state.style ? 10 : 0;
  const hq = state.hq ? 20 : 0;
  const edit = state.edit ? 30 : 0;

  const totalBp = clamp(base + turn + text + style + hq + edit, 50, 150);

  return {
    totalBp,
    breakdown: { base, turn, text, style, hq, edit },
  };
}

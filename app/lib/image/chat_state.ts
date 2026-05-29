import type { ImageChatState } from "./image_types";

export function mergeState(
  current: Partial<ImageChatState>,
  updates: Partial<ImageChatState>
): ImageChatState {
  return {
    ...current,
    ...updates,
    turns: (current.turns ?? 0) + (updates.turns ?? 0),
    textLength: (current.textLength ?? 0) + (updates.textLength ?? 0),
  };
}

export function emptyState(): ImageChatState {
  return { turns: 0, textLength: 0 };
}

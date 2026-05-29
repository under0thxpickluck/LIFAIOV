import type { ImageChatState } from "./image_types";

const MIN_BP = Number(process.env.IMAGE_MIN_BP ?? 50);
const MAX_BP = Number(process.env.IMAGE_MAX_BP ?? 150);

export function validateState(state: Partial<ImageChatState>): string | null {
  if (typeof state.turns !== "number" || state.turns < 0) {
    return "turns must be a non-negative number";
  }
  if (typeof state.textLength !== "number" || state.textLength < 0) {
    return "textLength must be a non-negative number";
  }
  return null;
}

export function checkBpSufficient(balance: number, cost: number): boolean {
  return balance >= cost;
}

export { MIN_BP, MAX_BP };

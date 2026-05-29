// lib/narasu-agency/validation.ts
import type { NarasuAgencyDraft } from "./types";

function isValidUrl(v: string): boolean {
  try { new URL(v); return true; } catch { return false; }
}

export type ValidationErrors = Partial<Record<keyof NarasuAgencyDraft | "audioUrls_items", string>>;

export function validateDraft(draft: NarasuAgencyDraft): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!draft.narasuLoginId.trim()) {
    errors.narasuLoginId = "narasuアカウントID（メールアドレス）を入力してください";
  }
  if (!draft.narasuPassword.trim()) {
    errors.narasuPassword = "narasuパスワードを入力してください";
  }

  const filledUrls = draft.audioUrls.filter((e) => e.url.trim());
  if (filledUrls.length === 0) {
    errors.audioUrls = "音源URLを1件以上入力してください";
  } else {
    const invalidUrl = filledUrls.find((e) => !isValidUrl(e.url.trim()));
    if (invalidUrl) {
      errors.audioUrls_items = "URL形式が正しくありません: " + invalidUrl.url;
    }
  }

  if (!draft.jacketImageUrl.trim()) {
    errors.jacketImageUrl = "ジャケット画像URLを入力してください";
  } else if (!isValidUrl(draft.jacketImageUrl.trim())) {
    errors.jacketImageUrl = "ジャケット画像URLの形式が正しくありません";
  }

  if (!draft.artistName.trim()) errors.artistName = "アーティスト名を入力してください";
  if (!draft.artistNameKana.trim()) errors.artistNameKana = "アーティスト名（仮名）を入力してください";
  if (!draft.artistNameAlpha.trim()) errors.artistNameAlpha = "アーティスト名（アルファベット）を入力してください";

  if (!draft.albumName.trim()) errors.albumName = "アルバム名を入力してください";
  if (!draft.albumNameKana.trim()) errors.albumNameKana = "アルバム名（仮名）を入力してください";
  if (!draft.albumNameAlpha.trim()) errors.albumNameAlpha = "アルバム名（アルファベット）を入力してください";

  return errors;
}

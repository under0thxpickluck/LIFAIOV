// lib/narasu-agency/validation.ts
import type { NarasuAgencyDraft } from "./types";

function isValidUrl(v: string): boolean {
  try { new URL(v); return true; } catch { return false; }
}

function isKanaOnly(v: string): boolean {
  return /^[ァ-ヶーヴ・\s　]+$/.test(v);
}

function isAlphaOnly(v: string): boolean {
  return /^[a-zA-Z0-9 .,\-_'&()!?]+$/.test(v);
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

  const MAX_AUDIO = 15;
  const filledUrls = draft.audioUrls.filter((e) => e.url.trim());
  if (filledUrls.length === 0) {
    errors.audioUrls = "音源URLを1件以上入力してください";
  } else if (filledUrls.length > MAX_AUDIO) {
    errors.audioUrls = `音源URLは${MAX_AUDIO}曲までです（現在${filledUrls.length}曲）`;
  } else {
    const invalidUrl = filledUrls.find((e) => !isValidUrl(e.url.trim()));
    if (invalidUrl) {
      errors.audioUrls_items = "URL形式が正しくありません: " + invalidUrl.url;
    } else {
      const missingTitle = filledUrls.find((e) => !e.title?.trim());
      if (missingTitle) {
        errors.audioUrls_items = "曲名をすべて入力してください";
      }
    }
  }

  if (!draft.jacketImageUrl.trim()) {
    errors.jacketImageUrl = "ジャケット画像URLを入力してください";
  } else if (!isValidUrl(draft.jacketImageUrl.trim())) {
    errors.jacketImageUrl = "ジャケット画像URLの形式が正しくありません";
  }

  if (!draft.artistName.trim()) errors.artistName = "アーティスト名を入力してください";

  if (!draft.artistNameKana.trim()) {
    errors.artistNameKana = "アーティスト名（仮名）を入力してください";
  } else if (!isKanaOnly(draft.artistNameKana)) {
    errors.artistNameKana = "カタカナで入力してください（例：ライファイスタジオ）";
  }

  if (!draft.artistNameAlpha.trim()) {
    errors.artistNameAlpha = "アーティスト名（アルファベット）を入力してください";
  } else if (!isAlphaOnly(draft.artistNameAlpha)) {
    errors.artistNameAlpha = "半角英数字・記号のみで入力してください（例：LIFAI Studio）";
  }

  if (!draft.albumName.trim()) errors.albumName = "アルバム名を入力してください";

  if (!draft.albumNameKana.trim()) {
    errors.albumNameKana = "アルバム名（仮名）を入力してください";
  } else if (!isKanaOnly(draft.albumNameKana)) {
    errors.albumNameKana = "カタカナで入力してください（例：ファーストライト）";
  }

  if (!draft.albumNameAlpha.trim()) {
    errors.albumNameAlpha = "アルバム名（アルファベット）を入力してください";
  } else if (!isAlphaOnly(draft.albumNameAlpha)) {
    errors.albumNameAlpha = "半角英数字・記号のみで入力してください（例：First Light）";
  }

  return errors;
}

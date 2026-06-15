// lib/narasu-agency/types.ts
export type NarasuAgencyStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "completed"
  | "rejected";

export type AudioUrlEntry = {
  id: string;
  url: string;
  title: string;
  lyrics: string;
};

export type NarasuAgencyDraft = {
  narasuLoginId: string;
  narasuPassword: string;
  audioUrls: AudioUrlEntry[];
  lyricsText: string;
  jacketImageUrl: string;
  jacketNote: string;
  artistPhotoUrl: string;
  artistName: string;
  artistNameKana: string;
  artistNameAlpha: string;
  albumName: string;
  albumNameKana: string;
  albumNameAlpha: string;
  note: string;
  agreedTermsVersion: string;
  agreedAt: string;
};

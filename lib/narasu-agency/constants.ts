// lib/narasu-agency/constants.ts
export const NARASU_GATE_PASSWORD = "nagoya01@";
export const NARASU_TERMS_VERSION = "v0.3-draft";
export const NARASU_STORAGE_KEY = "lifai_narasu_agency_draft_v1";
export const NARASU_GATE_KEY = "lifai_narasu_gate_v1";

// 一時停止フラグ: true にすると申請受付を停止する
export const NARASU_AGENCY_SUSPENDED = false;

// BP払い一時停止フラグ: true にすると narasu代理申請の BP払いを停止する（EP払いは継続）。
// 再開時は false に戻すだけでよい。
export const NARASU_BP_PAYMENT_SUSPENDED = true;

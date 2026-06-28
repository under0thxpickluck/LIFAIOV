export const BP_COSTS = {
  // 音楽生成
  music_lyrics:     36,  // 歌詞生成
  music_structure:  18,  // 構成生成
  music_bgm:       288,  // BGM生成
  music_bgm_pro:   540,  // BGM生成（Pro）
  music_full:      360,  // フル生成（構成+音楽）
  music_full_pro:  900,  // Pro設定使用時のフル生成

  // note記事生成
  note_title:        6,  // タイトル生成
  note_structure:   10,  // 構成生成
  note_body:        30,  // 本文生成
  note_full:       300,  // フル生成（企画〜本文 一括）

  // ワークフロー生成
  workflow_template: 20, // テンプレ生成
  workflow_full:     40, // フルワークフロー

  // アプリ生成
  app_ui:           15,  // UI生成
  app_spec:         10,  // 仕様生成
  app_code:         40,  // コード生成
  app_full:         60,  // フル生成

  // AIチャット
  chat_message:      6,  // リファ猫チャット1返信

  // 占い
  fortune_daily:     2,  // 今日占い
  fortune_match:     5,  // 相性占い

  // マーケット
  market_list:     100,  // 出品
  market_buy:        0,  // 購入
  market_boost:    200,  // 広告ブースト
} as const;

export type BpCostKey = keyof typeof BP_COSTS;

// BPパック定義
export const BP_PACKS = [
  { id: 'small',  label: 'Small',  bp: 500,   price_usd: 5  },
  { id: 'medium', label: 'Medium', bp: 2000,  price_usd: 15 },
  { id: 'large',  label: 'Large',  bp: 5000,  price_usd: 30 },
  { id: 'xl',     label: 'XL',     bp: 10000, price_usd: 50 },
] as const;

// サブスクBP上限定義
export const SUBSCRIPTION_BP_CAPS = {
  free:     0,
  plus:     1000,
  pro:      3000,
  priority: 10000,
  partner:  30000,
} as const;

// 初回付与BP（入会ランク別）
export const ENTRY_BP_GRANTS = {
  30:   300,   // Starter  $34
  50:   600,   // Builder  $57
  100:  1500,  // Automation $114
  500:  8000,  // Core     $567
  1000: 20000, // Infra    $1134
} as const;

// ログインボーナス（連続日数別）
export const LOGIN_BONUS_BP = {
  default:    5,   // 通常ログイン
  streak_3:  10,   // 3日連続
  streak_7:  20,   // 7日連続
  streak_30: 100,  // 30日連続
} as const;

// 1日の獲得上限
export const DAILY_LIMITS = {
  bp_max: 30,   // 1日最大獲得BP
  ep_max: 100,  // 1日最大獲得EP
} as const;

// ミッション報酬
export const MISSION_REWARDS = {
  fortune:       10,  // 占いをする
  music_listen:  15,  // 音楽を3曲聞く
  login:          5,  // ログイン
  all_complete:  20,  // 全ミッションクリア
} as const;

// EP→BP交換レート
export const EP_TO_BP_RATE = 5; // 5EP = 1BP

// ガチャ設定
export const GACHA_COST = 100; // 1回のコスト

export const GACHA_TABLE = [
  { bp: 50,   weight: 40 }, // 40%
  { bp: 100,  weight: 30 }, // 30%
  { bp: 200,  weight: 15 }, // 15%
  { bp: 500,  weight: 10 }, // 10%
  { bp: 1000, weight: 4  }, // 4%
  { bp: 5000, weight: 1  }, // 1%
] as const;

// ステーキング設定
export const STAKING_PLANS = [
  { days: 30,  rate: 0.10, label: '30日',  desc: '+10%' },
  { days: 60,  rate: 0.25, label: '60日',  desc: '+25%' },
  { days: 90,  rate: 0.50, label: '90日',  desc: '+50%' },
] as const;

export const STAKING_MIN_BP = 100; // 最低ステーク量

// LIFAI RADIO設定
export const RADIO_REWARD_EP = 5;        // 1回あたりの報酬EP
export const RADIO_MIN_SECONDS = 120;    // 最低視聴秒数（2分）
export const RADIO_DAILY_LIMITS = {
  free:     1,  // 1日1回
  plus:     3,  // 1日3回
  pro:      5,  // 1日5回
  priority: 5,
  partner:  5,
} as const;

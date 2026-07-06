import { NextResponse } from "next/server";

type Recommendation = { label: string; href: string; icon?: string };

const PAGE_RECS: Record<string, Recommendation[]> = {
  "/top": [
    { icon: "🎼", label: "曲を作る",            href: "/music2" },
    { icon: "🚀", label: "Music Boostを試す",   href: "/music-boost" },
    { icon: "🛒", label: "マーケットを見る",     href: "/market" },
    { icon: "⚔️", label: "Rumble Arenaに参加", href: "/mini-games/rumble" },
  ],
  "/5000": [
    { icon: "📝", label: "申請フォームへ進む",   href: "/5000/apply" },
    { icon: "❓", label: "プランについて相談",   href: "/chat" },
  ],
  "/5000/apply": [
    { icon: "✅", label: "入力内容を確認",       href: "/5000/confirm" },
    { icon: "❓", label: "項目について質問",     href: "/chat" },
  ],
  "/5000/confirm": [
    { icon: "💳", label: "決済へ進む",           href: "/5000" },
    { icon: "❓", label: "次のステップを聞く",   href: "/chat" },
  ],
  "/music2": [
    { icon: "🎵", label: "曲を作る",             href: "/music2" },
    { icon: "🚀", label: "Music Boostを試す",    href: "/music-boost" },
    { icon: "📝", label: "ノートを生成",         href: "/note-generator" },
  ],
  "/market": [
    { icon: "🛒", label: "人気商品を見る",       href: "/market" },
    { icon: "📦", label: "出品する",             href: "/market/create" },
    { icon: "📋", label: "注文履歴",             href: "/market/orders" },
  ],
  "/mini-games/rumble": [
    { icon: "⚔️", label: "バトルに参加",         href: "/mini-games/rumble" },
    { icon: "⛏️", label: "Tap Miningも試す",    href: "/mini-games/tap" },
  ],
  "/mini-games/tap": [
    { icon: "⛏️", label: "Tap Mining",          href: "/mini-games/tap" },
    { icon: "⚔️", label: "Rumble Arenaも試す",  href: "/mini-games/rumble" },
  ],
  "/fortune": [
    { icon: "🔮", label: "占いを見る",           href: "/fortune" },
    { icon: "🎼", label: "曲も作ってみよう",     href: "/music2" },
  ],
};

const DEFAULT_RECS: Recommendation[] = [
  { icon: "🎼", label: "曲を作る",            href: "/music2" },
  { icon: "🛒", label: "マーケットを見る",     href: "/market" },
  { icon: "⚔️", label: "Rumble Arena",        href: "/mini-games/rumble" },
  { icon: "🔮", label: "占い",             href: "/fortune" },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pagePath = searchParams.get("pagePath") || "/";

  // パスを正規化（クエリ・ハッシュ除去）
  const normalized = pagePath.split("?")[0].split("#")[0];
  const recs = PAGE_RECS[normalized] ?? DEFAULT_RECS;

  return NextResponse.json({ ok: true, items: recs });
}

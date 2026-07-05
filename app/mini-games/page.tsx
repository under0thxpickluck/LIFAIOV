"use client";
import Link from "next/link";
import { useTheme } from "../lib/useTheme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MiraixCard } from "./MiraixCard";

export default function MiniGamesPage() {
  const { isDark, toggleTheme } = useTheme();
  const th = {
    page:      isDark ? "bg-[#0a0a0a] text-white"              : "bg-gray-50 text-gray-900",
    card:      isDark ? "bg-white/5 border border-purple-500/30" : "bg-white border border-gray-200",
    cardHover: isDark ? "hover:bg-white/10"                      : "hover:bg-gray-50",
    muted:     isDark ? "text-white/40"                          : "text-gray-400",
    badge:     isDark ? "bg-purple-500/20 text-purple-400"       : "bg-purple-100 text-purple-600",
    back:      isDark ? "text-white/30 text-sm"                  : "text-gray-400 text-sm",
  };
  return (
    <div className={`min-h-screen ${th.page} px-4 py-10 max-w-2xl mx-auto`}>
      <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">🎮</span>
        <div>
          <h1 className="text-2xl font-bold">LIFAI Arcade</h1>
          <p className={`${th.muted} text-sm`}>ミニゲームで報酬をゲット</p>
        </div>
      </div>

      {/* ゲーム一覧 */}
      <div className="grid grid-cols-1 gap-4">
        {/* ランブル */}
        <Link href="/mini-games/rumble" className={`${th.card} rounded-2xl p-6 ${th.cardHover} transition block`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚔️</span>
              <div>
                <h2 className="font-bold">Rumble Arena</h2>
                <p className={`${th.muted} text-xs`}>週次ランキングで報酬獲得</p>
              </div>
            </div>
            <span className={`${th.badge} text-xs px-3 py-1 rounded-full`}>PLAY</span>
          </div>
        </Link>

        {/* タップゲーム */}
        <Link href="/mini-games/tap" className={`${th.card} rounded-2xl p-6 ${th.cardHover} transition block`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⛏️</span>
              <div>
                <h2 className="font-bold">Tap Mining</h2>
                <p className={`${th.muted} text-xs`}>毎日500タップでBP獲得</p>
              </div>
            </div>
            <span className={`${th.badge} text-xs px-3 py-1 rounded-full`}>PLAY</span>
          </div>
        </Link>

        {/* MIRAIX（外部サイト） */}
        <MiraixCard th={th} />
      </div>

      <Link href="/top" className={`block text-center ${th.back} mt-10`}>
        ← ホームに戻る
      </Link>
    </div>
  );
}

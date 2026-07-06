"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuth } from "@/app/lib/auth";

type Props = {
  activePage?: string;
};

export function AppSidebar({ activePage }: Props) {
  const [bp, setBp] = useState<number | null>(null);
  const [ep, setEp] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const id = (auth as any)?.id || (auth as any)?.loginId || "";
    if (!id) { setBalanceLoading(false); return; }

    (async () => {
      try {
        const res = await fetch("/api/wallet/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ id }),
        });
        const data = await res.json().catch(() => ({ ok: false }));
        if (data.ok) {
          setBp(Number(data.bp ?? 0));
          setEp(Number(data.ep ?? 0));
        }
      } catch {}
      finally { setBalanceLoading(false); }
    })();
  }, []);

  const navItems = [
    { href: "/top",    icon: "🏠", label: "ホーム" },
    { href: "/music2", icon: "🎵", label: "音楽生成NEW" },
    { href: "/fortune",icon: "🔮", label: "占い" },
    { href: "/market", icon: "🛒", label: "マーケット" },
  ];

  return (
    <aside className="w-52 flex-shrink-0 flex flex-col gap-4">
      {/* BP/EP残高 */}
      <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">残高</p>
        {balanceLoading ? (
          <p className="text-[11px] text-slate-400">読み込み中…</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">BP</span>
              <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                {bp ?? "–"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">EP</span>
              <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                {ep ?? "–"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ナビゲーション */}
      <div className="rounded-[18px] border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 px-1">メニュー</p>
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition",
                activePage === item.href
                  ? "bg-indigo-600 text-white"
                  : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

    </aside>
  );
}

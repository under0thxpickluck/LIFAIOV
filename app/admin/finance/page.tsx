"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UsersTab from "./UsersTab";
import AffiliateTab from "./AffiliateTab";
import TreeTab from "./TreeTab";
import MonthlyTab from "./MonthlyTab";
import CcPendingTab from "./CcPendingTab";

type Tab = "users" | "affiliate" | "tree" | "monthly" | "cc_pending";

export default function FinancePage() {
  const router = useRouter();
  const [verified,   setVerified]   = useState(false);
  const [activeTab,  setActiveTab]  = useState<Tab>("users");

  useEffect(() => {
    const token = sessionStorage.getItem("finance_token");
    if (!token) { router.replace("/admin"); return; }

    fetch("/api/admin/verify-finance-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(json => {
        if (json?.valid) { setVerified(true); }
        else { router.replace("/admin"); }
      })
      .catch(() => router.replace("/admin"));
  }, [router]);

  if (!verified) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-sm text-zinc-400">認証確認中…</p>
      </main>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "users",      label: "ユーザー詳細" },
    { key: "affiliate",  label: "アフィリエイト" },
    { key: "tree",       label: "紹介ツリー" },
    { key: "monthly",    label: "月次集計" },
    { key: "cc_pending", label: "CC付与待ち" },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-[1400px] px-4 py-8">
        <header className="mb-6 flex items-center gap-4">
          <a
            href="/admin"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            ← admin に戻る
          </a>
          <h1 className="text-xl font-bold text-white">財務管理</h1>
        </header>

        <div className="mb-6 flex gap-1 rounded-xl bg-zinc-900 p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={[
                "rounded-lg px-5 py-2 text-sm font-semibold transition",
                activeTab === t.key
                  ? "bg-amber-500 text-black"
                  : "text-zinc-400 hover:text-zinc-200",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "users"      && <UsersTab />}
        {activeTab === "affiliate"  && <AffiliateTab />}
        {activeTab === "tree"       && <TreeTab />}
        {activeTab === "monthly"    && <MonthlyTab />}
        {activeTab === "cc_pending" && <CcPendingTab />}
      </div>
    </main>
  );
}

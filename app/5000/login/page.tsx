// app/5000/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAuth, setAuthSecret } from "@/app/lib/auth";

export default function Login5000Page() {
  const router = useRouter();

  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null);
    setLoading(true);
    try {
      const trimmedId = id.trim();

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trimmedId, code: pw, group: "5000" }),
      })
        .then((r) => r.json())
        .catch(() => null);

      if (!res) {
        setErr("サーバーエラーが発生しました。しばらく待ってから再度お試しください。");
        return;
      }

      if (res.ok) {
        setAuth({
          status: "approved",
          id: trimmedId,
          token: res.token ?? pw,
          group: res.group ?? "5000",
        });
        setAuthSecret(pw);
        router.push("/top");
        return;
      }

      if (res.reason === "pending") {
        setAuth({ status: "pending", id: trimmedId, group: res.group ?? "5000" });
        router.push("/pending");
        return;
      }

      setErr("IDまたはパスワードが違います。");
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !id.trim() || !pw;

  return (
    <main
      style={{ background: "#0A0A0A" }}
      className="relative min-h-screen overflow-hidden text-white"
    >
      {/* 背景グラデーション */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 600px at 10% 0%, rgba(108,99,255,0.18), transparent 60%), radial-gradient(900px 600px at 110% 0%, rgba(0,212,255,0.12), transparent 55%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[480px] px-4 py-12">
        <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <div className="text-center">
            <div
              className="text-2xl font-extrabold tracking-tight"
              style={{ color: "#6C63FF" }}
            >
              LIFAI
            </div>
            <div className="mt-2 text-sm text-white/50">
              発行されたIDとパスワードを入力してください
            </div>
          </div>

          <div className="mt-8 grid gap-4">
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="ログインID"
              autoComplete="username"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/30"
            />

            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="パスワード"
              autoComplete="current-password"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/30"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !disabled) onSubmit();
              }}
            />

            {err && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {err}
              </div>
            )}

            <button
              onClick={onSubmit}
              disabled={disabled}
              className="mt-2 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition"
              style={
                disabled
                  ? { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }
                  : {
                      background: "linear-gradient(135deg, #6C63FF, #00D4FF)",
                      color: "#fff",
                    }
              }
            >
              {loading ? "確認中..." : "ログイン"}
            </button>

            <div className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              不明な場合は担当者へお問い合わせください。
            </div>
          </div>
        </div>

        <div
          className="mt-6 text-center text-xs"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          © LIFAI
        </div>
      </div>
    </main>
  );
}

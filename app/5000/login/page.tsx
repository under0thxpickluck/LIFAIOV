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

  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotPwId, setForgotPwId] = useState("");
  const [forgotPwLoading, setForgotPwLoading] = useState(false);
  const [forgotPwMsg, setForgotPwMsg] = useState<string | null>(null);

  const [showForgotId, setShowForgotId] = useState(false);
  const [forgotIdEmail, setForgotIdEmail] = useState("");
  const [forgotIdLoading, setForgotIdLoading] = useState(false);
  const [forgotIdMsg, setForgotIdMsg] = useState<string | null>(null);

  const onForgotPwSubmit = async () => {
    setForgotPwMsg(null);
    if (!forgotPwId.trim()) return;
    setForgotPwLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: forgotPwId.trim() }),
      });
      setForgotPwMsg("登録済みのIDであれば、メールアドレスにパスワード再設定リンクを送信しました。");
    } catch {
      setForgotPwMsg("エラーが発生しました。しばらく待ってから再度お試しください。");
    } finally {
      setForgotPwLoading(false);
    }
  };

  const onForgotIdSubmit = async () => {
    setForgotIdMsg(null);
    if (!forgotIdEmail.trim()) return;
    setForgotIdLoading(true);
    try {
      await fetch("/api/auth/forgot-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotIdEmail.trim() }),
      });
      setForgotIdMsg("登録済みのメールアドレスであれば、ログインIDを送信しました。");
    } catch {
      setForgotIdMsg("エラーが発生しました。しばらく待ってから再度お試しください。");
    } finally {
      setForgotIdLoading(false);
    }
  };

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

            <div className="flex justify-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              <button
                type="button"
                onClick={() => { setShowForgotPw(!showForgotPw); setShowForgotId(false); }}
                className="underline hover:text-white/60 transition"
              >
                パスワードを忘れた方
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={() => { setShowForgotId(!showForgotId); setShowForgotPw(false); }}
                className="underline hover:text-white/60 transition"
              >
                IDを忘れた方
              </button>
            </div>

            {showForgotPw && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 grid gap-3">
                <div className="text-xs font-semibold text-white/60">パスワードの再設定</div>
                <p className="text-xs text-white/40">
                  ログインIDまたはメールアドレスを入力してください。<br />
                  登録済みの場合、パスワード再設定リンクをメールで送ります。
                </p>
                <input
                  value={forgotPwId}
                  onChange={(e) => setForgotPwId(e.target.value)}
                  placeholder="ログインID またはメールアドレス"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/30"
                />
                {forgotPwMsg && (
                  <div className="rounded-2xl border border-[#6C63FF]/30 bg-[#6C63FF]/10 px-4 py-3 text-xs text-white/70">
                    {forgotPwMsg}
                  </div>
                )}
                <button
                  onClick={onForgotPwSubmit}
                  disabled={forgotPwLoading || !forgotPwId.trim()}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-semibold transition"
                  style={
                    forgotPwLoading || !forgotPwId.trim()
                      ? { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }
                      : { background: "linear-gradient(135deg, #6C63FF, #00D4FF)", color: "#fff" }
                  }
                >
                  {forgotPwLoading ? "送信中..." : "再設定メールを送る"}
                </button>
              </div>
            )}

            {showForgotId && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 grid gap-3">
                <div className="text-xs font-semibold text-white/60">ログインIDの確認</div>
                <p className="text-xs text-white/40">
                  登録したメールアドレスを入力してください。<br />
                  登録済みの場合、ログインIDをメールで送ります。
                </p>
                <input
                  type="email"
                  value={forgotIdEmail}
                  onChange={(e) => setForgotIdEmail(e.target.value)}
                  placeholder="登録したメールアドレス"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/30"
                />
                {forgotIdMsg && (
                  <div className="rounded-2xl border border-[#6C63FF]/30 bg-[#6C63FF]/10 px-4 py-3 text-xs text-white/70">
                    {forgotIdMsg}
                  </div>
                )}
                <button
                  onClick={onForgotIdSubmit}
                  disabled={forgotIdLoading || !forgotIdEmail.trim()}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-semibold transition"
                  style={
                    forgotIdLoading || !forgotIdEmail.trim()
                      ? { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }
                      : { background: "linear-gradient(135deg, #6C63FF, #00D4FF)", color: "#fff" }
                  }
                >
                  {forgotIdLoading ? "送信中..." : "IDをメールで受け取る"}
                </button>
              </div>
            )}

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

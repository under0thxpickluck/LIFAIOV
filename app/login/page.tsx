// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { setAuth, setAuthSecret } from "@/app/lib/auth"; // ✅ ここだけ追加

export default function LoginPage() {
  const router = useRouter();

  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // パスワード忘れ
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotPwId, setForgotPwId] = useState("");
  const [forgotPwLoading, setForgotPwLoading] = useState(false);
  const [forgotPwMsg, setForgotPwMsg] = useState<string | null>(null);

  // ID忘れ
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
        body: JSON.stringify({ id: trimmedId, code: pw }),
      }).then((r) => r.json()).catch(() => null);

      if (!res) {
        setErr("サーバーエラーが発生しました。しばらく待ってから再度お試しください。");
        return;
      }

      if (res.ok) {
        // ✅ ログイン状態を保存（localStorage）
        setAuth({
          status: "approved",
          id: trimmedId,
          token: res.token ?? pw, // ✅ ここだけ修正：tokenが無い場合はpwを入れる（壊さない保険）
          ...(res.group ? { group: res.group } : {}),
        });

        // ✅ 追加：パスワード(code)は sessionStorage にだけ保存（ブラウザを閉じると消える）
        // /api/me など「本人専用情報」を引く時に使う
        setAuthSecret(pw);

        router.push("/top");
        return;
      }

      if (res.reason === "pending") {
        // ✅ pendingも保存（/pendingガードに使える）
        // ※ pending では secret を保存しない（まだ承認前）
        setAuth({ status: "pending", id: trimmedId });
        router.push("/pending");
        return;
      }

      setErr("IDまたはワンタイムコードが違います。");
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !id.trim() || !pw;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-white to-slate-50 text-slate-900">
      {/* 🐱 背景に大きく猫ロゴ（薄く） */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center opacity-[0.14]">
        <div className="relative h-[520px] w-[520px] translate-y-[90px]">
          <Image
            src="/lifai.png"
            alt="LIFAI cat"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[480px] px-4 py-12">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← トップへ戻る
        </Link>

        <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
          {/* タイトル */}
          <div className="text-center">
            <div className="text-2xl font-extrabold tracking-tight">
              LIFAI ログイン
            </div>
            <div className="mt-2 text-sm text-slate-500">
              発行されたIDとパスワードを入力してください
            </div>
          </div>

          {/* 入力フォーム */}
          <div className="mt-8 grid gap-4">
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="ログインID"
              autoComplete="username"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />

            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="パスワード"
              autoComplete="current-password"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !disabled) onSubmit();
              }}
            />

            {err && (
              <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {err}
              </div>
            )}

            <button
              onClick={onSubmit}
              disabled={disabled}
              className={[
                "mt-2 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition",
                disabled
                  ? "bg-slate-200 text-slate-400"
                  : "bg-gradient-to-r from-indigo-600 to-cyan-500 text-white hover:opacity-95 active:scale-[0.99]",
              ].join(" ")}
            >
              {loading ? "確認中..." : "ログイン"}
            </button>

            <div className="flex justify-center gap-4 text-xs text-slate-400">
              <button
                type="button"
                onClick={() => { setShowForgotPw(!showForgotPw); setShowForgotId(false); }}
                className="underline hover:text-slate-600"
              >
                パスワードを忘れた方
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={() => { setShowForgotId(!showForgotId); setShowForgotPw(false); }}
                className="underline hover:text-slate-600"
              >
                IDを忘れた方
              </button>
            </div>

            {/* パスワード再設定フォーム */}
            {showForgotPw && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 grid gap-3">
                <div className="text-xs font-semibold text-slate-600">パスワードの再設定</div>
                <p className="text-xs text-slate-500">
                  ログインIDまたはメールアドレスを入力してください。<br />
                  登録済みの場合、パスワード再設定リンクをメールで送ります。
                </p>
                <input
                  value={forgotPwId}
                  onChange={(e) => setForgotPwId(e.target.value)}
                  placeholder="ログインID またはメールアドレス"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
                {forgotPwMsg && (
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
                    {forgotPwMsg}
                  </div>
                )}
                <button
                  onClick={onForgotPwSubmit}
                  disabled={forgotPwLoading || !forgotPwId.trim()}
                  className={[
                    "w-full rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    forgotPwLoading || !forgotPwId.trim()
                      ? "bg-slate-200 text-slate-400"
                      : "bg-indigo-600 text-white hover:opacity-95",
                  ].join(" ")}
                >
                  {forgotPwLoading ? "送信中..." : "再設定メールを送る"}
                </button>
              </div>
            )}

            {/* ID再送フォーム */}
            {showForgotId && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 grid gap-3">
                <div className="text-xs font-semibold text-slate-600">ログインIDの確認</div>
                <p className="text-xs text-slate-500">
                  登録したメールアドレスを入力してください。<br />
                  登録済みの場合、ログインIDをメールで送ります。
                </p>
                <input
                  type="email"
                  value={forgotIdEmail}
                  onChange={(e) => setForgotIdEmail(e.target.value)}
                  placeholder="登録したメールアドレス"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
                {forgotIdMsg && (
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
                    {forgotIdMsg}
                  </div>
                )}
                <button
                  onClick={onForgotIdSubmit}
                  disabled={forgotIdLoading || !forgotIdEmail.trim()}
                  className={[
                    "w-full rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    forgotIdLoading || !forgotIdEmail.trim()
                      ? "bg-slate-200 text-slate-400"
                      : "bg-indigo-600 text-white hover:opacity-95",
                  ].join(" ")}
                >
                  {forgotIdLoading ? "送信中..." : "IDをメールで受け取る"}
                </button>
              </div>
            )}

            <div className="text-center text-xs text-slate-400">
              不明な場合は代理店様へお問い合わせください。
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
  );
}
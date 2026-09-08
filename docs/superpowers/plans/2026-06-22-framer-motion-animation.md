# Framer Motion アニメーション実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ランブル以外の既存機能（/top・ガチャ・ログインボーナス・BP付与・タップマイニング・GameTile）に、バックエンド・API・ロジックを一切変更せず、Framer Motion中心の軽量アニメーションを追加する。

**Architecture:** 共通アニメーションコンポーネント6個を `components/animations/` に新規作成し、既存6ファイルをそれらで拡張する。既存の `useState`/`useEffect`/fetch ロジックには触れない。

**Tech Stack:** framer-motion v12（既インストール済み）、React 18、Next.js 14 App Router、TypeScript、Tailwind CSS

---

## 前提確認

- `framer-motion: ^12.38.0` が `package.json` に存在する（インストール不要）
- 対象リポジトリ: `LIFAIOV / lifaiov`（aisalon と混合しない）
- `prefers-reduced-motion` 対応: 各コンポーネントで `useReducedMotion()` を使う
- Tap Mining の浮遊テキスト: 最大20個に制限する

---

## ファイルマップ

### 新規作成

| ファイル | 責務 |
|---|---|
| `components/animations/MotionCard.tsx` | 入場アニメ + hover/tap スプリング のラッパー |
| `components/animations/AnimatedModal.tsx` | backdrop フェード + パネルスプリング のラッパー（既存 `visible` stateパターンを置き換え） |
| `components/animations/RewardBurst.tsx` | 報酬獲得時のパーティクル放射演出 |
| `components/animations/CountUpNumber.tsx` | 数値カウントアップ（0 → 目標値） |
| `components/animations/GlowBadge.tsx` | レアリティバッジのグロウパルス |
| `components/animations/TapFloatText.tsx` | タップ時の浮遊テキスト（animate-bounce を置き換え） |

### 既存ファイル変更

| ファイル | 変更内容 |
|---|---|
| `app/top/page.tsx` | アプリグリッドにスタガー入場 + ボトムシートにスライドアップ |
| `components/GameTile.tsx` | hover スプリング + 入場アニメ |
| `components/LoginBonusModal.tsx` | `AnimatedModal` + `CountUpNumber` + `RewardBurst` |
| `components/BPGrantModal.tsx` | `AnimatedModal` + `CountUpNumber` + `RewardBurst` |
| `components/GachaModal.tsx` | `AnimatedModal` + スピン演出 + 結果スケールイン + `GlowBadge` |
| `app/mini-games/tap/page.tsx` | `TapFloatText` 置き換え + ボタンスプリング + float 上限20個 |

---

## Task 1: `components/animations/` 共通コンポーネント6個を作成する

**Files:**
- Create: `components/animations/MotionCard.tsx`
- Create: `components/animations/AnimatedModal.tsx`
- Create: `components/animations/RewardBurst.tsx`
- Create: `components/animations/CountUpNumber.tsx`
- Create: `components/animations/GlowBadge.tsx`
- Create: `components/animations/TapFloatText.tsx`

---

- [ ] **Step 1-1: `MotionCard.tsx` を作成する**

`components/animations/MotionCard.tsx` を以下の内容で作成する。

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** stagger 用の遅延（秒）。親が variants を使う場合は不要。 */
  delay?: number;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
};

/**
 * 入場アニメーション（fade + translateY + scale）と
 * hover/tap スプリングを付与する汎用ラッパー。
 * prefers-reduced-motion 時はアニメを無効化する。
 */
export function MotionCard({
  children,
  delay = 0,
  className = "",
  onClick,
  disabled = false,
}: Props) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      onClick={onClick}
      initial={reduced ? {} : { opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduced
          ? { duration: 0 }
          : { delay, type: "spring", damping: 20, stiffness: 260 }
      }
      whileHover={disabled || reduced ? {} : { scale: 1.04 }}
      whileTap={disabled || reduced ? {} : { scale: 0.96 }}
      style={{ cursor: onClick && !disabled ? "pointer" : undefined }}
    >
      {children}
    </motion.div>
  );
}
```

---

- [ ] **Step 1-2: `AnimatedModal.tsx` を作成する**

`components/animations/AnimatedModal.tsx` を以下の内容で作成する。

既存モーダルの「`visible` state + CSS transition」パターンを置き換えるための共通ラッパー。
`open` prop で表示/非表示を制御し、`open=false` 時はフェードアウトする（親は300ms後に unmount すること）。

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode, MouseEvent } from "react";

type Props = {
  /** true → 表示アニメ、false → 非表示アニメ（親は~300ms後にアンマウント） */
  open: boolean;
  /** backdrop クリック時のコールバック */
  onBackdropClick?: () => void;
  children: ReactNode;
};

/**
 * backdrop フェード + パネルスプリングの共通モーダルラッパー。
 * children にパネル本体（style・className はそのまま渡す）を入れる。
 */
export default function AnimatedModal({ open, onBackdropClick, children }: Props) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      onClick={onBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
        cursor: onBackdropClick ? "pointer" : "default",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: open ? 1 : 0 }}
      transition={{ duration: reduced ? 0 : 0.25 }}
    >
      <motion.div
        onClick={(e: MouseEvent) => e.stopPropagation()}
        style={{ cursor: "default" }}
        initial={reduced ? {} : { scale: 0.88, y: 24, opacity: 0 }}
        animate={
          reduced
            ? {}
            : open
              ? { scale: 1, y: 0, opacity: 1 }
              : { scale: 0.92, y: 12, opacity: 0 }
        }
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", damping: 22, stiffness: 280 }
        }
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
```

---

- [ ] **Step 1-3: `RewardBurst.tsx` を作成する**

`components/animations/RewardBurst.tsx` を以下の内容で作成する。

報酬獲得時にパーティクルを放射状に飛ばす演出。`position: relative` のコンテナの中に入れて使う。

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

type Props = {
  /** パーティクル数（デフォルト 12） */
  count?: number;
  /** パーティクルの色リスト */
  colors?: string[];
};

/**
 * 中央から放射状にパーティクルを飛ばす演出。
 * 親要素に `position: relative; overflow: hidden` が必要。
 * prefers-reduced-motion 時は何も描画しない。
 */
export function RewardBurst({
  count = 12,
  colors = ["#f59e0b", "#6366f1", "#10b981", "#ec4899", "#f87171"],
}: Props) {
  const reduced = useReducedMotion();

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (360 / count) * i;
        const rad = (angle * Math.PI) / 180;
        const dist = 60 + (i % 3) * 20; // 60 / 80 / 100px の3種
        return {
          id: i,
          tx: Math.cos(rad) * dist,
          ty: Math.sin(rad) * dist,
          color: colors[i % colors.length],
          size: 6 + (i % 2) * 3, // 6px か 9px
        };
      }),
    [count, colors]
  );

  if (reduced) return null;

  return (
    <div
      aria-hidden
      style={{
        pointerEvents: "none",
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: p.color,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.tx, y: p.ty, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.05 }}
        />
      ))}
    </div>
  );
}
```

---

- [ ] **Step 1-4: `CountUpNumber.tsx` を作成する**

`components/animations/CountUpNumber.tsx` を以下の内容で作成する。

```tsx
"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
} from "framer-motion";

type Props = {
  /** カウント開始値（デフォルト 0） */
  from?: number;
  /** カウント目標値 */
  to: number;
  /** アニメーション時間（秒） */
  duration?: number;
  className?: string;
  /** 数値の前に付けるテキスト（例: "+"） */
  prefix?: string;
  /** 数値の後に付けるテキスト（例: "BP 獲得！"） */
  suffix?: string;
};

/**
 * from → to へ数値をカウントアップするコンポーネント。
 * prefers-reduced-motion 時は即座に to を表示する。
 */
export function CountUpNumber({
  from = 0,
  to,
  duration = 1.2,
  className = "",
  prefix = "",
  suffix = "",
}: Props) {
  const reduced = useReducedMotion();
  const count = useMotionValue(reduced ? to : from);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (reduced) {
      count.set(to);
      return;
    }
    const controls = animate(count, to, { duration, ease: "easeOut" });
    return controls.stop;
  }, [to, count, duration, reduced]);

  return (
    <motion.span className={className}>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </motion.span>
  );
}
```

---

- [ ] **Step 1-5: `GlowBadge.tsx` を作成する**

`components/animations/GlowBadge.tsx` を以下の内容で作成する。

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  /** CSSカラー文字列（例: "#fbbf24"） */
  color: string;
  children: ReactNode;
  /** true のときグロウパルスアニメを有効化 */
  glow?: boolean;
};

/**
 * レアリティバッジなどに使うグロウパルスバッジ。
 * glow=true かつ prefers-reduced-motion でない場合のみアニメーションする。
 */
export function GlowBadge({ color, children, glow = false }: Props) {
  const reduced = useReducedMotion();
  const shouldGlow = glow && !reduced;

  return (
    <motion.div
      style={{
        display: "inline-block",
        color,
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.15em",
        background: `${color}20`,
        border: `1px solid ${color}60`,
      }}
      animate={
        shouldGlow
          ? {
              boxShadow: [
                `0 0 0px ${color}`,
                `0 0 18px ${color}80`,
                `0 0 0px ${color}`,
              ],
            }
          : {}
      }
      transition={
        shouldGlow
          ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          : {}
      }
    >
      {children}
    </motion.div>
  );
}
```

---

- [ ] **Step 1-6: `TapFloatText.tsx` を作成する**

`components/animations/TapFloatText.tsx` を以下の内容で作成する。

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";

type FloatItem = {
  id: number;
  text: string;
  color: string; // Tailwind クラス文字列（例: "text-white/50"）
  x: number;    // left の % 値
};

type Props = {
  items: FloatItem[];
};

/**
 * タップ時の浮遊テキスト演出。
 * animate-bounce の代替として上方向にフェードアウトする。
 * prefers-reduced-motion 時はフェードのみ（y 移動なし）。
 */
export function TapFloatText({ items }: Props) {
  const reduced = useReducedMotion();

  return (
    <>
      {items.map((f) => (
        <motion.div
          key={f.id}
          className={`absolute text-sm font-bold pointer-events-none select-none ${f.color}`}
          style={{ left: `${f.x}%`, top: 0 }}
          initial={{ y: 0, opacity: 1 }}
          animate={reduced ? { opacity: 0 } : { y: -72, opacity: 0 }}
          transition={
            reduced ? { duration: 0.15 } : { duration: 0.65, ease: "easeOut" }
          }
        >
          {f.text}
        </motion.div>
      ))}
    </>
  );
}
```

---

- [ ] **Step 1-7: `npm run build` が通ることを確認する**

```bash
npm run build
```

期待される結果: エラーなし、warnings のみ可。型エラーが出た場合は型を修正してから次のタスクへ。

---

## Task 2: `/top` のアプリグリッドにスタガー入場 + ボトムシートにスライドアップ

**Files:**
- Modify: `app/top/page.tsx`

---

- [ ] **Step 2-1: `app/top/page.tsx` のインポートに `motion` と `AnimatePresence` を追加する**

ファイル冒頭の `import` 行を以下のように変更する（既存 import は維持）。

```tsx
// 既存の import の末尾に追記
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
```

---

- [ ] **Step 2-2: アプリグリッドコンテナを `motion.div` に変更し、スタガーを設定する**

`app/top/page.tsx` の以下の部分（約 617〜644行）を変更する。

変更前:
```tsx
<div className="mt-6">
  <p className="mb-3 text-xs font-extrabold text-slate-700">アプリ</p>
  <div className="grid grid-cols-4 gap-3 px-2">
    {apps.map((app) => (
      <button
        key={app.id}
        onClick={() => { if (app.disabled) return; setSelectedApp(app); }}
        className="flex flex-col items-center gap-1 focus:outline-none"
        style={{ cursor: app.disabled ? "not-allowed" : "pointer", opacity: app.disabled ? 0.6 : 1 }}
      >
        <div className="relative">
          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center text-2xl shadow-md active:scale-95 transition`}
          >
            {app.icon}
          </div>
          {app.badge && (
            <span className={`absolute -top-1 -right-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white leading-none ${app.badge === 'Beta' ? 'bg-sky-500' : 'bg-slate-700'}`}>
              {app.badge}
            </span>
          )}
        </div>
        <span className="text-[11px] text-zinc-600 text-center leading-tight">
          {app.label}
        </span>
      </button>
    ))}
  </div>
</div>
```

変更後:
```tsx
<div className="mt-6">
  <p className="mb-3 text-xs font-extrabold text-slate-700">アプリ</p>
  <motion.div
    className="grid grid-cols-4 gap-3 px-2"
    initial="hidden"
    animate="visible"
    variants={{
      hidden: {},
      visible: { transition: { staggerChildren: 0.045 } },
    }}
  >
    {apps.map((app) => (
      <motion.button
        key={app.id}
        onClick={() => { if (app.disabled) return; setSelectedApp(app); }}
        className="flex flex-col items-center gap-1 focus:outline-none"
        style={{ cursor: app.disabled ? "not-allowed" : "pointer", opacity: app.disabled ? 0.6 : 1 }}
        variants={{
          hidden: { opacity: 0, y: 12, scale: 0.93 },
          visible: {
            opacity: 1, y: 0, scale: 1,
            transition: { type: "spring", damping: 18, stiffness: 260 },
          },
        }}
        whileTap={app.disabled ? {} : { scale: 0.92 }}
      >
        <div className="relative">
          <motion.div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center text-2xl shadow-md`}
            whileHover={app.disabled ? {} : { scale: 1.08 }}
            transition={{ type: "spring", damping: 18, stiffness: 300 }}
          >
            {app.icon}
          </motion.div>
          {app.badge && (
            <span className={`absolute -top-1 -right-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white leading-none ${app.badge === 'Beta' ? 'bg-sky-500' : 'bg-slate-700'}`}>
              {app.badge}
            </span>
          )}
        </div>
        <span className="text-[11px] text-zinc-600 text-center leading-tight">
          {app.label}
        </span>
      </motion.button>
    ))}
  </motion.div>
</div>
```

---

- [ ] **Step 2-3: `selectedApp` ボトムシートを `AnimatePresence` でスライドアップアニメーションに変更する**

変更前（約 525〜575行）:
```tsx
{/* アプリ詳細ポップアップ */}
{selectedApp && (
  <>
    {/* オーバーレイ */}
    <div
      className="fixed inset-0 z-40 bg-black/60"
      onClick={() => setSelectedApp(null)}
    />
    {/* スライドアップシート */}
    <div className="fixed inset-x-0 bottom-0 z-50 max-w-sm mx-auto rounded-t-3xl bg-zinc-900 p-6 shadow-2xl">
      ...（内部コンテンツはそのまま）
    </div>
  </>
)}
```

変更後（`AnimatePresence` で囲み、2つの `div` を `motion.div` に変更。内部コンテンツ・Linkコンポーネント等は変更しない）:
```tsx
{/* アプリ詳細ポップアップ */}
<AnimatePresence>
  {selectedApp && (
    <>
      {/* オーバーレイ */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => setSelectedApp(null)}
      />
      {/* スライドアップシート */}
      <motion.div
        className="fixed inset-x-0 bottom-0 z-50 max-w-sm mx-auto rounded-t-3xl bg-zinc-900 p-6 shadow-2xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
      >
        {/* 内部コンテンツは既存のまま変更なし */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${selectedApp.color} flex items-center justify-center text-4xl shadow-lg`}>
            {selectedApp.icon}
          </div>
          <div>
            <p className="text-lg font-extrabold text-white">{selectedApp.label}</p>
            <p className="mt-1 text-sm text-zinc-400">{selectedApp.desc}</p>
          </div>
          {selectedApp.badge === '準備中' ? (
            <button
              disabled
              className="mt-2 w-full rounded-2xl bg-slate-700 px-6 py-3 text-sm font-extrabold text-slate-400 cursor-not-allowed"
            >
              準備中
            </button>
          ) : selectedApp.onOpen ? (
            <button
              onClick={selectedApp.onOpen}
              className="mt-2 w-full rounded-2xl bg-amber-400 px-6 py-3 text-sm font-extrabold text-zinc-900 hover:bg-amber-300 active:scale-95 transition"
            >
              開く →
            </button>
          ) : selectedApp.href.startsWith("#") ? (
            <button
              onClick={() => setSelectedApp(null)}
              className="mt-2 w-full rounded-2xl bg-amber-400 px-6 py-3 text-sm font-extrabold text-zinc-900 hover:bg-amber-300 active:scale-95 transition"
            >
              開く →
            </button>
          ) : (
            <Link
              href={selectedApp.href}
              className="mt-2 block w-full rounded-2xl bg-amber-400 px-6 py-3 text-sm font-extrabold text-zinc-900 text-center hover:bg-amber-300 active:scale-95 transition"
              onClick={() => setSelectedApp(null)}
            >
              開く →
            </Link>
          )}
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

---

- [ ] **Step 2-4: `npm run build` が通ることを確認する**

```bash
npm run build
```

型エラーが出た場合: `useReducedMotion` のインポートが不要であれば削除する（`motion.button` の `whileTap` 等で `reduced` を参照していない場合）。

---

## Task 3: `GameTile.tsx` に hover スプリング + 入場アニメを追加する

**Files:**
- Modify: `components/GameTile.tsx`

---

- [ ] **Step 3-1: `GameTile.tsx` を変更する**

変更前（ファイル全体）:
```tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
// ... (省略)

export function GameTile({ href, title, subtitle, icon, badge, disabled }: Props) {
  const base =
    "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_70px_rgba(0,0,0,.35)] backdrop-blur-xl transition";
  const hover = disabled ? "" : "hover:bg-white/10 hover:-translate-y-[1px] active:scale-[0.99]";

  const content = (
    <div className={`${base} ${hover} ${disabled ? "opacity-40" : ""}`}>
      ...
    </div>
  );

  if (disabled) return <div>{content}</div>;
  return <Link href={href}>{content}</Link>;
}
```

変更後（`motion` を import し、`div` を `motion.div` に置き換え。CSS の hover/active クラスを削除）:

```tsx
"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  href: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  badge?: string;
  disabled?: boolean;
};

export function GameTile({ href, title, subtitle, icon, badge, disabled }: Props) {
  const reduced = useReducedMotion();

  // CSS hover/active クラスは削除し、framer-motion に委譲
  const base =
    "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_70px_rgba(0,0,0,.35)] backdrop-blur-xl";

  const content = (
    <motion.div
      className={`${base} ${disabled ? "opacity-40" : ""}`}
      initial={reduced ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { type: "spring", damping: 20, stiffness: 260 }}
      whileHover={disabled || reduced ? {} : { y: -2, backgroundColor: "rgba(255,255,255,0.10)" }}
      whileTap={disabled || reduced ? {} : { scale: 0.98 }}
    >
      {/* 角の光 */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-cyan-400/20 blur-2xl" />
      {/* badge */}
      {badge ? (
        <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-slate-200">
          {badge}
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-black/25 text-white">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-base font-extrabold text-white">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-slate-300/80">{subtitle}</div> : null}
        </div>
      </div>
    </motion.div>
  );

  if (disabled) return <div>{content}</div>;
  return <Link href={href}>{content}</Link>;
}
```

---

- [ ] **Step 3-2: `npm run build` が通ることを確認する**

```bash
npm run build
```

---

## Task 4: `LoginBonusModal.tsx` を `AnimatedModal` + `CountUpNumber` + `RewardBurst` に差し替える

**Files:**
- Modify: `components/LoginBonusModal.tsx`

---

- [ ] **Step 4-1: `LoginBonusModal.tsx` を変更する**

変更後（ファイル全体を以下で置き換える。`onClose` の呼び出しタイミング・ロジックは変更なし）:

```tsx
"use client";

// components/LoginBonusModal.tsx
import { useEffect, useState } from "react";
import AnimatedModal from "./animations/AnimatedModal";
import { CountUpNumber } from "./animations/CountUpNumber";
import { RewardBurst } from "./animations/RewardBurst";

type Props = {
  bp_earned: number;
  streak: number;
  onClose: () => void;
};

export default function LoginBonusModal({ bp_earned, streak, onClose }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 300);
  };

  const nextBonus = (): string => {
    if (streak < 3) return `あと${3 - streak}日で +10BP`;
    if (streak < 7) return `あと${7 - streak}日で +20BP`;
    if (streak < 30) return `あと${30 - streak}日で +100BP`;
    return "🎉 MAX ボーナス達成中！";
  };

  return (
    <AnimatedModal open={open} onBackdropClick={handleClose}>
      <div
        style={{
          background: "#18181b",
          borderRadius: "16px",
          padding: "24px",
          textAlign: "center",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          maxWidth: "320px",
          width: "90vw",
          border: "1px solid rgba(255,255,255,0.08)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* パーティクル演出 */}
        <RewardBurst count={10} colors={["#f59e0b", "#fbbf24", "#f97316"]} />

        <p
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "#a1a1aa",
            letterSpacing: "0.05em",
            margin: "0 0 8px",
          }}
        >
          ログインボーナス
        </p>

        <p
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#f4f4f5",
            margin: "0 0 16px",
          }}
        >
          🔥 {streak}日連続ログイン中
        </p>

        {/* カウントアップ数値 */}
        <CountUpNumber
          to={bp_earned}
          prefix="+"
          suffix="BP 獲得！"
          duration={1.0}
          className="block"
          // style は以下で付与
        />
        {/* CountUpNumber はインラインスタイルを受け取れないため、ラッパーで調整 */}
        <style>{`
          .login-bonus-count { font-size: 36px; font-weight: 900; letter-spacing: -0.02em; color: #f59e0b; margin: 0 0 8px; }
        `}</style>

        <p
          style={{
            fontSize: "12px",
            color: "#a1a1aa",
            margin: "0 0 24px",
          }}
        >
          {nextBonus()}
        </p>

        <button
          onClick={handleClose}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "12px",
            border: "none",
            background: "#f59e0b",
            color: "#000",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          受け取る
        </button>
      </div>
    </AnimatedModal>
  );
}
```

> **注意**: `CountUpNumber` にインラインスタイルを渡せないため、スタイルを `className` ベースで調整するか、以下のように分離したラッパーで数値を表示する。

実際の実装では `CountUpNumber` を以下のように使う（style は親 div で包む）:

```tsx
{/* CountUpNumber を style 付き div で包む */}
<div
  style={{
    fontSize: "36px",
    fontWeight: 900,
    letterSpacing: "-0.02em",
    color: "#f59e0b",
    margin: "0 0 8px",
  }}
>
  <CountUpNumber to={bp_earned} prefix="+" suffix="BP 獲得！" duration={1.0} />
</div>
```

---

- [ ] **Step 4-2: `npm run build` が通ることを確認する**

```bash
npm run build
```

---

## Task 5: `BPGrantModal.tsx` を `AnimatedModal` + `CountUpNumber` + `RewardBurst` に差し替える

**Files:**
- Modify: `components/BPGrantModal.tsx`

---

- [ ] **Step 5-1: `BPGrantModal.tsx` を変更する**

```tsx
"use client";

// components/BPGrantModal.tsx
import { useEffect, useState } from "react";
import AnimatedModal from "./animations/AnimatedModal";
import { CountUpNumber } from "./animations/CountUpNumber";
import { RewardBurst } from "./animations/RewardBurst";

type Props = {
  amount: number;
  onClose: () => void;
};

export default function BPGrantModal({ amount, onClose }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 300);
  };

  return (
    <AnimatedModal open={open} onBackdropClick={handleClose}>
      <div
        style={{
          background: "white",
          borderRadius: "28px",
          padding: "40px 32px",
          textAlign: "center",
          boxShadow: "0 32px 80px rgba(2,6,23,0.22)",
          maxWidth: "340px",
          width: "90vw",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* パーティクル演出（インディゴ・バイオレット系） */}
        <RewardBurst count={12} colors={["#6366f1", "#8b5cf6", "#a78bfa", "#c084fc"]} />

        {/* 画像 */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <img
            src="/getBP.png"
            alt="BP獲得"
            style={{ width: "120px", height: "120px", objectFit: "contain" }}
          />
        </div>

        {/* BP獲得テキスト（CountUpNumber を gradient テキスト div で包む） */}
        <div
          style={{
            fontSize: "32px",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: 0,
          }}
        >
          <CountUpNumber to={amount} prefix="+" suffix=" BP 獲得！" duration={1.0} />
        </div>

        <p style={{ marginTop: "8px", fontSize: "14px", color: "#64748b", fontWeight: 600 }}>
          売却BPが付与されました
        </p>

        <button
          onClick={handleClose}
          style={{
            marginTop: "24px",
            width: "100%",
            padding: "12px",
            borderRadius: "16px",
            border: "none",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "white",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          閉じる
        </button>
      </div>
    </AnimatedModal>
  );
}
```

---

- [ ] **Step 5-2: `npm run build` が通ることを確認する**

```bash
npm run build
```

---

## Task 6: `GachaModal.tsx` を `AnimatedModal` + スピン演出 + 結果スケールイン + `GlowBadge` に更新する

**Files:**
- Modify: `components/GachaModal.tsx`

---

- [ ] **Step 6-1: インポートを追加する**

`components/GachaModal.tsx` 冒頭の import を変更する。

変更前:
```tsx
"use client";

// components/GachaModal.tsx
import { useEffect, useState, useRef } from "react";
```

変更後:
```tsx
"use client";

// components/GachaModal.tsx
import { useEffect, useState, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import AnimatedModal from "./animations/AnimatedModal";
import { GlowBadge } from "./animations/GlowBadge";
```

---

- [ ] **Step 6-2: `GachaModal` コンポーネント内で `useReducedMotion` を呼び出す**

`export default function GachaModal(...)` の内部、既存の `useState` 群の直後に追記する:

```tsx
export default function GachaModal({ loginId, onClose, onBpEarned }: Props) {
  // ... 既存の useState
  const reduced = useReducedMotion();  // ← 追記
  // ...
```

---

- [ ] **Step 6-3: `return` ブロックのラッパーを `AnimatedModal` に置き換える**

変更前（約 184〜215行の外側 `div` 2個）:
```tsx
return (
  <div
    onClick={result ? undefined : handleClose}
    style={{
      position:        "fixed",
      inset:           0,
      zIndex:          9999,
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
      backgroundColor: "rgba(0,0,0,0.6)",
      opacity:         visible ? 1 : 0,
      transition:      "opacity 0.3s ease",
      cursor:          result ? "default" : "pointer",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background:   "#18181b",
        borderRadius: "16px",
        padding:      "24px",
        maxWidth:     "380px",
        width:        "92%",
        boxShadow:    "0 32px 80px rgba(0,0,0,0.5)",
        border:       "1px solid rgba(255,255,255,0.08)",
        transform:    visible ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
        transition:   "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        cursor:       "default",
        maxHeight:    "90vh",
        overflowY:    "auto",
      }}
    >
```

変更後:
```tsx
return (
  <AnimatedModal
    open={visible}
    onBackdropClick={result ? undefined : handleClose}
  >
    <div
      style={{
        background:   "#18181b",
        borderRadius: "16px",
        padding:      "24px",
        maxWidth:     "380px",
        width:        "92vw",
        boxShadow:    "0 32px 80px rgba(0,0,0,0.5)",
        border:       "1px solid rgba(255,255,255,0.08)",
        cursor:       "default",
        maxHeight:    "90vh",
        overflowY:    "auto",
      }}
    >
```

対応する閉じタグ（`</div></div>` → `</div></AnimatedModal>`）も修正する:

変更前末尾:
```tsx
      </div>
    </div>
  );
}
```

変更後末尾:
```tsx
      </div>
    </AnimatedModal>
  );
}
```

---

- [ ] **Step 6-4: `spinning` 中のスロット演出を追加する**

`GachaModal` の通常画面（`<>` で始まるブロック内、 `errMsg` 表示とボタン群の間）に spinning 中のフィラー演出を追加する。

`errMsg` の表示ブロック（`{errMsg && ...}`）の直前に挿入:

```tsx
{/* スピン中のスロット演出 */}
{spinning && !reduced && (
  <div style={{ textAlign: "center", padding: "12px 0", marginBottom: "8px" }}>
    <motion.div
      style={{ fontSize: 36, display: "inline-block" }}
      animate={{ scale: [1, 1.12, 1] }}
      transition={{ duration: 0.35, repeat: Infinity, ease: "easeInOut" }}
    >
      🎰
    </motion.div>
  </div>
)}
```

---

- [ ] **Step 6-5: 結果画面のレアリティ表示を `GlowBadge` + スケールインに差し替える**

result 表示ブロック（`result ? (` の中）の以下の部分を変更する。

変更前（`style.label` を表示している `<p>` と prize_bp を表示している `<p>`）:
```tsx
<div style={{ marginBottom: "16px" }}>
  <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", color: style.color, marginBottom: "6px" }}>
    {style.label}
  </p>
  <p style={{
    fontSize:      "44px",
    fontWeight:    900,
    color:         style.color,
    letterSpacing: "-0.02em",
    margin:        "0 0 6px",
    animation:     result.prize_bp >= 5000 ? "pulse 1s infinite" : undefined,
  }}>
    +{result.prize_bp.toLocaleString()}BP
  </p>
  <p style={{ fontSize: "13px", fontWeight: 700, color: result.net >= 0 ? "#4ade80" : "#f87171" }}>
    差引: {result.net >= 0 ? "+" : ""}{result.net}BP
  </p>
</div>
```

変更後:
```tsx
<div style={{ marginBottom: "16px" }}>
  {/* GlowBadge でレアリティ表示（高レアならグロウON） */}
  <div style={{ marginBottom: "8px" }}>
    <GlowBadge color={style.color} glow={result.prize_bp >= 300}>
      {style.label}
    </GlowBadge>
  </div>

  {/* 獲得BP スケールイン */}
  <motion.p
    initial={reduced ? {} : { scale: 0.5, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={reduced ? { duration: 0 } : { type: "spring", damping: 16, stiffness: 280, delay: 0.1 }}
    style={{
      fontSize:      "44px",
      fontWeight:    900,
      color:         style.color,
      letterSpacing: "-0.02em",
      margin:        "0 0 6px",
    }}
  >
    +{result.prize_bp.toLocaleString()}BP
  </motion.p>

  <p style={{ fontSize: "13px", fontWeight: 700, color: result.net >= 0 ? "#4ade80" : "#f87171" }}>
    差引: {result.net >= 0 ? "+" : ""}{result.net}BP
  </p>
</div>
```

---

- [ ] **Step 6-6: `npm run build` が通ることを確認する**

```bash
npm run build
```

型エラー（`GlowBadge` の `glow` prop 等）が出た場合は修正する。

---

## Task 7: `app/mini-games/tap/page.tsx` を `TapFloatText` + ボタンスプリング + float 上限20個 に更新する

**Files:**
- Modify: `app/mini-games/tap/page.tsx`

---

- [ ] **Step 7-1: インポートを追加する**

ファイル冒頭に追記する（既存 import は変更なし）:

```tsx
import { motion, useReducedMotion } from "framer-motion";
import { TapFloatText } from "@/components/animations/TapFloatText";
```

---

- [ ] **Step 7-2: `useReducedMotion` を呼び出す**

`TapMiningPage()` 関数内、既存 `useState` 群の直後に追記:

```tsx
const reduced = useReducedMotion();
```

---

- [ ] **Step 7-3: `handleTap` 内の float 生成を上限20個にキャップする**

`handleTap` 内の以下の行を変更する。

変更前:
```tsx
setFloats(prev => [...prev, { id, text: "⛏️", color: isDark ? "text-white/50" : "text-gray-400", x }]);
```

変更後:
```tsx
setFloats(prev => [...prev, { id, text: "⛏️", color: isDark ? "text-white/50" : "text-gray-400", x }].slice(-20));
```

---

- [ ] **Step 7-4: メインタップボタンを `motion.button` に変更する**

変更前（約 435〜453行）:
```tsx
<button
  onClick={handleTap}
  disabled={!userId || !status || effectiveRemaining <= 0}
  className={`
    w-48 h-48 rounded-full font-black text-2xl transition-all duration-100 select-none
    ${isTapping ? "scale-90" : "scale-100"}
    ${fever
      ? "bg-gradient-to-br from-red-500 to-orange-500 shadow-[0_0_40px_rgba(239,68,68,0.8)]"
      : "bg-gradient-to-br from-purple-600 to-blue-600 shadow-[0_0_30px_rgba(99,102,241,0.5)]"
    }
    ${(!userId || !status || effectiveRemaining <= 0) ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:scale-105 active:scale-90"}
  `}
>
  {effectiveRemaining <= 0 ? "🔒" : "⛏️"}
  <div className="text-sm font-normal mt-1">
    {effectiveRemaining <= 0 ? "明日また来てね" : "TAP!"}
  </div>
</button>
```

変更後（`scale-90/scale-100/hover:scale-105/active:scale-90/transition-all` は framer-motion に委譲するため削除）:
```tsx
<motion.button
  onClick={handleTap}
  disabled={!userId || !status || effectiveRemaining <= 0}
  animate={reduced ? {} : { scale: isTapping ? 0.88 : 1 }}
  whileHover={(!userId || !status || effectiveRemaining <= 0) || reduced ? {} : { scale: 1.05 }}
  transition={{ type: "spring", damping: 14, stiffness: 420 }}
  className={`
    w-48 h-48 rounded-full font-black text-2xl select-none
    ${fever
      ? "bg-gradient-to-br from-red-500 to-orange-500 shadow-[0_0_40px_rgba(239,68,68,0.8)]"
      : "bg-gradient-to-br from-purple-600 to-blue-600 shadow-[0_0_30px_rgba(99,102,241,0.5)]"
    }
    ${(!userId || !status || effectiveRemaining <= 0) ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
  `}
>
  {effectiveRemaining <= 0 ? "🔒" : "⛏️"}
  <div className="text-sm font-normal mt-1">
    {effectiveRemaining <= 0 ? "明日また来てね" : "TAP!"}
  </div>
</motion.button>
```

---

- [ ] **Step 7-5: float テキストを `TapFloatText` に差し替える**

変更前（メインタップボタン周辺の `{floats.map(...)}` ブロック）:
```tsx
<div className="relative flex items-center justify-center my-8">
  {floats.map(f => (
    <div
      key={f.id}
      className={`absolute text-sm font-bold ${f.color} pointer-events-none animate-bounce`}
      style={{ left: `${f.x}%`, top: "-20px" }}
    >
      {f.text}
    </div>
  ))}
  <motion.button ...>
```

変更後:
```tsx
<div className="relative flex items-center justify-center my-8">
  <TapFloatText items={floats} />
  <motion.button ...>
```

---

- [ ] **Step 7-6: `npm run build` が通ることを確認する**

```bash
npm run build
```

型エラーが出た場合: `TapFloatText` の `FloatItem` 型と tap/page.tsx の `floats` state の型が一致しているか確認する。  
`floats` の型定義（`{ id: number; text: string; color: string; x: number }`）と `TapFloatText` の `FloatItem` が一致しているのでエラーは発生しないはず。

---

## Task 8: 最終 build 確認

- [ ] **Step 8-1: クリーンビルドを実行する**

```bash
npm run build
```

期待される結果: `✓ Compiled successfully` または `Route (app) Size` テーブルが出力される。エラー0件。

- [ ] **Step 8-2: 動作確認チェックリスト（目視）**

`npm run dev` でローカルサーバーを起動し、以下を目視確認する。

| 確認項目 | 期待動作 |
|---|---|
| `/top` ページ表示 | アプリアイコン14個がスタガーで順番に出現する |
| `/top` アイコン hover | アイコンが 1.08倍にスプリングスケールする |
| `/top` アイコン tap | ボトムシートが下から滑らかにスライドアップする |
| `/top` ボトムシート閉じ | スライドダウンして消える |
| BPGrantModal 表示 | パネルがスプリングでポップイン、パーティクルが放射する |
| BPGrantModal 数値 | 0 → amount へカウントアップする |
| LoginBonusModal 表示 | 同上 |
| LoginBonusModal 数値 | 0 → bp_earned へカウントアップする |
| GachaModal 表示 | スプリングポップイン |
| GachaModal spin 中 | 🎰が拡縮パルスする |
| GachaModal 結果 | 獲得BPが中央からスケールイン、高レアでグロウ |
| GameTile hover | わずかに上に浮く |
| Tap Mining float | ⛏️が上方向にスムーズにフェードアウトする（bounce ではない） |
| Tap Mining ボタン tap | ボタンがスプリングで凹む |
| prefers-reduced-motion | OS設定でアニメ無効にするとすべて即時表示 |

---

## 実装上の注意点

### framer-motion v12 の注意
- `motion.button` は `disabled` prop をそのまま渡せる（HTML属性として転送される）
- `useReducedMotion()` は `"use client"` コンポーネントの中でのみ使用可能（すべて満たしている）
- `animate` に空オブジェクト `{}` を渡すと、variants 継承を防げる

### 既存コードの不変部分
- すべての `fetch` / API 呼び出し: **変更なし**
- `GachaResult` 型・`handleSpin` / `handleDaily`: **変更なし**
- `LoginBonusModal` の `nextBonus()` ロジック: **変更なし**
- `BPGrantModal` の `onClose` コールバック: **変更なし**
- `TapMiningPage` のバッチ flush ロジック: **変更なし**

### `CountUpNumber` の gradient テキストへの適用
`WebkitTextFillColor: "transparent"` が設定された `div` の中に `CountUpNumber` を入れると、`motion.span` の内側テキストが gradient を継承するため問題なし。

### `AnimatedModal` の backdrop クリック
`GachaModal` は result 表示中は backdrop クリックを無効にしている（`result ? undefined : handleClose`）。この挙動は `onBackdropClick={result ? undefined : handleClose}` でそのまま維持される。

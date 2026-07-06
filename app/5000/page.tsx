"use client";

import Link from "next/link";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence, Variants, useInView } from "framer-motion";
import { loadDraft, saveDraft } from "@/components/storage";

/* ===== プランデータ ===== */
type PlanId = "500" | "2000" | "3000" | "5000";

const PLAN_DATA: Record<
  PlanId,
  {
    amount: number;
    name: string;
    bp: number;
    epRate: string;
    units: number;
    pool: "none" | "credit" | "total";
    badge: string | null;
    accent: string;
    popular: boolean;
  }
> = {
  "500":  { amount: 500,  name: "Automation", bp: 1000,  epRate: "3EP = 1円",   units: 0, pool: "none",   badge: null,          accent: "#94a3b8", popular: false },
  "2000": { amount: 2000, name: "Core",        bp: 4000,  epRate: "2.5EP = 1円", units: 2, pool: "credit", badge: null,          accent: "#6C63FF", popular: false },
  "3000": { amount: 3000, name: "Core",        bp: 8000,  epRate: "2.5EP = 1円", units: 3, pool: "credit", badge: "RECOMMENDED", accent: "#6C63FF", popular: false },
  "5000": { amount: 5000, name: "Infra",       bp: 10000, epRate: "2EP = 1円",   units: 5, pool: "total",  badge: "MOST POPULAR",accent: "#00D4FF", popular: true  },
};

const PLAN_IDS: PlanId[] = ["500", "2000", "3000", "5000"];

/* ===== Variants ===== */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

/* ===== カウントアップ hook ===== */
function useCountUp(target: number, duration = 1.5) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let current = 0;
    const step = target / (duration * 60);
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return { count, ref };
}

/* ===== Component ===== */
function DaoMemberPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<ReturnType<typeof loadDraft> | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("5000");
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [payBusy, setPayBusy] = useState(false);

  /* カウントアップ */
  const c1 = useCountUp(128);
  const c2 = useCountUp(3);
  const c3 = useCountUp(12);

  useEffect(() => {
    const d = loadDraft();
    // URLに refCode がある場合、regular draft と sessionStorage に保存
    const refCode = searchParams.get("refCode");
    if (refCode && !d.refId) {
      d.refId = refCode;
      saveDraft({ refId: refCode });
      try { sessionStorage.setItem("5000_ref_code", refCode); } catch {}
    }
    setDraft(d);
  }, [searchParams]);

  function handleCta() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("5000_plan", selectedPlan);
    }
    router.push("/5000/apply");
  }

  const selectedData = PLAN_DATA[selectedPlan];
  const ctaLabel = "入会申請フォームへ →";

  const slots = selectedData.units;

  return (
    <main className="min-h-screen text-white overflow-x-hidden" style={{ background: "#0A0A0A" }}>
      {/* CSS keyframes */}
      <style>{`
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .hero-gradient {
          background: linear-gradient(135deg, #6C63FF 0%, #00D4FF 40%, #0A0A0A 70%, #6C63FF 100%);
          background-size: 300% 300%;
          animation: gradientShift 12s ease infinite;
        }
        @keyframes coreGlow {
          0%, 100% { box-shadow: 0 0 40px 10px rgba(108,99,255,0.45); }
          50%       { box-shadow: 0 0 90px 35px rgba(108,99,255,0.75), 0 0 140px 60px rgba(0,212,255,0.25); }
        }
        .ai-core { animation: coreGlow 3s ease-in-out infinite; }
        .plan-table th, .plan-table td {
          padding: 10px 14px;
          text-align: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          white-space: nowrap;
        }
        .plan-table th { font-size: 11px; color: rgba(255,255,255,0.35); font-weight: 600; letter-spacing: 0.08em; }
        .plan-table td { font-size: 13px; color: rgba(255,255,255,0.75); }
        .plan-table td:first-child { text-align: left; color: rgba(255,255,255,0.4); font-size: 11px; }
        .sim-table th, .sim-table td {
          padding: 10px 16px;
          text-align: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          white-space: nowrap;
        }
        .sim-table th { font-size: 11px; color: rgba(255,255,255,0.35); font-weight: 600; }
        .sim-table td { font-size: 13px; color: rgba(255,255,255,0.75); }
        .sim-table td:first-child { text-align: left; color: rgba(255,255,255,0.4); font-size: 12px; }
      `}</style>

      {/* ── 固定背景ブロブ ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute top-[-200px] left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(108,99,255,0.1) 0%, transparent 70%)",
            filter: "blur(50px)",
          }}
        />
        <div
          className="absolute bottom-[-150px] right-[-100px] h-[400px] w-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* ======================================================
          ① Hero
      ====================================================== */}
      <section className="hero-gradient relative min-h-screen flex flex-col items-center justify-center text-center px-4 pb-20">
        <div className="absolute inset-0 bg-black/55" />

        <div className="relative z-10 flex flex-col items-center">
          {/* バッジ */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/50 mb-10 backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#6C63FF] animate-pulse" />
            LIMITED ACCESS — 先着枠
          </motion.div>

          {/* AI コア */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="flex justify-center mb-12"
          >
            <div className="relative">
              <div
                className="ai-core h-32 w-32 rounded-full flex items-center justify-center"
                style={{
                  background: "radial-gradient(circle, #6C63FF 0%, #00D4FF 55%, transparent 100%)",
                }}
              >
                <span className="text-4xl select-none">⬡</span>
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-16px] rounded-full border border-dashed border-[#6C63FF]/30"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-36px] rounded-full border border-dashed border-[#00D4FF]/15"
              />
            </div>
          </motion.div>

          {/* テキスト */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
            <div className="text-sm font-semibold tracking-[0.25em] text-[#6C63FF] uppercase mb-3">
              LIFAI Limited Access
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4 leading-tight">
              AIを使えるかどうかで、
              <br className="hidden sm:block" />
              未来は分かれる。
            </h1>
            <p className="text-xl text-white/45 mb-10">$500 / $2,000 / $3,000 / $5,000</p>
          </motion.div>

        </div>

        {/* スクロール誘導 */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: [0.25, 0.1, 0.25, 1] }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 text-xs"
        >
          ↓
        </motion.div>
      </section>

      <div className="relative mx-auto max-w-3xl px-4 py-20">

        {/* ======================================================
            ② プランカード
        ====================================================== */}
        <section className="mb-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-2">Plans</div>
            <h2 className="text-2xl font-black">参加プランを選ぶ</h2>
          </motion.div>

          {/* タブ */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="flex justify-center gap-2 mb-8 flex-wrap"
          >
            {PLAN_IDS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPlan(p)}
                className="rounded-full px-5 py-2 text-sm font-bold transition-all duration-200"
                style={{
                  background: selectedPlan === p ? PLAN_DATA[p].accent : "rgba(255,255,255,0.05)",
                  color: selectedPlan === p ? "#fff" : "rgba(255,255,255,0.4)",
                  boxShadow: selectedPlan === p ? `0 0 20px ${PLAN_DATA[p].accent}80` : "none",
                }}
              >
                ${p}
              </button>
            ))}
          </motion.div>

          {/* 4枚グリッド */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            {PLAN_IDS.map((p, i) => {
              const d = PLAN_DATA[p];
              const isSelected = selectedPlan === p;
              const isPopular = d.popular;
              return (
                <motion.div
                  key={p}
                  animate={{
                    scale: isSelected ? (isPopular ? 1.06 : 1.04) : 0.93,
                    opacity: isSelected ? 1 : 0.55,
                  }}
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  onClick={() => setSelectedPlan(p)}
                  className="cursor-pointer relative rounded-2xl border p-5"
                  style={{
                    borderColor: isSelected
                      ? isPopular ? "rgba(0,212,255,0.65)" : "rgba(108,99,255,0.55)"
                      : "rgba(255,255,255,0.1)",
                    background: isSelected
                      ? isPopular ? "rgba(0,212,255,0.08)" : "rgba(108,99,255,0.08)"
                      : "rgba(255,255,255,0.03)",
                    boxShadow: isSelected
                      ? isPopular
                        ? "0 0 60px rgba(0,212,255,0.25), 0 0 120px rgba(0,212,255,0.1)"
                        : "0 0 40px rgba(108,99,255,0.2)"
                      : "none",
                  }}
                >
                  {d.badge && (
                    <div
                      className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white whitespace-nowrap"
                      style={{
                        background: isPopular ? "#00D4FF" : "rgba(108,99,255,0.3)",
                        border: isPopular ? "none" : "1px solid rgba(108,99,255,0.5)",
                        color: isPopular ? "#0A0A0A" : "#a5b4fc",
                        boxShadow: isPopular ? "0 0 16px rgba(0,212,255,0.6)" : "none",
                      }}
                    >
                      {d.badge}
                    </div>
                  )}
                  <div
                    className="text-[10px] tracking-widest font-semibold mb-1"
                    style={{ color: isSelected ? (isPopular ? "#00D4FF" : "#a5b4fc") : "rgba(255,255,255,0.3)" }}
                  >
                    {d.name.toUpperCase()}
                  </div>
                  <div className="text-2xl font-black mb-3">${Number(p).toLocaleString()}</div>
                  <ul className="space-y-1.5 text-[11px]" style={{ color: isSelected ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.35)" }}>
                    <li>✓ コンテンツ利用無制限</li>
                    <li>✓ 月額サポート契約</li>
                    <li>✓ BP {d.bp.toLocaleString()}付与</li>
                    {d.units > 0 && (
                      <li style={{ color: isSelected ? (isPopular ? "#67e8f9" : "#a5b4fc") : "rgba(255,255,255,0.3)" }}>
                        ✓ 還元 <span className="font-bold">{d.units}口</span>
                      </li>
                    )}
                    {d.units === 0 && (
                      <li style={{ color: "rgba(255,255,255,0.2)" }}>還元なし</li>
                    )}
                    {p === "5000" && <li>✓ 🎧 Music Boost</li>}
                  </ul>
                </motion.div>
              );
            })}
          </div>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={2}
            className="text-center text-xs text-white/25 mt-6"
          >
            ※すべてのプランに月額契約（¥9,800）が必要です
          </motion.p>
        </section>

        {/* ======================================================
            ③ プラン比較表
        ====================================================== */}
        <section className="mb-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-2">Comparison</div>
            <h2 className="text-2xl font-black">プラン比較</h2>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="rounded-3xl border border-white/10 overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div className="overflow-x-auto">
              <table className="plan-table w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <th style={{ textAlign: "left", padding: "14px 14px" }}></th>
                    {PLAN_IDS.map((p) => {
                      const d = PLAN_DATA[p];
                      return (
                        <th key={p} style={{ color: d.popular ? "#00D4FF" : d.units > 0 ? "#a5b4fc" : "rgba(255,255,255,0.35)" }}>
                          <div className="font-black text-sm">${Number(p).toLocaleString()}</div>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", opacity: 0.7 }}>{d.name.toUpperCase()}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>BP付与</td>
                    {PLAN_IDS.map((p) => (
                      <td key={p} className="font-bold">{PLAN_DATA[p].bp.toLocaleString()} BP</td>
                    ))}
                  </tr>
                  <tr>
                    <td>EP広告単価</td>
                    {PLAN_IDS.map((p) => (
                      <td key={p} style={{ color: p === "3000" ? "#a5b4fc" : "rgba(255,255,255,0.75)" }}>
                        {PLAN_DATA[p].epRate}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>分配口数</td>
                    {PLAN_IDS.map((p) => {
                      const d = PLAN_DATA[p];
                      return (
                        <td key={p} style={{ color: d.units > 0 ? (d.popular ? "#67e8f9" : "#a5b4fc") : "rgba(255,255,255,0.25)" }}>
                          {d.units > 0 ? `${d.units}口` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td>分配対象</td>
                    {PLAN_IDS.map((p) => {
                      const d = PLAN_DATA[p];
                      return (
                        <td key={p} style={{ fontSize: 11, color: d.pool === "none" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)" }}>
                          {d.pool === "none" && "—"}
                          {d.pool === "credit" && "クレジット売上 5%"}
                          {d.pool === "total" && (
                            <span style={{ color: "#67e8f9", fontWeight: 600 }}>全体売上 5%</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td>Music Boost</td>
                    {PLAN_IDS.map((p) => (
                      <td key={p} style={{ color: p === "5000" ? "#a5b4fc" : "rgba(255,255,255,0.2)" }}>
                        {p === "5000" ? "✓" : "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        </section>

        {/* ======================================================
            ④ 還元の可視化
        ====================================================== */}
        <section className="mb-16">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-2">
              Revenue Share
            </div>
            <h2 className="text-2xl font-black">パートナー還元</h2>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="rounded-3xl border border-white/10 p-8 mb-6"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            {/* 分配ルール説明 */}
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              <div
                className="rounded-2xl p-4"
                style={{ background: "rgba(108,99,255,0.08)", border: "1px solid rgba(108,99,255,0.2)" }}
              >
                <div className="text-[11px] tracking-widest text-[#a5b4fc] font-semibold uppercase mb-2">Core</div>
                <div className="text-sm font-bold text-white/80 mb-1">$2,000 / $3,000</div>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span className="rounded bg-[#6C63FF]/20 px-2 py-0.5 text-[#a5b4fc] font-bold">クレジット売上</span>
                  <span>×</span>
                  <span className="text-white/80 font-bold">5%</span>
                  <span>を口数で分配</span>
                </div>
              </div>
              <div
                className="rounded-2xl p-4"
                style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.2)" }}
              >
                <div className="text-[11px] tracking-widest text-[#67e8f9] font-semibold uppercase mb-2">Infra</div>
                <div className="text-sm font-bold text-white/80 mb-1">$5,000</div>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span className="rounded bg-[#00D4FF]/20 px-2 py-0.5 text-[#67e8f9] font-bold">全体売上</span>
                  <span>×</span>
                  <span className="text-white/80 font-bold">5%</span>
                  <span>を口数で分配</span>
                </div>
              </div>
            </div>

            {/* 口数アニメーション */}
            <div className="flex justify-center min-h-[88px] items-center mb-6">
              <AnimatePresence mode="wait">
                {slots > 0 ? (
                  <motion.div
                    key={`slots-${slots}`}
                    className="flex gap-3 items-center flex-wrap justify-center"
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    {Array.from({ length: slots }).map((_, i) => (
                      <motion.div
                        key={i}
                        variants={{
                          hidden: { opacity: 0, scale: 0 },
                          visible: {
                            opacity: 1,
                            scale: 1,
                            transition: {
                              delay: i * 0.15,
                              duration: 0.45,
                              type: "spring",
                              stiffness: 220,
                            },
                          },
                        }}
                        className="rounded-full flex items-center justify-center font-extrabold text-white text-sm"
                        style={{
                          width: 64,
                          height: 64,
                          background:
                            i === 0
                              ? selectedPlan === "5000"
                                ? "linear-gradient(135deg, #00D4FF, #6C63FF)"
                                : "linear-gradient(135deg, #6C63FF, #00D4FF)"
                              : `rgba(108,99,255,${0.28 - i * 0.04})`,
                          border: `2px solid ${selectedPlan === "5000" ? "rgba(0,212,255,0.5)" : "rgba(108,99,255,0.5)"}`,
                          boxShadow:
                            i === 0
                              ? selectedPlan === "5000"
                                ? "0 0 28px rgba(0,212,255,0.65)"
                                : "0 0 28px rgba(108,99,255,0.65)"
                              : "0 0 12px rgba(108,99,255,0.2)",
                        }}
                      >
                        {i + 1}口
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.p
                    key="no-slots"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-white/25"
                  >
                    Automationプランは還元対象外
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="text-center text-xs text-white/35 space-y-1">
              <p>$2,000 = 2口　/　$3,000 = 3口　/　$5,000 = 5口</p>
              <p>人数と売上で毎月変動　/　収益保証なし</p>
            </div>
          </motion.div>
        </section>

        {/* ======================================================
            ⑤ 分配シミュレーション
        ====================================================== */}
        <section className="mb-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-2">Simulation</div>
            <h2 className="text-2xl font-black">分配シミュレーション</h2>
            <p className="text-xs text-white/30 mt-2">※ 参加者数の仮定: Core合計100口、Infra合計25口</p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="rounded-3xl border border-white/10 overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div className="overflow-x-auto">
              <table className="sim-table w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}></th>
                    <th>
                      <div className="text-white/70 font-black text-sm">売上 ¥500万</div>
                    </th>
                    <th>
                      <div style={{ color: "#a5b4fc" }} className="font-black text-sm">売上 ¥1,000万</div>
                    </th>
                    <th>
                      <div style={{ color: "#00D4FF" }} className="font-black text-sm">売上 ¥2,500万</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ color: "#a5b4fc", fontWeight: 600 }}>Core 分配プール<br/><span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>クレジット売上 × 5%</span></td>
                    <td style={{ color: "#a5b4fc", fontWeight: 700 }}>¥250,000</td>
                    <td style={{ color: "#a5b4fc", fontWeight: 700 }}>¥500,000</td>
                    <td style={{ color: "#a5b4fc", fontWeight: 700 }}>¥1,250,000</td>
                  </tr>
                  <tr>
                    <td style={{ color: "#67e8f9", fontWeight: 600 }}>Infra 分配プール<br/><span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>全体売上 × 5%</span></td>
                    <td style={{ color: "#67e8f9", fontWeight: 700 }}>¥250,000</td>
                    <td style={{ color: "#67e8f9", fontWeight: 700 }}>¥500,000</td>
                    <td style={{ color: "#67e8f9", fontWeight: 700 }}>¥1,250,000</td>
                  </tr>
                  <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td>Core 1口あたり<br/><span style={{ fontSize: 10 }}>（合計100口仮定）</span></td>
                    <td className="font-bold">¥2,500</td>
                    <td className="font-bold">¥5,000</td>
                    <td className="font-bold">¥12,500</td>
                  </tr>
                  <tr>
                    <td>$2,000 Core（2口）</td>
                    <td style={{ color: "#a5b4fc", fontWeight: 600 }}>¥5,000 / 月</td>
                    <td style={{ color: "#a5b4fc", fontWeight: 600 }}>¥10,000 / 月</td>
                    <td style={{ color: "#a5b4fc", fontWeight: 600 }}>¥25,000 / 月</td>
                  </tr>
                  <tr>
                    <td>$3,000 Core（3口）</td>
                    <td style={{ color: "#a5b4fc", fontWeight: 700 }}>¥7,500 / 月</td>
                    <td style={{ color: "#a5b4fc", fontWeight: 700 }}>¥15,000 / 月</td>
                    <td style={{ color: "#a5b4fc", fontWeight: 700 }}>¥37,500 / 月</td>
                  </tr>
                  <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td>Infra 1口あたり<br/><span style={{ fontSize: 10 }}>（合計25口仮定）</span></td>
                    <td className="font-bold">¥10,000</td>
                    <td className="font-bold">¥20,000</td>
                    <td className="font-bold">¥50,000</td>
                  </tr>
                  <tr>
                    <td>$5,000 Infra（5口）</td>
                    <td style={{ color: "#67e8f9", fontWeight: 700 }}>¥50,000 / 月</td>
                    <td style={{ color: "#67e8f9", fontWeight: 700 }}>¥100,000 / 月</td>
                    <td style={{ color: "#67e8f9", fontWeight: 700 }}>¥250,000 / 月</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-white/6">
              <p className="text-[11px] text-white/25">
                ※ 参加口数が増えると1口あたりの分配額は減少します。収益を保証するものではありません。
              </p>
            </div>
          </motion.div>
        </section>

        {/* ======================================================
            ⑥ What You Get
        ====================================================== */}
        <section className="mb-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-2">Features</div>
            <h2 className="text-2xl font-black">LIFAIでできること</h2>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { icon: "🎼", title: "音楽生成",        desc: "歌詞・構成・楽曲を3ステップで自動制作",          accent: "#00D4FF", i: 0 },
              { icon: "🚀", title: "Music Boost",     desc: "楽曲の優先処理と収益化ブースト",                accent: "#7c3aed", i: 1 },
              { icon: "📝", title: "ノート生成",       desc: "構成→本文→見出し→導入文まで一括AI作成",        accent: "#6C63FF", i: 2 },
              { icon: "🛒", title: "マーケット",       desc: "メンバー間でサービスやコンテンツを売買",         accent: "#f59e0b", i: 3 },
              { icon: "🎰", title: "ガチャ",           desc: "BPを消費してレアアイテムや特典を獲得",          accent: "#ec4899", i: 4 },
              { icon: "💎", title: "ステーキング",     desc: "BPを預けて複利で増やす自動運用機能",            accent: "#06b6d4", i: 5 },
              { icon: "🔮", title: "占い",         desc: "団子占い・AIカード占い",             accent: "#8b5cf6", i: 6 },
              { icon: "🧩", title: "ワークフロー",     desc: "n8nなど自動化ツールの設計テンプレを生成",       accent: "#0ea5e9", i: 7 },
              { icon: "⚔️", title: "Rumble Arena",    desc: "週次バトルランキングで上位入賞してBP獲得",      accent: "#6C63FF", i: 8 },
              { icon: "⛏️", title: "Tap Mining",      desc: "毎日500タップでコツコツBPをマイニング",         accent: "#6C63FF", i: 9 },
              { icon: "👑", title: "メンバーシップ",   desc: "プランのアップグレードと特典の確認・管理",       accent: "#94a3b8", i: 10 },
            ].map(({ icon, title, desc, accent, i }) => (
              <motion.div
                key={title}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i % 6}
                whileHover={{
                  scale: 1.03,
                  boxShadow: `0 0 32px ${accent}33`,
                  borderColor: `${accent}55`,
                  transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
                }}
                className="rounded-2xl border border-white/8 p-5 cursor-pointer"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div className="text-3xl mb-3">{icon}</div>
                <div className="font-bold text-sm mb-1 text-white/90">{title}</div>
                <div className="text-xs text-white/40">{desc}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ======================================================
            ⑦ 月額サブスク
        ====================================================== */}
        <section className="mb-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="rounded-3xl border border-white/10 p-8"
            style={{
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-1">
              Monthly Plan
            </div>
            <h2 className="text-lg font-extrabold text-white/90 mb-2">月額サポート契約</h2>
            <div className="text-4xl font-black mb-6" style={{ color: "#6C63FF" }}>
              ¥9,800
              <span className="text-base font-normal text-white/30 ml-2">/ 月</span>
            </div>
            <ul className="grid sm:grid-cols-2 gap-3 text-sm text-white/60">
              <li>🎓 オンライン講習（月1回）</li>
              <li>🤝 オフライン講習（隔月）</li>
              <li>🛠 専用サポート窓口</li>
              <li>☁️ 安定インフラ運用</li>
            </ul>
          </motion.div>
        </section>

        {/* ======================================================
            ⑧ 信頼ブロック（数字アニメーション）
        ====================================================== */}
        <section className="mb-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-2">Status</div>
            <h2 className="text-2xl font-black">現在の状況</h2>
          </motion.div>

          {/* カウントアップ */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { spanRef: c1.ref, count: c1.count, label: "参加者", suffix: "名" },
              { spanRef: c2.ref, count: c2.count, label: "稼働システム", suffix: "本" },
              { spanRef: c3.ref, count: c3.count, label: "開発中機能", suffix: "件" },
            ].map(({ spanRef, count, label, suffix }) => (
              <motion.div
                key={label}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="rounded-2xl border border-white/8 p-4 text-center"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <span
                  ref={spanRef}
                  className="text-3xl font-black"
                  style={{ color: "#6C63FF" }}
                >
                  {count}
                </span>
                <span className="text-sm text-white/50 ml-1">{suffix}</span>
                <div className="text-xs text-white/30 mt-1">{label}</div>
              </motion.div>
            ))}
          </div>

          {/* ロードマップ（縦タイムライン） */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="rounded-2xl border border-white/8 p-5"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div className="text-xs tracking-widest text-white/30 font-semibold uppercase mb-5">
              Roadmap
            </div>

            <div className="relative">
              {/* 縦線（紫グラデーション） */}
              <div
                className="absolute left-[7px] top-0 bottom-0 w-[2px]"
                style={{
                  background: "linear-gradient(to bottom, #6C63FF, #00D4FF)",
                }}
              />

              <div className="flex flex-col gap-1">
                {[
                  { label: "音楽生成",   status: "done" },
                  { label: "AI自動化",   status: "done" },
                  { label: "マーケット", status: "done" },
                  { label: "ステーキング", status: "done" },
                  { label: "ノート生成", status: "done"  },
                  { label: "Bot",        status: "dev"  },
                  { label: "ワークフロー", status: "dev" },
                  { label: "Marketplace",          status: "soon" },
                  { label: "無料VPSサーバー設置",    status: "dev"  },
                  { label: "画像生成AI",            status: "dev"  },
                  { label: "動画生成AI",            status: "dev"  },
                  { label: "EPステーキングシステム", status: "dev"  },
                  { label: "SNS自動運用プロトコル",  status: "dev"  },
                  { label: "長期記憶AIチャット",     status: "dev"  },
                  { label: "副業マッチング",         status: "dev"  },
                  { label: "GPUレンダリング",        status: "dev"  },
                  { label: "アプリ生成AI",           status: "dev"  },
                  { label: "HP & LP自動生成AI",     status: "dev"  },
                ].map(({ label, status }, i) => {
                  const isDone = status === "done";
                  const isDev  = status === "dev";

                  return (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{
                        delay: i * 0.07,
                        duration: 0.4,
                        ease: [0.25, 0.1, 0.25, 1],
                      }}
                      whileHover={{
                        backgroundColor: "rgba(108,99,255,0.07)",
                        transition: { duration: 0.15 },
                      }}
                      className="flex items-center gap-4 pl-5 pr-3 py-2.5 rounded-lg cursor-default"
                    >
                      {/* ドット */}
                      <div className="relative flex-shrink-0 -ml-[18px]">
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{
                            background: isDone
                              ? "rgba(34,197,94,0.15)"
                              : isDev
                              ? "rgba(108,99,255,0.15)"
                              : "rgba(255,255,255,0.05)",
                          }}
                        />
                        <div
                          className={[
                            "absolute inset-[4px] rounded-full",
                            isDone || isDev ? "animate-pulse" : "",
                          ].join(" ")}
                          style={{
                            background: isDone
                              ? "#22c55e"
                              : isDev
                              ? "#6C63FF"
                              : "rgba(255,255,255,0.25)",
                          }}
                        />
                      </div>

                      {/* ラベル */}
                      <span
                        className="text-sm font-medium flex-1"
                        style={{
                          color: isDone
                            ? "rgba(255,255,255,0.95)"
                            : isDev
                            ? "rgba(255,255,255,0.55)"
                            : "rgba(255,255,255,0.3)",
                        }}
                      >
                        {label}
                      </span>

                      {/* ステータスバッジ */}
                      <span
                        className="text-[10px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0"
                        style={{
                          background: isDone
                            ? "rgba(34,197,94,0.15)"
                            : isDev
                            ? "rgba(108,99,255,0.18)"
                            : "rgba(255,255,255,0.05)",
                          color: isDone
                            ? "#4ade80"
                            : isDev
                            ? "#a5b4fc"
                            : "rgba(255,255,255,0.3)",
                          border: isDone
                            ? "1px solid rgba(34,197,94,0.3)"
                            : isDev
                            ? "1px solid rgba(108,99,255,0.35)"
                            : "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        {isDone ? "✅ 稼働中" : isDev ? "🔄 開発中" : "🔜 近日公開"}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </section>

        {/* ======================================================
            ⑨ アコーディオン
        ====================================================== */}
        <section className="mb-16">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <button
              type="button"
              onClick={() => setAccordionOpen((v) => !v)}
              className="w-full flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-5 py-4 text-sm font-semibold text-white/50 hover:bg-white/7 transition"
            >
              <span>▼ 詳細・利用条件</span>
              <motion.span
                animate={{ rotate: accordionOpen ? 180 : 0 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className="text-white/30"
              >
                ∧
              </motion.span>
            </button>

            <AnimatePresence>
              {accordionOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-2xl border border-white/10 bg-white/4 px-5 py-5 space-y-4 text-sm text-white/50">
                    <div>
                      <div className="font-extrabold text-white/75 mb-1">■ 参加条件</div>
                      <p>月額契約が必須です。未払いの場合、特典・還元を含む全サービスが停止します。</p>
                    </div>
                    <div>
                      <div className="font-extrabold text-white/75 mb-1">■ 還元ルール</div>
                      <p>
                        対象は $2,000 / $3,000 / $5,000 プランのみ。CoreはEPクレジット売上の5%、InfraはEPクレジットを含む全体売上の5%を口数に応じて分配。在籍中のみ有効。収益保証はありません。
                      </p>
                    </div>
                    <div>
                      <div className="font-extrabold text-white/75 mb-1">■ $5,000 Infra 特典</div>
                      <p>音楽生成機能の強化・優先処理・拡張機能が利用可能です。全体売上からの分配（5口）。</p>
                    </div>
                    <div>
                      <div className="font-extrabold text-white/75 mb-1">■ $2,000 と $3,000 の差異</div>
                      <p>どちらもCoreプランですが、$3,000はBP（8,000）・口数（3口）・EP広告単価（¥2.5/EP）すべてで上位です。</p>
                    </div>
                    <div>
                      <div className="font-extrabold text-white/75 mb-1">■ 注意事項</div>
                      <p>
                        本サービスへの参加は投資ではありません。利回り・配当・価格上昇益の保証はなく、
                        株式・持分・経営権を付与するものではありません。
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </section>

        {/* ======================================================
            ⑩ CTA
        ====================================================== */}
        <section className="text-center pb-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.button
              type="button"
              disabled={payBusy}
              onClick={handleCta}
              whileHover={
                !payBusy
                  ? {
                      scale: 1.06,
                      y: -5,
                      boxShadow:
                        "0 0 65px rgba(108,99,255,0.75), 0 0 130px rgba(108,99,255,0.3)",
                    }
                  : {}
              }
              whileTap={!payBusy ? { scale: 0.97 } : {}}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="inline-flex items-center justify-center rounded-2xl px-12 py-5 text-lg font-extrabold"
              style={{
                background: "linear-gradient(135deg, #6C63FF, #00D4FF)",
                color: "#fff",
                boxShadow: "0 0 40px rgba(108,99,255,0.4)",
                opacity: payBusy ? 0.6 : 1,
                cursor: payBusy ? "not-allowed" : "pointer",
              }}
            >
              {ctaLabel}
            </motion.button>
            <p className="mt-3 text-xs text-white/25">先着受付中 / 審査あり</p>
          </motion.div>

          <div className="mt-12">
            <Link
              href="/"
              className="text-xs text-white/25 hover:text-white/50 underline decoration-white/20"
            >
              ← トップへ戻る
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}

export default function DaoMemberPageWrapper() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", background: "#0A0A0A" }} />}>
      <DaoMemberPage />
    </Suspense>
  );
}

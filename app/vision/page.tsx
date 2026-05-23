// app/vision/page.tsx
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type Milestone = {
  amountUSD: number;
  title: string;
  bullets: string[];
};

type RoadItem = {
  when: string; // 例: 2026 Q1
  title: string;
  desc: string;
  tags?: string[];
};

type EarningModel = {
  title: string;
  target: string;
  steps: string[];
  note: string;
};

const growth = {
  // ※後でAPI化してOK。いまは固定値で「見える化」優先。
  members: 82,
  fundUSD: 4831,
  gpuUnits: 1,
  vpsActive: 14,
  nextGoalUSD: 10000,
};

const milestones: Milestone[] = [
  {
    amountUSD: 10000,
    title: "楽曲配信サービス提携開始+GPU 追加（第1段階）",
    bullets: ["音楽配信企業との連携", "全員のGPU利用枠が増える（イベント/無料枠）", "生成速度が体感で上がる"],
  },
  {
    amountUSD: 25000,
    title: "VPS無料枠拡張 + AI実践強化（第2段階）",
    bullets: ["VPS無料枠を拡張（上限・台数）", "個人専用のAIBOTの導入", "生成AIの無料開放(制限付き)"],
  },
  {
    amountUSD: 50000,
    title: "AIラボ化（第3段階）",
    bullets: ["完全無料レンタルGPU整備", "企業向けに提供しサービス還元", "専用AIBOTの長期記憶化"],
  },
];

const credit = {
  // 30ドル→300クレ のように “わかりやすさ” を優先
  starterUSD: 30,
  starterCredits: 300,
  examples: [
    { name: "🔮 毎日占い", cost: 0, note: "1回" },
    { name: "🧠 デイリーチャレンジ（参加）", cost: 0, note: "無料（当選で+5クレなど）" },
    { name: "⚙ ワークフロー購入", cost: 15, note: "1本" },
    { name: "🖥 GPU利用", cost: 20, note: "1時間（例）" },
    { name: "☁ VPS利用", cost: 30, note: "2GB / 1ヶ月（例）" },
  ],
  notes: [
    "皆さんが払うのは手数料ではなく、行動資源です。",
    "手数料などは取らずにそのままクレジットに変換されます。",
    "クレジットはアプリ内専用（外部で換金・交換・譲渡はできません）",
    "“賭け”ではなく、参加無料のイベント・抽選・チャレンジで楽しむ設計です",
  ],
};

// 「体験型」も「実践環境」も両取りするための “流れ図”
const flowSteps = [
  {
    title: "体験する",
    icon: "✨",
    desc: "占い・AIツール・チャレンジで“まず触ってみる”。難しい説明より先に、体験で理解。",
    points: ["最初は遊び感覚でOK", "年齢問わず入りやすい"],
  },
  {
    title: "型を使う",
    icon: "🧩",
    desc: "成果が出やすいテンプレ/ワークフローを使って“再現”する。",
    points: ["コピペで動く型", "失敗しにくい手順"],
  },
  {
    title: "実践する",
    icon: "⚙",
    desc: "VPS/GPUで“実際に回す”。ここが“学ぶだけで終わらない”ポイント。",
    points: ["環境があるから継続できる", "副業の作業がラクになる"],
  },
  {
    title: "収益化へ",
    icon: "💰",
    desc: "ワークフロー販売/受託/外部販売など“売れる形”に整えていく。",
    points: ["月3万の現実ラインから", "実績が増えるほど強くなる"],
  },
];

// みんなで育つ循環（ワクワクの中核）
const loopItems = [
  { title: "参加が増える", icon: "👥", desc: "仲間が増えるほど、環境が強くなる。" },
  { title: "クレジットが回る", icon: "🪙", desc: "ツール体験・テンプレ購入・学びが増える。" },
  { title: "インフラ強化", icon: "🖥", desc: "GPU/VPSが強くなる（無料枠/イベントも解放）。" },
  { title: "副業が進む", icon: "🚀", desc: "回せる人が増える → 成果が出やすくなる。" },
];

// 年長者にも刺さる “具体例”
const earningModels: EarningModel[] = [
  {
    title: "音楽配信(音源/BGM)",
    target: "月 +‘1〜5万円（目安）",
    steps: ["音源自動生成AIを学ぶ", "SNS広告やジャケット作り", "配信し、収益化"],
    note: "音楽配信サイトと提携し、企業に提供、収益になりやすい。",
  },
  {
    title: "SNS素材づくり（画像/サムネ）",
    target: "月 +1〜3万円（目安）",
    steps: ["テンプレで画像生成の型を体験", "自分のジャンルに合わせて“型”を微調整", "納品/販売（サムネ/バナー/商品画像など）"],
    note: "“最初の成功体験”が作りやすい王道ルート。",
  },
  {
    title: "ワークフロー販売（自動化テンプレ）",
    target: "月 +3〜10万円（目安）",
    steps: ["使える自動化テンプレを購入して体験", "自分なりに改良して成果が出る形にする", "“テンプレとして販売”して積み上げる"],
    note: "単発労働ではなく“積み上がる副業”になりやすい。",
  },
  {
    title: "受託（LP/PWA/自動ツール）",
    target: "月 +5〜20万円（目安）",
    steps: ["LIFAI内で型を使って最短で形にする", "実例をポートフォリオ化", "企業/個人の要望に合わせて納品"],
    note: "本業に近い人ほど伸びやすい。",
  },
];

// 将来の広がり（※約束ではなく「目標/構想」と明記）
const roadmap: RoadItem[] = [
  { when: "いま", title: "進捗公開（透明性）", desc: "基金/目標/解放内容を公開。安心して参加できる状態へ。", tags: ["誰でも閲覧OK", "見える化"] },
  { when: "次", title: "GPU追加 → 体験の質UP", desc: "生成速度UP / 無料枠・イベントを増やして“使える感”を上げる。", tags: ["GPU", "無料枠"] },
  { when: "その次", title: "専用のAIBOTの完備", desc: "副業が続く環境へ。専用の秘書がつく。", tags: ["AIBOT", "継続"] },
  { when: "将来（構想）", title: "企業向け提供 → 環境に還元", desc: "企業利用が進めば、環境強化・優遇・イベントなどで“体験価値”を厚くする。", tags: ["構想", "還元は体験価値で"] },
];

// “目安”のミニグラフ（参加増→環境強化のイメージ）
const growthForecast = [
  { members: 100, gpu: 1 },
  { members: 300, gpu: 3 },
  { members: 800, gpu: 8 },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatUSD(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function ProgressBar({ valuePct }: { valuePct: number }) {
  const pct = clamp(valuePct, 0, 100);
  return (
    <div className="w-full rounded-full bg-zinc-200/80 ring-1 ring-zinc-300/60 overflow-hidden">
      <div
        className="h-3 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400"
        style={{ width: `${pct}%` }}
        aria-label={`progress ${pct}%`}
      />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-md ring-1 ring-zinc-200 shadow-sm p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-zinc-500">{sub}</div> : null}
    </div>
  );
}

function SectionHeader({ title, desc }: { title: string; desc?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {desc ? <p className="mt-2 text-sm text-zinc-600">{desc}</p> : null}
    </div>
  );
}

function ArrowDivider() {
  return (
    <div className="hidden md:flex items-center justify-center">
      <svg width="40" height="12" viewBox="0 0 40 12" fill="none" aria-hidden="true">
        <path d="M1 6H33" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M33 1L39 6L33 11"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function MiniLineChart({
  points,
  width = 520,
  height = 180,
}: {
  points: { members: number; gpu: number }[];
  width?: number;
  height?: number;
}) {
  const pad = 24;
  const xs = points.map((p) => p.members);
  const ys = points.map((p) => p.gpu);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = 0;
  const maxY = Math.max(...ys) + 1;

  const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (width - pad * 2);
  const sy = (y: number) => height - pad - ((y - minY) / (maxY - minY || 1)) * (height - pad * 2);

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.members).toFixed(1)} ${sy(p.gpu).toFixed(1)}`)
    .join(" ");

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="block" role="img" aria-label="参加人数の増加に伴うGPU強化のイメージ">
      <g opacity="0.35">
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={pad}
            x2={width - pad}
            y1={pad + t * (height - pad * 2)}
            y2={pad + t * (height - pad * 2)}
            stroke="currentColor"
            strokeOpacity="0.25"
          />
        ))}
      </g>

      <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="currentColor" strokeOpacity="0.25" />
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="currentColor" strokeOpacity="0.25" />

      <path d={d} fill="none" stroke="currentColor" strokeWidth="3" />

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={sx(p.members)} cy={sy(p.gpu)} r="5" fill="currentColor" />
          <text x={sx(p.members)} y={sy(p.gpu) - 10} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">
            {p.gpu} GPU
          </text>
        </g>
      ))}

      <text x={pad} y={height - 6} fontSize="11" fill="currentColor" opacity="0.6">
        {minX}人
      </text>
      <text x={width - pad} y={height - 6} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.6">
        {maxX}人
      </text>
      <text x={pad} y={14} fontSize="11" fill="currentColor" opacity="0.6">
        GPU
      </text>
    </svg>
  );
}

export default function VisionPage() {
  const pctToNext = (growth.fundUSD / growth.nextGoalUSD) * 100;
  const remaining = Math.max(0, growth.nextGoalUSD - growth.fundUSD);

  // ✅ IME/コピペ事故を避けるため、背景は「ASCIIだけ」で生成
  const gridBg =
    "linear-gradient(to right, rgba(24,24,27,0.14) 1px, transparent 1px), " +
    "linear-gradient(to bottom, rgba(24,24,27,0.14) 1px, transparent 1px)";

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-zinc-50 to-white text-zinc-900">
      {/* subtle grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-[0.08]"
        style={{
          backgroundImage: gridBg,
          backgroundSize: "56px 56px",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-5 py-10 md:py-14">
        {/* top nav */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/lifai.png"
              alt="LIFAI"
              width={40}
              height={40}
              className="rounded-xl ring-1 ring-zinc-200"
              priority
            />
            <div className="leading-tight">
              <div className="text-sm font-semibold">LIFAI</div>
              <div className="text-xs text-zinc-500">AI副業 実践環境</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/5000"
              className="rounded-xl bg-zinc-900 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-zinc-800 active:bg-zinc-900"
            >
              クレジット購入
            </Link>
            <Link
              href="/apply"
              className="rounded-xl bg-white/70 px-4 py-2 text-sm font-semibold ring-1 ring-zinc-200 shadow-sm hover:bg-white"
            >
              参加申請
            </Link>
          </div>
        </div>

        {/* hero */}
        <section className="mt-10 grid gap-8 md:grid-cols-[1.2fr_0.8fr] items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs ring-1 ring-zinc-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-zinc-700">進捗公開中</span>
            </div>

            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
              そのままだと、
              <span className="text-zinc-900">「知ってるだけ」</span>で終わる。
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-600 bg-clip-text text-transparent">
                実際に回せる“副業の実践環境”がないと、伸びない。
              </span>
            </h1>

            <p className="mt-4 text-sm md:text-base text-zinc-600 leading-relaxed">
              情報は増え続けるのに、時間だけが減っていく。
              <br />
              「何をやればいいか分からない」「続かない」「成果が出ない」──その詰まりを、
              <span className="font-semibold text-zinc-800">“体験 → 型 → 実践”</span>でほどきます。
              <br />
              LIFAIは、学習ではなく<span className="font-semibold text-zinc-800">“実行”を積み上げる場所</span>です。
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/70 ring-1 ring-zinc-200 px-3 py-1 text-xs">
                情報だけで終わる不安を解消
              </span>
              <span className="rounded-full bg-white/70 ring-1 ring-zinc-200 px-3 py-1 text-xs">
                “型”があるから迷わない
              </span>
              <span className="rounded-full bg-white/70 ring-1 ring-zinc-200 px-3 py-1 text-xs">
                VPS/GPUで実際に回して前に進む
              </span>
            </div>

          </div>

        </section>
        {/* vision block (inserted) */}
        {/* 🔥 Vision Image Block */}
        <section className="mt-14">
          <div className="rounded-3xl overflow-hidden ring-1 ring-zinc-200 shadow-sm bg-white/70">
            <Image
              src="/thema.png"
              alt="LIFAI Vision"
              width={1600}
              height={700}
              className="w-full h-auto object-cover"
              priority
            />
          </div>

          <div className="mt-10 max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              ただの副業サロンではありません。
            </h2>

            <p className="mt-6 text-base md:text-lg text-zinc-600 leading-relaxed">
              1人の挑戦が、環境を強くし、
              <br />
              環境が強くなるほど、参加者の成果が出やすくなる。
              <br />
              その積み上げが、やがて企業に提供できる基盤になる。
            </p>

            <p className="mt-6 text-sm text-zinc-500">
              ※これは約束ではなく構想です。進捗と共に段階的に公開していきます。
            </p>
          </div>
        </section>


        {/* flow diagram */}
        <section className="mt-12">
          <SectionHeader
            title="体験型も、実践環境も。どう繋がる？"
            desc="LIFAIは“体験して終わり”ではなく、体験をそのまま副業の実践に繋げます。"
          />
          {/* key visual: service */}
          <div className="mt-4 rounded-3xl overflow-hidden ring-1 ring-zinc-200 shadow-sm bg-white/70">
            <Image
              src="/sarvice.png"
              alt="LIFAI service overview"
              width={1600}
              height={900}
              className="w-full h-auto"
            />
          </div>
          <div className="rounded-3xl bg-white/70 ring-1 ring-zinc-200 shadow-sm p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch">
              {flowSteps.map((s, idx) => (
                <div key={s.title} className="contents">
                  <div className="rounded-3xl bg-white/60 ring-1 ring-zinc-200/80 p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-zinc-900 text-white flex items-center justify-center text-lg">
                        {s.icon}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{s.title}</div>
                        <div className="text-xs text-zinc-500">（ここがポイント）</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-zinc-600 leading-relaxed">{s.desc}</div>
                    <ul className="mt-3 space-y-1">
                      {s.points.map((p, i) => (
                        <li key={i} className="text-xs text-zinc-700">
                          ・{p}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {idx < flowSteps.length - 1 ? <ArrowDivider /> : null}
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-sky-50 to-cyan-50 ring-1 ring-zinc-200 p-4">
              <div className="text-sm font-semibold">ここが安心ポイント</div>
              <div className="mt-1 text-sm text-zinc-600">
                「体験」→「型」→「実践」まで道があるので、年齢や経験に関係なく進めます。
                <br />
                難しい言葉より、まず“動くもの”を触る設計です。
              </div>
            </div>
          </div>
        </section>

        {/* 🌱 Credit → インフラ基金 → GPU/AIBOT 還元の橋渡し */}
        <div className="mt-6 rounded-3xl bg-gradient-to-r from-emerald-50 via-sky-50 to-indigo-50 ring-1 ring-zinc-200 shadow-sm p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900">みんなのクレジットが、環境になる。</div>
              <div className="mt-1 text-sm text-zinc-600 leading-relaxed">
                LIFAIのクレジットは「消費して終わり」ではなく、
                <span className="font-semibold text-zinc-800">インフラ基金</span>として積み上がります。
                その基金で<span className="font-semibold text-zinc-800">GPU</span>や<span className="font-semibold text-zinc-800">AIBOT</span>の導入を進め、
                将来的に<span className="font-semibold text-zinc-800">“みんなの実践環境”として還元</span>していきます。
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/80 ring-1 ring-zinc-200 px-3 py-1 text-xs text-zinc-700">
                クレジット
              </span>
              <span className="text-zinc-400">→</span>
              <span className="rounded-full bg-white/80 ring-1 ring-zinc-200 px-3 py-1 text-xs text-zinc-700">
                インフラ基金
              </span>
              <span className="text-zinc-400">→</span>
              <span className="rounded-full bg-white/80 ring-1 ring-zinc-200 px-3 py-1 text-xs text-zinc-700">
                GPU / VPS
              </span>
              <span className="text-zinc-400">→</span>
              <span className="rounded-full bg-white/80 ring-1 ring-zinc-200 px-3 py-1 text-xs text-zinc-700">
                AIBOT
              </span>
              <span className="text-zinc-400">→</span>
              <span className="rounded-full bg-white/80 ring-1 ring-zinc-200 px-3 py-1 text-xs text-zinc-700">
                みんなへ還元
              </span>
            </div>
          </div>

          <div className="mt-4 text-xs text-zinc-500">
            ※配当や金融商品ではなく、体験と実践のための「環境整備」に使います（進捗は段階的に公開）。
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2"></div>



        {/* what you can do */}
        <section className="mt-12">
          <SectionHeader
            title="GPUがあると何ができる？"
            desc="“GPU=難しい”をやめます。要は「重いAIを速く動かせる環境」です。"
          />
          {/* key visual: GPU */}
          <div className="mt-4 rounded-3xl overflow-hidden ring-1 ring-zinc-200 shadow-sm bg-white/70">
            <Image
              src="/gpu.png"
              alt="GPU rendering"
              width={1600}
              height={900}
              className="w-full h-auto"
            />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { t: "画像生成", d: "SNS投稿・商品画像・サムネを高速生成" },
              { t: "動画/素材", d: "短尺向けの生成・編集ワークフローに強い" },
              { t: "自分専用AI", d: "自分の用途に合わせた“専用AI”を育てる" },
              { t: "自動化", d: "定型作業をワークフロー化して副業へ" },
              { t: "アプリ制作", d: "PWA/LP/自動ツールを作って販売" },
              { t: "学び→収益化", d: "学ぶだけで終わらせず“売れる形”へ" },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl bg-white/70 ring-1 ring-zinc-200 shadow-sm p-4">
                <div className="text-sm font-semibold">{x.t}</div>
                <div className="mt-1 text-sm text-zinc-600">{x.d}</div>
              </div>
            ))}
          </div>



          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl bg-white/70 ring-1 ring-zinc-200 shadow-sm p-5">
              <div className="text-sm font-semibold">参加が増えるほど、環境が強くなる（イメージ）</div>
              <div className="mt-2 text-xs text-zinc-500">※これは目安の図です（実際の強化は進捗・コスト・運用状況で調整）</div>
              <div className="mt-4 rounded-2xl bg-white/60 ring-1 ring-zinc-200/80 p-3 text-zinc-800">
                <MiniLineChart points={growthForecast} />
              </div>
            </div>

            <div className="rounded-3xl bg-white/70 ring-1 ring-zinc-200 shadow-sm p-5">
              <div className="text-sm font-semibold">“払った以上の価値”はどう作る？</div>
              <div className="mt-2 text-sm text-zinc-600 leading-relaxed">
                LIFAIは金融ではありません。なので「配当」ではなく、
                <span className="font-semibold">体験価値（無料枠・優遇・イベント・環境拡張）</span>で“価値”を作ります。
              </div>
              <ul className="mt-4 space-y-2">
                {["無料枠の拡張（VPS/GPU）", "全員参加の“無料デー”や解放イベント", "テンプレ/ワークフローの無償公開枠", "環境が強いほど、作れるものが増える（＝副業が進む）"].map((t, i) => (
                  <li key={i} className="text-sm text-zinc-700">
                    ・{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* loop diagram */}
        <section className="mt-12">
          <SectionHeader title="みんなで育つ仕組み（ワクワクの正体）" desc="“参加するほど環境が強くなる”を、わかりやすく1枚にしました。" />
          <div className="rounded-3xl bg-white/70 ring-1 ring-zinc-200 shadow-sm p-5">
            <div className="grid gap-3 md:grid-cols-4">
              {loopItems.map((x) => (
                <div key={x.title} className="rounded-3xl bg-white/60 ring-1 ring-zinc-200/80 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center">{x.icon}</div>
                    <div className="text-sm font-semibold">{x.title}</div>
                  </div>
                  <div className="mt-2 text-sm text-zinc-600">{x.desc}</div>
                </div>
              ))}
            </div>
            {/* key visual: AI assistant concept */}
            <div className="mt-4 rounded-3xl overflow-hidden ring-1 ring-zinc-200 shadow-sm bg-white/70">
              <Image
                src="/aiimage.png"
                alt="AI assistant concept"
                width={1600}
                height={900}
                className="w-full h-auto"
              />
            </div>
            <div className="mt-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-sky-50 to-cyan-50 ring-1 ring-zinc-200 p-4">
              <div className="text-sm font-semibold">ポイント</div>
              <div className="mt-1 text-sm text-zinc-600">
                “環境が強い＝できることが増える” → “副業が進む” → “また参加が増える”。<br />
                この循環を“透明な進捗”で運用します。
              </div>
            </div>
          </div>
        </section>

        {/* milestones */}
        <section className="mt-12">
          <SectionHeader title="集まるほど、何が起きる？" desc="ここが“ワクワク”の中核。達成ラインは段階的に公開します。" />

          <div className="mt-5 grid gap-3">
            {milestones.map((m) => {
              const pct = (growth.fundUSD / m.amountUSD) * 100;
              return (
                <div key={m.amountUSD} className="rounded-3xl bg-white/70 ring-1 ring-zinc-200 shadow-sm p-5">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
                    <div>
                      <div className="text-xs text-zinc-500">目標 ${formatUSD(m.amountUSD)}</div>
                      <div className="text-base font-semibold">{m.title}</div>
                    </div>
                    <div className="text-xs text-zinc-500">進捗 {Math.floor(clamp(pct, 0, 100))}%</div>
                  </div>

                  <div className="mt-3">
                    <ProgressBar valuePct={pct} />
                  </div>

                  <ul className="mt-4 grid gap-2 md:grid-cols-3">
                    {m.bullets.map((b, i) => (
                      <li key={i} className="rounded-2xl bg-white/60 ring-1 ring-zinc-200/80 px-3 py-2 text-sm text-zinc-700">
                        {b}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 text-xs text-zinc-500">※目標は運用状況に応じて調整する場合があります（透明性は維持します）</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ✅ credits economy（ここが壊れてたので section で囲う） */}
        <section className="mt-12">
          <SectionHeader
            title="LIFAIクレジット（アプリ内専用）"
            desc={
              <>
                <span className="font-semibold">{credit.starterUSD}ドル → {credit.starterCredits}クレジット</span>{" "}
                のように “体験ポイント” として使います。
              </>
            }
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl bg-white/70 ring-1 ring-zinc-200 shadow-sm p-5">
              <div className="text-sm font-semibold">使い道の例</div>
              <div className="mt-3 divide-y divide-zinc-200/70">
                {credit.examples.map((e) => (
                  <div key={e.name} className="flex items-center justify-between py-3">
                    <div className="text-sm text-zinc-800">
                      {e.name}
                      <div className="text-xs text-zinc-500">{e.note}</div>
                    </div>
                    <div className="text-sm font-semibold text-zinc-900">{e.cost}クレ</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white/70 ring-1 ring-zinc-200 shadow-sm p-5">
              <div className="text-sm font-semibold">安心のために</div>
              <ul className="mt-3 space-y-2">
                {credit.notes.map((n, i) => (
                  <li key={i} className="text-sm text-zinc-700">・{n}</li>
                ))}
              </ul>

              <div className="mt-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-sky-50 to-cyan-50 ring-1 ring-zinc-200 p-4">
                <div className="text-sm font-semibold">毎日の繰り返しを価値に</div>
                <div className="mt-1 text-sm text-zinc-600">
                  参加無料の「デイリーチャレンジ」や「抽選イベント」で +5クレなど。
                  <br />
                  “作業”ではなく、楽しさと継続の仕掛けにします。
                </div>
              </div>

              <div className="mt-4 text-xs text-zinc-500">※EPやBPの価値は『LIFAIとは』のページをご確認ください。</div>
            </div>
          </div>
        </section>

        {/* concrete earning examples */}
        <section className="mt-12">
          <SectionHeader title="副業って結局、何をするの？（具体例）" desc="年齢問わずイメージできるように、代表的な“収益化の形”を置きます。" />
          <div className="grid gap-3 md:grid-cols-3">
            {earningModels.map((m) => (
              <div key={m.title} className="rounded-3xl bg-white/70 ring-1 ring-zinc-200 shadow-sm p-5">
                <div className="text-sm font-semibold">{m.title}</div>
                <div className="mt-1 text-xs text-zinc-500">{m.target}</div>
                <ol className="mt-4 space-y-2">
                  {m.steps.map((s, i) => (
                    <li key={i} className="text-sm text-zinc-700">
                      <span className="font-semibold">{i + 1}.</span> {s}
                    </li>
                  ))}
                </ol>
                <div className="mt-4 text-xs text-zinc-500">※ {m.note}</div>
              </div>
            ))}
          </div>
        </section>

        {/* roadmap for beginners */}
        <section className="mt-12">
          <SectionHeader title="副業スタートは、3ステップ" desc="年齢関係なく、やることを短くします。" />

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { n: "1", t: "テンプレを選ぶ", d: "note / 自動化 / 生成など、すぐ使える型から開始" },
              { n: "2", t: "環境で動かす", d: "VPS/GPUで“実際に回す”ところまで体験" },
              { n: "3", t: "販売・収益化", d: "ワークフロー販売/受託/外部案件へ繋げる" },
            ].map((s) => (
              <div key={s.n} className="rounded-3xl bg-white/70 ring-1 ring-zinc-200 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-bold">{s.n}</div>
                  <div className="text-sm font-semibold">{s.t}</div>
                </div>
                <div className="mt-3 text-sm text-zinc-600">{s.d}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-white/70 ring-1 ring-zinc-200 shadow-sm p-4">
            <div className="text-sm font-semibold">不安になりやすいポイント（先に潰します）</div>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {[
                { q: "AIが難しそう", a: "体験→型→実践の順で進むのでOK" },
                { q: "何から始める？", a: "まず“テンプレ1本”で体験から" },
                { q: "損しない？", a: "外部換金なし＝トラブルを避けやすい設計" },
              ].map((x) => (
                <div key={x.q} className="rounded-2xl bg-white/60 ring-1 ring-zinc-200/80 p-3">
                  <div className="text-xs text-zinc-500">Q. {x.q}</div>
                  <div className="mt-1 text-sm text-zinc-700">A. {x.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* roadmap timeline */}
        <section className="mt-12">
          <SectionHeader title="これからどうなる？（ロードマップ）" desc="約束ではなく“目標/構想”として公開し、進捗と一緒に更新します。" />

          <div className="rounded-3xl bg-white/70 ring-1 ring-zinc-200 shadow-sm p-5">
            <div className="grid gap-3">
              {roadmap.map((r, idx) => (
                <div key={idx} className="rounded-3xl bg-white/60 ring-1 ring-zinc-200/80 p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-zinc-900 text-white px-3 py-1 text-xs font-semibold">{r.when}</div>
                      <div className="text-sm font-semibold">{r.title}</div>
                    </div>
                    {r.tags?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {r.tags.map((t) => (
                          <span key={t} className="rounded-full bg-white/70 ring-1 ring-zinc-200 px-2 py-0.5 text-xs text-zinc-600">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm text-zinc-600">{r.desc}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-xs text-zinc-500">
              ※「企業向け提供→還元」は、配当のような金融ではなく “体験価値（無料枠/優遇/イベント）” の強化として扱います。
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-12 rounded-3xl bg-zinc-900 text-white p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="text-lg font-bold">まずは “見える化” から。</div>
              <div className="mt-2 text-sm text-white/80">進捗・目標・何が起きるかを公開して、安心して参加できる場所にします。</div>
            </div>
            <div className="flex gap-2">
              <Link href="/5000" className="rounded-xl bg-white text-zinc-900 px-5 py-3 text-sm font-semibold shadow-sm hover:bg-zinc-100">
                クレジット購入へ
              </Link>
              <Link href="/apply" className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold ring-1 ring-white/20 hover:bg-white/15">
                参加申請へ
              </Link>
            </div>
          </div>
        </section>

        <footer className="mt-10 pb-10 text-center text-xs text-zinc-500">© {new Date().getFullYear()} LIFAI</footer>
      </div>
    </main>
  );
}

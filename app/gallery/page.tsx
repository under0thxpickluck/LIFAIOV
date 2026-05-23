import Image from "next/image";
import Link from "next/link";
import GalleryNav from "@/components/GalleryNav";
import WorksShowcase from "./WorksShowcase";

export const metadata = {
  title: "LIFAIでできること｜AI副業サービス一覧・デモ",
  description:
    "LIFAIの全サービスを体験できるギャラリーページ。音楽生成・画像生成・note記事・占いなど、ログイン前にサンプルを確認できます。",
};

const CTA_OUTLINE =
  "mt-7 inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-50";

export default function GalleryPage() {
  return (
    <main id="top" className="min-h-screen bg-neutral-50">
      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-6">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-gradient-to-r from-indigo-500 via-purple-400 to-pink-400" />
          <div className="p-8">
            <div className="mb-8 flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                ← 最初に戻る
              </Link>
              <div className="flex gap-2">
                <Link
                  href="/login"
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  ログイン
                </Link>
                <Link
                  href="/5000"
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-800"
                >
                  参加申請
                </Link>
              </div>
            </div>

            <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
              サービス紹介
            </span>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-900 md:text-4xl">
              LIFAI でできること
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-neutral-500">
              AI×副業のサービスをまとめて確認できる場所です。<br className="hidden md:block" />
              音楽・画像・記事・占い・ゲームなど、全機能のサンプルをここで見られます。
            </p>
          </div>
        </div>
      </section>

      {/* ===== スティッキーナビ ===== */}
      <GalleryNav />

      {/* ===== #music: 音楽生成 ===== */}
      <section id="music" className="mx-auto max-w-5xl px-4 pb-10 pt-4">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-indigo-400" />
          <div className="p-8">
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
              音楽生成
            </span>
            <div className="mt-5 flex flex-col gap-8 md:flex-row md:items-start">
              <div className="flex-1">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                  AIで楽曲を作り、配信・BGMで収益化
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
                  楽器経験ゼロでも、テキストを入力するだけで本格的な楽曲が生成できます。
                  作った楽曲は配信ストアへ登録するか、LIFAI経由でBGM提供として収益化できます。
                </p>
                <ul className="mt-5 space-y-2.5 text-[15px] text-neutral-600">
                  {["テキスト入力だけで曲が完成", "Spotify・Apple Music などへ配信可能", "店舗BGMとして使われるほど収益が積み上がる", "1曲から始められる"].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 text-xs font-bold text-indigo-400">✓</span>
                      {t}
                    </li>
                  ))}
                </ul>
                <Link href="/5000" className={CTA_OUTLINE}>使ってみる →</Link>
              </div>
              <div className="flex w-full shrink-0 items-center justify-center rounded-xl border border-neutral-100 bg-neutral-50 p-6 md:w-52">
                <div className="relative h-28 w-28">
                  <Image src="/lifai/icon/music.png" alt="音楽生成" fill className="object-contain" sizes="112px" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ad-slot-1 */}
      <div className="mx-auto max-w-5xl px-4 pb-4" aria-hidden="true"><div className="h-0 w-full" /></div>

      {/* ===== #bgm: BGM生成 ===== */}
      <section id="bgm" className="mx-auto max-w-5xl px-4 pb-10">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-teal-400" />
          <div className="p-8">
            <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 ring-1 ring-inset ring-teal-200">
              BGM生成
            </span>
            <div className="mt-5 flex flex-col gap-8 md:flex-row md:items-start">
              <div className="flex-1">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                  用途別BGMをワンクリック生成
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
                  「カフェ向けジャズ」「集中作業用ローファイ」など、用途を選ぶだけでBGMが生成できます。
                  ループ再生に最適化された出力なので、そのままお店や動画で使えます。
                </p>
                <ul className="mt-5 space-y-2.5 text-[15px] text-neutral-600">
                  {["カフェ・オフィス・リラックスなど多彩なジャンル", "30秒〜数分の長さを指定可能", "ループ再生に最適化された出力"].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 text-xs font-bold text-teal-400">✓</span>
                      {t}
                    </li>
                  ))}
                </ul>
                <Link href="/5000" className={CTA_OUTLINE}>使ってみる →</Link>
              </div>
              <div className="w-full shrink-0 rounded-xl border border-neutral-100 bg-neutral-50 p-5 md:w-52">
                <p className="mb-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">BGMカテゴリ例</p>
                <div className="flex flex-wrap gap-2">
                  {["カフェBGM", "作業用ローファイ", "リラックス", "アップテンポ", "ジャズ", "クラシック"].map((tag) => (
                    <span key={tag} className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== #image: 画像生成 ===== */}
      <section id="image" className="mx-auto max-w-5xl px-4 pb-10">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-violet-400" />
          <div className="p-8">
            <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-inset ring-violet-200">
              画像生成
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900">
              AIで画像を自由に生成
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
              テキストで説明するだけで、サムネイル・アイキャッチ・バナーなどが生成できます。
              SNS投稿や広告・ストック販売用の素材として活用できます。
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
              {(["/aiimage.png", null, null] as (string | null)[]).map((src, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50">
                  {src ? (
                    <div className="relative h-full w-full">
                      <Image src={src} alt={`AI生成画像サンプル${i + 1}`} fill className="object-cover" sizes="(max-width: 768px) 50vw, 33vw" />
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-neutral-300">サンプル画像</div>
                  )}
                </div>
              ))}
            </div>
            <Link href="/5000" className={CTA_OUTLINE}>使ってみる →</Link>
          </div>
        </div>
      </section>

      {/* ===== #note: note記事生成 ===== */}
      <section id="note" className="mx-auto max-w-5xl px-4 pb-10">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-orange-400" />
          <div className="p-8">
            <span className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 ring-1 ring-inset ring-orange-200">
              note記事生成
            </span>
            <div className="mt-5 flex flex-col gap-8 md:flex-row md:items-start">
              <div className="flex-1">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                  売れるnote記事をAIで自動生成
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
                  テーマを入力するだけで構成・タイトル・本文を自動生成します。
                  そのままnoteに投稿して収益化できます。
                </p>
                <ul className="mt-5 space-y-2.5 text-[15px] text-neutral-600">
                  {["売れやすいタイトル候補を複数提案", "有料・無料パート構成を自動設計", "SNS投稿文も同時生成", "3ステップで完成"].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 text-xs font-bold text-orange-400">✓</span>
                      {t}
                    </li>
                  ))}
                </ul>
                <Link href="/5000" className={CTA_OUTLINE}>使ってみる →</Link>
              </div>
              <div className="w-full shrink-0 rounded-xl border border-neutral-100 bg-neutral-50 p-5 md:w-52">
                <p className="mb-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">生成サンプル</p>
                <div className="rounded-lg border border-neutral-100 bg-white p-4">
                  <p className="text-xs font-bold text-neutral-900 leading-snug">
                    副業で月5万円を達成した私がやった3つのこと
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-neutral-400">
                    会社員でも副業で稼げるの？という疑問に答えます。実際にやってみた方法をステップごとに解説します...
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">★★★★★</span>
                    <span className="text-[10px] text-neutral-400">¥500</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== #fortune: 占い ===== */}
      <section id="fortune" className="mx-auto max-w-5xl px-4 pb-10">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-amber-400" />
          <div className="p-8">
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
              占い
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900">毎日のAI性格診断＆運勢</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
              性格タイプ診断のあと、毎日その日の運勢をAIが提供します。
              占いを見るだけでBPも獲得できるので、ログインのモチベーションにもなります。
            </p>
            <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50/60 p-6">
              <p className="mb-4 text-xs font-semibold text-amber-600 uppercase tracking-wider">サンプル占い結果</p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-neutral-400">今日のテーマ</span>
                  <span className="text-sm font-bold text-neutral-900">直感を大切にする日</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[{ label: "仕事運", stars: "★★★★☆" }, { label: "恋愛運", stars: "★★★☆☆" }, { label: "金運", stars: "★★★★★" }].map(({ label, stars }) => (
                    <div key={label} className="rounded-lg border border-amber-100 bg-white p-3 text-center">
                      <p className="text-xs text-neutral-400">{label}</p>
                      <p className="mt-1 text-xs font-bold text-amber-500">{stars}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 text-xs text-neutral-500">
                  <span>ラッキーカラー: <b className="text-neutral-700">ゴールド</b></span>
                  <span>ラッキーアイテム: <b className="text-neutral-700">手帳</b></span>
                </div>
              </div>
            </div>
            <Link href="/5000" className={CTA_OUTLINE}>使ってみる →</Link>
          </div>
        </div>
      </section>

      {/* ad-slot-2 */}
      <div className="mx-auto max-w-5xl px-4 pb-4" aria-hidden="true"><div className="h-0 w-full" /></div>

      {/* ===== #music-boost: Music Boost ===== */}
      <section id="music-boost" className="mx-auto max-w-5xl px-4 pb-10">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-pink-400" />
          <div className="p-8">
            <span className="inline-flex items-center rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 ring-1 ring-inset ring-pink-200">
              Music Boost
            </span>
            <div className="mt-5 flex flex-col gap-8 md:flex-row md:items-start">
              <div className="flex-1">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                  アーティスト活動を後押しするブースト機能
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
                  楽曲の宣伝・プロモーションをLIFAIがサポートします。
                  ブーストプランを選ぶだけで配信数・露出が増え、アーティストとして認知されやすくなります。
                </p>
                <ul className="mt-5 space-y-2.5 text-[15px] text-neutral-600">
                  {["月額定額のブーストプラン", "アーティスト情報ページの作成", "LIFAI内での優先表示", "楽曲リリースのサポート"].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 text-xs font-bold text-pink-400">✓</span>
                      {t}
                    </li>
                  ))}
                </ul>
                <Link href="/5000" className={CTA_OUTLINE}>使ってみる →</Link>
              </div>
              <div className="w-full shrink-0 rounded-xl border border-pink-100 bg-pink-50/50 p-5 md:w-52">
                <p className="mb-3 text-xs font-semibold text-pink-500 uppercase tracking-wider">ブーストプラン例</p>
                <div className="space-y-2">
                  {[{ name: "ライト", price: "月500BP〜" }, { name: "スタンダード", price: "月1,500BP〜" }, { name: "プレミアム", price: "月3,000BP〜" }].map(({ name, price }) => (
                    <div key={name} className="flex items-center justify-between rounded-lg border border-pink-100 bg-white px-3 py-2.5 text-xs">
                      <span className="font-semibold text-neutral-800">{name}</span>
                      <span className="text-neutral-400">{price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== #games: ミニゲーム ===== */}
      <section id="games" className="mx-auto max-w-5xl px-4 pb-10">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-green-400" />
          <div className="p-8">
            <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700 ring-1 ring-inset ring-green-200">
              ミニゲーム
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900">ポイントを稼ぐミニゲーム</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
              タップゲームで高スコアを出してEPを獲得。バトルロイヤル形式のランブルで上位を目指すとBPも稼げます。
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-green-100 bg-green-50/50 p-5">
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">タップゲーム</p>
                <div className="mt-4 space-y-3 text-sm">
                  {[["ハイスコア", "1,248 pt"], ["ランキング", "3位 / 全体"], ["獲得EP", "+120 EP"]].map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-neutral-400">{label}</span>
                      <span className={`font-bold ${label === "獲得EP" ? "text-green-600" : "text-neutral-800"}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-5">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">ランブル（バトル）</p>
                <div className="mt-4 space-y-3 text-sm">
                  {[["最終順位", "12位 / 128人"], ["バトル結果", "7勝 3敗"], ["獲得BP", "+80 BP"]].map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-neutral-400">{label}</span>
                      <span className={`font-bold ${label === "獲得BP" ? "text-indigo-600" : "text-neutral-800"}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Link href="/5000" className={CTA_OUTLINE}>使ってみる →</Link>
          </div>
        </div>
      </section>

      {/* ad-slot-3 */}
      <div className="mx-auto max-w-5xl px-4 pb-4" aria-hidden="true"><div className="h-0 w-full" /></div>

      {/* ===== #gacha: ガチャ ===== */}
      <section id="gacha" className="mx-auto max-w-5xl px-4 pb-10">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-purple-400" />
          <div className="p-8">
            <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-200">
              ガチャ
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900">デイリーガチャでレアアイテムを獲得</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
              毎日1回無料でガチャが引けます。レアアイテムはBPや特典と交換可能。
              BPを消費することで追加ガチャも引けます。
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
              {[
                { rarity: "スーパーレア", item: "音楽生成チケット×3", color: "from-amber-400 to-orange-500", textColor: "text-white" },
                { rarity: "レア", item: "AIプロンプトパック", color: "from-violet-400 to-purple-600", textColor: "text-white" },
                { rarity: "ノーマル", item: "デイリーBP +50", color: "from-neutral-100 to-neutral-200", textColor: "text-neutral-700" },
              ].map(({ rarity, item, color, textColor }) => (
                <div key={rarity} className={`rounded-xl bg-gradient-to-br ${color} p-5 text-center`}>
                  <p className={`text-[10px] font-bold ${textColor} opacity-70 uppercase tracking-widest`}>{rarity}</p>
                  <p className={`mt-2 text-sm font-bold ${textColor}`}>{item}</p>
                </div>
              ))}
            </div>
            <Link href="/5000" className={CTA_OUTLINE}>使ってみる →</Link>
          </div>
        </div>
      </section>

      {/* ===== #market: マーケット ===== */}
      <section id="market" className="mx-auto max-w-5xl px-4 pb-10">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-blue-400" />
          <div className="p-8">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-200">
              マーケット
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900">メンバー同士でテンプレや情報を売買</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
              自分が作ったnoteテンプレやAIプロンプト集をBPで販売できます。
              他のメンバーの成果物を購入して、自分の副業に活かすことも可能です。
            </p>
            <div className="mt-6 space-y-2.5">
              {[
                { title: "副業で月5万円稼ぐnoteテンプレ集", price: "3,000 BP", seller: "メンバーA", tag: "note" },
                { title: "AIプロンプト集 vol.1（画像生成100選）", price: "1,200 BP", seller: "メンバーB", tag: "画像" },
                { title: "LP制作ワークフロー完全版", price: "2,500 BP", seller: "メンバーC", tag: "制作" },
              ].map(({ title, price, seller, tag }) => (
                <div key={title} className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">{tag}</span>
                      <span className="text-[10px] text-neutral-400">{seller}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-neutral-800">{title}</p>
                  </div>
                  <p className="ml-4 shrink-0 text-sm font-bold text-indigo-600">{price}</p>
                </div>
              ))}
            </div>
            <Link href="/5000" className={CTA_OUTLINE}>使ってみる →</Link>
          </div>
        </div>
      </section>

      {/* ad-slot-4 */}
      <div className="mx-auto max-w-5xl px-4 pb-4" aria-hidden="true"><div className="h-0 w-full" /></div>

      {/* ===== #radio: ラジオ ===== */}
      <section id="radio" className="mx-auto max-w-5xl px-4 pb-10">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-rose-400" />
          <div className="p-8">
            <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-200">
              ラジオ
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900">LIFAI公式ラジオ</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
              AI副業の最新情報や成功事例をラジオ形式で発信しています。
              移動中でも学べるコンテンツを定期配信中です。
            </p>
            <div className="mt-6 space-y-2.5">
              {[
                { ep: "ep.15", title: "2025年のAI副業トレンド完全解説", duration: "23:14" },
                { ep: "ep.14", title: "月10万円達成メンバーのリアルな話", duration: "18:42" },
                { ep: "ep.13", title: "初心者がやりがちな3つのミスと対策", duration: "15:30" },
              ].map(({ ep, title, duration }) => (
                <div key={ep} className="flex items-center gap-4 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500 text-xs">▶</div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">{ep}</p>
                    <p className="mt-0.5 text-sm font-semibold text-neutral-800">{title}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-neutral-400">{duration}</span>
                </div>
              ))}
            </div>
            <Link href="/5000" className={CTA_OUTLINE}>使ってみる →</Link>
          </div>
        </div>
      </section>

      {/* ===== #lifaneko: LIFAネコ + ギフト ===== */}
      <section id="lifaneko" className="mx-auto max-w-5xl px-4 pb-10">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-cyan-400" />
          <div className="p-8">
            <span className="inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700 ring-1 ring-inset ring-cyan-200">
              LIFAネコ＋ギフト
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900">LIFAネコ＆ギフト機能</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
              AIキャラクター「LIFAネコ」がサロン内をガイドしてくれます。
              メンバー間でBP/EPを贈り合うギフト機能も楽しめます。
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="flex gap-4 rounded-xl border border-cyan-100 bg-cyan-50/50 p-5">
                <div className="relative h-14 w-14 shrink-0">
                  <Image src="/aibot/cat_normal.png" alt="LIFAネコ" fill className="object-contain" sizes="56px" />
                </div>
                <div className="relative flex-1 rounded-xl border border-neutral-100 bg-white p-3">
                  <p className="text-xs leading-5 text-neutral-600">
                    今日も副業がんばろうにゃ！<br />
                    ログインボーナスを忘れずに！
                  </p>
                  <div className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 border-b border-l border-neutral-100 bg-white" />
                </div>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-5">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">ギフト機能</p>
                <p className="text-[15px] leading-relaxed text-neutral-600">
                  BP・EPをメンバーに贈ることができます。感謝の気持ちをポイントで表現しましょう。
                </p>
                <div className="mt-4 flex gap-2">
                  <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">BP を贈る</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">EP を贈る</span>
                </div>
              </div>
            </div>
            <Link href="/5000" className={CTA_OUTLINE}>使ってみる →</Link>
          </div>
        </div>
      </section>

      {/* ===== #works: AI作品ショーケース ===== */}
      <section id="works" className="mx-auto max-w-5xl px-4 pb-10">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <div className="h-[3px] bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />
          <div className="p-8">
            <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-200">
              AI作品ショーケース
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">
              LIFAIで実際に作った作品
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
              音楽・画像・記事など、LIFAIで生成した作品を公開しています。
              プロンプトや生成条件もあわせて掲載しているので、すぐに試せます。
            </p>
            <div className="mt-6">
              <WorksShowcase />
            </div>
          </div>
        </div>
      </section>

      {/* ===== フッター CTA ===== */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm text-center">
          <div className="h-[3px] bg-gradient-to-r from-indigo-500 via-purple-400 to-pink-400" />
          <div className="p-10">
            <h2 className="text-2xl font-black tracking-tight text-neutral-900">
              LIFAIに参加して、体験してみよう
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
              全機能はメンバー限定です。まずは参加申請から始めてください。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/5000"
                className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
              >
                参加申請（権利購入）
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                すでにIDをお持ちの方
              </Link>
              <Link
                href="#top"
                className="inline-flex items-center justify-center rounded-xl border border-neutral-100 bg-white px-6 py-3 text-sm font-medium text-neutral-400 transition hover:bg-neutral-50"
              >
                ページ上部へ ↑
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-neutral-400">
          © {new Date().getFullYear()} LIFAI
        </div>
      </footer>
    </main>
  );
}

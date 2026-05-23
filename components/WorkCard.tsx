import Image from "next/image";
import Link from "next/link";
import type { Work } from "@/data/works";

type Props = {
  work: Work;
  variant?: "gallery" | "featured";
};

const TAB_COLOR: Record<Work["tab"], string> = {
  music:   "bg-indigo-50 text-indigo-700 ring-indigo-200",
  image:   "bg-violet-50 text-violet-700 ring-violet-200",
  article: "bg-orange-50 text-orange-700 ring-orange-200",
};

export default function WorkCard({ work, variant = "gallery" }: Props) {
  const badgeColor = TAB_COLOR[work.tab];

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
      {/* プレビュー */}
      <div className="relative">
        {work.preview.type === "audio" && (
          <div className="flex flex-col items-center justify-center gap-3 bg-neutral-50 px-4 py-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-2xl">
              🎵
            </div>
            {work.preview.src ? (
              <audio controls src={work.preview.src} className="w-full max-w-xs" />
            ) : (
              <p className="text-xs text-neutral-400">音源準備中</p>
            )}
          </div>
        )}

        {work.preview.type === "image" && (
          <div className="relative aspect-video w-full overflow-hidden bg-neutral-100">
            {work.preview.src ? (
              <Image
                src={work.preview.src}
                alt={work.preview.alt ?? work.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-neutral-300">
                画像準備中
              </div>
            )}
          </div>
        )}

        {work.preview.type === "text" && (
          <div className="bg-neutral-50 px-5 py-4">
            <p className="line-clamp-3 text-sm leading-relaxed text-neutral-600">
              {work.preview.excerpt}
            </p>
          </div>
        )}
      </div>

      {/* コンテンツ */}
      <div className="flex flex-1 flex-col p-5">
        <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${badgeColor}`}>
          {work.category}
        </span>

        <h3 className="mt-2 text-base font-bold leading-snug text-neutral-900">
          {work.title}
        </h3>

        <p className="mt-2 text-[13px] leading-relaxed text-neutral-500 line-clamp-3">
          {work.description}
        </p>

        {/* 生成条件 */}
        <div className="mt-3 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2">
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            📝 生成条件
          </p>
          <p className="text-xs text-neutral-600 line-clamp-2">{work.prompt}</p>
        </div>

        {/* 用途タグ */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {work.useCases.map(tag => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-4 flex gap-2">
          <Link
            href={`/works/${work.slug}`}
            className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-center text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            詳しく見る →
          </Link>
          <Link
            href="/5000"
            className="flex-1 rounded-xl bg-neutral-900 px-3 py-2 text-center text-xs font-bold text-white transition hover:bg-neutral-800"
          >
            この作品を作る
          </Link>
        </div>
      </div>
    </div>
  );
}

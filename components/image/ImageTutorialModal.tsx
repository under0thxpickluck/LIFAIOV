"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    title: "チャットで伝えよう",
    content: (
      <div className="space-y-3 text-sm text-[#A8B3CF]">
        <p>左のチャット欄に、どんな画像が欲しいかを自然な言葉で書いてください。</p>
        <ul className="space-y-1.5 list-none">
          <li className="flex items-start gap-2"><span className="text-[#7C5CFF] mt-0.5">●</span><span><strong className="text-[#EAF0FF]">キャラクター</strong>：髪色・服装・表情など</span></li>
          <li className="flex items-start gap-2"><span className="text-[#7C5CFF] mt-0.5">●</span><span><strong className="text-[#EAF0FF]">背景・場所</strong>：海辺・夕暮れ・室内など</span></li>
          <li className="flex items-start gap-2"><span className="text-[#7C5CFF] mt-0.5">●</span><span><strong className="text-[#EAF0FF]">雰囲気・スタイル</strong>：アニメ風・リアル・水彩など</span></li>
        </ul>
        <p>AIが質問で詳細を引き出してくれるので、思いつくままに話しかけてOKです。</p>
      </div>
    ),
  },
  {
    title: "具体的な入力例",
    content: (
      <div className="space-y-4 text-sm">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <p className="mb-1 text-xs font-bold text-emerald-400">良い例 ✓</p>
          <p className="text-[#EAF0FF]">「夕暮れの海辺に立つ黒髪の女性、白いワンピース、アニメ風、柔らかい光」</p>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="mb-1 text-xs font-bold text-red-400">悪い例 ✗</p>
          <p className="text-[#EAF0FF]">「女の人」</p>
          <p className="mt-1 text-xs text-[#A8B3CF]">情報が少なすぎると、意図と違う画像が生成されます。</p>
        </div>
        <p className="text-xs text-[#A8B3CF]">具体的であるほど、理想に近い画像が生成されます。</p>
      </div>
    ),
  },
  {
    title: "生成ボタンを押そう",
    content: (
      <div className="space-y-3 text-sm text-[#A8B3CF]">
        <p>チャットでイメージが固まったら、右側の <strong className="text-[#7C5CFF]">生成ボタン</strong> を押してください。</p>
        <div className="rounded-xl border border-white/10 bg-[#0B1220] p-3 space-y-2">
          <p className="flex items-center gap-2"><span className="text-[#7C5CFF]">①</span> チャットで画像の内容を伝える</p>
          <p className="flex items-center gap-2"><span className="text-[#7C5CFF]">②</span> コスト確認ボックスでBP消費量をチェック</p>
          <p className="flex items-center gap-2"><span className="text-[#7C5CFF]">③</span> 生成ボタンを押して画像を生成</p>
        </div>
        <p className="text-xs">生成にはBPが消費されます。残高は画面右上で確認できます。</p>
      </div>
    ),
  },
];

export default function ImageTutorialModal({ open, onClose }: Props) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  function handleClose() {
    setStep(0);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1a2e] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[#EAF0FF]">
            {STEPS[step].title}
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-[#A8B3CF] transition hover:bg-white/10 hover:text-[#EAF0FF]"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* コンテンツ */}
        <div className="mb-6 min-h-[160px]">{STEPS[step].content}</div>

        {/* ドットインジケーター */}
        <div className="mb-5 flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition ${
                i === step ? "bg-[#7C5CFF]" : "bg-white/20"
              }`}
            />
          ))}
        </div>

        {/* ナビゲーションボタン */}
        <div className="flex gap-2">
          {!isFirst && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-xl border border-white/10 bg-transparent py-2.5 text-sm font-semibold text-[#A8B3CF] transition hover:bg-white/10 hover:text-[#EAF0FF]"
            >
              ◀ 前へ
            </button>
          )}
          {isLast ? (
            <button
              onClick={handleClose}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#7C5CFF] to-[#3AA0FF] py-2.5 text-sm font-bold text-white transition hover:opacity-90"
            >
              閉じる
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#7C5CFF] to-[#3AA0FF] py-2.5 text-sm font-bold text-white transition hover:opacity-90"
            >
              次へ ▶
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

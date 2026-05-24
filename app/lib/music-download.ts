"use client";

/**
 * 音声ファイルをダウンロード
 * プロキシ URL を <a download> でクリックするだけ。
 * ファイルを事前にメモリへ読み込まないため遅延なし。
 * iOS Safari 13+ は同一オリジン URL の download 属性に対応しており
 * Content-Disposition: attachment を返すプロキシ経由でファイルに保存される。
 */
export async function shareOrDownloadAudio(
  url: string,
  filename: string
): Promise<void> {
  const proxyUrl =
    `/api/music/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;

  const a = document.createElement("a");
  a.href = proxyUrl;
  a.download = filename;
  // target="_blank" で新しいタブを開き、現在ページの履歴を保持する
  // （モバイルブラウザでダウンロード後に戻るボタンが消える問題を防ぐ）
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  const target = document.body ?? document.documentElement;
  target.appendChild(a);
  a.click();
  target.removeChild(a);
}

/**
 * 歌詞テキストをダウンロード / シェア
 * UTF-8 BOM を先頭に付与（Android テキストアプリの文字化け対策）
 */
export async function shareOrDownloadText(
  text: string,
  filename: string
): Promise<void> {
  const blob = new Blob(["﻿" + text], { type: "text/plain;charset=utf-8" });

  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      const file = new File([blob], filename, { type: "text/plain" });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file] } as any);
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  const target = document.body ?? document.documentElement;
  target.appendChild(a);
  a.click();
  target.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

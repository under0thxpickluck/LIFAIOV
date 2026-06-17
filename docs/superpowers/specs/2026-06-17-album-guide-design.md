# アルバムガイドページ 設計ドキュメント

**作成日:** 2026-06-17  
**ステータス:** 承認済み

---

## 概要

LIFAIで音楽を生成したユーザーが、narasu配信申請（特に代理申請代行フロー）に必要なアルバム情報を準備できるよう手順を解説する隠しページ。

---

## 要件

- **パス:** `/album-guide`
- **ファイル:** `app/album-guide/page.tsx`（新規作成）
- **アクセス:** URLを直接知っている人のみ（ナビ・他ページからのリンクなし）
- **スタイル:** ライト系（`bg-slate-50 text-slate-900`）— `/narasu-agency/terms` と同系統
- **フォーマット:** ステップ形式（Step 1〜5）

---

## ページ構成

### ヘッダー
- タイトル: 「アルバムの作り方」
- サブテキスト: 「narasu配信申請に必要な準備をステップで確認」

### ステップカード × 5枚

スタイル: `rounded-3xl border border-slate-200 bg-white p-6 shadow-sm`

#### Step 1 — アーティスト名を決める
- 日本語・カタカナ・英語（アルファベット）の3表記が必要な理由
- 各表記の例（例: 山田太郎 / ヤマダ タロウ / Taro Yamada）
- 既存アーティストとの重複を避けるための確認方法（narasu検索、Google検索）
- narasu代行フォームの対応フィールド: `artistName / artistNameKana / artistNameAlpha`

#### Step 2 — アルバム名を決める
- 命名パターン例:
  - テーマ型: 「夜明けの詩」「DAWN」
  - 感情型: 「静寂」「Silence」
  - 造語型: 「ルミネシア」「Luminecia」
- 3表記（日本語・カタカナ・英語）の注意点
- シングルの場合は楽曲タイトルをそのまま使ってもよい
- narasu代行フォームの対応フィールド: `albumName / albumNameKana / albumNameAlpha`

#### Step 3 — 収録曲を揃える
- 曲数の目安:
  - シングル: 1〜2曲
  - EP: 3〜5曲
  - アルバム: 6曲以上
- LIFAIで生成した音源のURLを確認する方法（生成完了後に表示されるURLをコピー）
- 楽曲タイトルの決め方
- narasu代行フォームの対応フィールド: `audioUrls`（URL + タイトル）

#### Step 4 — ジャケット画像を作る
- **規格（重要）:** 3000×3000px以上、JPGまたはPNG形式
- 無料ツール紹介:
  - Canva（テンプレート豊富、初心者向け）
  - Adobe Express（高品質、シンプルな操作）
- デザインのポイント: 文字は読みやすく、白抜き文字を使う場合はコントラストに注意
- 著作権の注意: 使用素材が商業利用可能であることを確認
- 画像をURLで提出する場合の方法（Googleドライブなどで共有リンクを取得）
- narasu代行フォームの対応フィールド: `jacketImageUrl / jacketNote`

#### Step 5 — 申請前の最終チェック
narasu代行フォームに必要な全項目チェックリスト:

| 項目 | フォームフィールド | 備考 |
|------|-----------------|------|
| narasuアカウントID | `narasuLoginId` | 事前にnarasu登録が必要 |
| narasuパスワード | `narasuPassword` | 代行申請後に変更推奨 |
| 楽曲URL（1曲以上） | `audioUrls` | LIFAIで生成した音源URL |
| 楽曲タイトル | `audioUrls[].title` | 各曲のタイトル |
| アーティスト名（日） | `artistName` | Step 1 で決めたもの |
| アーティスト名（カナ） | `artistNameKana` | Step 1 で決めたもの |
| アーティスト名（英） | `artistNameAlpha` | Step 1 で決めたもの |
| アルバム名（日） | `albumName` | Step 2 で決めたもの |
| アルバム名（カナ） | `albumNameKana` | Step 2 で決めたもの |
| アルバム名（英） | `albumNameAlpha` | Step 2 で決めたもの |
| ジャケット画像URL | `jacketImageUrl` | Step 4 で作成したもの |
| 歌詞（任意） | `lyricsText` | 任意入力 |

### フッター
- `← narasu代理申請に戻る` → `/narasu-agency` へのリンク
- `text-slate-400 text-sm text-center`

---

## 注意事項（narasu代行規約より）

- 申請楽曲について著作権・原盤権を保有していること
- narasuによる審査結果は保証されない
- アカウント情報は代行業務完了後に削除される

---

## 実装スコープ

- `app/album-guide/page.tsx` 1ファイルのみ新規作成
- `"use client"` は不要（静的コンテンツのみ）
- 既存ページへの変更なし

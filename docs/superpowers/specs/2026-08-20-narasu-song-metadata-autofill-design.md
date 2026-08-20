# narasu代理申請 管理画面: 曲名・歌詞の自動取得 設計書

作成日: 2026-08-20

## 背景

管理画面 `/admin/narasu` の楽曲リストで、曲名が「（曲名未入力）」と表示され、音源URLだけが並ぶ申請が多い。

```
10
（曲名未入力）

曲名
https://pub-331d6c8cbdd7478192f432436d19f29f.r2.dev/songs/song_20260814_IUTKJ4/final.wav
```

この音源URLは LIFAI の音楽生成機能が出力したものであり、生成時には曲名と歌詞も同時に作られてスプレッドシートに保存されている。代理申請のたびに管理者が別シートを手で探す必要がない状態にする。

## 現状の調査結果

### 必要なデータは既にスプレッドシートにある

`music_history` シート（`gas/Code.gs` の `getMusicHistorySheet_`）が音楽生成のたびに次を保存している。

```
id | user_id | job_id | title | audio_url | download_url | lyrics | created_at | expires_at
```

**曲名（`title`）も歌詞（`lyrics`）も両方保存されている。** URL に含まれる `song_20260814_IUTKJ4` の部分が楽曲の一意キーになる。

### 逆引きの仕組みは一部だけ既に存在する

`app/api/narasu-agency/resolve-title/route.ts` が `music_history_list` を呼び、URL から曲名を解決している。申請フォーム `app/narasu-agency/form/page.tsx` が URL 入力時にこれを叩いて曲名欄を自動補完する。

現状の制約は3つ。

1. **曲名のみ**で歌詞は取得していない
2. **フォーム入力時のみ**動くため、既に提出済みの申請は空欄のまま
3. `loginId` 必須のため、`narasu_agency.login_id` と `music_history.user_id` がズレている申請では引けない

### 期限切れの扱い

`musicHistoryList_` は `expires_at`（生成から31日）を過ぎた行を除外する。ただし **`music_history` の行そのものは削除されない**（`gas/Code.gs` の music_history 関連コードに `deleteRow` は存在しない）。したがって除外ロジックを通さずに直接シートを読めば、31日を過ぎた楽曲でも曲名・歌詞を取得できる。

### narasu_agency 側の関連列

| 列 | 内容 |
|---|---|
| `audio_urls` | 音源URL（改行区切りの1セル） |
| `audio_titles` | 曲名（改行区切りの1セル） |
| `audio_lyrics` | 曲別歌詞（`\n---\n` 区切りの1セル） |
| `lyrics_text` | 共通歌詞 |
| `login_id` | 申請者の LIFAI ログインID |

## 決定事項

| 論点 | 決定 |
|---|---|
| 取得タイミング | 管理画面を開くたびに GAS 側で自動解決する |
| スプレッドシートへの書き込み | **一切しない**（読み取り専用） |
| 手入力がある場合 | 申請者の入力を優先し、**空欄のときだけ**補う |
| 期限切れ楽曲 | **拾う**（`expires_at` を無視する） |
| 照合キー | URL 全体一致ではなく songId |
| `login_id` によるスコープ | **かけない** |

## 設計

### データフロー

```
/admin/narasu を開く
  → GET /api/admin/narasu-agency（変更なし）
    → GAS narasu_agency_list
        ① narasu_agency 全行を読む（現状どおり）
        ② music_history 全行を読み、songId → { title, lyrics, createdAt } の対応表を作る
           ・audio_url / download_url から songId を抽出
           ・expires_at は無視する
           ・同一 songId が複数あれば created_at が新しい方を採用
        ③ 各行の audio_urls を改行分割し、URL ごとに songId で対応表を引く
        ④ 曲名が空なら title を、歌詞が空なら lyrics を補う
        ⑤ 値の出所を付けて返す
```

対応表の構築は1リクエストにつき1回だけ行う。楽曲数が増えてもシート読み込みは1回で済む。

### 照合ルール

- **キーは songId**（`song_` に続く英数字とアンダースコア）。正規表現は既存の `resolve-title` と同じ `/song_[A-Z0-9_]+/i` を使う。`final.wav` とダウンロード用でパスが違っても同じ曲として一致する。
- **`login_id` によるスコープはかけない。** songId が一意なので不要であり、スコープをかけると `narasu_agency.login_id` と `music_history.user_id` がズレている申請で引けなくなる。フォーム側の `resolve-title` が取りこぼしている分も、管理画面では拾えるようになる。
- 同一 songId が複数行あれば `created_at` が最新の行を採用する。

### 曲名・歌詞の優先順位

「空欄かどうか」の判定対象を明示する。トリム後に空文字なら空欄とみなす。

**曲名** — `audio_titles` を改行分割した i 番目

1. `audio_titles[i]` が非空 → それを使う（`titleSource: "form"`）
2. 空 かつ 対応表にヒット → `music_history.title`（`titleSource: "history"`）
3. どちらも無い → 空文字（`titleSource: "none"`）

**歌詞** — `audio_lyrics` を `\n---\n` 分割した i 番目

1. `audio_lyrics[i]` が非空 → それを使う（`lyricsSource: "form"`）
2. 空 かつ 対応表にヒット → `music_history.lyrics`（`lyricsSource: "history"`）
3. どちらも無い → 空文字（`lyricsSource: "none"`）

共通歌詞 `lyrics_text` は `_resolved_tracks` の判定には**使わない**。既存どおり行レベルの値として返し、画面側が `lyricsSource: "none"` のトラックに対してのみ「共通歌詞を参照」の注意書きとともに表示する。曲別歌詞と共通歌詞を混ぜると、どちらを見て申請すべきか管理者が判断できなくなるため。

### 返却フォーマット

**既存のキーは一切変更しない。** 追加のみなので画面側は段階的に対応できる。

```json
{
  "ok": true,
  "requests": [
    {
      "...既存の列すべて...": "...",
      "_resolved_tracks": [
        {
          "url": "https://pub-....r2.dev/songs/song_20260814_IUTKJ4/final.wav",
          "songId": "song_20260814_IUTKJ4",
          "title": "曲名",
          "titleSource": "history",
          "lyrics": "歌詞…",
          "lyricsSource": "form"
        }
      ]
    }
  ]
}
```

`titleSource` / `lyricsSource` は3値をとる。

| 値 | 意味 |
|---|---|
| `form` | 申請者が入力した値を採用した |
| `history` | `music_history` から自動取得した |
| `none` | どちらにも無かった |

`_resolved_tracks` の要素順は `audio_urls` の並び順と一致させる。

### 画面

`app/admin/narasu/page.tsx` は `_resolved_tracks` を使って楽曲リストを描画する。`titleSource` / `lyricsSource` が `history` の値には「自動取得」バッジを添え、申請者が書いた内容と区別できるようにする。`（曲名未入力）` は `titleSource` が `none` のときだけ表示する。

### エラー処理

一覧表示を壊さないことを最優先にする。

- `music_history` シートが存在しない → 対応表は空、全トラックが `none`、一覧は現状どおり返る
- 解決処理全体を try/catch で囲む。失敗しても `_resolved_tracks` を空にして一覧は必ず返す
- songId が抽出できない URL（手入力の外部URLなど）→ そのトラックだけ `none`
- `audio_urls` が空 → `_resolved_tracks` は空配列
- **配列長の不一致** → `_resolved_tracks` の件数は常に `audio_urls` の件数に合わせる。`audio_titles` / `audio_lyrics` が足りない場合、不足分は空欄として扱う（＝自動取得の対象になる）。多い場合は余りを捨てる。過去の申請は曲名・歌詞列が保存されていない行があるため、この不一致は日常的に起こる

### 変更するもの・変更しないもの

| ファイル | 変更内容 |
|---|---|
| `gas/Code.gs` | `narasu_agency_list` に解決処理を追加。ヘルパー `buildSongMetaMap_()` を新規追加 |
| `app/admin/narasu/page.tsx` | `_resolved_tracks` を使った表示と「自動取得」バッジ |
| `app/api/admin/narasu-agency/route.ts` | 変更なし（GAS の返り値をそのまま通す） |

**変更しないもの:**

- `musicHistoryList_` / `musicHistorySave_`（ユーザー向けの31日期限の挙動はそのまま）
- `app/api/narasu-agency/resolve-title/route.ts` と申請フォームの挙動
- `narasu_agency_submit` の `appendRow` 列順
- `narasu_agency` シートの内容（書き込みを一切しないため）

## 検証

`gas/Code.gs` の ADMIN_SECRET 修正時に作った Node スタブハーネスを拡張する。GAS のグローバルをスタブし、`music_history` と `narasu_agency` のスタブシートを与えて稼働中の `doPost` を直接呼ぶ。

| # | ケース | 期待結果 |
|---|---|---|
| 1 | 曲名・歌詞が空欄の申請 | `music_history` の値で埋まり、source が `history` |
| 2 | 申請者が曲名を手入力済み | 手入力値が保持され、source が `form` |
| 3 | 生成から31日超の楽曲 | 期限切れでも取得できる |
| 4 | songId が取れないURL | source が `none`、他トラックには影響しない |
| 5 | `music_history` シートが無い | 全トラック `none`、一覧は正常に返る |
| 6 | 同一 songId が複数行 | `created_at` が最新の行が採用される |
| 7 | 既存キー | `_resolved_tracks` 追加後も既存の列キーが欠落しない |
| 8 | 曲別歌詞が空・共通歌詞あり | `lyricsSource` が `none` になり、共通歌詞は混入しない |
| 9 | URL 3件・曲名1件 | `_resolved_tracks` が3件返り、2件目以降が自動取得される |

## スコープ外

- `narasu_agency` シートへの書き戻し（バックフィル）
- 申請フォーム側での歌詞の自動補完
- `music_history` の期限（31日）そのものの見直し

# narasu代理申請 曲名・歌詞 自動取得 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面 `/admin/narasu` で「（曲名未入力）」になっている楽曲の曲名・歌詞を、`music_history` シートから songId で逆引きして表示時に自動補完する。

**Architecture:** GAS の `narasu_agency_list` が一覧を返す際、`music_history` を1回だけ読んで songId → {title, lyrics} の対応表を作り、各申請の音源URLから逆引きする。空欄のときだけ補い、スプレッドシートへの書き込みは一切しない。結果は既存キーを保ったまま `_resolved_tracks` として追加で返す。

**Tech Stack:** Google Apps Script (ES5互換の書き方), Next.js 14 App Router, TypeScript, Jest（`jest-environment-node`）, Node の `vm` モジュールで GAS をサンドボックス実行

**設計書:** `docs/superpowers/specs/2026-08-20-narasu-song-metadata-autofill-design.md`

## Global Constraints

- `music_history` シートへの**書き込みを一切行わない**。`getMusicHistorySheet_()` は存在しないシートを `insertSheet` で作ってしまうため、**絶対に使わない**。`getSheetByName("music_history")` を直接使い、`null` なら空の対応表を返す。
- `narasu_agency` シートへの書き込みも行わない（この機能は読み取り専用）。
- 以下は**変更禁止**: `musicHistoryList_`、`musicHistorySave_`、`getMusicHistorySheet_`、`app/api/narasu-agency/resolve-title/route.ts`、申請フォーム `app/narasu-agency/form/page.tsx`、`narasu_agency_submit` の `appendRow` 列順。
- `narasu_agency_list` の返却JSONから**既存キーを削除・改名しない**。追加のみ。
- `gas/Code.gs` の変更は**稼働中の `doPost`（3つ目の定義、8291行目付近）**に対して行う。1つ目・2つ目の `doPost` は死んでいる。
- 稼働中 `doPost` のスコープに `ADMIN_SECRET` は存在しない。必要なら `getSecrets_().ADMIN_SECRET` を使う。
- GAS は ES5 相当で書く（`var`、`function`、テンプレートリテラルや arrow を新規に持ち込まない）。既存の `str_()` ヘルパーを使う。
- `app/api/admin/narasu-agency/route.ts` は**変更しない**。
- この機能は管理者専用でユーザーには見えないため、`data/notices.ts` へのお知らせ追加は**不要**。
- **テストコマンドは必ずファイル指定で実行する。** `npm test` は `.worktrees/bunpai-affiliate`（別プロジェクトのworktree）まで拾い、そこに3件の既存失敗がある。この計画の成否とは無関係。

## File Structure

| ファイル | 責務 | 種別 |
|---|---|---|
| `__tests__/helpers/gasSandbox.ts` | GAS のグローバルをスタブして `gas/Code.gs` を Node の `vm` で実行し、`doPost` を呼べるようにする | 新規 |
| `__tests__/narasuResolveTracks.test.ts` | `narasu_agency_list` の曲名・歌詞解決の振る舞いを検証 | 新規 |
| `gas/Code.gs` | `extractSongId_()` / `buildSongMetaMap_()` / `resolveNarasuTracks_()` を追加し、`narasu_agency_list` に組み込む | 変更 |
| `app/admin/narasu/page.tsx` | `_resolved_tracks` を使った表示と「自動取得」バッジ | 変更 |

`__tests__/helpers/` はテストファイルではないため Jest の `testMatch`（`**/__tests__/**/*.test.ts`）に拾われない。

---

### Task 1: GAS サンドボックスと songId 逆引きマップ

**Files:**
- Create: `__tests__/helpers/gasSandbox.ts`
- Create: `__tests__/narasuResolveTracks.test.ts`
- Modify: `gas/Code.gs`（`narasu_agency_list` ブロックの直前、8525行目付近に追記）

**Interfaces:**
- Produces: `createGasSandbox(options)` → `{ doPost, sheets }`。Task 2・3 のテストが使う。
- Produces: GAS 側 `extractSongId_(url) -> string`（見つからなければ `""`）
- Produces: GAS 側 `buildSongMetaMap_() -> { [songId]: { title: string, lyrics: string, createdAt: string } }`

- [ ] **Step 1: テスト用サンドボックスヘルパーを作る**

`__tests__/helpers/gasSandbox.ts` を新規作成:

```ts
import fs from "fs";
import path from "path";
import vm from "vm";

export type SheetRows = unknown[][];

export type SandboxOptions = {
  /** シート名 → 2次元配列（1行目がヘッダー）。ここに無いシート名は存在しない扱い */
  sheets?: Record<string, SheetRows>;
  /** スクリプトプロパティ ADMIN_SECRET の値 */
  adminSecret?: string;
};

export type GasSandbox = {
  /** doPost を呼び、パース済みのJSONを返す */
  doPost: (body: Record<string, unknown>) => any;
  /** 呼び出し後のシート状態（書き込みが起きていないかの検証に使う） */
  sheets: Record<string, SheetRows>;
  /** insertSheet が呼ばれたシート名（読み取り専用の検証に使う） */
  insertedSheets: string[];
};

function makeSheet(rows: SheetRows) {
  return {
    getDataRange: () => ({ getValues: () => rows.map((r) => [...r]) }),
    getLastColumn: () => (rows[0] ? rows[0].length : 0),
    getLastRow: () => rows.length,
    getName: () => "stub",
    appendRow: (r: unknown[]) => {
      rows.push([...r]);
    },
    getRange: (row: number, col: number, _numRows?: number, numCols?: number) => ({
      getValues: () => [(rows[row - 1] ?? []).slice(col - 1, col - 1 + (numCols ?? 1))],
      setValue: (v: unknown) => {
        while (rows.length < row) rows.push([]);
        rows[row - 1][col - 1] = v;
      },
    }),
  };
}

export function createGasSandbox(options: SandboxOptions = {}): GasSandbox {
  const sheets: Record<string, SheetRows> = {};
  for (const [name, rows] of Object.entries(options.sheets ?? {})) {
    sheets[name] = rows.map((r) => [...r]);
  }
  const insertedSheets: string[] = [];
  const adminSecret = options.adminSecret ?? "TEST_ADMIN_SECRET";

  const sandbox: Record<string, unknown> = {
    console,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => (k === "ADMIN_SECRET" ? adminSecret : "TEST_SECRET"),
      }),
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name: string) => (sheets[name] ? makeSheet(sheets[name]) : null),
        insertSheet: (name: string) => {
          insertedSheets.push(name);
          sheets[name] = [];
          return makeSheet(sheets[name]);
        },
        getName: () => "stub-spreadsheet",
        getId: () => "stub-id",
        getUrl: () => "https://example.invalid/stub",
      }),
      flush: () => {},
    },
    Logger: { log: () => {} },
    ContentService: {
      createTextOutput: (t: string) => ({ setMimeType: () => ({ __text: t }) }),
      MimeType: { JSON: "application/json" },
    },
    Utilities: {
      getUuid: () => "stub-uuid",
      computeHmacSha256Signature: () => [1, 2, 3],
      formatDate: () => "2026-08-20",
      sleep: () => {},
    },
    MailApp: { sendEmail: () => {} },
    UrlFetchApp: { fetch: () => ({ getContentText: () => "{}" }) },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }),
    },
    Session: { getScriptTimeZone: () => "Asia/Tokyo" },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({}) },
  };

  vm.createContext(sandbox);
  const src = fs.readFileSync(path.resolve(process.cwd(), "gas/Code.gs"), "utf8");
  vm.runInContext(src, sandbox, { filename: "Code.gs" });

  return {
    doPost: (body: Record<string, unknown>) => {
      const out = (sandbox as any).doPost({ postData: { contents: JSON.stringify(body) } });
      return JSON.parse(out.__text);
    },
    sheets,
    insertedSheets,
  };
}
```

- [ ] **Step 2: 失敗するテストを書く**

`__tests__/narasuResolveTracks.test.ts` を新規作成:

```ts
import { createGasSandbox, SheetRows } from "./helpers/gasSandbox";

const ADMIN = "TEST_ADMIN_SECRET";
const URL_A = "https://pub-x.r2.dev/songs/song_20260814_IUTKJ4/final.wav";
const URL_B = "https://pub-x.r2.dev/songs/song_20260701_AAAAAA/final.wav";

/** music_history のヘッダーは gas/Code.gs の getMusicHistorySheet_ と同じ順 */
function musicHistory(rows: SheetRows): SheetRows {
  return [
    ["id", "user_id", "job_id", "title", "audio_url", "download_url", "lyrics", "created_at", "expires_at"],
    ...rows,
  ];
}

function narasuAgency(rows: SheetRows): SheetRows {
  return [["request_id", "status", "login_id", "audio_urls", "audio_titles", "audio_lyrics", "lyrics_text"], ...rows];
}

function list(sheets: Record<string, SheetRows>) {
  const gas = createGasSandbox({ sheets, adminSecret: ADMIN });
  const res = gas.doPost({ action: "narasu_agency_list", adminKey: ADMIN });
  return { gas, res };
}

test("曲名・歌詞が空欄なら music_history から補完され source が history になる", () => {
  const { res } = list({
    music_history: musicHistory([
      ["id1", "user1", "job1", "夏の終わり", URL_A, "", "歌詞ほんぶん", "2026-08-14T00:00:00.000Z", "2026-09-14T00:00:00.000Z"],
    ]),
    narasu_agency: narasuAgency([["req1", "submitted", "user1", URL_A, "", "", ""]]),
  });

  expect(res.ok).toBe(true);
  const t = res.requests[0]._resolved_tracks[0];
  expect(t.songId).toBe("song_20260814_IUTKJ4");
  expect(t.title).toBe("夏の終わり");
  expect(t.titleSource).toBe("history");
  expect(t.lyrics).toBe("歌詞ほんぶん");
  expect(t.lyricsSource).toBe("history");
});

test("申請者の手入力があれば保持され上書きされない", () => {
  const { res } = list({
    music_history: musicHistory([
      ["id1", "user1", "job1", "生成時の曲名", URL_A, "", "生成時の歌詞", "2026-08-14T00:00:00.000Z", ""],
    ]),
    narasu_agency: narasuAgency([["req1", "submitted", "user1", URL_A, "手入力の曲名", "手入力の歌詞", ""]]),
  });

  const t = res.requests[0]._resolved_tracks[0];
  expect(t.title).toBe("手入力の曲名");
  expect(t.titleSource).toBe("form");
  expect(t.lyrics).toBe("手入力の歌詞");
  expect(t.lyricsSource).toBe("form");
});

test("expires_at が過去でも取得できる", () => {
  const { res } = list({
    music_history: musicHistory([
      ["id1", "user1", "job1", "古い曲", URL_B, "", "古い歌詞", "2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z"],
    ]),
    narasu_agency: narasuAgency([["req1", "submitted", "user1", URL_B, "", "", ""]]),
  });

  const t = res.requests[0]._resolved_tracks[0];
  expect(t.title).toBe("古い曲");
  expect(t.titleSource).toBe("history");
});

test("songId が取れないURLは none になり他トラックに影響しない", () => {
  const { res } = list({
    music_history: musicHistory([
      ["id1", "user1", "job1", "ヒットする曲", URL_A, "", "歌詞", "2026-08-14T00:00:00.000Z", ""],
    ]),
    narasu_agency: narasuAgency([
      ["req1", "submitted", "user1", `https://example.com/manual.mp3\n${URL_A}`, "", "", ""],
    ]),
  });

  const tracks = res.requests[0]._resolved_tracks;
  expect(tracks).toHaveLength(2);
  expect(tracks[0].songId).toBe("");
  expect(tracks[0].titleSource).toBe("none");
  expect(tracks[1].titleSource).toBe("history");
});

test("music_history シートが無くても一覧は正常に返り、シートを作らない", () => {
  const { gas, res } = list({
    narasu_agency: narasuAgency([["req1", "submitted", "user1", URL_A, "", "", ""]]),
  });

  expect(res.ok).toBe(true);
  expect(res.requests[0]._resolved_tracks[0].titleSource).toBe("none");
  expect(gas.insertedSheets).not.toContain("music_history");
});

test("同一 songId が複数行あれば created_at が最新の行を採用する", () => {
  const { res } = list({
    music_history: musicHistory([
      ["id1", "user1", "job1", "古いほう", URL_A, "", "古い歌詞", "2026-08-14T00:00:00.000Z", ""],
      ["id2", "user2", "job2", "新しいほう", URL_A, "", "新しい歌詞", "2026-08-15T00:00:00.000Z", ""],
    ]),
    narasu_agency: narasuAgency([["req1", "submitted", "user1", URL_A, "", "", ""]]),
  });

  const t = res.requests[0]._resolved_tracks[0];
  expect(t.title).toBe("新しいほう");
  expect(t.lyrics).toBe("新しい歌詞");
});

test("既存の列キーは欠落しない", () => {
  const { res } = list({
    narasu_agency: narasuAgency([["req1", "submitted", "user1", URL_A, "", "", "共通歌詞"]]),
  });

  const row = res.requests[0];
  expect(row.request_id).toBe("req1");
  expect(row.status).toBe("submitted");
  expect(row.audio_urls).toBe(URL_A);
  expect(row.lyrics_text).toBe("共通歌詞");
  expect(row._row).toBe(2);
});

test("曲別歌詞が空で共通歌詞だけある場合、共通歌詞は混入しない", () => {
  const { res } = list({
    narasu_agency: narasuAgency([["req1", "submitted", "user1", URL_A, "曲名", "", "共通の歌詞"]]),
  });

  const t = res.requests[0]._resolved_tracks[0];
  expect(t.lyrics).toBe("");
  expect(t.lyricsSource).toBe("none");
});

test("URL3件・曲名1件でも3件返り2件目以降が自動取得される", () => {
  const URL_C = "https://pub-x.r2.dev/songs/song_20260816_CCCCCC/final.wav";
  const { res } = list({
    music_history: musicHistory([
      ["id2", "u", "j2", "2曲目", URL_B, "", "", "2026-08-15T00:00:00.000Z", ""],
      ["id3", "u", "j3", "3曲目", URL_C, "", "", "2026-08-16T00:00:00.000Z", ""],
    ]),
    narasu_agency: narasuAgency([
      ["req1", "submitted", "u", `${URL_A}\n${URL_B}\n${URL_C}`, "1曲目だけ手入力", "", ""],
    ]),
  });

  const tracks = res.requests[0]._resolved_tracks;
  expect(tracks).toHaveLength(3);
  expect(tracks[0].title).toBe("1曲目だけ手入力");
  expect(tracks[0].titleSource).toBe("form");
  expect(tracks[1].title).toBe("2曲目");
  expect(tracks[1].titleSource).toBe("history");
  expect(tracks[2].title).toBe("3曲目");
  expect(tracks[2].titleSource).toBe("history");
});
```

- [ ] **Step 3: テストを実行して失敗することを確認する**

Run: `npx jest __tests__/narasuResolveTracks.test.ts`

Expected: **8 failed, 1 passed, 9 total**。`_resolved_tracks` がまだ存在しないため `Cannot read properties of undefined (reading '0')` になる。

「既存の列キーは欠落しない」の1件だけは `_resolved_tracks` を参照しないので、この時点でも通る。これは正常。

**8件が失敗しない場合は先に進まないこと。** サンドボックスが `gas/Code.gs` を読めていない、または `narasu_agency_list` に届いていない可能性がある。切り分けには `res` をそのまま `console.log` して `{ok:false, error:...}` が返っていないか確認する。

- [ ] **Step 4: GAS にヘルパー2つを追加する**

`gas/Code.gs` の**ファイル末尾**に追加する。

配置場所の注意: 稼働中 `doPost`（8291行目付近）の**内側ではなく、トップレベル**に置くこと。関数宣言は巻き上げられるので、ファイル末尾に置いても `doPost` から呼べる。`doPost` の内側に入れてしまうと他の関数から使えなくなる。

```javascript

// ============================================================
// narasu代理申請 管理: 音源URLから曲名・歌詞を逆引きする
// music_history は読み取り専用（シートが無くても作らない）
// 追加日: 2026-08 / 既存関数への変更なし・追記のみ
// ============================================================

/** 音源URLから songId（song_XXXX）を抽出する。取れなければ "" */
function extractSongId_(url) {
  var m = String(url || "").match(/song_[A-Z0-9_]+/i);
  return m ? m[0] : "";
}

/**
 * music_history 全行から songId -> { title, lyrics, createdAt } の対応表を作る。
 * expires_at は無視する（管理画面用の参照なので期限切れも拾う）。
 * 同一 songId が複数あれば created_at が新しい行を採用。
 * シートが無ければ空オブジェクトを返す（getMusicHistorySheet_ は使わない。
 * あれは存在しないシートを insertSheet で作ってしまうため）。
 */
function buildSongMetaMap_() {
  var map = {};
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("music_history");
  if (!sheet) return map;

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return map;

  var idx = {};
  for (var h = 0; h < data[0].length; h++) idx[String(data[0][h])] = h;
  if (idx["audio_url"] === undefined) return map;

  for (var i = 1; i < data.length; i++) {
    var createdAt = str_(data[i][idx["created_at"]]);
    var title = str_(data[i][idx["title"]]);
    var lyrics = str_(data[i][idx["lyrics"]]);

    var urls = [str_(data[i][idx["audio_url"]])];
    if (idx["download_url"] !== undefined) urls.push(str_(data[i][idx["download_url"]]));

    for (var u = 0; u < urls.length; u++) {
      var songId = extractSongId_(urls[u]);
      if (!songId) continue;
      var prev = map[songId];
      if (prev && prev.createdAt > createdAt) continue;
      map[songId] = { title: title, lyrics: lyrics, createdAt: createdAt };
    }
  }
  return map;
}
```

- [ ] **Step 5: テストがまだ失敗することを確認する**

Run: `npx jest __tests__/narasuResolveTracks.test.ts`

Expected: **8 failed, 1 passed**（Step 3 と同じ）。ヘルパーを足しただけで `narasu_agency_list` からはまだ呼んでいないため。**ここで結果が変わったら何かがおかしい。**

- [ ] **Step 6: コミット**

```bash
git add __tests__/helpers/gasSandbox.ts __tests__/narasuResolveTracks.test.ts gas/Code.gs
git commit -m "test(gas): narasu曲名・歌詞解決のテストとGASサンドボックスを追加

songId抽出とmusic_history逆引きマップのヘルパーも追加。
narasu_agency_list への組み込みは次のコミットで行うため、
この時点ではテストは失敗する。"
```

---

### Task 2: narasu_agency_list への組み込み

**Files:**
- Modify: `gas/Code.gs`（ファイル末尾のヘルパー群と、`narasu_agency_list` ブロック）
- Test: `__tests__/narasuResolveTracks.test.ts`（Task 1 で作成済み。変更しない）

**Interfaces:**
- Consumes: `extractSongId_()`, `buildSongMetaMap_()`（Task 1）
- Produces: GAS 側 `resolveNarasuTracks_(rowObj, songMap) -> Array<{ url, songId, title, titleSource, lyrics, lyricsSource }>`
- Produces: `narasu_agency_list` の各要素に `_resolved_tracks` が付く。Task 3 のフロントが消費する。

- [ ] **Step 1: トラック解決関数を追加する**

`gas/Code.gs` の末尾、Task 1 で追加した `buildSongMetaMap_()` の**直後**に追加:

```javascript

/**
 * narasu_agency の1行から _resolved_tracks を組み立てる。
 * 件数は常に audio_urls の件数に合わせる（audio_titles / audio_lyrics が
 * 足りなければ空欄扱い、多ければ余りを捨てる）。
 * 共通歌詞 lyrics_text はここでは使わない（曲別歌詞と混ぜない）。
 */
function resolveNarasuTracks_(rowObj, songMap) {
  var urlsRaw = str_(rowObj["audio_urls"]);
  var urls = [];
  var urlParts = urlsRaw.split(/\r?\n/);
  for (var p = 0; p < urlParts.length; p++) {
    var trimmed = urlParts[p].replace(/^\s+|\s+$/g, "");
    if (trimmed) urls.push(trimmed);
  }
  if (!urls.length) return [];

  var titlesRaw = str_(rowObj["audio_titles"]) || str_(rowObj["song_titles"]);
  var titles = titlesRaw.split(/\r?\n/);
  var lyricsList = str_(rowObj["audio_lyrics"]).split(/\r?\n---\r?\n/);

  var out = [];
  for (var i = 0; i < urls.length; i++) {
    var url = urls[i];
    var songId = extractSongId_(url);
    var meta = songId ? songMap[songId] : null;

    var formTitle = str_(titles[i]).replace(/^\s+|\s+$/g, "");
    var title = formTitle;
    var titleSource = formTitle ? "form" : "none";
    if (!title && meta && meta.title) {
      title = meta.title;
      titleSource = "history";
    }

    var formLyrics = str_(lyricsList[i]).replace(/^\s+|\s+$/g, "");
    var lyrics = formLyrics;
    var lyricsSource = formLyrics ? "form" : "none";
    if (!lyrics && meta && meta.lyrics) {
      lyrics = meta.lyrics;
      lyricsSource = "history";
    }

    out.push({
      url: url,
      songId: songId,
      title: title,
      titleSource: titleSource,
      lyrics: lyrics,
      lyricsSource: lyricsSource
    });
  }
  return out;
}
```

- [ ] **Step 2: narasu_agency_list から呼び出す**

`gas/Code.gs` の `narasu_agency_list` ブロック内、`return json_({ ok: true, requests: naList });` の**直前**に挿入する。

変更前:

```javascript
        naList.push(naObj);
      }
      return json_({ ok: true, requests: naList });
    } catch (e) {
```

変更後:

```javascript
        naList.push(naObj);
      }

      // 音源URLから曲名・歌詞を逆引きして補完する（読み取り専用）。
      // ここが失敗しても一覧そのものは必ず返す。
      try {
        var songMap = buildSongMetaMap_();
        for (var nk = 0; nk < naList.length; nk++) {
          naList[nk]._resolved_tracks = resolveNarasuTracks_(naList[nk], songMap);
        }
      } catch (eResolve) {
        Logger.log("[narasu_agency_list] resolve error: " + String(eResolve));
        for (var nz = 0; nz < naList.length; nz++) {
          if (!naList[nz]._resolved_tracks) naList[nz]._resolved_tracks = [];
        }
      }

      return json_({ ok: true, requests: naList });
    } catch (e) {
```

- [ ] **Step 3: テストが全て通ることを確認する**

Run: `npx jest __tests__/narasuResolveTracks.test.ts`

Expected: PASS（9件すべて）

失敗した場合は実装を直す。テストの期待値を書き換えて通すのは禁止。

- [ ] **Step 4: 既存のテストを壊していないことを確認する**

Run: `npx jest __tests__/bgmGenerateRoute.test.ts __tests__/noteGenerateRoute.test.ts`

Expected: PASS（2 suites / 12 tests）

- [ ] **Step 5: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): narasu_agency_list が音源URLから曲名・歌詞を自動補完する

music_history を songId で逆引きし、空欄のときだけ補って
_resolved_tracks として返す。expires_at は無視し期限切れも拾う。
シートへの書き込みは行わない。既存キーは変更なし。"
```

---

### Task 3: 管理画面の表示対応

**Files:**
- Modify: `app/admin/narasu/page.tsx:47-52`（`Track` 型）
- Modify: `app/admin/narasu/page.tsx:82-92`（`buildTracks`）
- Modify: `app/admin/narasu/page.tsx:340-392`（楽曲リストの描画）

**Interfaces:**
- Consumes: `_resolved_tracks`（Task 2 が返す。要素は `{ url, songId, title, titleSource, lyrics, lyricsSource }`）

- [ ] **Step 1: Track 型に source を足す**

`app/admin/narasu/page.tsx` の `type Track = {...}`（47行目付近）を置き換える:

```ts
type TrackSource = "form" | "history" | "none";

type ResolvedTrack = {
  url?: string;
  songId?: string;
  title?: string;
  titleSource?: TrackSource;
  lyrics?: string;
  lyricsSource?: TrackSource;
};

type Track = {
  index: number;
  url: string;
  title: string;
  titleSource: TrackSource;
  lyrics: string;
  lyricsSource: TrackSource;
};
```

- [ ] **Step 2: buildTracks を _resolved_tracks 優先にする**

`buildTracks`（82行目付近）を置き換える。GAS が未デプロイでも壊れないよう、`_resolved_tracks` が無ければ従来どおり列から組み立てるフォールバックを残す:

```ts
function buildTracks(row: NarasuRow): Track[] {
  const resolved = Array.isArray(row._resolved_tracks)
    ? (row._resolved_tracks as ResolvedTrack[])
    : null;

  if (resolved) {
    return resolved.map((t, i) => ({
      index: i + 1,
      url: String(t.url ?? ""),
      title: String(t.title ?? "").trim(),
      titleSource: (t.titleSource ?? "none") as TrackSource,
      lyrics: String(t.lyrics ?? "").trim(),
      lyricsSource: (t.lyricsSource ?? "none") as TrackSource,
    }));
  }

  // GAS が未デプロイの場合のフォールバック（従来の挙動）
  const urls = splitLines(row.audio_urls).filter((u) => u);
  const titles = splitLines(row.audio_titles ?? row.song_titles);
  const lyrics = splitLyrics(row.audio_lyrics);
  return urls.map((url, i) => {
    const title = (titles[i] ?? "").trim();
    const lyric = (lyrics[i] ?? "").trim();
    return {
      index: i + 1,
      url,
      title,
      titleSource: (title ? "form" : "none") as TrackSource,
      lyrics: lyric,
      lyricsSource: (lyric ? "form" : "none") as TrackSource,
    };
  });
}
```

- [ ] **Step 3: 「自動取得」バッジのコンポーネントを足す**

`buildTracks` の直後に追加:

```tsx
/** music_history から自動補完した値であることを示すバッジ */
function AutoBadge() {
  return (
    <span className="mt-0.5 shrink-0 rounded border border-sky-500/30 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
      自動取得
    </span>
  );
}
```

- [ ] **Step 4: 楽曲リストの描画にバッジを差し込む**

曲名行（350行目付近）を置き換える。

設計書の「`（曲名未入力）` は `titleSource` が `none` のときだけ表示する」は、`t.title` が空文字になるのは `titleSource === "none"` のときだけなので、既存の `t.title || "（曲名未入力）"` のままで満たされる。条件式を書き換える必要はない。

```tsx
                          <div className="flex items-start gap-2">
                            <p className={clsx("min-w-0 flex-1 break-all text-sm font-bold", t.title ? "text-zinc-100" : "text-zinc-600")}>
                              {t.title || "（曲名未入力）"}
                            </p>
                            {t.titleSource === "history" && <AutoBadge />}
                            <CopyButton text={t.title} label="曲名" />
                          </div>
```

歌詞のボタン行（367〜381行目付近）を置き換える:

```tsx
                            {t.lyrics ? (
                              <>
                                <button
                                  onClick={() => setOpenLyrics((p) => ({ ...p, [t.index]: !p[t.index] }))}
                                  className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20"
                                >
                                  {lyricsOpen ? "▲ 歌詞を閉じる" : `▼ この曲の歌詞（${t.lyrics.length}文字）`}
                                </button>
                                {t.lyricsSource === "history" && <AutoBadge />}
                                <CopyButton text={t.lyrics} label="歌詞" />
                              </>
                            ) : (
                              <span className="rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-500">
                                曲別の歌詞なし
                              </span>
                            )}
```

- [ ] **Step 5: 型チェックとビルドを通す**

Run: `npx tsc --noEmit`

Expected: `app/admin/narasu/page.tsx` に関するエラーが出ないこと。

Run: `npm run build`

Expected: `✓ Compiled successfully`、ルート一覧に `○ /admin/narasu` が出ること。

- [ ] **Step 6: 全テストを再確認する**

Run: `npx jest __tests__/narasuResolveTracks.test.ts __tests__/bgmGenerateRoute.test.ts __tests__/noteGenerateRoute.test.ts`

Expected: 3 suites PASS

- [ ] **Step 7: コミット**

```bash
git add app/admin/narasu/page.tsx
git commit -m "feat(admin): narasu代理申請の楽曲リストに自動取得した曲名・歌詞を表示

_resolved_tracks を優先して描画し、music_history 由来の値には
「自動取得」バッジを付ける。GAS 未デプロイ時は従来の列から
組み立てるフォールバックを残す。"
```

---

## デプロイ手順

コード変更だけでは本番に反映されない。両方が必要。

1. `git push origin main` → Vercel が本番ビルド（フロントの表示対応）
2. `gas/Code.gs` を GAS エディタに反映し、**「デプロイを管理」→ 既存デプロイの鉛筆アイコン → バージョンを「新バージョン」→ デプロイ**
   - 「新しいデプロイ」で作ると `/exec` の URL が変わり `GAS_WEBAPP_URL` と合わなくなる

GAS が未デプロイの間もフロントはフォールバックで従来どおり動く（曲名が空のまま表示される）ため、順序はどちらが先でもよい。

## 完了の定義

- `npx jest __tests__/narasuResolveTracks.test.ts` が9件PASS
- `npm run build` が exit 0
- 本番の `/admin/narasu` で、これまで「（曲名未入力）」だった楽曲に曲名が表示され、「自動取得」バッジが付く
- `music_history` シートと `narasu_agency` シートの内容が変化していない

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

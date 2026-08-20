import { createGasSandbox, SheetRows } from "./helpers/gasSandbox";

// 稼働中の doPost は key 検証を handle_() へのフォールスルー時に行う。
// 診断用アクションはその手前に置かれていたため、認証なしで任意のシートを
// 読み出せる状態だった。このテストはその経路が塞がれていることを保証する。

const SECRET_EMAIL = "victim@example.com";
const SECRET_ARTIST = "流出してはいけないアーティスト名";

const APPLIES: SheetRows = [
  ["login_id", "email", "music_boost_artist", "music_boost_album", "music_boost_tracks_json"],
  ["u001", SECRET_EMAIL, SECRET_ARTIST, "秘密アルバム", ""],
];

function sandbox() {
  return createGasSandbox({
    sheets: {
      applies: APPLIES,
      music_boost: [["col"], ["value"]],
    },
  });
}

/** doPost は key を渡さない = 未認証リクエスト */
function callWithoutKey(body: Record<string, unknown>) {
  return sandbox().doPost(body);
}

test("diag_dump は未認証で applies の中身を返さない", () => {
  const res = callWithoutKey({ action: "diag_dump", sheet: "applies", limit: 10000 });

  expect(JSON.stringify(res)).not.toContain(SECRET_EMAIL);
  expect(res.ok).toBe(false);
});

test("diag_mbtracks は未認証で applies の申請内容を返さない", () => {
  const res = callWithoutKey({ action: "diag_mbtracks" });

  expect(JSON.stringify(res)).not.toContain(SECRET_ARTIST);
  expect(res.ok).toBe(false);
});

test("which_sheet は未認証でスプレッドシートの識別情報を返さない", () => {
  const res = callWithoutKey({ action: "which_sheet" });

  expect(JSON.stringify(res)).not.toContain("stub-id");
  expect(res.ok).toBe(false);
});

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
    // Share the host's Date constructor with the sandbox realm. vm.createContext()
    // otherwise gives the sandbox its own intrinsics, so a Date object created in a
    // test file would fail `instanceof Date` checks inside gas/Code.gs even though
    // it behaves like a Date in every other way (cross-realm identity mismatch).
    // Sheets can return real Date objects for date-like cells, so tests need to be
    // able to simulate that faithfully.
    Date,
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

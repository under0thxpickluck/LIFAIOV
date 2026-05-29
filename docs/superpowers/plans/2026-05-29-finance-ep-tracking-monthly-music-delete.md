# 財務管理強化 + 音楽売却削除 + OV対応 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 財務管理にEP動き追跡・月次自動集計・音楽売却削除を追加し、OVにも財務ゲートウェイと音楽売却管理を追加する。

**Architecture:** 全て追加のみ。既存コード・API・GASアクションへの変更・削除はゼロ。OV専用コードは `/5000/admin/page.tsx` のみ、本家専用は `/admin/page.tsx` のみ。財務ページ（`/admin/finance/`）は共用。

**Tech Stack:** Next.js 14 App Router, TypeScript, Google Apps Script (GAS), Tailwind CSS

---

## ファイル変更マップ

| ファイル | 変更種別 | 担当機能 |
|---|---|---|
| `gas/Code.gs` | 追加 | `music_sell_delete` アクション |
| `app/api/admin/music-sell-requests/route.ts` | 追加 | `DELETE` メソッド |
| `app/admin/page.tsx` | 追加 | 承認済み音楽売却に削除ボタン |
| `app/admin/finance/UsersTab.tsx` | 追加 | EP/BP/USD フィルタ + バッジ |
| `app/admin/finance/MonthlyTab.tsx` | 追加 | 自動集計 + 直近6ヶ月サマリ |
| `app/5000/admin/page.tsx` | 追加 | 財務ゲートウェイ + 音楽売却管理 |

---

## Task 1: GAS — `music_sell_delete` アクション追加

**Files:**
- Modify: `gas/Code.gs`（`music_sell_notify` ブロック終端の直後、`return json_({ ok: false, error: "bad_action" });` の直前）

- [ ] **Step 1: 挿入位置を確認する**

`gas/Code.gs` 内で以下の文字列を検索し、その直前に挿入する：
```
  // actionが不明
  return json_({ ok: false, error: "bad_action" });
```

- [ ] **Step 2: `music_sell_delete` アクションを追加する**

`// actionが不明` の直前に以下を挿入：

```javascript
  // =========================================================
  // music_sell_delete（管理：承認済み楽曲売却申請の行を物理削除）
  // - approved 行のみ削除可能
  // =========================================================
  if (action === "music_sell_delete") {
    if (str_(body.adminKey) !== ADMIN_SECRET) return json_({ ok: false, error: "admin_unauthorized" });
    try {
      var delRequestId = str_(body.requestId);
      if (!delRequestId) return json_({ ok: false, error: "missing_requestId" });
      var ssDel = SpreadsheetApp.getActiveSpreadsheet();
      var mssDel = ssDel.getSheetByName("music_sell_requests");
      if (!mssDel) return json_({ ok: false, error: "sheet_not_found" });
      var delRows    = mssDel.getDataRange().getValues();
      var delHeaders = delRows[0];
      var delRidIdx  = delHeaders.indexOf("request_id");
      var delStIdx   = delHeaders.indexOf("status");
      if (delRidIdx === -1) return json_({ ok: false, error: "request_id_column_not_found" });
      for (var di = 1; di < delRows.length; di++) {
        if (str_(delRows[di][delRidIdx]) === delRequestId) {
          if (str_(delRows[di][delStIdx]) !== "approved") {
            return json_({ ok: false, error: "not_approved" });
          }
          mssDel.deleteRow(di + 1);
          return json_({ ok: true });
        }
      }
      return json_({ ok: false, error: "request_not_found" });
    } catch(e) {
      return json_({ ok: false, error: String(e) });
    }
  }

```

- [ ] **Step 3: コミット**

```bash
git add gas/Code.gs
git commit -m "feat(gas): music_sell_delete アクション追加（approved行のみ物理削除）"
```

---

## Task 2: API — `DELETE` メソッド追加

**Files:**
- Modify: `app/api/admin/music-sell-requests/route.ts`

- [ ] **Step 1: ファイル末尾に `DELETE` エクスポートを追加する**

`route.ts` の末尾（既存の `POST` 関数の後）に以下を追加：

```typescript
export async function DELETE(req: Request) {
  const base     = process.env.GAS_WEBAPP_URL;
  const key      = process.env.GAS_API_KEY;
  const adminKey = process.env.GAS_ADMIN_KEY;

  if (!base || !key || !adminKey) {
    return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const requestId = String(body?.requestId ?? "");
  if (!requestId) {
    return NextResponse.json({ ok: false, error: "requestId_required" }, { status: 400 });
  }

  try {
    const url = `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "music_sell_delete", adminKey, requestId }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "invalid_response" }));
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add app/api/admin/music-sell-requests/route.ts
git commit -m "feat(api): music-sell-requests に DELETE メソッド追加"
```

---

## Task 3: 本家 `/admin/page.tsx` — 削除ボタン追加

**Files:**
- Modify: `app/admin/page.tsx`

現在の state に `deletingMusicId` がない。`updatingMusicId` の直後に追加し、handler と UI ボタンを追加する。

- [ ] **Step 1: `deletingMusicId` state を追加する**

`app/admin/page.tsx` 内の以下を探す：
```typescript
  const [updatingMusicId,   setUpdatingMusicId]   = useState<string | null>(null);
```
その直後に追加：
```typescript
  const [deletingMusicId,   setDeletingMusicId]   = useState<string | null>(null);
```

- [ ] **Step 2: `handleMusicSellDelete` handler を追加する**

`handleMusicSellUpdate` 関数（`const handleMusicSellUpdate = async ...`）の直後に追加：

```typescript
  const handleMusicSellDelete = async (requestId: string) => {
    setDeletingMusicId(requestId); setMusicSellErr(null); setMusicSellMsg(null);
    try {
      const res  = await fetch("/api/admin/music-sell-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "delete_failed");
      setMusicSellMsg("🗑 削除しました");
      await loadMusicSellRequests();
    } catch (e: any) {
      setMusicSellErr(String(e?.message ?? e));
    } finally {
      setDeletingMusicId(null);
    }
  };
```

- [ ] **Step 3: 承認済み行に削除ボタンを追加する**

音楽売却テーブルの操作列（`<Td className="text-right">`）内を確認する。現在は `isPending` の場合のみボタンが表示されている。以下の `{isPending && (...)}` ブロックの**直後**に追加：

```typescript
                          {req.status === "approved" && (
                            <button
                              onClick={() => handleMusicSellDelete(req.request_id)}
                              disabled={deletingMusicId === req.request_id}
                              className="rounded-lg border border-red-800 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-900/30 disabled:opacity-50"
                            >
                              {deletingMusicId === req.request_id ? "…" : "🗑 削除"}
                            </button>
                          )}
```

- [ ] **Step 4: コミット**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): 音楽売却申請の承認済み行に削除ボタン追加"
```

---

## Task 4: UsersTab — EP/BP/USD フィルタ追加

**Files:**
- Modify: `app/admin/finance/UsersTab.tsx`

- [ ] **Step 1: 通貨分類の定数と関数をファイル先頭（`function clsx` の前）に追加する**

```typescript
const EP_KINDS = new Set([
  "music_sell", "radio_ep", "rumble_weekly_ep", "deduct_ep",
]);
const BP_KINDS = new Set([
  "gacha_cost", "gacha_prize", "login_bonus", "deduct_bp",
  "rumble_daily_bp", "square_bp_purchase", "monthly_recover",
  "fortune_daily", "stake_lock", "stake_claim", "market_confirm_fee",
]);

function ledgerCurrency(kind: string): "EP" | "BP" | "USD" {
  if (EP_KINDS.has(kind)) return "EP";
  if (BP_KINDS.has(kind) || kind.startsWith("mission_")) return "BP";
  return "USD";
}
```

- [ ] **Step 2: `ledgerFilter` state を追加する**

`UsersTab` コンポーネント内の `useState` 群の末尾に追加：

```typescript
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "EP" | "BP" | "USD">("all");
```

- [ ] **Step 3: フィルタ済みの wallet 履歴を算出する useMemo を追加する**

既存の `userLedger` useMemo の直後に追加：

```typescript
  const filteredLedger = useMemo(() => {
    if (ledgerFilter === "all") return userLedger;
    return userLedger.filter(l => ledgerCurrency(l.kind) === ledgerFilter);
  }, [userLedger, ledgerFilter]);
```

- [ ] **Step 4: wallet 履歴セクションのヘッダーにフィルタトグルを追加する**

以下の行を探す：
```typescript
            <p className="mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wide">
              Wallet 履歴（{userLedger.length} 件）
            </p>
```
以下に差し替える：
```typescript
            <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                Wallet 履歴（{filteredLedger.length} / {userLedger.length} 件）
              </p>
              <div className="flex gap-1">
                {(["all", "EP", "BP", "USD"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setLedgerFilter(f)}
                    className={clsx(
                      "rounded-md px-2 py-0.5 text-[10px] font-bold transition",
                      ledgerFilter === f
                        ? f === "EP"  ? "bg-emerald-700 text-white"
                          : f === "BP"  ? "bg-amber-700 text-white"
                          : f === "USD" ? "bg-blue-700 text-white"
                          : "bg-zinc-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    )}
                  >
                    {f === "all" ? "全て" : f}
                  </button>
                ))}
              </div>
            </div>
```

- [ ] **Step 5: テーブルのループを `userLedger` から `filteredLedger` に変更し、kind バッジを追加する**

テーブル tbody のループ箇所：
```typescript
                    {userLedger.map((l, i) => (
```
を以下に変更：
```typescript
                    {filteredLedger.map((l, i) => (
```

kind セルを以下に変更（現在は `{l.kind}` のみ）：
```typescript
                        <td className="px-2 py-1.5 text-[10px] text-zinc-300">
                          <span className={clsx(
                            "mr-1 rounded px-1 py-0.5 text-[9px] font-bold",
                            ledgerCurrency(l.kind) === "EP"  ? "bg-emerald-900/60 text-emerald-400"
                            : ledgerCurrency(l.kind) === "BP"  ? "bg-amber-900/60 text-amber-400"
                            : "bg-blue-900/60 text-blue-400"
                          )}>
                            {ledgerCurrency(l.kind)}
                          </span>
                          {l.kind}
                        </td>
```

- [ ] **Step 6: コミット**

```bash
git add app/admin/finance/UsersTab.tsx
git commit -m "feat(finance): UsersTab wallet履歴にEP/BP/USDフィルタとバッジを追加"
```

---

## Task 5: MonthlyTab — 自動集計 + 直近6ヶ月サマリ追加

**Files:**
- Modify: `app/admin/finance/MonthlyTab.tsx`

- [ ] **Step 1: 月別サマリ用の型と state を追加する**

`MonthlyTab` コンポーネント内の既存 state（`month`, `data`, `loading`, `err`, `expanded`）の直後に追加：

```typescript
  const [monthSummaries,        setMonthSummaries]        = useState<Array<{ month: string; total_ep: number; referrer_count: number } | null>>([]);
  const [summaryLoading,        setSummaryLoading]        = useState(false);
```

- [ ] **Step 2: `loadMonthlySummaries` 関数を追加する**

既存の `load` 関数の直後に追加：

```typescript
  const loadMonthlySummaries = async () => {
    setSummaryLoading(true);
    const months = monthOptions().slice(0, 6);
    const results = await Promise.allSettled(
      months.map(m =>
        fetch("/api/admin/affiliate-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ month: m }),
        })
          .then(r => r.json())
          .then((j: any) => j?.ok ? { month: m, total_ep: Number(j.summary?.total_ep ?? 0), referrer_count: Number(j.summary?.referrer_count ?? 0) } : null)
          .catch(() => null)
      )
    );
    setMonthSummaries(results.map(r => r.status === "fulfilled" ? r.value : null));
    setSummaryLoading(false);
  };
```

- [ ] **Step 3: ページロード時に自動集計する `useEffect` を追加する**

`return (` の直前に追加：

```typescript
  useEffect(() => {
    load(currentMonth());
    loadMonthlySummaries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4: 直近6ヶ月サマリを既存テーブルの下に追加する**

`MonthlyTab` の `return` 内、`</> ` の直前（既存テーブルのブロック後）に追加：

```typescript
          {/* 直近6ヶ月サマリ */}
          <div className="mt-8">
            <p className="mb-3 text-sm font-bold text-zinc-300">直近6ヶ月サマリ（末締め）</p>
            {summaryLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-zinc-800" />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {monthOptions().slice(0, 6).map((m, i) => {
                  const s = monthSummaries[i];
                  return (
                    <button
                      key={m}
                      onClick={() => { setMonth(m); load(m); }}
                      className={[
                        "rounded-xl border p-3 text-left transition hover:border-amber-500/60",
                        month === m ? "border-amber-500 bg-zinc-800" : "border-zinc-800 bg-zinc-900"
                      ].join(" ")}
                    >
                      <p className="mb-1 text-[11px] font-bold text-zinc-400">{fmtMonth(m)}</p>
                      {s ? (
                        <>
                          <p className="text-sm font-bold text-amber-400">{fmtEp(s.total_ep)}</p>
                          <p className="text-[10px] text-zinc-500">{s.referrer_count} 人</p>
                        </>
                      ) : (
                        <p className="text-[10px] text-zinc-600">データなし</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
```

- [ ] **Step 5: コミット**

```bash
git add app/admin/finance/MonthlyTab.tsx
git commit -m "feat(finance): MonthlyTab 自動集計 + 直近6ヶ月サマリ追加"
```

---

## Task 6: OV `/5000/admin/page.tsx` — 財務ゲートウェイ + 音楽売却セクション追加

**Files:**
- Modify: `app/5000/admin/page.tsx`

- [ ] **Step 1: 型定義を追加する**

ファイル先頭の `type ApplyRow = { ... };` の直後に追加：

```typescript
type MusicSellRequest5000 = {
  request_id: string;
  login_id: string;
  title: string;
  music_url: string;
  price_usdt: string;
  memo: string;
  status: string;
  created_at: string;
};
```

- [ ] **Step 2: state を追加する**

コンポーネント内の既存 state（`rows`, `loading`, `err`, `approving`, `messages`）の直後に追加：

```typescript
  // --- 財務ゲートウェイ ---
  const [financePass, setFinancePass] = useState("");
  const [financeBusy, setFinanceBusy] = useState(false);
  const [financeErr,  setFinanceErr]  = useState<string | null>(null);

  // --- 音楽売却申請 ---
  const [musicSellRequests, setMusicSellRequests] = useState<MusicSellRequest5000[]>([]);
  const [musicSellLoading,  setMusicSellLoading]  = useState(false);
  const [musicSellErr,      setMusicSellErr]      = useState<string | null>(null);
  const [musicSellMsg,      setMusicSellMsg]      = useState<string | null>(null);
  const [updatingMusicId,   setUpdatingMusicId]   = useState<string | null>(null);
  const [deletingMusicId,   setDeletingMusicId]   = useState<string | null>(null);
```

- [ ] **Step 3: handler 3本を追加する**

既存の `approve` 関数の直後に追加：

```typescript
  // ── 財務ゲートウェイ ──────────────────────────────────────
  const handleFinanceUnlock = async () => {
    if (!financePass.trim() || financeBusy) return;
    setFinanceBusy(true); setFinanceErr(null);
    try {
      const res  = await fetch("/api/admin/finance-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: financePass }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "unlock_failed");
      sessionStorage.setItem("finance_token", json.token);
      window.location.href = "/admin/finance";
    } catch (e: any) {
      setFinanceErr(String(e?.message ?? e));
    } finally {
      setFinanceBusy(false);
    }
  };

  // ── 音楽売却申請 ─────────────────────────────────────────
  const loadMusicSellRequests = async () => {
    setMusicSellLoading(true); setMusicSellErr(null);
    try {
      const res  = await fetch("/api/admin/music-sell-requests", { cache: "no-store" });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "fetch_failed");
      setMusicSellRequests(Array.isArray(json.requests) ? json.requests : []);
    } catch (e: any) {
      setMusicSellErr(String(e?.message ?? e));
    } finally {
      setMusicSellLoading(false);
    }
  };

  const handleMusicSellUpdate = async (requestId: string, status: "approved" | "rejected") => {
    setUpdatingMusicId(requestId); setMusicSellErr(null); setMusicSellMsg(null);
    try {
      const res  = await fetch("/api/admin/music-sell-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "update_failed");
      setMusicSellMsg(status === "approved" ? "✅ 承認しました" : "❌ 却下しました");
      await loadMusicSellRequests();
    } catch (e: any) {
      setMusicSellErr(String(e?.message ?? e));
    } finally {
      setUpdatingMusicId(null);
    }
  };

  const handleMusicSellDelete = async (requestId: string) => {
    setDeletingMusicId(requestId); setMusicSellErr(null); setMusicSellMsg(null);
    try {
      const res  = await fetch("/api/admin/music-sell-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "delete_failed");
      setMusicSellMsg("🗑 削除しました");
      await loadMusicSellRequests();
    } catch (e: any) {
      setMusicSellErr(String(e?.message ?? e));
    } finally {
      setDeletingMusicId(null);
    }
  };
```

- [ ] **Step 4: `useEffect` を更新して音楽売却申請も自動ロードする**

既存の `useEffect(() => { load(); }, []);` を以下に差し替える：

```typescript
  useEffect(() => {
    load();
    loadMusicSellRequests();
  }, []);
```

- [ ] **Step 5: 財務ゲートウェイセクションを追加する**

`<footer ...>` の直前に追加：

```typescript
        {/* ═══ 財務管理ゲートウェイ ════════════════════════════ */}
        <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-lg font-semibold" style={{ color: "#6C63FF" }}>🔒 財務管理</p>
          <p className="mb-4 text-xs text-white/40">
            パスワードを入力して財務管理ページへ進んでください。ブラウザを閉じると再認証が必要です。
          </p>
          {financeErr && (
            <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400">
              {financeErr === "invalid_password" ? "パスワードが違います" : financeErr}
            </div>
          )}
          <div className="flex gap-3">
            <input
              type="password"
              placeholder="財務パスワード"
              value={financePass}
              onChange={e => setFinancePass(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleFinanceUnlock(); }}
              className="w-56 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-purple-500 focus:outline-none"
            />
            <button
              onClick={handleFinanceUnlock}
              disabled={financeBusy || !financePass.trim()}
              className="rounded-lg px-5 py-2 text-sm font-bold transition disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #6C63FF, #00D4FF)", color: "#fff" }}
            >
              {financeBusy ? "確認中…" : "財務管理へ →"}
            </button>
          </div>
        </section>
```

`<footer ...>` が存在しない場合は `</main>` の直前の `</div>` の前に追加する。

- [ ] **Step 6: 音楽売却申請セクションを追加する**

財務管理セクションの直後（`</main>` の直前）に追加：

```typescript
        {/* ═══ 楽曲売却申請 ════════════════════════════════════ */}
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-sm font-bold tracking-wider text-white/60 uppercase">
              楽曲売却申請
            </h2>
            <button
              onClick={loadMusicSellRequests}
              disabled={musicSellLoading}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 hover:bg-white/10 disabled:opacity-40"
            >
              {musicSellLoading ? "読み込み中…" : "更新"}
            </button>
          </div>

          {musicSellMsg && (
            <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-400">
              {musicSellMsg}
            </div>
          )}
          {musicSellErr && (
            <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400">
              エラー：{musicSellErr}
            </div>
          )}

          {musicSellLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-white/5" />
          ) : musicSellRequests.length === 0 ? (
            <p className="text-sm text-white/30">申請はありません</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-2 px-3 text-left text-white/50 font-medium text-xs">申請日時</th>
                    <th className="py-2 px-3 text-left text-white/50 font-medium text-xs">ユーザー</th>
                    <th className="py-2 px-3 text-left text-white/50 font-medium text-xs">楽曲タイトル</th>
                    <th className="py-2 px-3 text-left text-white/50 font-medium text-xs">希望価格</th>
                    <th className="py-2 px-3 text-left text-white/50 font-medium text-xs">ステータス</th>
                    <th className="py-2 px-3 text-right text-white/50 font-medium text-xs">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {musicSellRequests.map((req, i) => {
                    const busy = updatingMusicId === req.request_id;
                    const isPending = req.status === "pending";
                    return (
                      <tr key={req.request_id || i} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 px-3 text-xs text-white/40 whitespace-nowrap">{req.created_at}</td>
                        <td className="py-2 px-3 text-xs font-mono text-cyan-400">{req.login_id}</td>
                        <td className="py-2 px-3 text-xs text-white/70 max-w-[160px]">
                          <div className="truncate">{req.title}</div>
                        </td>
                        <td className="py-2 px-3 text-xs text-purple-300">{req.price_usdt ? `${req.price_usdt} EP` : "—"}</td>
                        <td className="py-2 px-3 text-xs">
                          <span className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            req.status === "approved" ? "bg-green-500/20 text-green-300"
                            : req.status === "rejected" ? "bg-white/10 text-white/30"
                            : "bg-yellow-500/20 text-yellow-300"
                          ].join(" ")}>
                            {req.status === "approved" ? "承認済" : req.status === "rejected" ? "却下済" : "審査中"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          {isPending && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleMusicSellUpdate(req.request_id, "approved")}
                                disabled={busy}
                                className="rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
                                style={{ background: "linear-gradient(135deg, #10b981, #0d9488)", color: "#fff" }}
                              >
                                {busy ? "…" : "承認"}
                              </button>
                              <button
                                onClick={() => handleMusicSellUpdate(req.request_id, "rejected")}
                                disabled={busy}
                                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-white/60 hover:bg-white/10 disabled:opacity-50"
                              >
                                {busy ? "…" : "却下"}
                              </button>
                            </div>
                          )}
                          {req.status === "approved" && (
                            <button
                              onClick={() => handleMusicSellDelete(req.request_id)}
                              disabled={deletingMusicId === req.request_id}
                              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              {deletingMusicId === req.request_id ? "…" : "🗑 削除"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
```

- [ ] **Step 7: コミット**

```bash
git add app/5000/admin/page.tsx
git commit -m "feat(5000/admin): 財務ゲートウェイ + 音楽売却申請管理セクション追加"
```

---

## Task 7: 最終確認 + Push

- [ ] **Step 1: TypeScript ビルドチェック**

```bash
npx tsc --noEmit
```

エラーがある場合は該当ファイルを修正してから再実行。

- [ ] **Step 2: 変更ファイルの最終確認**

```bash
git log --oneline -6
git diff HEAD~6 --stat
```

以下6コミットが存在することを確認：
1. `feat(gas): music_sell_delete アクション追加`
2. `feat(api): music-sell-requests に DELETE メソッド追加`
3. `feat(admin): 音楽売却申請の承認済み行に削除ボタン追加`
4. `feat(finance): UsersTab wallet履歴にEP/BP/USDフィルタとバッジを追加`
5. `feat(finance): MonthlyTab 自動集計 + 直近6ヶ月サマリ追加`
6. `feat(5000/admin): 財務ゲートウェイ + 音楽売却申請管理セクション追加`

- [ ] **Step 3: Push**

```bash
git push origin main
```

---

## 混合防止チェックリスト

実装後に以下を確認：

- [ ] `app/5000/admin/page.tsx` に `zinc-` クラスや `/admin/page.tsx` のスタイルが混入していない（OV は `white/` + `#0A0A0A` ベース）
- [ ] `app/admin/page.tsx` に OV 固有コード（`/5000/`, `/api/5000/`）への参照がない
- [ ] `/api/5000/admin/` 以下に新規ルートが生まれていない（OV の音楽売却は `/api/admin/` を共用）
- [ ] `gas/Code.gs` の既存 `music_sell_submit`・`music_sell_list`・`music_sell_update`・`music_sell_notify` ブロックが変更されていない

"use client";

import Link from "next/link";
import { LoadingCat } from "@/components/LoadingCat";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, getAuthSecret } from "../../lib/auth";

type LocalOrder = {
  order_id: string;
  item_id: string;
  item_title: string;
  item_type: string;
  price: number;
  currency: string;
  status: "paid" | "confirmed" | "refunded";
  created_at: string;
};

type MyListing = {
  item_id: string;
  title: string;
  item_type: string;
  price: number;
  currency: string;
  status: string;
  created_at: string;
  sell_requested?: boolean;
};

const ORDERS_KEY = "market_orders_v1";

function getLocalOrders(): LocalOrder[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]"); } catch { return []; }
}

function updateLocalOrderStatus(order_id: string, status: LocalOrder["status"]) {
  const orders = getLocalOrders();
  const idx = orders.findIndex(o => o.order_id === order_id);
  if (idx >= 0) {
    orders[idx].status = status;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }
}

function itemTypeLabel(type: string) {
  switch (type) {
    case "image_pack": return "🖼️ 画像パック";
    case "music_pack": return "🎵 音楽パック";
    case "other_pack": return "📦 その他";
    default: return type || "—";
  }
}

function StatusBadge({ status }: { status: LocalOrder["status"] }) {
  switch (status) {
    case "paid":
      return (
        <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
          支払い済
        </span>
      );
    case "confirmed":
      return (
        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          受領確定済
        </span>
      );
    case "refunded":
      return (
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          返金済
        </span>
      );
    default:
      return null;
  }
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders]     = useState<LocalOrder[]>([]);
  const [myId, setMyId]         = useState("");
  const [myCode, setMyCode]     = useState("");
  const [confirmingId, setConfirmingId] = useState("");
  const [confirmErrors, setConfirmErrors] = useState<Record<string, string>>({});
  const [ordersSource, setOrdersSource] = useState<"gas" | "local">("local");

  // 出品中アイテム
  const [myListings, setMyListings]     = useState<MyListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [requestingId, setRequestingId] = useState("");
  const [requestErrors, setRequestErrors] = useState<Record<string, string>>({});
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const auth = getAuth();
    if (!auth) { router.replace("/login"); return; }
    const id =
      (auth as any)?.id || (auth as any)?.loginId ||
      (auth as any)?.login_id || (auth as any)?.email || "";
    const code = getAuthSecret() || (auth as any)?.token || "";
    setMyId(id);
    setMyCode(code);

    // まずlocalStorageで初期表示
    setOrders(getLocalOrders());

    if (id && code) {
      // GASから購入履歴を取得（優先）
      fetch("/api/market/my-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, code }),
        cache: "no-store",
      })
        .then(r => r.json())
        .catch(() => ({ ok: false }))
        .then((data: any) => {
          if (data.ok && Array.isArray(data.orders) && data.orders.length > 0) {
            // GAS取得成功 → マージ（GASを優先しつつlocalStorageの未登録分を補完）
            const gasOrders: LocalOrder[] = data.orders.map((o: any) => ({
              order_id: o.order_id,
              item_id: o.item_id,
              item_title: o.item_title || "",
              item_type: o.item_type || "",
              price: o.price || 0,
              currency: o.currency || "EP",
              status: o.status as LocalOrder["status"],
              created_at: o.paid_at || new Date().toISOString(),
            }));
            const localOrders = getLocalOrders();
            const gasOrderIds = new Set(gasOrders.map(o => o.order_id));
            const localOnly = localOrders.filter(o => !gasOrderIds.has(o.order_id));
            const merged = [...gasOrders, ...localOnly].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            setOrders(merged);
            setOrdersSource("gas");
          }
        });

      // 自分の出品一覧を取得
      setListingsLoading(true);
      fetch(`/api/market/list?seller_id=${encodeURIComponent(id)}&status=active`, { cache: "no-store" })
        .then(r => r.json())
        .catch(() => ({ ok: false }))
        .then((data: any) => {
          if (data.ok && Array.isArray(data.items)) {
            setMyListings(data.items);
            // すでに申請済みのものをセット
            const alreadyRequested = new Set<string>(
              data.items.filter((i: MyListing) => i.sell_requested).map((i: MyListing) => i.item_id)
            );
            setRequestedIds(alreadyRequested);
          }
        })
        .finally(() => setListingsLoading(false));
    }
  }, [router]);

  const handleSellRequest = async (item: MyListing) => {
    if (!myId || !myCode) return;
    setRequestingId(item.item_id);
    setRequestErrors(prev => ({ ...prev, [item.item_id]: "" }));
    try {
      const res = await fetch("/api/market/sell-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: myId, code: myCode, item_id: item.item_id, seller_id: myId }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        setRequestErrors(prev => ({
          ...prev,
          [item.item_id]: data.error || "申請に失敗しました",
        }));
        return;
      }
      setRequestedIds(prev => new Set(prev).add(item.item_id));
    } catch (e) {
      setRequestErrors(prev => ({ ...prev, [item.item_id]: String(e) }));
    } finally {
      setRequestingId("");
    }
  };

  const handleConfirm = async (order: LocalOrder) => {
    if (!myId || !myCode) return;
    setConfirmingId(order.order_id);
    setConfirmErrors(prev => ({ ...prev, [order.order_id]: "" }));
    try {
      const res = await fetch("/api/market/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: myId, code: myCode, order_id: order.order_id }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        setConfirmErrors(prev => ({
          ...prev,
          [order.order_id]: data.gas?.error || data.error || "確定に失敗しました",
        }));
        return;
      }
      updateLocalOrderStatus(order.order_id, "confirmed");
      setOrders(getLocalOrders());
    } catch (e) {
      setConfirmErrors(prev => ({ ...prev, [order.order_id]: String(e) }));
    } finally {
      setConfirmingId("");
    }
  };

  return (
    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_520px_at_12%_-10%,rgba(99,102,241,.16),transparent_60%),radial-gradient(900px_520px_at_112%_0%,rgba(34,211,238,.12),transparent_55%),linear-gradient(180deg,#FFFFFF,#F6F7FB_55%,#FFFFFF)]" />

      <div className="mx-auto max-w-[720px] px-4 py-10">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_26px_70px_rgba(2,6,23,.10)]">

          <div className="flex items-center gap-3">
            <Link
              href="/market"
              className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              ← 戻る
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              <span className="text-base">📦</span>
              購入履歴
            </div>
          </div>

          <h1 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">購入履歴</h1>
          <p className="mt-1 text-sm text-slate-500">
            {ordersSource === "gas" ? "サーバーから取得した購入履歴です。" : "このデバイスでの購入履歴です。"}
          </p>

          {/* 利用ルール */}
          <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
            <p className="mb-1.5 text-xs font-bold text-violet-700">利用ルール</p>
            <ul className="space-y-1 text-xs text-violet-600">
              <li>⚠ EP（Exchangeポイント）は換金できません</li>
              <li>⚠ 外部売買は禁止されています</li>
              <li>⚠ 違反時はアカウント停止となる場合があります</li>
            </ul>
          </div>

          {/* ── 出品中アイテム（売却申請） ── */}
          <div className="mt-8">
            <h2 className="text-base font-extrabold text-slate-900">出品中のアイテム</h2>
            <p className="mt-1 text-xs text-slate-500">運営への売却申請ができます。</p>

            <div className="mt-4 space-y-3">
              {listingsLoading ? (
                <LoadingCat fullscreen={false} textColor="text-slate-400" />
              ) : myListings.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-center">
                  <p className="text-sm text-slate-400">出品中のアイテムはありません</p>
                  <Link
                    href="/market/create"
                    className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    出品する →
                  </Link>
                </div>
              ) : (
                myListings.map(item => {
                  const isRequested = requestedIds.has(item.item_id);
                  const isRequesting = requestingId === item.item_id;
                  return (
                    <div key={item.item_id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-400">{itemTypeLabel(item.item_type)}</p>
                          <p className="mt-0.5 truncate text-sm font-extrabold text-slate-800">
                            {item.title || "（タイトル不明）"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.price.toLocaleString()} {item.currency}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <button
                            onClick={() => handleSellRequest(item)}
                            disabled={isRequested || isRequesting}
                            className={[
                              "rounded-2xl px-4 py-2 text-xs font-semibold transition",
                              isRequested
                                ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                                : isRequesting
                                ? "cursor-not-allowed border border-indigo-200 bg-indigo-50 text-indigo-400"
                                : "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50",
                            ].join(" ")}
                          >
                            {isRequested ? "申請中" : isRequesting ? "送信中…" : "売却申請"}
                          </button>
                        </div>
                      </div>
                      {isRequested && (
                        <p className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                          ご利用ありがとうございます。24時間〜48時間以内に売却申請の可否の返答が行われます。今しばらくお待ちください。
                        </p>
                      )}
                      {requestErrors[item.item_id] && (
                        <p className="mt-2 text-xs text-rose-600">{requestErrors[item.item_id]}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-8 border-t border-slate-100" />

          <div className="mt-6 space-y-4">
            {orders.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-slate-400">購入履歴がありません</p>
                <Link
                  href="/market"
                  className="mt-3 inline-block text-xs font-semibold text-indigo-600 hover:underline"
                >
                  マーケットで探す →
                </Link>
              </div>
            ) : (
              orders.map(order => (
                <div key={order.order_id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={order.status} />
                        <span className="text-[10px] text-slate-400">
                          {itemTypeLabel(order.item_type)}
                        </span>
                      </div>
                      <p className="truncate text-sm font-extrabold text-slate-800">
                        {order.item_title || "（タイトル不明）"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">注文ID: {order.order_id}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(order.created_at).toLocaleString("ja-JP")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-extrabold text-slate-900">
                        {order.price.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-500">{order.currency}</p>
                    </div>
                  </div>

                  {order.status === "paid" && (
                    <div className="mt-3 space-y-2">
                      <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        商品を受け取ったら「受領確定」してください。確定後に出品者へ代金が支払われます。
                      </p>
                      {confirmErrors[order.order_id] && (
                        <p className="text-xs text-rose-600">{confirmErrors[order.order_id]}</p>
                      )}
                      <button
                        onClick={() => handleConfirm(order)}
                        disabled={confirmingId === order.order_id}
                        className="w-full rounded-2xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {confirmingId === order.order_id ? "確定中…" : "✅ 受領確定する"}
                      </button>
                      <Link
                        href={`/market/${order.item_id}`}
                        className="block w-full rounded-2xl border border-slate-200 bg-white py-2.5 text-center text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        商品詳細を見る
                      </Link>
                    </div>
                  )}

                  {order.status === "confirmed" && (
                    <div className="mt-3">
                      <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        ✅ 受領確定済みです。
                      </p>
                    </div>
                  )}

                  {order.status === "refunded" && (
                    <div className="mt-3">
                      <p className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-600">
                        返金が完了しています。
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© LIFAI</div>
      </div>
    </main>
  );
}

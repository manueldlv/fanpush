"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";
import { parseTipAmountFromMessage } from "@/lib/earnings";
import { parsePayoutProfile, type PayoutProfile } from "@/lib/payouts";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { getSupabaseClient } from "@/lib/supabase";
import {
  getCurrentMonthKey,
  getWithdrawalReservedAmount,
  getWithdrawalStatusLabel,
  parseWithdrawalRecord,
  type WithdrawalStatus,
} from "@/lib/withdrawals";
import {
  FANPUSH_WITHDRAWAL_MIN_ARS,
  formatARS,
} from "@/lib/utils";

type SaleItem = {
  id: string;
  type: string;
  title: string;
  count: number;
  total: number;
  createdAt?: string;
  buyer: {
    id: string;
    name: string;
    full: string;
    avatar: string | null;
  };
};

type WithdrawalItem = {
  id: string;
  amount: number;
  status: WithdrawalStatus;
  statusLabel: string;
  requestedAt: string;
  monthKey: string;
};

export default function VentasPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [payoutProfile, setPayoutProfile] = useState<PayoutProfile | null>(null);
  const load = useCallback(async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId) return;

        const { data: postRows } = await supabase
          .from("posts")
          .select("id,user_id,media_type,caption,album_posts(album_id)")
          .eq("user_id", userId);
        const postIds = (postRows ?? []).map((row) => row.id);
        const { data: purchaseRows } =
          postIds.length > 0
            ? await supabase
                .from("purchases")
                .select("id,user_id,post_id,amount,created_at")
                .in("post_id", postIds)
                .order("created_at", { ascending: false })
            : { data: [] };

        const buyerIds = Array.from(
          new Set((purchaseRows ?? []).map((row) => row.user_id)),
        );
        const { data: buyers } = buyerIds.length
          ? await supabase
              .from("users")
              .select("id,username,avatar_url")
              .in("id", buyerIds)
          : { data: [] };

        const buyerMap = new Map(
          (buyers ?? []).map((row) => [row.id, row]),
        );
        const postMap = new Map((postRows ?? []).map((row) => [row.id, row]));

        const albumIds = Array.from(
          new Set(
            (postRows ?? [])
              .map((row) => row.album_posts?.[0]?.album_id)
              .filter(Boolean) as string[],
          ),
        );
        const { data: albumRows } = albumIds.length
          ? await supabase
              .from("albums")
              .select("id,description")
              .in("id", albumIds)
          : { data: [] };
        const albumMap = new Map(
          (albumRows ?? []).map((row) => [row.id, row]),
        );
        const { data: albumPostRows } = albumIds.length
          ? await supabase
              .from("album_posts")
              .select("album_id,post_id")
              .in("album_id", albumIds)
          : { data: [] };
        const albumCountMap = new Map<string, number>();
        (albumPostRows ?? []).forEach((row) => {
          const current = albumCountMap.get(row.album_id) ?? 0;
          albumCountMap.set(row.album_id, current + 1);
        });

        const resolveAvatar = (value: string | null) => {
          if (!value) return null;
          if (value.startsWith("http")) return value;
          const { data: publicUrl } = supabase.storage
            .from("Imagenes")
            .getPublicUrl(value);
          return publicUrl.publicUrl;
        };

        const grouped = new Map<string, SaleItem>();
        (purchaseRows ?? []).forEach((row) => {
          const post = postMap.get(row.post_id);
          const buyer = buyerMap.get(row.user_id);
          const albumId = post?.album_posts?.[0]?.album_id ?? row.post_id;
          const album = albumMap.get(albumId);
          const groupKey = `${albumId}-${row.user_id}`;
          const current = grouped.get(groupKey);
          const count =
            albumCountMap.get(albumId) ??
            (post?.media_type ? 1 : 0);
          const type =
            count > 1 ? "Album" : post?.media_type === "video" ? "Video" : "Foto";
          const base: SaleItem = current ?? {
            id: groupKey,
            type,
            title: album?.description || post?.caption || "Publicación",
            count,
            total: 0,
            createdAt: row.created_at,
            buyer: {
              id: row.user_id,
              name: buyer?.username ?? "usuario",
              full: buyer?.username ?? "Usuario",
              avatar: resolveAvatar(buyer?.avatar_url ?? null),
            },
          };
          grouped.set(groupKey, {
            ...base,
            total: base.total + Number(row.amount || 0),
          });
        });

        const { data: tipRows } = await supabase
          .from("notifications")
          .select("id,actor_id,message,created_at")
          .eq("user_id", userId)
          .eq("type", "tip")
          .order("created_at", { ascending: false });

        (tipRows ?? []).forEach((row) => {
          const amount = parseTipAmountFromMessage(row.message);
          if (!amount) return;
          const buyer = buyerMap.get(row.actor_id);
          grouped.set(`tip-${row.id}`, {
            id: `tip-${row.id}`,
            type: "Propina",
            title: "Propina directa",
            count: 1,
            total: amount,
            createdAt: row.created_at,
            buyer: {
              id: row.actor_id,
              name: buyer?.username ?? "usuario",
              full: buyer?.username ?? "Usuario",
              avatar: resolveAvatar(buyer?.avatar_url ?? null),
            },
          });
        });

        const mapped: SaleItem[] = Array.from(grouped.values()).sort((a, b) =>
          (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
        );

        setSales(mapped);

        const { data: withdrawalRows } = await supabase
          .from("notifications")
          .select("id,message,created_at")
          .eq("user_id", userId)
          .eq("type", "withdrawal_request")
          .order("created_at", { ascending: false });

        const withdrawalItems = (withdrawalRows ?? [])
          .map((row) => {
            const parsed = parseWithdrawalRecord(row.message);
            if (!parsed) return null;
            return {
              id: row.id,
              amount: parsed.amount,
              status: parsed.status,
              statusLabel: getWithdrawalStatusLabel(parsed.status),
              requestedAt: row.created_at,
              monthKey: parsed.monthKey,
            };
          })
          .filter(Boolean) as WithdrawalItem[];

        setWithdrawals(withdrawalItems);

        const { data: payoutRow } = await supabase
          .from("notifications")
          .select("message")
          .eq("user_id", userId)
          .eq("type", "payout_profile")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setPayoutProfile(parsePayoutProfile(payoutRow?.message));
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("purchases-updated", handler);
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      window.removeEventListener("purchases-updated", handler);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [load]);

  const totals = useMemo(() => {
    const totalSales = sales.reduce((acc, item) => acc + item.total, 0);
    const creator = totalSales * 0.7;
    const platform = totalSales * 0.3;
    const reserved = getWithdrawalReservedAmount(withdrawals);
    const withdrawable = Math.max(creator - reserved, 0);
    const canRequest = withdrawable >= FANPUSH_WITHDRAWAL_MIN_ARS;
    const currentMonthKey = getCurrentMonthKey();
    const hasRequestThisMonth = withdrawals.some(
      (item) => item.monthKey === currentMonthKey,
    );
    return {
      totalSales,
      creator,
      platform,
      withdrawable,
      reserved,
      canRequest,
      hasRequestThisMonth,
    };
  }, [sales, withdrawals]);

  const handleRequestWithdrawal = async () => {
    try {
      setRequestError(null);
      setRequestSuccess(null);
      setRequesting(true);
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Necesitas iniciar sesión.");

      const response = await fetch("/api/withdrawals/request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = (await response.json()) as {
        error?: string;
        record?: {
          amount: number;
          status: WithdrawalStatus;
          requestedAt: string;
          monthKey: string;
        };
      };
      if (!response.ok || !result.record) {
        throw new Error(result.error ?? "No se pudo solicitar el retiro.");
      }

      setWithdrawals((prev) => [
        {
          id: `local-${Date.now()}`,
          amount: result.record!.amount,
          status: result.record!.status,
          statusLabel: getWithdrawalStatusLabel(result.record!.status),
          requestedAt: result.record!.requestedAt,
          monthKey: result.record!.monthKey,
        },
        ...prev,
      ]);
      setRequestSuccess(
        "Solicitud enviada. Te avisaremos cuando el retiro quede programado o enviado.",
      );
    } catch (err) {
      setRequestError(
        err instanceof Error ? err.message : "No se pudo solicitar el retiro.",
      );
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      <SidebarLeft
        searchOpen={searchOpen}
        onSearchClick={() => {
          setNotificationsOpen(false);
          setSearchOpen(true);
        }}
        notificationsOpen={notificationsOpen}
        onNotificationsClick={() => {
          setSearchOpen(false);
          setNotificationsOpen(true);
        }}
      />

      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-none flex-col gap-6 px-4 py-6 md:max-w-[1100px] md:gap-8 md:px-6 md:py-8">
          <div>
            <h1 className="text-2xl font-semibold">Mis ventas</h1>
            <p className="text-sm text-zinc-500">
              Resumen de ventas totales y detalle por tipo de contenido.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
              <div className="text-xs text-zinc-500">Ventas totales</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatARS(totals.totalSales)}
              </div>
            </div>
            <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
              <div className="text-xs text-zinc-500">Comision (30%)</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatARS(totals.platform)}
              </div>
            </div>
            <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-5">
              <div className="text-xs text-emerald-700">Tu ganancia (70%)</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-900">
                {formatARS(totals.creator)}
              </div>
            </div>
          </div>

          <div className="rounded-[5px] border border-zinc-200 bg-white">
            <div className="grid grid-cols-8 border-b border-zinc-200 px-4 py-3 text-xs font-semibold text-zinc-500">
              <span>Tipo</span>
              <span className="col-span-2">Contenido</span>
              <span>Comprador</span>
              <span className="text-right">Ventas</span>
              <span className="text-right">Total</span>
              <span className="col-span-2 text-right">Desglose</span>
            </div>
            {loading ? (
              <div className="px-4 py-4 text-sm text-zinc-500">
                Cargando ventas...
              </div>
            ) : null}
            {!loading && sales.length === 0 ? (
              <div className="px-4 py-4 text-sm text-zinc-500">
                Aún no tienes ventas.
              </div>
            ) : null}
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="grid grid-cols-8 items-center px-4 py-3 text-sm text-zinc-700"
              >
                <span>{sale.type}</span>
                <span className="col-span-2">{sale.title}</span>
                <a
                  href={buildUserProfileHref(sale.buyer.name)}
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  {sale.buyer.name}
                </a>
                <span className="text-right">{sale.count}</span>
                <span className="text-right font-semibold">
                  {formatARS(sale.total)}
                </span>
                <span className="col-span-2 text-right text-xs text-zinc-500">
                  {formatARS(sale.total * 0.7)} (70%) · {formatARS(sale.total * 0.3)} (30%)
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-emerald-900">
                  Retirar fondos con MercadoPago
                </div>
                <div className="text-xs text-emerald-700">
                  Disponible para retirar: {formatARS(totals.withdrawable)}
                </div>
                <div className="mt-1 text-xs text-emerald-700">
                  Mínimo para retirar: {formatARS(FANPUSH_WITHDRAWAL_MIN_ARS)}
                </div>
                <div className="mt-1 text-xs text-emerald-700">
                  Los retiros se procesan una vez por mes y pueden demorar hasta 72 hs.
                </div>
                <div className="mt-1 text-xs text-emerald-700">
                  Próxima ventana estimada de pago: entre el 1 y el 3 del próximo ciclo mensual.
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestWithdrawal}
                disabled={
                  requesting ||
                  !totals.canRequest ||
                  totals.hasRequestThisMonth ||
                  !payoutProfile
                }
                className="rounded-[8px] bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requesting
                  ? "Solicitando..."
                  : totals.hasRequestThisMonth
                    ? "Retiro ya solicitado este mes"
                    : totals.canRequest
                      ? payoutProfile
                        ? `Solicitar retiro de ${formatARS(totals.withdrawable)}`
                        : "Completa tus datos de cobro"
                      : `Necesitas al menos ${formatARS(FANPUSH_WITHDRAWAL_MIN_ARS)}`}
              </button>
            </div>
            <div className="mt-4 rounded-[8px] border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-600">
              {payoutProfile ? (
                <>
                  <div className="font-semibold text-zinc-900">Datos de cobro cargados</div>
                  <div className="mt-1">
                    Alias / CVU / CBU: <span className="font-semibold">{payoutProfile.alias}</span>
                  </div>
                  <div className="mt-1">
                    Titular: <span className="font-semibold">{payoutProfile.holderName}</span>
                  </div>
                </>
              ) : (
                <div>
                  Completa tus datos de cobro en Configuración &gt; Cobros y retiros para poder solicitar un retiro.
                </div>
              )}
            </div>
            {requestError ? (
              <div className="mt-4 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                {requestError}
              </div>
            ) : null}
            {requestSuccess ? (
              <div className="mt-4 rounded-[8px] border border-emerald-200 bg-white px-4 py-3 text-xs text-emerald-700">
                {requestSuccess}
              </div>
            ) : null}
          </div>

          <div className="rounded-[5px] border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900">
              Historial de retiros
            </div>
            {withdrawals.length === 0 ? (
              <div className="px-4 py-4 text-sm text-zinc-500">
                Aún no solicitaste retiros.
              </div>
            ) : (
              withdrawals.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-1 gap-2 border-t border-zinc-100 px-4 py-4 text-sm text-zinc-700 md:grid-cols-4"
                >
                  <div>
                    <div className="text-xs text-zinc-500">Fecha</div>
                    <div>{new Date(item.requestedAt).toLocaleString("es-AR")}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Período</div>
                    <div>{item.monthKey}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Monto</div>
                    <div className="font-semibold">{formatARS(item.amount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Estado</div>
                    <div>{item.statusLabel}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-[5px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
            Recibes el 70% de cada venta. La plataforma retiene el 30% en
            concepto de comision. Los retiros se agrupan mensualmente para no
            saturar pagos individuales.
          </div>
        </div>
      </div>
    </div>
  );
}

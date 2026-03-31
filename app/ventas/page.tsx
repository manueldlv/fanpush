"use client";

import { useMemo, useState } from "react";
import SidebarLeft from "@/components/SidebarLeft";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { useGetSalesQuery, useRequestWithdrawalMutation } from "@/lib/redux/api/commerceApi";
import { getCurrentMonthKey, getWithdrawalReservedAmount } from "@/lib/withdrawals";
import {
  FANPUSH_WITHDRAWAL_MIN_ARS,
  formatARS,
} from "@/lib/utils";

export default function VentasPage() {
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const { data, isLoading: loading } = useGetSalesQuery();
  const [requestWithdrawal, { isLoading: requesting }] = useRequestWithdrawalMutation();
  const sales = data?.sales ?? [];
  const withdrawals = data?.withdrawals ?? [];
  const payoutProfile = data?.payoutProfile ?? null;

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
      amountMissing: Math.max(
        FANPUSH_WITHDRAWAL_MIN_ARS - withdrawable,
        0,
      ),
    };
  }, [sales, withdrawals]);

  const handleRequestWithdrawal = async () => {
    try {
      setRequestError(null);
      setRequestSuccess(null);
      await requestWithdrawal().unwrap();
      setRequestSuccess(
        "Solicitud enviada. Te avisaremos cuando el retiro quede programado o enviado.",
      );
    } catch (err) {
      setRequestError(
        err instanceof Error ? err.message : "No se pudo solicitar el retiro.",
      );
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      <SidebarLeft />

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-none flex-col gap-6 px-4 py-6 md:max-w-[1100px] md:gap-8 md:px-6 md:py-8">
          <div>
            <h1 className="text-2xl font-semibold">Mis ventas</h1>
            <p className="text-sm text-zinc-500">
              Resumen de ventas totales y detalle por tipo de contenido.
            </p>
          </div>

          {sales.length === 0 && !loading ? (
            <div className="rounded-[16px] border border-zinc-200 bg-white p-6">
              <div className="text-lg font-semibold text-zinc-900">
                Todavía no tienes ventas
              </div>
              <p className="mt-2 max-w-[640px] text-sm leading-6 text-zinc-600">
                Cuando alguien compre tu contenido o te envíe una propina, aquí
                verás el resumen, tu ganancia neta y el estado de los retiros.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="/crear"
                  className="rounded-[12px] bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Crear mi primera publicación
                </a>
                <a
                  href="/settings"
                  className="rounded-[12px] border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700"
                >
                  Completar datos de cobro
                </a>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-[16px] border border-zinc-200 bg-white p-5">
              <div className="text-xs text-zinc-500">Ventas totales</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatARS(totals.totalSales)}
              </div>
            </div>
            <div className="rounded-[16px] border border-zinc-200 bg-white p-5">
              <div className="text-xs text-zinc-500">Comision (30%)</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatARS(totals.platform)}
              </div>
            </div>
            <div className="rounded-[16px] border border-zinc-200 bg-white p-5">
              <div className="text-xs text-zinc-500">Tu ganancia (70%)</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">
                {formatARS(totals.creator)}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[16px] border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-900">Detalle de ventas</div>
              <div className="mt-1 text-xs text-zinc-500">
                Cada compra o propina aparece aquí con su desglose.
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-zinc-50">
                  <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-500">
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Contenido</th>
                    <th className="px-4 py-3 text-left">Comprador</th>
                    <th className="px-4 py-3 text-right">Ventas</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Desglose</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className="border-t border-zinc-100">
                      <td
                        colSpan={6}
                        className="px-4 py-5"
                      >
                        <div className="flex min-h-[88px] items-center rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-500">
                          Cargando ventas...
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {!loading && sales.length === 0 ? (
                    <tr className="border-t border-zinc-100">
                      <td
                        colSpan={6}
                        className="px-4 py-5"
                      >
                        <div className="flex min-h-[88px] items-center rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-500">
                          <span className="font-medium text-zinc-700">
                            No hay datos para mostrar.
                          </span>
                          <span className="ml-2">
                            Cuando se registre una compra o propina, aparecerá aquí.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-t border-zinc-100 text-sm text-zinc-700"
                    >
                      <td className="px-4 py-3">{sale.type}</td>
                      <td className="px-4 py-3">{sale.title}</td>
                      <td className="px-4 py-3">
                        <a
                          href={buildUserProfileHref(sale.buyer.name)}
                          className="text-sm font-semibold text-blue-600 hover:underline"
                        >
                          {sale.buyer.name}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right">{sale.count}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatARS(sale.total)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-zinc-500">
                        {formatARS(sale.total * 0.7)} (70%) · {formatARS(sale.total * 0.3)} (30%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[16px] border border-zinc-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  Retirar fondos con MercadoPago
                </div>
                <div className="text-xs text-zinc-600">
                  Disponible para retirar: {formatARS(totals.withdrawable)}
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  Mínimo para retirar: {formatARS(FANPUSH_WITHDRAWAL_MIN_ARS)}
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  Los retiros se procesan una vez por mes y pueden demorar hasta 72 hs.
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  Próxima ventana estimada de pago: entre el 1 y el 3 del próximo ciclo mensual.
                </div>
              </div>
              <div className="flex flex-col items-start gap-3 sm:items-end">
                {totals.canRequest && payoutProfile && !totals.hasRequestThisMonth ? (
                  <button
                    type="button"
                    onClick={handleRequestWithdrawal}
                    disabled={requesting}
                    className="rounded-[12px] bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {requesting
                      ? "Solicitando..."
                      : `Solicitar retiro de ${formatARS(totals.withdrawable)}`}
                  </button>
                ) : null}
                {totals.hasRequestThisMonth ? (
                  <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700">
                    Ya solicitaste un retiro este mes
                  </div>
                ) : null}
                {!totals.canRequest ? (
                  <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
                    Te faltan {formatARS(totals.amountMissing)} para llegar al mínimo de{" "}
                    {formatARS(FANPUSH_WITHDRAWAL_MIN_ARS)}
                  </div>
                ) : null}
                {totals.canRequest && !payoutProfile ? (
                  <a
                    href="/settings"
                    className="rounded-[12px] border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    Completar datos de cobro
                  </a>
                ) : null}
              </div>
            </div>
            <div className="mt-4 rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
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
              <div className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                {requestError}
              </div>
            ) : null}
            {requestSuccess ? (
              <div className="mt-4 rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                {requestSuccess}
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[16px] border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-900">Historial de retiros</div>
              <div className="mt-1 text-xs text-zinc-500">
                Seguimiento de cada solicitud de retiro y su estado.
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-zinc-50">
                  <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-500">
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Período</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className="border-t border-zinc-100">
                      <td
                        colSpan={4}
                        className="px-4 py-5"
                      >
                        <div className="flex min-h-[88px] items-center rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-500">
                          Cargando retiros...
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {!loading && withdrawals.length === 0 ? (
                    <tr className="border-t border-zinc-100">
                      <td
                        colSpan={4}
                        className="px-4 py-5"
                      >
                        <div className="flex min-h-[88px] items-center rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-500">
                          <span className="font-medium text-zinc-700">
                            No hay datos para mostrar.
                          </span>
                          <span className="ml-2">Aún no solicitaste retiros.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    withdrawals.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-zinc-100 text-sm text-zinc-700"
                      >
                        <td className="px-4 py-4">
                          {new Date(item.requestedAt).toLocaleString("es-AR")}
                        </td>
                        <td className="px-4 py-4">{item.monthKey}</td>
                        <td className="px-4 py-4 text-right font-semibold">
                          {formatARS(item.amount)}
                        </td>
                        <td className="px-4 py-4 text-right">{item.statusLabel}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[16px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
            Recibes el 70% de cada venta. La plataforma retiene el 30% en
            concepto de comision. Los retiros se agrupan mensualmente para no
            saturar pagos individuales.
          </div>
        </div>
      </div>
    </div>
  );
}

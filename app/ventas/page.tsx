"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import SidebarLeft from "@/components/SidebarLeft";
import { buildUserProfileHref } from "@/lib/profileRoute";
import {
  useCancelWithdrawalMutation,
  useGetSalesQuery,
  useRequestWithdrawalMutation,
} from "@/lib/redux/api/commerceApi";
import { useGetViewerQuery } from "@/lib/redux/api/sessionApi";
import { getCurrentMonthKey, getWithdrawalReservedAmount } from "@/lib/withdrawals";
import { FANPUSH_WITHDRAWAL_MIN_ARS, formatARS } from "@/lib/utils";

const SALES_PAGE_SIZE = 10;

export default function VentasPage() {
  const router = useRouter();
  const payoutPromptRef = useRef<HTMLDivElement | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [tab, setTab] = useState<"sales" | "withdrawals">("sales");
  const [salesPage, setSalesPage] = useState(1);
  const [highlightPayoutSetup, setHighlightPayoutSetup] = useState(false);

  const { data: viewer, isLoading: viewerLoading } = useGetViewerQuery();
  const { data, isLoading: loading, refetch } = useGetSalesQuery();
  const [requestWithdrawal, { isLoading: requesting }] = useRequestWithdrawalMutation();
  const [cancelWithdrawal, { isLoading: cancelling }] = useCancelWithdrawalMutation();

  useEffect(() => {
    if (!viewerLoading && viewer && !viewer.access.isAuthor) {
      router.replace("/saldo");
    }
  }, [router, viewer, viewerLoading]);

  if (!viewerLoading && viewer && !viewer.access.isAuthor) {
    return null;
  }

  const sales = data?.sales ?? [];
  const withdrawals = data?.withdrawals ?? [];
  const payoutProfile = data?.payoutProfile ?? null;
  const availableToWithdraw = data?.availableToWithdraw ?? 0;
  const reservedToWithdraw = data?.reservedToWithdraw ?? 0;

  const getMutationErrorMessage = (value: unknown, fallback: string) => {
    if (value instanceof Error && value.message) return value.message;
    if (
      typeof value === "object" &&
      value !== null &&
      "error" in value &&
      typeof value.error === "string"
    ) {
      return value.error;
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "data" in value &&
      typeof value.data === "object" &&
      value.data !== null &&
      "error" in value.data &&
      typeof value.data.error === "string"
    ) {
      return value.data.error;
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "message" in value &&
      typeof value.message === "string"
    ) {
      return value.message;
    }
    return fallback;
  };

  const totals = useMemo(() => {
    const totalSales = sales.reduce((acc, item) => acc + item.total, 0);
    const creator = totalSales * 0.7;
    const platform = totalSales * 0.3;
    const reserved = Math.max(reservedToWithdraw, getWithdrawalReservedAmount(withdrawals));
    const withdrawable = Math.max(availableToWithdraw, 0);
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
      amountMissing: Math.max(FANPUSH_WITHDRAWAL_MIN_ARS - withdrawable, 0),
    };
  }, [availableToWithdraw, reservedToWithdraw, sales, withdrawals]);

  const parsedWithdrawalAmount = Math.floor(Number(withdrawalAmount) || 0);
  const withdrawalAmountError =
    withdrawalAmount.trim().length === 0
      ? "Ingresa el monto que quieres retirar."
      : parsedWithdrawalAmount < FANPUSH_WITHDRAWAL_MIN_ARS
        ? `El mínimo es ${formatARS(FANPUSH_WITHDRAWAL_MIN_ARS)}.`
        : parsedWithdrawalAmount > totals.withdrawable
          ? "No puedes retirar más de lo disponible."
          : null;

  const canSubmitWithdrawal =
    totals.canRequest &&
    Boolean(payoutProfile) &&
    !totals.hasRequestThisMonth &&
    !withdrawalAmountError;
  const payoutSettingsHref = "/settings?tab=payments#cobros-retiros";

  const salesPageCount = Math.max(1, Math.ceil(sales.length / SALES_PAGE_SIZE));
  const currentSalesPage = Math.min(salesPage, salesPageCount);
  const paginatedSales = sales.slice(
    (currentSalesPage - 1) * SALES_PAGE_SIZE,
    currentSalesPage * SALES_PAGE_SIZE,
  );
  const salesRangeStart = sales.length === 0 ? 0 : (currentSalesPage - 1) * SALES_PAGE_SIZE + 1;
  const salesRangeEnd = Math.min(currentSalesPage * SALES_PAGE_SIZE, sales.length);

  const quickAmounts = [
    FANPUSH_WITHDRAWAL_MIN_ARS,
    Math.floor(totals.withdrawable / 2),
    Math.floor(totals.withdrawable),
  ].filter((amount, index, array) => {
    return (
      amount >= FANPUSH_WITHDRAWAL_MIN_ARS &&
      amount <= totals.withdrawable &&
      array.indexOf(amount) === index
    );
  });

  useEffect(() => {
    if (totals.withdrawable <= 0) {
      setWithdrawalAmount("");
      return;
    }
    setWithdrawalAmount(String(Math.floor(totals.withdrawable)));
  }, [totals.withdrawable]);

  useEffect(() => {
    setSalesPage(1);
  }, [sales.length]);

  useEffect(() => {
    if (payoutProfile) {
      setHighlightPayoutSetup(false);
    }
  }, [payoutProfile]);

  const handleRequestWithdrawal = async () => {
    if (!payoutProfile) {
      setHighlightPayoutSetup(true);
      payoutPromptRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    try {
      setRequestError(null);
      setRequestSuccess(null);
      const parsedAmount = Math.floor(Number(withdrawalAmount) || 0);
      await requestWithdrawal({ amount: parsedAmount }).unwrap();
      setRequestSuccess(
        `Solicitud enviada por ${formatARS(parsedAmount)}. Te avisaremos cuando el retiro quede programado o enviado.`,
      );
      await refetch();
    } catch (err) {
      setRequestError(getMutationErrorMessage(err, "No se pudo solicitar el retiro."));
    }
  };

  const handleCancelWithdrawal = async (id: string) => {
    try {
      setRequestError(null);
      setRequestSuccess(null);
      await cancelWithdrawal({ id }).unwrap();
      setRequestSuccess("Retiro cancelado. El saldo volvió a quedar disponible.");
      await refetch();
    } catch (err) {
      setRequestError(getMutationErrorMessage(err, "No se pudo cancelar el retiro."));
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SidebarLeft />

      <div className="flex min-h-screen md:pl-60">
        <div className="mx-auto flex w-full max-w-none flex-col gap-6 px-4 py-5 pb-24 md:max-w-[1140px] md:gap-8 md:px-6 md:py-8">
          <div>
            <h1 className="text-2xl font-semibold">Mis ventas</h1>
            <p className="text-sm text-zinc-500">
              Resumen de ingresos, retiros y detalle completo de tu actividad.
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
                  className="rounded-[12px] bg-[#5A3EE7] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4931bc]"
                >
                  Crear mi primera publicación
                </a>
                <a
                  href={payoutSettingsHref}
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
              <div className="text-xs text-zinc-500">Tu ganancia (70%)</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">
                {formatARS(totals.creator)}
              </div>
            </div>
            <div className="rounded-[16px] border border-zinc-200 bg-white p-5">
              <div className="text-xs text-zinc-500">Disponible para retirar</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-950">
                {formatARS(totals.withdrawable)}
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border border-zinc-200 bg-white p-2">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "sales" as const, label: "Detalle de ventas" },
                { id: "withdrawals" as const, label: "Retiros" },
              ].map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`rounded-[12px] px-4 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "bg-zinc-100 text-zinc-950"
                        : "bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {tab === "sales" ? (
            <div className="overflow-hidden rounded-[16px] border border-zinc-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Detalle de ventas</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Compras y propinas registradas, con paginación para revisar historiales largos.
                  </div>
                </div>
                <div className="text-xs text-zinc-500">
                  {salesRangeStart}-{salesRangeEnd} de {sales.length} movimientos
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
                      <th className="px-4 py-3 text-right">Monto</th>
                      <th className="px-4 py-3 text-right">Desglose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr className="border-t border-zinc-100">
                        <td colSpan={6} className="px-4 py-5">
                          <div className="flex min-h-[88px] items-center rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-500">
                            Cargando ventas...
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    {!loading && sales.length === 0 ? (
                      <tr className="border-t border-zinc-100">
                        <td colSpan={6} className="px-4 py-5">
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
                    ) : (
                      paginatedSales.map((sale) => (
                        <tr
                          key={sale.id}
                          className="border-t border-zinc-100 text-sm text-zinc-700"
                        >
                          <td className="px-4 py-3">{sale.type}</td>
                          <td className="px-4 py-3">
                            <Link
                              href={`${buildUserProfileHref(viewer?.profile.username ?? "")}?post=${encodeURIComponent(sale.albumId)}`}
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {sale.title}
                            </Link>
                          </td>
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
                <div className="text-xs text-zinc-500">
                  Página {currentSalesPage} de {salesPageCount}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSalesPage((value) => Math.max(1, value - 1))}
                    disabled={currentSalesPage === 1}
                    className="rounded-[10px] border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalesPage((value) => Math.min(salesPageCount, value + 1))}
                    disabled={currentSalesPage === salesPageCount}
                    className="rounded-[10px] border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "withdrawals" ? (
            <div className="space-y-5">
              <div className="space-y-5 rounded-[20px] border border-zinc-200 bg-white p-6">
                <div>
                  <div className="text-lg font-semibold text-zinc-900">
                    Retiros con Mercado Pago
                  </div>
                  <p className="mt-2 max-w-[760px] text-sm leading-6 text-zinc-600">
                    Desde acá puedes ingresar el monto que quieres retirar y enviar la solicitud cuando tu saldo esté listo.
                  </p>
                </div>
                <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 p-5">
                  <div className="text-[15px] font-semibold text-zinc-900">
                    Monto a retirar
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-[16px] border border-zinc-200 bg-white px-4 py-4">
                    <span className="text-xl font-semibold text-zinc-500">$</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={FANPUSH_WITHDRAWAL_MIN_ARS}
                      max={Math.floor(totals.withdrawable)}
                      step={1}
                      value={withdrawalAmount}
                      onChange={(event) => setWithdrawalAmount(event.target.value)}
                      className="w-full bg-transparent text-2xl font-semibold text-zinc-950 outline-none placeholder:text-zinc-300"
                      placeholder={`${FANPUSH_WITHDRAWAL_MIN_ARS.toLocaleString("es-AR")}`}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {quickAmounts.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setWithdrawalAmount(String(amount))}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
                      >
                        {formatARS(amount)}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[14px] border border-zinc-200 bg-white p-4">
                      <div className="text-xs font-medium text-zinc-500">Disponible</div>
                      <div className="mt-2 text-lg font-semibold text-zinc-900">
                        {formatARS(totals.withdrawable)}
                      </div>
                    </div>
                    <div className="rounded-[14px] border border-zinc-200 bg-white p-4">
                      <div className="text-xs font-medium text-zinc-500">Mínimo</div>
                      <div className="mt-2 text-lg font-semibold text-zinc-900">
                        {formatARS(FANPUSH_WITHDRAWAL_MIN_ARS)}
                      </div>
                    </div>
                  </div>
                </div>

                {withdrawalAmountError && !totals.hasRequestThisMonth ? (
                  <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    {withdrawalAmountError}
                  </div>
                ) : null}
                {totals.hasRequestThisMonth ? (
                  <div className="rounded-[12px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
                    Ya solicitaste un retiro este mes.
                  </div>
                ) : null}
                {!totals.canRequest && !totals.hasRequestThisMonth ? (
                  <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    Te faltan {formatARS(totals.amountMissing)} para llegar al mínimo.
                  </div>
                ) : null}
                {totals.canRequest && !payoutProfile ? (
                  <div ref={payoutPromptRef}>
                    <a
                      href={payoutSettingsHref}
                      className={`inline-flex w-fit rounded-[12px] border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition ${
                        highlightPayoutSetup
                          ? "border-[#5A3EE7] ring-4 ring-[#5A3EE7]/15"
                          : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                      }`}
                    >
                      Completar datos de cobro
                    </a>
                  </div>
                ) : null}
                {totals.canRequest && !payoutProfile && highlightPayoutSetup ? (
                  <div className="rounded-[12px] border border-[#5A3EE7]/20 bg-[#5A3EE7]/5 px-4 py-3 text-sm font-semibold text-[#4931bc]">
                    Para retirar primero completa tus datos en cobros y retiros.
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleRequestWithdrawal}
                  disabled={
                    requesting ||
                    totals.hasRequestThisMonth ||
                    !totals.canRequest ||
                    Boolean(withdrawalAmountError)
                  }
                  className="fanpush-button-primary w-full rounded-[16px] px-4 py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {requesting ? "Solicitando..." : "Solicitar retiro"}
                </button>
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
                        <th className="px-4 py-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr className="border-t border-zinc-100">
                          <td colSpan={5} className="px-4 py-5">
                            <div className="flex min-h-[88px] items-center rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-500">
                              Cargando retiros...
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      {!loading && withdrawals.length === 0 ? (
                        <tr className="border-t border-zinc-100">
                          <td colSpan={5} className="px-4 py-5">
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
                            <td className="px-4 py-4 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span>{item.statusLabel}</span>
                                {item.status === "rejected" ? (
                                  <span className="text-[11px] text-emerald-600">
                                    Saldo devuelto
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              {item.status === "requested" ? (
                                <button
                                  type="button"
                                  onClick={() => handleCancelWithdrawal(item.id)}
                                  disabled={cancelling}
                                  className="inline-flex items-center justify-center rounded-full p-2 text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label="Cancelar retiro"
                                  title="Cancelar retiro"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : (
                                <span className="text-xs text-zinc-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {requestError ? (
            <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {requestError}
            </div>
          ) : null}
          {requestSuccess ? (
            <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
              {requestSuccess}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

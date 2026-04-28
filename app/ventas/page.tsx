"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
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
import { useEscapeKey } from "@/lib/useEscapeKey";
import { FANPUSH_WITHDRAWAL_MIN_ARS, formatARS } from "@/lib/utils";

const SALES_PAGE_SIZE = 10;

export default function VentasPage() {
  const router = useRouter();
  const payoutPromptRef = useRef<HTMLDivElement | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalSubmitAttempted, setWithdrawalSubmitAttempted] = useState(false);
  const [tab, setTab] = useState<"sales" | "withdrawals">("sales");
  const [salesPage, setSalesPage] = useState(1);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<{
    id: string;
    amount: number;
    statusLabel: string;
    payoutAlias?: string;
    payoutHolderName?: string;
    payoutHolderDocument?: string;
    payoutBank?: string;
  } | null>(null);
  const { data: viewer, isLoading: viewerLoading } = useGetViewerQuery();
  const { data, isLoading: loading, refetch } = useGetSalesQuery();
  const [requestWithdrawal, { isLoading: requesting }] = useRequestWithdrawalMutation();
  const [cancelWithdrawal, { isLoading: cancelling }] = useCancelWithdrawalMutation();

  useEscapeKey(Boolean(selectedWithdrawal), () => setSelectedWithdrawal(null));
  useEscapeKey(withdrawalModalOpen, () => {
    setWithdrawalModalOpen(false);
    setWithdrawalAmount("");
    setWithdrawalSubmitAttempted(false);
    setRequestError(null);
    setRequestSuccess(null);
  });

  useEffect(() => {
    if (!viewerLoading && viewer && !viewer.access.isAuthor) {
      router.replace("/saldo");
    }
  }, [router, viewer, viewerLoading]);

  const sales = data?.sales ?? [];
  const withdrawals = data?.withdrawals ?? [];
  const payoutProfile = data?.payoutProfile ?? null;
  const payoutProfileComplete = Boolean(
    payoutProfile?.alias?.trim() &&
      payoutProfile?.holderName?.trim() &&
      payoutProfile?.holderDocument?.trim(),
  );
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
    const postSales = sales
      .filter((item) => item.type !== "Propina" && item.type !== "Chat")
      .reduce((acc, item) => acc + item.total, 0);
    const creatorPosts = postSales * 0.7;
    const tipsAndChats = sales
      .filter((item) => item.type === "Propina" || item.type === "Chat")
      .reduce((acc, item) => acc + item.total * 0.7, 0);
    const reserved = Math.max(reservedToWithdraw, getWithdrawalReservedAmount(withdrawals));
    const withdrawable = Math.max(availableToWithdraw, 0);
    const canRequest = withdrawable >= FANPUSH_WITHDRAWAL_MIN_ARS;
    const currentMonthKey = getCurrentMonthKey();
    const hasRequestThisMonth = withdrawals.some(
      (item) => item.monthKey === currentMonthKey && item.status !== "rejected",
    );

    return {
      totalSales,
      creatorPosts,
      tipsAndChats,
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
  const payoutProfileError = payoutProfileComplete
    ? null
    : "Configura tu cuenta de cobro en Configuración antes de solicitar un retiro.";

  const canSubmitWithdrawal =
    totals.canRequest &&
    !totals.hasRequestThisMonth &&
    !payoutProfileError &&
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

  const openWithdrawalModal = () => {
    setRequestError(null);
    setRequestSuccess(null);
    setWithdrawalSubmitAttempted(false);
    setWithdrawalModalOpen(true);
  };

  const closeWithdrawalModal = () => {
    if (requesting) return;
    setWithdrawalModalOpen(false);
  };

  const handleRequestWithdrawal = async () => {
    setWithdrawalSubmitAttempted(true);
    if (withdrawalAmountError || payoutProfileError) {
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
      setWithdrawalModalOpen(false);
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

  if (!viewerLoading && viewer && !viewer.access.isAuthor) {
    return null;
  }

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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[16px] border border-zinc-200 bg-white p-5">
              <div className="text-xs text-zinc-500">Ventas totales</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatARS(totals.totalSales)}
              </div>
            </div>
            <div className="rounded-[16px] border border-zinc-200 bg-white p-5">
              <div className="text-xs text-zinc-500">Tu ganancia (posts)</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">
                {formatARS(totals.creatorPosts)}
              </div>
            </div>
            <div className="rounded-[16px] border border-zinc-200 bg-white p-5">
              <div className="text-xs text-zinc-500">Propinas y chats (70%)</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">
                {formatARS(totals.tipsAndChats)}
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
                            {sale.href ? (
                              <Link
                                href={sale.href}
                                className="font-medium text-blue-600 hover:underline"
                              >
                                {sale.title}
                              </Link>
                            ) : (
                              <span className="font-medium text-zinc-700">{sale.title}</span>
                            )}
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
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-zinc-900">
                      Retiros con Mercado Pago
                    </div>
                    <p className="mt-2 max-w-[760px] text-sm leading-6 text-zinc-600">
                      Gestiona tus retiros desde un popup dedicado. El mínimo para retirar es {formatARS(FANPUSH_WITHDRAWAL_MIN_ARS)}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openWithdrawalModal}
                    disabled={!totals.canRequest || totals.hasRequestThisMonth}
                    className="fanpush-button-primary rounded-[14px] px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Nuevo retiro
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 p-5">
                    <div className="text-xs font-medium text-zinc-500">Disponible</div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-950">
                      {formatARS(totals.withdrawable)}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 p-5">
                    <div className="text-xs font-medium text-zinc-500">Reservado</div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-900">
                      {formatARS(totals.reserved)}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 p-5">
                    <div className="text-xs font-medium text-zinc-500">Cuenta de cobro</div>
                    <div className="mt-2 text-sm font-semibold text-zinc-900">
                      {payoutProfile?.alias?.trim() ? payoutProfile.alias : "Sin configurar"}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {payoutProfile?.notes?.trim()
                        ? payoutProfile.notes
                        : payoutProfileComplete
                          ? "Cuenta lista para recibir retiros."
                          : "Configúrala desde Configuración para poder retirar."}
                    </div>
                  </div>
                </div>

                <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 p-5">
                  <div className="text-sm font-semibold text-zinc-900">
                    Cómo funciona
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Cuando abras un nuevo retiro podrás definir el monto y usar la cuenta de cobro que ya guardaste en Configuración. El alias, CBU o CVU debe estar a nombre del autor; si no coincide, el retiro se rechaza.
                  </p>
                </div>

                {totals.hasRequestThisMonth ? (
                  <div className="rounded-[12px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
                    Ya solicitaste un retiro este mes.
                  </div>
                ) : null}
                {!totals.canRequest ? (
                  <div className="rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
                    Te faltan {formatARS(totals.amountMissing)} para llegar al mínimo de retiro.
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
                                <button
                                  type="button"
                                  onClick={() => setSelectedWithdrawal(item)}
                                  className="font-semibold text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:text-[#5A3EE7]"
                                >
                                  {item.statusLabel}
                                </button>
                                {item.status === "rejected" ? (
                                  <span className="text-[11px] text-emerald-600">
                                    Saldo devuelto
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedWithdrawal(item)}
                                  className="rounded-[10px] border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                                >
                                  Ver datos
                                </button>
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
                                ) : null}
                              </div>
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

      {selectedWithdrawal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4 py-6">
          <button
            type="button"
            onClick={() => setSelectedWithdrawal(null)}
            className="absolute inset-0"
            aria-label="Cerrar detalle del retiro"
          />
          <div className="relative z-10 w-full max-w-[640px] rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-zinc-950">
                  Detalle del retiro
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Estos son los datos bancarios guardados en esa solicitud.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWithdrawal(null)}
                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[16px] border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-medium text-zinc-500">Monto</div>
                <div className="mt-2 text-lg font-semibold text-zinc-900">
                  {formatARS(selectedWithdrawal.amount)}
                </div>
              </div>
              <div className="rounded-[16px] border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-medium text-zinc-500">Estado</div>
                <div className="mt-2 text-lg font-semibold text-zinc-900">
                  {selectedWithdrawal.statusLabel}
                </div>
              </div>
              <div className="rounded-[16px] border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-medium text-zinc-500">Alias / CBU / CVU</div>
                <div className="mt-2 text-sm font-semibold text-zinc-900">
                  {selectedWithdrawal.payoutAlias?.trim() || "No registrado"}
                </div>
              </div>
              <div className="rounded-[16px] border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-medium text-zinc-500">Banco</div>
                <div className="mt-2 text-sm font-semibold text-zinc-900">
                  {selectedWithdrawal.payoutBank?.trim() || "No registrado"}
                </div>
              </div>
              <div className="rounded-[16px] border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-medium text-zinc-500">Titular</div>
                <div className="mt-2 text-sm font-semibold text-zinc-900">
                  {selectedWithdrawal.payoutHolderName?.trim() || "No registrado"}
                </div>
              </div>
              <div className="rounded-[16px] border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs font-medium text-zinc-500">Documento</div>
                <div className="mt-2 text-sm font-semibold text-zinc-900">
                  {selectedWithdrawal.payoutHolderDocument?.trim() || "No registrado"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {withdrawalModalOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4 py-6">
          <button
            type="button"
            onClick={closeWithdrawalModal}
            className="absolute inset-0"
            aria-label="Cerrar modal de retiro"
          />
          <div className="relative z-10 w-full max-w-[720px] rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-zinc-950">
                  Nuevo retiro
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {payoutProfileComplete
                    ? "Confirma el monto del retiro. Vamos a usar la cuenta de cobro guardada en Configuración."
                    : "Antes de solicitar un retiro tienes que configurar tu cuenta de cobro en Configuración."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeWithdrawalModal}
                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              El alias, CBU o CVU debe estar a nombre del autor. Si no coincide con la titularidad de la cuenta, el retiro será rechazado.
            </div>

            {payoutProfileComplete ? (
              <div className="mt-5 grid gap-5">
                <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 p-5">
                  <div className="text-[15px] font-semibold text-zinc-900">
                    Cuenta de cobro
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[14px] border border-zinc-200 bg-white p-4">
                      <div className="text-xs font-medium text-zinc-500">Alias / CBU / CVU</div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900">
                        {payoutProfile?.alias}
                      </div>
                    </div>
                    <div className="rounded-[14px] border border-zinc-200 bg-white p-4">
                      <div className="text-xs font-medium text-zinc-500">Titular</div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900">
                        {payoutProfile?.holderName}
                      </div>
                    </div>
                    <div className="rounded-[14px] border border-zinc-200 bg-white p-4">
                      <div className="text-xs font-medium text-zinc-500">Documento</div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900">
                        {payoutProfile?.holderDocument}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-zinc-500">
                    Si necesitas cambiar estos datos, hazlo desde{" "}
                    <Link
                      href={payoutSettingsHref}
                      className="font-semibold text-[#5A3EE7] hover:underline"
                    >
                      Configuración
                    </Link>
                    .
                  </div>
                </div>

                <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 p-5">
                  <div className="text-[15px] font-semibold text-zinc-900">
                    Monto a retirar
                  </div>
                  <div
                    className={`mt-4 flex items-center gap-2 rounded-[16px] border bg-white px-4 py-4 transition ${
                      withdrawalSubmitAttempted && withdrawalAmountError && !totals.hasRequestThisMonth
                        ? "border-red-400 ring-4 ring-red-500/10"
                        : "border-zinc-200"
                    }`}
                  >
                    <span className="text-xl font-semibold text-zinc-500">$</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={FANPUSH_WITHDRAWAL_MIN_ARS}
                      max={Math.floor(totals.withdrawable)}
                      step={1}
                      value={withdrawalAmount}
                      onChange={(event) => {
                        setWithdrawalAmount(event.target.value);
                        setWithdrawalSubmitAttempted(false);
                      }}
                      className="w-full bg-transparent text-2xl font-semibold text-zinc-950 outline-none placeholder:text-zinc-300"
                      placeholder={`${FANPUSH_WITHDRAWAL_MIN_ARS.toLocaleString("es-AR")}`}
                    />
                  </div>
                  {withdrawalSubmitAttempted && withdrawalAmountError && !totals.hasRequestThisMonth ? (
                    <div className="mt-2 text-sm font-semibold text-red-600">
                      {withdrawalAmountError}
                    </div>
                  ) : null}

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
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[18px] border border-zinc-200 bg-zinc-50 p-5">
                <div className="text-[15px] font-semibold text-zinc-900">
                  Configura tu cuenta de cobro
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Para solicitar retiros necesitas cargar tu alias o CBU, titular y documento en Configuración.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      closeWithdrawalModal();
                      router.push(payoutSettingsHref);
                    }}
                    className="fanpush-button-primary rounded-[14px] px-5 py-3 text-sm font-semibold"
                  >
                    Ir a Configuración
                  </button>
                  <button
                    type="button"
                    onClick={closeWithdrawalModal}
                    className="rounded-[14px] border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700"
                  >
                    Ahora no
                  </button>
                </div>
              </div>
            )}

            {withdrawalSubmitAttempted && payoutProfileError ? (
              <div className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {payoutProfileError}
              </div>
            ) : null}

            {!payoutProfileComplete ? (
              <div ref={payoutPromptRef} className="mt-4 rounded-[12px] border border-[#5A3EE7]/20 bg-[#5A3EE7]/5 px-4 py-3 text-sm font-medium text-[#4931bc]">
                Cuando guardes tu cuenta de cobro en Configuración, podrás volver acá y solicitar el retiro.
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={closeWithdrawalModal}
                className="rounded-[14px] border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRequestWithdrawal}
                disabled={requesting || totals.hasRequestThisMonth || !payoutProfileComplete}
                className="fanpush-button-primary rounded-[14px] px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requesting ? "Solicitando..." : "Solicitar retiro"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

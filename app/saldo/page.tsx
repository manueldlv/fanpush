"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownToLine, BadgePlus, Wallet } from "lucide-react";
import SidebarLeft from "@/components/SidebarLeft";
import { useCreateCheckoutPreferenceMutation } from "@/lib/redux/api/commerceApi";
import { useGetViewerQuery } from "@/lib/redux/api/sessionApi";
import { formatARS } from "@/lib/utils";

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000];

export default function SaldoPage() {
  const searchParams = useSearchParams();
  const [amount, setAmount] = useState("10000");
  const [error, setError] = useState<string | null>(null);
  const { data: viewer, isLoading: viewerLoading } = useGetViewerQuery();
  const [createCheckoutPreference, { isLoading: submitting }] =
    useCreateCheckoutPreferenceMutation();

  const depositSuccess = searchParams.get("checkout") === "deposit";
  const depositedTotal = Number(searchParams.get("deposit_total") || 0);
  const showSkeleton = viewerLoading && !viewer;
  const spendableBalance = viewer?.commerce.balance ?? 0;

  const amountNumber = useMemo(() => Number(amount), [amount]);

  const handleDeposit = async () => {
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Ingresa un monto válido para cargar saldo.");
      return;
    }

    setError(null);
    try {
      const result = await createCheckoutPreference({
        kind: "deposit",
        amount: amountNumber,
        returnPath: "/saldo",
      }).unwrap();
      window.location.assign(result.initPoint);
    } catch (depositError) {
      setError(
        depositError instanceof Error
          ? depositError.message
          : "No se pudo iniciar la carga de saldo.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SidebarLeft />

      <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-24 md:pl-[280px] md:pr-8">
        <section className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-400">
                FanPush
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
                Mi saldo
              </h1>
              <p className="max-w-2xl text-sm text-zinc-500">
                Carga saldo para comprar contenido, dejar propinas y moverte dentro de la
                plataforma sin depender de un checkout externo en cada acción.
              </p>
            </div>

            {depositSuccess && depositedTotal > 0 ? (
              <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                Se acreditaron {formatARS(depositedTotal)} en tu saldo.
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="rounded-[20px] border border-zinc-200 bg-zinc-950 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm text-white/60">Disponible para usar</div>
                  {showSkeleton ? (
                    <div className="fanpush-skeleton mt-2 h-10 w-36 rounded-xl bg-white/10" />
                  ) : (
                    <div className="mt-2 text-4xl font-semibold tracking-tight">
                      {formatARS(spendableBalance)}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {showSkeleton ? (
                  <>
                    <div className="fanpush-skeleton h-20 rounded-[16px] bg-white/10" />
                    <div className="fanpush-skeleton h-20 rounded-[16px] bg-white/10" />
                    <div className="fanpush-skeleton h-20 rounded-[16px] bg-white/10" />
                  </>
                ) : (
                  <>
                    <div className="rounded-[16px] border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                          Cash
                        </div>
                        <div className="mt-2 text-lg font-semibold">
                          {formatARS(viewer?.commerce.cashAvailable ?? 0)}
                        </div>
                      </div>
                    <div className="rounded-[16px] border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                          Bonus
                        </div>
                        <div className="mt-2 text-lg font-semibold">
                          {formatARS(viewer?.commerce.bonusAvailable ?? 0)}
                        </div>
                      </div>
                    <div className="rounded-[16px] border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                          Reservado
                        </div>
                        <div className="mt-2 text-lg font-semibold">
                          {formatARS(viewer?.commerce.cashReserved ?? 0)}
                        </div>
                      </div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-[20px] border border-zinc-200 bg-zinc-50 p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <BadgePlus className="h-4 w-4" />
                Cargar saldo
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                Elige un monto y continúa en Mercado Pago para acreditar fondos a tu
                balance.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {QUICK_AMOUNTS.map((quickAmount) => {
                  const active = amountNumber === quickAmount;
                  return (
                    <button
                      key={quickAmount}
                      type="button"
                      onClick={() => setAmount(String(quickAmount))}
                      className={`rounded-[12px] border px-4 py-3 text-sm font-semibold transition ${
                        active
                          ? "border-zinc-950 bg-zinc-950 text-white"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                      }`}
                    >
                      {formatARS(quickAmount)}
                    </button>
                  );
                })}
              </div>

              <label className="mt-4 block text-sm font-medium text-zinc-700">
                Monto personalizado
                <div className="mt-2 flex items-center rounded-[14px] border border-zinc-200 bg-white px-4 py-3">
                  <span className="text-sm font-semibold text-zinc-500">$</span>
                  <input
                    value={amount}
                    onChange={(event) => {
                      const nextValue = event.target.value.replace(/[^\d.,]/g, "");
                      setAmount(nextValue.replace(",", "."));
                    }}
                    inputMode="decimal"
                    placeholder="10000"
                    className="w-full bg-transparent pl-3 text-base font-semibold text-zinc-900 outline-none"
                  />
                </div>
              </label>

              {error ? (
                <div className="mt-4 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleDeposit}
                disabled={submitting}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                <ArrowDownToLine className="h-4 w-4" />
                {submitting ? "Redirigiendo..." : "Cargar saldo"}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          {showSkeleton ? (
            <>
              <div className="fanpush-skeleton h-28 rounded-[20px]" />
              <div className="fanpush-skeleton h-28 rounded-[20px]" />
              <div className="fanpush-skeleton h-28 rounded-[20px]" />
            </>
          ) : (
            <>
              <div className="rounded-[20px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-zinc-500">Ingresos históricos</div>
                <div className="mt-2 text-2xl font-semibold text-zinc-950">
                  {formatARS(viewer?.commerce.lifetimeEarned ?? 0)}
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Total acreditado a tu cuenta como creador o receptor.
                </p>
              </div>
              <div className="rounded-[20px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-zinc-500">Fondeado total</div>
                <div className="mt-2 text-2xl font-semibold text-zinc-950">
                  {formatARS(viewer?.commerce.lifetimeDeposited ?? 0)}
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Todo el dinero que cargaste en tu saldo desde Mercado Pago.
                </p>
              </div>
              <div className="rounded-[20px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-zinc-500">Retirado</div>
                <div className="mt-2 text-2xl font-semibold text-zinc-950">
                  {formatARS(viewer?.commerce.lifetimeWithdrawn ?? 0)}
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Total ya liquidado fuera de la plataforma.
                </p>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

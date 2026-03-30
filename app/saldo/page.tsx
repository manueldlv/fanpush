"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownToLine, BadgePlus, Wallet } from "lucide-react";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";
import { useAppSelector } from "@/lib/redux/hooks";
import { getSupabaseClient } from "@/lib/supabase";
import { formatARS } from "@/lib/utils";

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000];

export default function SaldoPage() {
  const searchParams = useSearchParams();
  const viewer = useAppSelector((state) => state.viewer);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [amount, setAmount] = useState("10000");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depositSuccess = searchParams.get("checkout") === "deposit";
  const depositedTotal = Number(searchParams.get("deposit_total") || 0);
  const showSkeleton = !viewer.hydrated;
  const spendableBalance = viewer.commerce.balance;

  const amountNumber = useMemo(() => Number(amount), [amount]);

  const handleDeposit = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Falta configurar Supabase.");
      return;
    }

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Ingresa un monto válido para cargar saldo.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Necesitas iniciar sesión para cargar saldo.");
      }

      const response = await fetch("/api/mercadopago/preference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          kind: "deposit",
          amount: amountNumber,
          returnPath: "/saldo",
        }),
      });

      const result = (await response.json()) as {
        initPoint?: string;
        error?: string;
      };

      if (!response.ok || !result.initPoint) {
        throw new Error(result.error ?? "No se pudo iniciar la carga de saldo.");
      }

      window.location.assign(result.initPoint);
    } catch (depositError) {
      setError(
        depositError instanceof Error
          ? depositError.message
          : "No se pudo iniciar la carga de saldo.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
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
                        {formatARS(viewer.commerce.cashAvailable)}
                      </div>
                    </div>
                    <div className="rounded-[16px] border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                        Bonus
                      </div>
                      <div className="mt-2 text-lg font-semibold">
                        {formatARS(viewer.commerce.bonusAvailable)}
                      </div>
                    </div>
                    <div className="rounded-[16px] border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                        Reservado
                      </div>
                      <div className="mt-2 text-lg font-semibold">
                        {formatARS(viewer.commerce.cashReserved)}
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
                  {formatARS(viewer.commerce.lifetimeEarned)}
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Total acreditado a tu cuenta como creador o receptor.
                </p>
              </div>
              <div className="rounded-[20px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-zinc-500">Fondeado total</div>
                <div className="mt-2 text-2xl font-semibold text-zinc-950">
                  {formatARS(viewer.commerce.lifetimeDeposited)}
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Todo el dinero que cargaste en tu saldo desde Mercado Pago.
                </p>
              </div>
              <div className="rounded-[20px] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-zinc-500">Retirado</div>
                <div className="mt-2 text-2xl font-semibold text-zinc-950">
                  {formatARS(viewer.commerce.lifetimeWithdrawn)}
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

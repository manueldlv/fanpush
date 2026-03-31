"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { History, Info } from "lucide-react";
import SidebarLeft from "@/components/SidebarLeft";
import { useCreateCheckoutPreferenceMutation } from "@/lib/redux/api/commerceApi";
import { useGetSessionQuery, useGetViewerQuery } from "@/lib/redux/api/sessionApi";
import { getSupabaseClient } from "@/lib/supabase";
import { formatARS } from "@/lib/utils";
import UserAvatar from "@/components/UserAvatar";

const RECHARGE_OPTIONS = [1000, 5000, 20000, 50000, 100000] as const;

type RechargeHistoryItem = {
  id: string;
  amount: number;
  status: string | null;
  provider: string | null;
  providerPaymentId: string | null;
  createdAt: string;
};

const formatSaldoUnits = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatHistoryStatus = (value: string | null) => {
  if (value === "posted") return "Acreditada";
  if (value === "pending") return "Pendiente";
  if (value === "failed") return "Fallida";
  return "Procesando";
};

function SaldoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(5000);
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<RechargeHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const { data: session, isLoading: sessionLoading } = useGetSessionQuery();
  const { data: viewer } = useGetViewerQuery();
  const [createCheckoutPreference, { isLoading: submitting }] =
    useCreateCheckoutPreferenceMutation();

  const depositSuccess = searchParams.get("checkout") === "deposit";
  const depositedTotal = Number(searchParams.get("deposit_total") || 0);

  const amountNumber = useMemo(() => {
    if (selectedAmount !== null) return selectedAmount;
    return Number(customAmount);
  }, [customAmount, selectedAmount]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!session?.isAuthenticated || !session.userId) {
        setHistory([]);
        setHistoryLoading(false);
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        setHistory([]);
        setHistoryLoading(false);
        return;
      }

      setHistoryLoading(true);
      const { data, error: historyError } = await supabase
        .from("ledger_transactions")
        .select(
          "id,transaction_amount,status,external_provider,provider_payment_id,created_at",
        )
        .eq("buyer_user_id", session.userId)
        .eq("kind", "deposit")
        .order("created_at", { ascending: false })
        .limit(20);

      if (historyError) {
        setHistory([]);
        setHistoryLoading(false);
        return;
      }

      setHistory(
        (data ?? []).map((item) => ({
          id: item.id,
          amount: Number(item.transaction_amount ?? 0),
          status: item.status ?? null,
          provider: item.external_provider ?? null,
          providerPaymentId: item.provider_payment_id ?? null,
          createdAt: item.created_at,
        })),
      );
      setHistoryLoading(false);
    };

    void loadHistory();
  }, [session?.isAuthenticated, session?.userId, depositSuccess, depositedTotal]);

  const handleDeposit = async () => {
    if (sessionLoading) {
      setError("Estamos validando tu sesión. Intenta de nuevo en un momento.");
      return;
    }

    if (!session?.isAuthenticated) {
      router.push("/auth");
      return;
    }

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Ingresa un monto válido para recargar saldo.");
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
          : "No se pudo iniciar la recarga.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-zinc-900">
      <SidebarLeft />

      <main className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-8 md:pl-[280px] md:pr-8 md:pt-10">
        <div className="grid gap-5">
          <section className="rounded-[22px] border border-zinc-100 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={viewer?.profile.avatarUrl}
                  alt={viewer?.profile.username ?? "Perfil"}
                  sizeClassName="h-12 w-12"
                  iconClassName="h-5 w-5"
                />
                <div>
                  <div className="text-[13px] font-medium text-zinc-500">Mi saldo</div>
                  <div className="text-[20px] font-semibold tracking-tight text-zinc-950">
                    {viewer?.profile.fullName || viewer?.profile.username || "Tu cuenta"}
                  </div>
                </div>
              </div>

              <div className="min-w-[250px] rounded-[22px] border border-amber-200 bg-[linear-gradient(135deg,#fff7dd_0%,#fff3c4_100%)] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Saldo disponible
                </div>
                <div className="mt-2 flex items-end gap-2 text-zinc-950">
                  <span className="rounded-full bg-white/80 px-2 py-1 text-[16px] leading-none shadow-sm">
                    ⚡
                  </span>
                  <span className="text-[30px] font-semibold tracking-tight">
                    {formatSaldoUnits(viewer?.commerce.balance ?? 0)}
                  </span>
                </div>
                <div className="mt-2 text-[12px] text-amber-800/80">
                  Usalo para compras y acciones dentro del sitio.
                </div>
              </div>
            </div>

            {!sessionLoading && !session?.isAuthenticated ? (
              <div className="mt-4 inline-flex rounded-[14px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">
                Iniciá sesión para ver tu saldo y continuar con la recarga.
              </div>
            ) : null}
          </section>

          <section className="rounded-[22px] border border-zinc-100 bg-white p-5 shadow-sm md:p-7">
            <div className="mx-auto w-full max-w-[920px]">
              <h1 className="text-[28px] font-semibold tracking-tight text-zinc-950 md:text-[32px]">
                Recargá
              </h1>

              {depositSuccess && depositedTotal > 0 ? (
                <div className="mt-4 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  Se acreditaron {formatARS(depositedTotal)} en tu saldo.
                </div>
              ) : null}

              <div className="mt-5 flex items-center gap-2 text-[14px] font-medium text-zinc-500">
                <Info className="h-4 w-4 text-zinc-400" />
                Elegí un monto y te llevamos a Mercado Pago para completar la recarga.
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {RECHARGE_OPTIONS.map((option) => {
                  const active = selectedAmount === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setSelectedAmount(option);
                        setCustomAmount("");
                      }}
                      className={`rounded-[18px] border px-5 py-5 text-center transition ${
                        active
                          ? "border-zinc-950 bg-zinc-50"
                          : "border-zinc-100 bg-zinc-50 hover:border-zinc-200"
                      }`}
                    >
                      <div className="inline-flex items-center justify-center gap-2">
                        <span className="text-[20px] leading-none">⚡</span>
                        <span className="text-[24px] font-semibold tracking-tight text-zinc-950 md:text-[26px]">
                          {formatSaldoUnits(option)}
                        </span>
                      </div>
                      <div className="mt-2 text-[14px] text-zinc-400">
                        {formatARS(option)}
                      </div>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setSelectedAmount(null)}
                  className={`rounded-[18px] border px-5 py-5 text-center transition ${
                    selectedAmount === null
                      ? "border-zinc-950 bg-zinc-50"
                      : "border-zinc-100 bg-zinc-50 hover:border-zinc-200"
                  }`}
                >
                  <div className="inline-flex items-center justify-center gap-2">
                    <span className="text-[20px] leading-none">⚡</span>
                    <span className="text-[21px] font-semibold tracking-tight text-zinc-950">
                      Personalizado
                    </span>
                  </div>
                  <div className="mt-2 text-[14px] text-zinc-400">
                    Elegí el monto exacto
                  </div>
                </button>
              </div>

              {selectedAmount === null ? (
                <div className="mt-4 max-w-[340px]">
                  <label className="block text-sm font-medium text-zinc-700">
                    Monto personalizado
                    <div className="mt-2 flex items-center rounded-[14px] border border-zinc-200 bg-white px-4 py-3">
                      <span className="text-sm font-semibold text-zinc-500">$</span>
                      <input
                        value={customAmount}
                        onChange={(event) => {
                          const nextValue = event.target.value.replace(/[^\d.,]/g, "");
                          setCustomAmount(nextValue.replace(",", "."));
                        }}
                        inputMode="decimal"
                        placeholder="1000"
                        className="w-full bg-transparent pl-3 text-[15px] font-semibold text-zinc-900 outline-none"
                      />
                    </div>
                  </label>
                </div>
              ) : null}

              <div className="mt-6 flex items-center gap-3 text-[17px] md:text-[18px]">
                <span className="text-zinc-700">Total</span>
                <span className="font-semibold text-zinc-950">
                  {formatARS(amountNumber || 0)}
                </span>
              </div>

              {error ? (
                <div className="mt-4 max-w-[520px] rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleDeposit}
                disabled={submitting}
                className="mt-6 inline-flex min-w-[220px] items-center justify-center rounded-[14px] bg-rose-300 px-7 py-4 text-[15px] font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {submitting
                  ? "Abriendo Mercado Pago..."
                  : !sessionLoading && !session?.isAuthenticated
                    ? "Iniciar sesión"
                    : "Recargar"}
              </button>
            </div>
          </section>

          <section className="rounded-[22px] border border-zinc-100 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-zinc-500" />
              <h2 className="text-[18px] font-semibold tracking-tight text-zinc-950">
                Historial de recargas
              </h2>
            </div>

            <div className="mt-4 overflow-hidden rounded-[18px] border border-zinc-200">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr] gap-3 bg-zinc-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
                <span>Fecha</span>
                <span>Monto</span>
                <span>Estado</span>
                <span className="hidden md:block">Referencia</span>
              </div>

              {historyLoading ? (
                <div className="px-4 py-6 text-[13px] text-zinc-500">
                  Cargando historial...
                </div>
              ) : history.length === 0 ? (
                <div className="px-4 py-6 text-[13px] text-zinc-500">
                  Todavía no tenés recargas registradas.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1.2fr_0.8fr_0.8fr] gap-3 px-4 py-3 text-[13px] text-zinc-700 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]"
                    >
                      <span>{formatDateTime(item.createdAt)}</span>
                      <span className="font-semibold text-zinc-950">
                        {formatARS(item.amount)}
                      </span>
                      <span>{formatHistoryStatus(item.status)}</span>
                      <span className="hidden truncate md:block">
                        {item.providerPaymentId || item.provider || "Mercado Pago"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function SaldoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f7f7f7] text-zinc-900">
          <SidebarLeft />
          <main className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-8 md:pl-[280px] md:pr-8 md:pt-10">
            <section className="rounded-[22px] border border-zinc-100 bg-white p-5 shadow-sm md:p-7">
              <div className="mx-auto w-full max-w-[920px]">
                <h1 className="text-[28px] font-semibold tracking-tight text-zinc-950 md:text-[34px]">
                  Recargá
                </h1>
              </div>
            </section>
          </main>
        </div>
      }
    >
      <SaldoPageContent />
    </Suspense>
  );
}

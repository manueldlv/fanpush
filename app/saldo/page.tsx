"use client";

import Image from "next/image";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import SidebarLeft from "@/components/SidebarLeft";
import UserAvatar from "@/components/UserAvatar";
import { useCreateCheckoutPreferenceMutation } from "@/lib/redux/api/commerceApi";
import { useGetSessionQuery, useGetViewerQuery } from "@/lib/redux/api/sessionApi";
import { formatARS } from "@/lib/utils";

const RECHARGE_OPTIONS = [1000, 5000, 10000, 20000, 50000, 100000, 500000] as const;

const formatSaldoUnits = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

function SaldoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isLoading: sessionLoading } = useGetSessionQuery();
  const { data: viewer } = useGetViewerQuery();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(10000);
  const [customMode, setCustomMode] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [createCheckoutPreference, { isLoading: submitting }] =
    useCreateCheckoutPreferenceMutation();

  const depositSuccess = searchParams.get("checkout") === "deposit";
  const depositCancelled = searchParams.get("checkout") === "cancelled";
  const depositedTotal = Number(searchParams.get("deposit_total") || 0);
  const mercadoPagoStatus = searchParams.get("mp_status");

  const selectedValue = useMemo(() => {
    if (selectedAmount !== null) return selectedAmount;
    if (!customAmount.trim()) return 0;
    return Math.floor(Number(customAmount.replace(/[^\d]/g, "")) || 0);
  }, [customAmount, selectedAmount]);

  const isCustomSelected = customMode && selectedAmount === null;
  const canPurchase =
    Number.isFinite(selectedValue) && selectedValue >= 1000 && !sessionLoading;

  const handlePresetClick = (amount: number) => {
    setError(null);
    setCustomMode(false);
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handleCustomSelect = () => {
    setError(null);
    setCustomMode(true);
    setSelectedAmount(null);
  };

  const handleCustomChange = (value: string) => {
    setCustomMode(true);
    setSelectedAmount(null);
    setError(null);
    setCustomAmount(value.replace(/[^\d]/g, ""));
  };

  const handleDeposit = async () => {
    if (sessionLoading) {
      setError("Estamos validando tu sesión. Intenta de nuevo en un momento.");
      return;
    }

    if (!session?.isAuthenticated) {
      router.push("/auth");
      return;
    }

    if (!Number.isFinite(selectedValue) || selectedValue < 1000) {
      setError("Elegí un saldo válido de al menos $1.000 para continuar.");
      return;
    }

    setError(null);
    setCheckoutPending(true);

    try {
      const result = await createCheckoutPreference({
        kind: "deposit",
        amount: selectedValue,
        returnPath: "/saldo",
      }).unwrap();
      window.location.assign(result.initPoint);
    } catch (depositError) {
      setCheckoutPending(false);
      setError(
        depositError instanceof Error
          ? depositError.message
          : "No se pudo iniciar la compra de saldo.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900">
      {checkoutPending ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-[420px] rounded-[16px] border border-[#E0E0E0] bg-white px-6 py-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f3efff]">
              <Loader2 className="h-6 w-6 animate-spin text-[#5A3EE7]" />
            </div>
            <h2 className="mt-4 text-[20px] font-semibold text-zinc-950">
              Estamos abriendo Mercado Pago
            </h2>
            <p className="mt-2 text-[15px] leading-[1.5] text-[#464646]">
              Estamos resolviendo tu compra de saldo. En unos segundos deberías ser
              redirigido al checkout.
            </p>
            <p className="mt-3 text-[13px] leading-[1.45] text-zinc-500">
              Si algo falla, te vamos a mostrar el error acá mismo para que puedas
              intentar de nuevo.
            </p>
          </div>
        </div>
      ) : null}

      <SidebarLeft />

      <main className="w-full px-4 pb-24 pt-6 sm:px-6 md:pl-[348px] md:pr-8 md:pt-10">
        <div className="max-w-[900px]">
          <h1 className="text-[25px] font-semibold text-zinc-950">Mi saldo</h1>

          {depositSuccess && depositedTotal > 0 ? (
            <div className="mt-5 rounded-[5px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] font-medium text-emerald-700">
              Se acreditaron {formatARS(depositedTotal)} en tu saldo.
            </div>
          ) : depositCancelled ? (
            <div className="mt-5 rounded-[5px] border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] font-medium text-amber-700">
              {mercadoPagoStatus === "pending"
                ? "La compra de saldo quedó pendiente. Cuando Mercado Pago la apruebe, se acreditará automáticamente."
                : "La compra de saldo no se completó. Puedes volver a intentarlo cuando quieras."}
            </div>
          ) : null}

          <section className="mt-5 flex flex-wrap items-center gap-4">
            <UserAvatar
              src={viewer?.profile.avatarUrl}
              alt={viewer?.profile.username ?? "Perfil"}
              sizeClassName="h-[68px] w-[68px]"
              iconClassName="h-7 w-7"
            />

            <div className="flex items-center gap-3">
              <Image
                src="/brand-lightning.png"
                alt="Saldo"
                width={24}
                height={24}
                className="h-6 w-6 brightness-0"
              />
              <span className="text-[20px] font-bold text-zinc-950">
                {formatARS(viewer?.commerce.balance ?? 0)}
              </span>
            </div>

            <Link
              href="/ventas?tab=withdrawals"
              className="text-[14px] font-semibold text-[#5A3EE7] transition hover:opacity-80"
            >
              retirar
            </Link>
          </section>

          <section className="mt-12">
            <h2 className="text-[25px] font-semibold text-zinc-950">Comprar saldo</h2>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
              {RECHARGE_OPTIONS.map((amount) => {
                const active = selectedAmount === amount;

                return (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handlePresetClick(amount)}
                    className={`flex h-[92px] items-center justify-center rounded-[5px] border px-4 text-center transition ${
                      active
                        ? "border-[#5A3EE7] bg-[#f8f6ff] text-zinc-950 ring-1 ring-[#5A3EE7]"
                        : "border-[#E0E0E0] bg-white text-zinc-950 hover:border-[#cfcfcf]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 text-[18px] font-semibold">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                          active
                            ? "bg-[linear-gradient(90deg,#5A3EE7_0%,#CF4BDB_100%)]"
                            : "bg-transparent"
                        }`}
                      >
                        <Image
                          src="/brand-lightning.png"
                          alt=""
                          width={18}
                          height={18}
                          className={`h-[18px] w-[18px] ${
                            active ? "brightness-0 invert" : "brightness-0"
                          }`}
                        />
                      </span>
                      {formatSaldoUnits(amount)}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleCustomSelect}
                className={`flex h-[92px] items-center justify-center rounded-[5px] border px-4 text-center transition ${
                  isCustomSelected
                    ? "border-[#5A3EE7] bg-[#f8f6ff] text-zinc-950 ring-1 ring-[#5A3EE7]"
                    : "border-[#E0E0E0] bg-white text-zinc-950 hover:border-[#cfcfcf]"
                }`}
              >
                <span className="inline-flex items-center gap-2 text-[18px] font-semibold">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                      isCustomSelected
                        ? "bg-[linear-gradient(90deg,#5A3EE7_0%,#CF4BDB_100%)]"
                        : "bg-transparent"
                    }`}
                  >
                    <Image
                      src="/brand-lightning.png"
                      alt=""
                      width={18}
                      height={18}
                      className={`h-[18px] w-[18px] ${
                        isCustomSelected ? "brightness-0 invert" : "brightness-0"
                      }`}
                    />
                  </span>
                  Personalizado
                </span>
              </button>
            </div>

            {isCustomSelected ? (
              <div className="mt-4 max-w-[300px]">
                <label className="block">
                  <span className="sr-only">Monto personalizado</span>
                  <div className="flex h-[52px] items-center rounded-[5px] border border-[#E0E0E0] bg-white px-4">
                    <Image
                        src="/brand-lightning.png"
                        alt=""
                        width={18}
                        height={18}
                        className="h-[18px] w-[18px] brightness-0"
                      />
                    <input
                      value={customAmount}
                      onFocus={handleCustomSelect}
                      onChange={(event) => handleCustomChange(event.target.value)}
                      inputMode="numeric"
                      placeholder="Escribe el saldo"
                      className="w-full bg-transparent pl-3 text-[16px] font-semibold text-zinc-950 outline-none placeholder:text-zinc-500"
                    />
                  </div>
                </label>
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 max-w-[540px] rounded-[5px] border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              disabled={!canPurchase || submitting}
              onClick={handleDeposit}
              className={`mt-4 inline-flex h-[48px] min-w-[148px] items-center justify-center rounded-[5px] px-6 text-[15px] font-semibold transition ${
                canPurchase && !submitting
                  ? "bg-[linear-gradient(90deg,#5A3EE7_0%,#6E46F2_100%)] text-white hover:opacity-95"
                  : "bg-[#d8d8d8] text-white"
              }`}
            >
              {submitting
                ? "Abriendo Mercado Pago..."
                : !sessionLoading && !session?.isAuthenticated
                  ? "Iniciar sesión"
                  : "Comprar"}
            </button>
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
        <div className="min-h-screen bg-[#FAFAFA] text-zinc-900">
          <SidebarLeft />
          <main className="w-full px-4 pb-24 pt-6 sm:px-6 md:pl-[348px] md:pr-8 md:pt-10">
            <div className="max-w-[900px]">
              <h1 className="text-[25px] font-semibold text-zinc-950">Mi saldo</h1>
            </div>
          </main>
        </div>
      }
    >
      <SaldoPageContent />
    </Suspense>
  );
}

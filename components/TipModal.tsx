"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import {
  runBalanceCheckout,
  type BalanceCheckoutResult,
} from "@/lib/balanceCheckout";

const formatUnits = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));

type TipModalProps = {
  open: boolean;
  availableBalance: number;
  recipientLabel: string;
  recipientUserId: string | null;
  onClose: () => void;
  onSubmitted?: (result: BalanceCheckoutResult) => void;
};

export default function TipModal({
  open,
  availableBalance,
  recipientLabel,
  recipientUserId,
  onClose,
  onSubmitted,
}: TipModalProps) {
  const [amount, setAmount] = useState("100");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BalanceCheckoutResult | null>(null);

  const amountValue = useMemo(() => Number(amount), [amount]);
  const creatorReceives = Math.floor(Math.max(0, amountValue) * 0.7);
  const platformFee = Math.max(0, amountValue) - creatorReceives;
  const canSubmit =
    Boolean(recipientUserId) &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    amountValue <= availableBalance &&
    !submitting;

  useEffect(() => {
    if (!open) return;
    setAmount("100");
    setSubmitting(false);
    setError(null);
    setResult(null);
  }, [open, recipientUserId]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!recipientUserId) return;
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Ingresá un monto válido para la propina.");
      return;
    }
    if (amountValue > availableBalance) {
      setError("No tenés saldo suficiente para enviar esta propina.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const checkoutResult = await runBalanceCheckout({
        kind: "tip",
        targetUserId: recipientUserId,
        amount: amountValue,
      });
      setResult(checkoutResult);
      onSubmitted?.(checkoutResult);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo enviar la propina.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label="Cerrar modal de propina"
      />

      <div className="relative w-full max-w-[700px] rounded-[22px] bg-white shadow-2xl">
        {result ? (
          <div className="p-5 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[20px] font-semibold leading-none text-zinc-900 md:text-[22px]">
                    Propina enviada
                  </h2>
                  <p className="mt-2 text-[12px] leading-5 text-zinc-500">
                    Enviaste ⚡ {formatUnits(result.amount)} a @{recipientLabel}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[12px] p-2 text-zinc-500 transition hover:bg-zinc-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-4 md:px-5">
              <div className="flex items-center justify-between gap-4 text-[14px] text-zinc-700 md:text-[15px]">
                <span>Propina enviada</span>
                <span className="font-semibold text-zinc-950">
                  ⚡ {formatUnits(result.amount)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 text-[14px] text-zinc-700 md:text-[15px]">
                <span>Saldo restante</span>
                <span className="font-semibold text-zinc-950">
                  ⚡ {formatUnits(result.balance)}
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[14px] bg-zinc-950 px-5 py-2.5 text-[14px] font-semibold text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 md:px-7 md:pb-7 md:pt-7">
            <div className="flex items-start justify-between gap-4">
              <div className="pr-4">
                <h2 className="text-[22px] font-semibold leading-none tracking-tight text-zinc-900 md:text-[26px]">
                  Enviar propina
                </h2>
                <p className="mt-3 max-w-[520px] text-[13px] leading-[1.45] text-zinc-500 md:text-[14px]">
                  Apoya a @{recipientLabel} con una propina directa. Recibe el
                  70% y la plataforma retiene el 30%.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-[12px] p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-7">
              <label className="block text-[15px] font-semibold text-zinc-700 md:text-[16px]">
                Monto de la propina
              </label>
              <div className="mt-3 flex h-[64px] items-center rounded-[18px] border border-zinc-300 px-5 md:h-[72px]">
                <span className="text-[22px] text-zinc-500 md:text-[24px]">
                  ⚡
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value.replace(/[^\d]/g, ""))
                  }
                  className="w-full bg-transparent pl-3 text-[20px] font-semibold text-zinc-900 outline-none md:text-[22px]"
                />
              </div>
              <div className="mt-2 text-[11px] text-zinc-400">
                Saldo disponible: ⚡ {formatUnits(availableBalance)}
              </div>
            </div>

            <div className="mt-7 rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-4 md:px-5 md:py-5">
              <div className="flex items-center justify-between gap-4 text-[14px] text-zinc-700 md:text-[15px]">
                <span>Propina total</span>
                <span className="font-semibold text-zinc-950">
                  ⚡ {formatUnits(amountValue || 0)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 text-[14px] text-zinc-700 md:text-[15px]">
                <span>Recibe el creador (70%)</span>
                <span className="font-semibold text-zinc-950">
                  ⚡ {formatUnits(creatorReceives)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 text-[14px] text-zinc-700 md:text-[15px]">
                <span>Comisión plataforma (30%)</span>
                <span className="font-semibold text-zinc-950">
                  ⚡ {formatUnits(platformFee)}
                </span>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="mt-7 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[14px] border border-zinc-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-zinc-700 md:min-w-[150px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                className="rounded-[14px] bg-zinc-950 px-5 py-2.5 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 md:min-w-[210px]"
              >
                {submitting ? "Procesando..." : "Enviar propina"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

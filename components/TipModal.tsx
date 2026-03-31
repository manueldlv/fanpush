"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, X, Zap } from "lucide-react";
import {
  runBalanceCheckout,
  type BalanceCheckoutResult,
} from "@/lib/balanceCheckout";

const PRESET_AMOUNTS = [100, 200, 500, 1000] as const;

const formatCredits = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

const formatCompactCredits = (value: number) => {
  const safeValue = Math.max(0, value);
  if (safeValue >= 1000) {
    return `${(safeValue / 1000).toFixed(safeValue >= 10000 ? 0 : 1)}K`;
  }
  return formatCredits(safeValue);
};

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
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BalanceCheckoutResult | null>(null);

  const amountValue = useMemo(() => Number(amount), [amount]);
  const canSubmit =
    Boolean(recipientUserId) &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    amountValue <= availableBalance &&
    !submitting;

  useEffect(() => {
    if (!open) return;
    setAmount("100");
    setMessage("");
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
      setError("Ingresa una cantidad válida.");
      return;
    }
    if (amountValue > availableBalance) {
      setError("No tienes créditos suficientes para enviar esta propina.");
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
        aria-label="Cerrar modal de tip"
      />

      <div className="relative w-full max-w-[360px] rounded-[10px] bg-white shadow-2xl">
        {result ? (
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-[28px] font-semibold leading-none text-zinc-900">
                    Tip
                  </h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    Se enviaron {formatCredits(result.amount)} créditos a @{recipientLabel}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[5px] p-2 text-zinc-500 transition hover:bg-zinc-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-[8px] bg-zinc-50 px-4 py-4 text-sm text-zinc-700">
              <div className="flex items-center justify-between">
                <span>Débito realizado</span>
                <span className="font-semibold text-zinc-900">
                  {formatCredits(result.amount)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Balance restante</span>
                <span className="font-semibold text-zinc-900">
                  {formatCredits(result.balance)}
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[5px] bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-5">
              <h2 className="text-[34px] font-semibold leading-none text-zinc-900">
                Tip
              </h2>
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-600">
                  <span>Créditos disponibles</span>
                  <span className="inline-flex items-center gap-1 text-sm text-zinc-900">
                    <Zap className="h-3.5 w-3.5 fill-current text-amber-400" />
                    {formatCompactCredits(availableBalance)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-[5px] p-2 text-zinc-500 transition hover:bg-zinc-100"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="text-sm font-medium text-zinc-700">
                ¿Cuántos créditos quieres enviar?
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {PRESET_AMOUNTS.map((presetAmount) => {
                  const active = amountValue === presetAmount;
                  return (
                    <button
                      key={presetAmount}
                      type="button"
                      onClick={() => setAmount(String(presetAmount))}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      {presetAmount}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setAmount("")}
                  className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200"
                >
                  Otro
                </button>
              </div>

              <div className="relative mt-4">
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value.replace(/[^\d]/g, ""))
                  }
                  className="h-14 w-full rounded-[5px] border border-zinc-200 bg-zinc-50 px-4 pr-10 text-lg font-medium text-zinc-900 outline-none transition focus:border-zinc-400"
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </div>

              <div className="mt-4">
                <textarea
                  value={message}
                  maxLength={100}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Mensaje opcional"
                  className="min-h-[112px] w-full resize-none rounded-[5px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-lg text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
                />
                <div className="mt-3 text-sm text-zinc-500">
                  {message.length}/100 caracteres
                </div>
              </div>

              {error ? (
                <div className="mt-4 rounded-[5px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-[5px] bg-zinc-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit}
                  className="rounded-[5px] bg-amber-100 px-5 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Procesando..." : "Tip"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

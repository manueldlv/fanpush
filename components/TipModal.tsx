"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import {
  runBalanceCheckout,
  type BalanceCheckoutResult,
} from "@/lib/balanceCheckout";
import { MIN_CONTENT_PRICE_ARS } from "@/lib/pricing";

const formatUnits = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));

function TipLightningIcon({
  className,
}: {
  className?: string;
}) {
  return (
    <img
      src="/tip-lightning.png"
      alt=""
      aria-hidden="true"
      className={className ?? "h-4 w-4 object-contain"}
    />
  );
}

type TipModalProps = {
  open: boolean;
  availableBalance: number;
  recipientLabel: string;
  recipientUserId: string | null;
  threadId?: string | null;
  onClose: () => void;
  onSubmitted?: (result: BalanceCheckoutResult) => void;
};

export default function TipModal({
  open,
  availableBalance,
  recipientLabel,
  recipientUserId,
  threadId,
  onClose,
  onSubmitted,
}: TipModalProps) {
  const [amount, setAmount] = useState(String(MIN_CONTENT_PRICE_ARS));
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BalanceCheckoutResult | null>(null);

  const amountValue = useMemo(() => Number(amount), [amount]);
  const hasInvalidAmount =
    amount.trim().length > 0 && amountValue < MIN_CONTENT_PRICE_ARS;
  const creatorReceives = Math.floor(Math.max(0, amountValue) * 0.7);
  const platformFee = Math.max(0, amountValue) - creatorReceives;
  const canSubmit =
    Boolean(recipientUserId) &&
    Number.isFinite(amountValue) &&
    amountValue >= MIN_CONTENT_PRICE_ARS &&
    !submitting;

  useEffect(() => {
    if (!open) return;
    setAmount(String(MIN_CONTENT_PRICE_ARS));
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
    if (
      !Number.isFinite(amountValue) ||
      amountValue < MIN_CONTENT_PRICE_ARS
    ) {
      setError(
        `La propina mínima es de $${formatUnits(MIN_CONTENT_PRICE_ARS)}.`,
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const checkoutResult = await runBalanceCheckout({
        kind: "tip",
        targetUserId: recipientUserId,
        amount: amountValue,
        message: message.trim() || undefined,
        threadId: threadId || undefined,
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
                    <span className="inline-flex items-center gap-1.5">
                      Enviaste
                      <TipLightningIcon className="h-3.5 w-3.5 object-contain" />
                      {formatUnits(result.amount)} a @{recipientLabel}.
                    </span>
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
                <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-950">
                  <TipLightningIcon className="h-3.5 w-3.5 object-contain" />
                  {formatUnits(result.amount)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 text-[14px] text-zinc-700 md:text-[15px]">
                <span>Saldo restante</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-950">
                  <TipLightningIcon className="h-3.5 w-3.5 object-contain" />
                  {formatUnits(result.balance)}
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="fanpush-button-primary rounded-[14px] px-5 py-2.5 text-[14px]"
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
              <div
                className={`mt-3 flex h-[64px] items-center rounded-[18px] border px-5 md:h-[72px] ${
                  hasInvalidAmount
                    ? "border-rose-400 bg-rose-50"
                    : "border-zinc-300"
                }`}
              >
                <TipLightningIcon className="h-[22px] w-[22px] object-contain md:h-[24px] md:w-[24px]" />
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_CONTENT_PRICE_ARS}
                  step="1"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value.replace(/[^\d]/g, ""))
                  }
                  className="w-full bg-transparent pl-3 text-[20px] font-semibold text-zinc-900 outline-none md:text-[22px]"
                />
              </div>
              <div
                className={`mt-2 text-[11px] ${
                  hasInvalidAmount ? "text-rose-600" : "text-zinc-400"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  Mínimo {formatUnits(MIN_CONTENT_PRICE_ARS)} · Saldo disponible:
                  <TipLightningIcon className="h-3.5 w-3.5 object-contain" />
                  {formatUnits(availableBalance)}
                </span>
              </div>
              {hasInvalidAmount ? (
                <div className="mt-2 text-[12px] font-medium text-rose-600">
                  El mínimo para enviar una propina es ARS {MIN_CONTENT_PRICE_ARS.toLocaleString("es-AR")}.
                </div>
              ) : null}
            </div>

            <div className="mt-7 rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-4 md:px-5 md:py-5">
              <div className="flex items-center justify-between gap-4 text-[14px] text-zinc-700 md:text-[15px]">
                <span>Propina total</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-950">
                  <TipLightningIcon className="h-3.5 w-3.5 object-contain" />
                  {formatUnits(amountValue || 0)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 text-[14px] text-zinc-700 md:text-[15px]">
                <span>Recibe el creador (70%)</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-950">
                  <TipLightningIcon className="h-3.5 w-3.5 object-contain" />
                  {formatUnits(creatorReceives)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 text-[14px] text-zinc-700 md:text-[15px]">
                <span>Comisión plataforma (30%)</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-950">
                  <TipLightningIcon className="h-3.5 w-3.5 object-contain" />
                  {formatUnits(platformFee)}
                </span>
              </div>
            </div>

            <div className="mt-7">
              <label className="block text-[15px] font-semibold text-zinc-700 md:text-[16px]">
                Mensaje corto <span className="font-normal text-zinc-400">(opcional)</span>
              </label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, 140))}
                rows={3}
                placeholder={`Escribe algo para @${recipientLabel} si quieres...`}
                className="mt-3 w-full rounded-[18px] border border-zinc-300 px-4 py-3 text-[14px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              />
              <div className="mt-2 text-[11px] text-zinc-400">
                {message.length}/140
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
                className="fanpush-button-primary rounded-[14px] px-5 py-2.5 text-[14px] disabled:cursor-not-allowed disabled:opacity-60 md:min-w-[210px]"
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

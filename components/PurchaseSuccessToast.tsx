"use client";

import { CheckCircle2, X } from "lucide-react";

type PurchaseSuccessToastProps = {
  message: string | null;
  onClose: () => void;
};

export default function PurchaseSuccessToast({
  message,
  onClose,
}: PurchaseSuccessToastProps) {
  if (!message) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[140] flex w-[calc(100vw-2rem)] justify-end sm:bottom-6 sm:right-6 sm:w-auto">
      <div className="pointer-events-auto w-full max-w-[390px] rounded-[16px] border border-zinc-200 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.14)]">
        <div className="flex items-start gap-3 px-4 py-4">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-zinc-950">
              Compra realizada
            </div>
            <div className="mt-1 text-[13px] font-semibold text-emerald-600">
              contenido desbloqueado
            </div>
            <div className="mt-3 text-[14px] leading-7 text-zinc-600">
              {message}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-[10px] p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

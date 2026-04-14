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
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[140] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-[560px] rounded-[12px] border border-emerald-200 bg-white shadow-[0_18px_48px_rgba(0,0,0,0.14)]">
        <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
          <div className="mt-0.5 shrink-0 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-zinc-900">
              Compra realizada con éxito
            </div>
            <div className="mt-1 text-[14px] leading-6 text-[#464646]">
              {message}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-[8px] p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

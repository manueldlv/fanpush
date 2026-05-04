"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFinalizeMercadoPagoMutation } from "@/lib/redux/api/commerceApi";
import {
  BALANCE_REFRESH_FLAG,
  clearPendingCheckout,
  EARNINGS_REFRESH_FLAG,
  savePendingCheckout,
  PURCHASE_REFRESH_FLAG,
} from "@/lib/auth";
import { getSupabaseClient, getSupabaseSessionSafely } from "@/lib/supabase";

function CheckoutReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Validando el pago...");
  const [finalizeMercadoPago] = useFinalizeMercadoPagoMutation();

  const target = useMemo(
    () => searchParams.get("target") || "/",
    [searchParams],
  );

  const redirectToTarget = useCallback(
    (checkoutState: string, extraParams?: Record<string, string>) => {
      clearPendingCheckout();
      const url = new URL(target, window.location.origin);
      url.searchParams.set("checkout", checkoutState);
      Object.entries(extraParams ?? {}).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      const finalTarget = `${url.pathname}${url.search}${url.hash}`;
      router.replace(finalTarget);
    },
    [router, target],
  );

  useEffect(() => {
    const run = async () => {
      const status =
        searchParams.get("status") ||
        searchParams.get("collection_status") ||
        "";
      const paymentId =
        searchParams.get("payment_id") ||
        searchParams.get("collection_id") ||
        "";

      if (!paymentId) {
        setMessage("La operación no se completó. Redirigiéndote de nuevo...");
        window.setTimeout(() => {
          redirectToTarget("cancelled", { mp_status: "cancelled" });
        }, 500);
        return;
      }

      if (status && status !== "approved") {
        setMessage("La operación no fue aprobada. Redirigiéndote de nuevo...");
        window.setTimeout(() => {
          redirectToTarget("cancelled", { mp_status: status || "cancelled" });
        }, 500);
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        setMessage("Falta configurar Supabase.");
        return;
      }

      let session = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        session = await getSupabaseSessionSafely(supabase);
        if (session?.access_token) break;
        setMessage("Recuperando tu sesión para acreditar el pago...");
        await new Promise((resolve) => window.setTimeout(resolve, 600));
      }

      if (!session?.access_token) {
        savePendingCheckout({
          paymentId,
          kind:
            (searchParams.get("kind") as "purchase" | "tip" | "deposit" | null) ?? null,
          target,
          status: status || "approved",
          savedAt: Date.now(),
        });
        setMessage("Redirigiéndote al login para continuar con la acreditación...");
        window.setTimeout(() => {
          window.location.assign("/auth?checkout=resume");
        }, 500);
        return;
      }

      let result:
        | {
            ok?: boolean;
            kind?: "purchase" | "tip" | "deposit";
            status?: string;
            amount?: number;
            error?: string;
          }
        | undefined;

      try {
        result = await finalizeMercadoPago({
          paymentId,
          accessToken: session.access_token,
        }).unwrap();
      } catch (finalizeError) {
        setMessage(
          finalizeError instanceof Error
            ? finalizeError.message
            : "No se pudo acreditar el pago.",
        );
        return;
      }

      if (!result?.ok) {
        setMessage("La operación no quedó aprobada. Redirigiéndote de nuevo...");
        window.setTimeout(() => {
          redirectToTarget("cancelled", {
            mp_status: result?.status || "pending",
          });
        }, 500);
        return;
      }

      if (result.kind === "purchase") {
        clearPendingCheckout();
        window.sessionStorage.setItem(
          PURCHASE_REFRESH_FLAG,
          String(Date.now()),
        );
        window.dispatchEvent(new Event("purchases-updated"));
      }
      if (result.kind === "tip") {
        clearPendingCheckout();
        window.sessionStorage.setItem(
          EARNINGS_REFRESH_FLAG,
          String(Date.now()),
        );
        window.dispatchEvent(new Event("earnings-updated"));
      }
      if (result.kind === "deposit") {
        clearPendingCheckout();
        window.sessionStorage.setItem(
          BALANCE_REFRESH_FLAG,
          String(Date.now()),
        );
        window.dispatchEvent(new Event("balance-updated"));
      }

      const url = new URL(target, window.location.origin);
      url.searchParams.set("checkout", result.kind ?? "ok");
      if (result.kind === "tip" && typeof result.amount === "number") {
        url.searchParams.set("tip_total", result.amount.toFixed(2));
      }
      if (result.kind === "deposit" && typeof result.amount === "number") {
        url.searchParams.set("deposit_total", result.amount.toFixed(2));
      }
      const finalTarget = `${url.pathname}${url.search}${url.hash}`;
      router.replace(finalTarget);
    };

    void run();
  }, [finalizeMercadoPago, redirectToTarget, router, searchParams, target]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-900">
      <div className="w-full max-w-[460px] rounded-[20px] border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Mercado Pago</h1>
        <p className="mt-3 text-sm text-zinc-500">{message}</p>
      </div>
    </div>
  );
}

export default function CheckoutReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-900">
          <div className="w-full max-w-[460px] rounded-[20px] border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold">Mercado Pago</h1>
            <p className="mt-3 text-sm text-zinc-500">Preparando la acreditación...</p>
          </div>
        </div>
      }
    >
      <CheckoutReturnContent />
    </Suspense>
  );
}

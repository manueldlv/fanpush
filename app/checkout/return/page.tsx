"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export default function CheckoutReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Validando el pago...");

  const target = useMemo(
    () => searchParams.get("target") || "/",
    [searchParams],
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
        setMessage("No recibimos un identificador de pago de Mercado Pago.");
        return;
      }

      if (status && status !== "approved") {
        setMessage(`El pago quedó en estado ${status}.`);
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        setMessage("Falta configurar Supabase.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessage("Necesitas volver a iniciar sesión para acreditar el pago.");
        return;
      }

      const response = await fetch("/api/mercadopago/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ paymentId }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        kind?: "purchase" | "tip";
        status?: string;
        amount?: number;
        error?: string;
      };

      if (!response.ok) {
        setMessage(result.error ?? "No se pudo acreditar el pago.");
        return;
      }

      if (!result.ok) {
        setMessage(
          result.status
            ? `El pago quedó en estado ${result.status}.`
            : "El pago no quedó aprobado todavía.",
        );
        return;
      }

      if (result.kind === "purchase") {
        window.dispatchEvent(new Event("purchases-updated"));
      }
      if (result.kind === "tip") {
        window.dispatchEvent(new Event("earnings-updated"));
      }

      const url = new URL(target, window.location.origin);
      url.searchParams.set("checkout", result.kind ?? "ok");
      if (result.kind === "tip" && typeof result.amount === "number") {
        url.searchParams.set("tip_total", result.amount.toFixed(2));
      }
      const finalTarget = `${url.pathname}${url.search}${url.hash}`;
      router.replace(finalTarget);
    };

    run();
  }, [router, searchParams, target]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-900">
      <div className="w-full max-w-[460px] rounded-[20px] border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Mercado Pago</h1>
        <p className="mt-3 text-sm text-zinc-500">{message}</p>
      </div>
    </div>
  );
}

import { getSupabaseClient } from "@/lib/supabase";
import { redirectToSaldoIfNeeded } from "@/lib/purchaseRedirect";

type PurchaseCheckoutInput = {
  kind: "purchase";
  albumId: string;
};

type TipCheckoutInput = {
  kind: "tip";
  targetUserId: string;
  amount: number;
};

export type BalanceCheckoutResult = {
  ok: true;
  kind: "purchase" | "tip";
  transactionId: string;
  amount: number;
  creatorAmount: number;
  platformFeeAmount: number;
  bonusUsed: number;
  cashUsed: number;
  balance: number;
};

export const runBalanceCheckout = async (
  input: PurchaseCheckoutInput | TipCheckoutInput,
) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Falta configurar Supabase.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Necesitas iniciar sesión para continuar.");
  }

  const response = await fetch("/api/balance/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });

  const result = (await response.json()) as BalanceCheckoutResult & {
    error?: string;
  };

  if (!response.ok || !result.ok) {
    if (input.kind === "purchase") {
      redirectToSaldoIfNeeded(result.error);
    }
    throw new Error(result.error ?? "No se pudo completar el checkout con saldo.");
  }

  return result;
};

import { getSupabaseClient } from "@/lib/supabase";
import {
  redirectToSaldo,
  redirectToSaldoIfNeeded,
  shouldRedirectToSaldo,
} from "@/lib/purchaseRedirect";

type PurchaseCheckoutInput = {
  kind: "purchase";
  albumId: string;
  availableBalance?: number;
  requiredAmount?: number;
};

type TipCheckoutInput = {
  kind: "tip";
  targetUserId: string;
  amount: number;
  message?: string;
  threadId?: string;
  availableBalance?: number;
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
  const requiredAmount =
    input.kind === "tip" ? Number(input.amount) : Number(input.requiredAmount ?? 0);
  const availableBalance = Number(input.availableBalance ?? NaN);

  if (
    shouldRedirectToSaldo({
      availableBalance,
      requiredAmount,
    })
  ) {
    redirectToSaldo({
      reason: "insufficient-balance",
      requiredAmount,
      currentBalance: availableBalance,
      kind: input.kind === "tip" ? "tip" : "purchase",
      targetId: input.kind === "tip" ? input.targetUserId : input.albumId,
    });
    throw new Error("No tienes saldo suficiente. Te redirigimos a Mi saldo.");
  }

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
    redirectToSaldoIfNeeded(result.error, {
      reason: "insufficient-balance",
      requiredAmount,
      currentBalance: Number.isFinite(availableBalance) ? availableBalance : null,
      kind: input.kind === "tip" ? "tip" : "purchase",
      targetId: input.kind === "tip" ? input.targetUserId : input.albumId,
    });
    throw new Error(result.error ?? "No se pudo completar el checkout con saldo.");
  }

  return result;
};

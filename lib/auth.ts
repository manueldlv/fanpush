import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseSessionSafely } from "@/lib/supabase";

type BrowserSupabase = SupabaseClient<any, "public", any>;

export const PURCHASE_REFRESH_FLAG = "fanpush-refresh-purchases";
export const EARNINGS_REFRESH_FLAG = "fanpush-refresh-earnings";
export const BALANCE_REFRESH_FLAG = "fanpush-refresh-balance";
export const PENDING_CHECKOUT_KEY = "fanpush-pending-checkout";

export type PendingCheckoutPayload = {
  paymentId: string;
  kind: "purchase" | "tip" | "deposit" | null;
  target: string;
  status: string;
  savedAt: number;
};

export const savePendingCheckout = (payload: PendingCheckoutPayload) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(payload));
};

export const readPendingCheckout = (): PendingCheckoutPayload | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PENDING_CHECKOUT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingCheckoutPayload;
    if (!parsed?.paymentId || !parsed?.target) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearPendingCheckout = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_CHECKOUT_KEY);
};

export const getSessionAccessTokenWithRetry = async (
  supabase: BrowserSupabase,
  options?: {
    attempts?: number;
    delayMs?: number;
    forceRetry?: boolean;
  },
) => {
  const attempts = options?.attempts ?? 8;
  const delayMs = options?.delayMs ?? 500;
  const shouldRetry =
    options?.forceRetry ??
    (typeof window !== "undefined" &&
      Boolean(window.sessionStorage.getItem(PURCHASE_REFRESH_FLAG)));

  let accessToken: string | null = null;

  for (let attempt = 0; attempt < (shouldRetry ? attempts : 1); attempt += 1) {
    const session = await getSupabaseSessionSafely(supabase);
    accessToken = session?.access_token ?? null;
    if (accessToken) break;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
  }

  return accessToken;
};

import type { SupabaseClient } from "@supabase/supabase-js";

type BrowserSupabase = SupabaseClient<any, "public", any>;

export const PURCHASE_REFRESH_FLAG = "fanpush-refresh-purchases";
export const EARNINGS_REFRESH_FLAG = "fanpush-refresh-earnings";

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
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token ?? null;
    if (accessToken) break;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
  }

  return accessToken;
};

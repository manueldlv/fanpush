import { createClient } from "@supabase/supabase-js";

const mercadopagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type MercadoPagoPayment = {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
};

export const getBearerToken = (header: string | null) => {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
};

export const getMercadoPagoAccessToken = () => mercadopagoAccessToken;

export const getAdminSupabase = () => {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export const getAuthenticatedUser = async (request: Request) => {
  const admin = getAdminSupabase();
  const accessToken = getBearerToken(request.headers.get("authorization"));

  if (!admin || !accessToken) {
    return { admin, user: null, error: "No autorizado." };
  }

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(accessToken);

  if (error || !user) {
    return { admin, user: null, error: "Sesion invalida." };
  }

  return { admin, user, error: null };
};

export const isPublicHttpsUrl = (value: string) => /^https:\/\//i.test(value);

export const resolveAppBaseUrl = (request: Request) => {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin.replace(/\/$/, "");
};

export const mercadopagoFetch = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  if (!mercadopagoAccessToken) {
    throw new Error("Falta configurar MERCADOPAGO_ACCESS_TOKEN.");
  }

  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mercadopagoAccessToken}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (json &&
        typeof json === "object" &&
        "message" in json &&
        typeof json.message === "string" &&
        json.message) ||
      `Mercado Pago devolvio ${response.status}.`;
    throw new Error(message);
  }

  return json as T;
};

export const parseExternalReference = (reference?: string | null) => {
  if (!reference) return null;
  const [kind, buyerId, targetId, amountValue] = reference.split(":");
  if (!kind || !buyerId || !targetId) return null;
  return {
    kind,
    buyerId,
    targetId,
    amount: amountValue ? Number(amountValue) : null,
  };
};

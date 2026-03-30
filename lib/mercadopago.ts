import {
  ensureServerUserRows,
  getAdminSupabase,
  getAuthenticatedUser,
} from "@/lib/server/auth/session";
import {
  creditApprovedAlbumPurchase,
  creditApprovedTip,
  getPurchaseAlbumTarget,
} from "@/lib/server/repositories/payments";
import { recordMercadoPagoDepositTransaction } from "@/lib/server/repositories/ledger";
export {
  ensureServerUserRows,
  getAdminSupabase,
  getAuthenticatedUser,
  getBearerToken,
} from "@/lib/server/auth/session";

const mercadopagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

export type MercadoPagoPayment = {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
};

export type FinalizedPaymentResult =
  | { ok: true; kind: "purchase" }
  | { ok: true; kind: "tip"; amount: number }
  | { ok: true; kind: "deposit"; amount: number }
  | { ok: false; status: string; statusDetail?: string | null };

export const getMercadoPagoAccessToken = () => mercadopagoAccessToken;

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

export const finalizeMercadoPagoPayment = async ({
  admin,
  paymentId,
  expectedBuyerId,
}: {
  admin: NonNullable<ReturnType<typeof getAdminSupabase>>;
  paymentId: string | number;
  expectedBuyerId?: string | null;
}): Promise<FinalizedPaymentResult> => {
  const payment = await mercadopagoFetch<{
    id: number | string;
    status?: string;
    status_detail?: string;
    external_reference?: string;
  }>(`/v1/payments/${paymentId}`);

  if (payment.status !== "approved") {
    return {
      ok: false,
      status: payment.status ?? "unknown",
      statusDetail: payment.status_detail ?? null,
    };
  }

  const reference = parseExternalReference(payment.external_reference);
  if (!reference) {
    throw new Error("No se pudo interpretar el pago recibido.");
  }

  if (expectedBuyerId && reference.buyerId !== expectedBuyerId) {
    throw new Error("Este pago no pertenece a la sesión actual.");
  }

  const {
    data: { user: buyerUser },
    error: buyerError,
  } = await admin.auth.admin.getUserById(reference.buyerId);

  if (buyerError || !buyerUser) {
    throw new Error("No se pudo validar al comprador del pago.");
  }

  await ensureServerUserRows(admin, buyerUser);

  if (reference.kind === "purchase") {
    const albumId = reference.targetId;
    const album = await getPurchaseAlbumTarget(admin, albumId);

    if (!album) {
      throw new Error("No se encontró el álbum pagado.");
    }

    await creditApprovedAlbumPurchase({
      admin,
      buyerUserId: buyerUser.id,
      albumId,
      paymentId: payment.id,
      amount: Number(reference.amount || album.price || 0),
      sellerUserId: album.userId,
      externalReference: payment.external_reference ?? null,
    });

    return { ok: true, kind: "purchase" };
  }

  if (reference.kind === "tip") {
    const targetUserId = reference.targetId;
    const amount = Number(reference.amount || 0);

    await creditApprovedTip({
      admin,
      targetUserId,
      buyerUserId: buyerUser.id,
      paymentId: payment.id,
      amount,
      externalReference: payment.external_reference ?? null,
    });

    return { ok: true, kind: "tip", amount };
  }

  if (reference.kind === "deposit") {
    const amount = Number(reference.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("El fondeo recibido no tiene un monto válido.");
    }

    await recordMercadoPagoDepositTransaction({
      admin,
      userId: buyerUser.id,
      providerPaymentId: payment.id,
      transactionAmount: amount,
      externalReference: payment.external_reference ?? null,
    });

    return { ok: true, kind: "deposit", amount };
  }

  throw new Error("Tipo de pago no soportado.");
};

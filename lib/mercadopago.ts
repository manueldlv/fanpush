import {
  ensureServerUserRows,
  getAdminSupabase,
  getAuthenticatedUser,
} from "@/lib/server/auth/session";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MIN_CONTENT_PRICE_ARS } from "@/lib/pricing";
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
const mercadopagoWebhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() ?? "";
const mercadopagoWebhookToken = process.env.MERCADOPAGO_WEBHOOK_TOKEN?.trim() ?? "";

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
export const getMercadoPagoWebhookSecret = () => mercadopagoWebhookSecret;
export const getMercadoPagoWebhookToken = () => mercadopagoWebhookToken;

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

export const parseMercadoPagoWebhookSignature = (value?: string | null) => {
  if (!value) return null;

  const signature = Object.fromEntries(
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, raw] = part.split("=", 2);
        return [key?.trim(), raw?.trim()] as const;
      }),
  ) as Record<string, string | undefined>;

  if (!signature.ts || !signature.v1) return null;
  return {
    ts: signature.ts,
    v1: signature.v1,
  };
};

export const verifyMercadoPagoWebhookSignature = ({
  dataId,
  requestId,
  signatureHeader,
}: {
  dataId: string;
  requestId?: string | null;
  signatureHeader?: string | null;
}) => {
  if (!mercadopagoWebhookSecret) {
    return { verified: false as const, mode: "skipped" as const };
  }

  const parsed = parseMercadoPagoWebhookSignature(signatureHeader);
  if (!parsed?.ts || !parsed.v1) {
    return { verified: false as const, mode: "secret" as const };
  }

  const manifest = `id:${dataId};request-id:${requestId ?? ""};ts:${parsed.ts};`;
  const expected = createHmac("sha256", mercadopagoWebhookSecret)
    .update(manifest)
    .digest("hex");

  const left = Buffer.from(expected);
  const right = Buffer.from(parsed.v1);
  if (left.length !== right.length) {
    return { verified: false as const, mode: "secret" as const };
  }

  return {
    verified: timingSafeEqual(left, right),
    mode: "secret" as const,
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
    if (!Number.isFinite(amount) || amount < MIN_CONTENT_PRICE_ARS) {
      throw new Error("La propina recibida no tiene un monto válido.");
    }
    const paymentWithMetadata = payment as {
      metadata?: { tipMessage?: string | null };
    };

    await creditApprovedTip({
      admin,
      targetUserId,
      buyerUserId: buyerUser.id,
      paymentId: payment.id,
      amount,
      externalReference: payment.external_reference ?? null,
      message: paymentWithMetadata.metadata?.tipMessage ?? null,
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

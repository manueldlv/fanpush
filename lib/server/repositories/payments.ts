import type { SupabaseClient } from "@supabase/supabase-js";
import { recordMercadoPagoCreatorCreditTransaction } from "@/lib/server/repositories/ledger";

export type PurchaseAlbumTarget = {
  id: string;
  userId: string;
  description: string | null;
  price: number | null;
};

const throwRepositoryError = (
  error: { message: string } | null,
  fallback: string,
) => {
  if (error) {
    throw new Error(`${fallback}: ${error.message}`);
  }
};

export const getPurchaseAlbumTarget = async (
  admin: SupabaseClient,
  albumId: string,
) => {
  const { data, error } = await admin
    .from("albums")
    .select("id,user_id,description,price")
    .eq("id", albumId)
    .maybeSingle();

  throwRepositoryError(error, "No se pudo leer el álbum");

  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    description: data.description ?? null,
    price: data.price == null ? null : Number(data.price),
  } satisfies PurchaseAlbumTarget;
};

export const getAlbumPostIds = async (
  admin: SupabaseClient,
  albumId: string,
) => {
  const { data, error } = await admin
    .from("album_posts")
    .select("post_id")
    .eq("album_id", albumId);

  throwRepositoryError(error, "No se pudo leer el contenido del álbum");

  return (data ?? []).map((row) => row.post_id).filter(Boolean);
};

export const creditApprovedAlbumPurchase = async ({
  admin,
  buyerUserId,
  albumId,
  paymentId,
  amount,
  sellerUserId,
  externalReference,
}: {
  admin: SupabaseClient;
  buyerUserId: string;
  albumId: string;
  paymentId: string | number;
  amount: number;
  sellerUserId: string;
  externalReference?: string | null;
}) => {
  const postIds = await getAlbumPostIds(admin, albumId);
  if (postIds.length === 0) {
    throw new Error("No se encontró contenido para acreditar.");
  }

  const purchaseRows = postIds.map((postId, index) => ({
    user_id: buyerUserId,
    post_id: postId,
    payment_id: `${paymentId}-${postId}`,
    amount: index === 0 ? amount : 0,
    status: "approved",
  }));

  const { data: existingRows, error: existingError } = await admin
    .from("purchases")
    .select("payment_id")
    .in(
      "payment_id",
      purchaseRows.map((row) => row.payment_id),
    );

  throwRepositoryError(existingError, "No se pudieron validar compras previas");

  const existingPaymentIds = new Set((existingRows ?? []).map((row) => row.payment_id));
  const missingRows = purchaseRows.filter((row) => !existingPaymentIds.has(row.payment_id));

  if (missingRows.length > 0) {
    const { error: insertError } = await admin.from("purchases").insert(missingRows);
    throwRepositoryError(insertError, "No se pudo acreditar la compra");
  }

  await recordMercadoPagoCreatorCreditTransaction({
    admin,
    kind: "purchase",
    providerPaymentId: paymentId,
    buyerUserId,
    recipientUserId: sellerUserId,
    transactionAmount: amount,
    sourceType: "album",
    sourceId: albumId,
    externalReference,
  });

  if (existingPaymentIds.size === 0) {
    const { error: notificationError } = await admin.from("notifications").insert({
      user_id: sellerUserId,
      actor_id: buyerUserId,
      type: "purchase",
      entity_id: albumId,
      message: "compró tu contenido.",
      is_read: false,
    });

    throwRepositoryError(notificationError, "No se pudo notificar la compra");
  }

  return {
    postIds,
    insertedRows: missingRows.length,
    alreadyCredited: missingRows.length === 0,
  };
};

export const recordInternalAlbumPurchase = async ({
  admin,
  buyerUserId,
  albumId,
  transactionId,
  amount,
  sellerUserId,
}: {
  admin: SupabaseClient;
  buyerUserId: string;
  albumId: string;
  transactionId: string;
  amount: number;
  sellerUserId: string;
}) => {
  const postIds = await getAlbumPostIds(admin, albumId);
  if (postIds.length === 0) {
    throw new Error("No se encontró contenido para acreditar.");
  }

  const purchaseRows = postIds.map((postId, index) => ({
    user_id: buyerUserId,
    post_id: postId,
    payment_id: `${transactionId}-${postId}`,
    amount: index === 0 ? amount : 0,
    status: "approved",
  }));

  const { data: existingRows, error: existingError } = await admin
    .from("purchases")
    .select("payment_id")
    .in(
      "payment_id",
      purchaseRows.map((row) => row.payment_id),
    );

  throwRepositoryError(existingError, "No se pudieron validar compras previas");

  const existingPaymentIds = new Set((existingRows ?? []).map((row) => row.payment_id));
  const missingRows = purchaseRows.filter((row) => !existingPaymentIds.has(row.payment_id));

  if (missingRows.length > 0) {
    const { error: insertError } = await admin.from("purchases").insert(missingRows);
    throwRepositoryError(insertError, "No se pudo acreditar la compra interna");
  }

  if (existingPaymentIds.size === 0) {
    const { error: notificationError } = await admin.from("notifications").insert({
      user_id: sellerUserId,
      actor_id: buyerUserId,
      type: "purchase",
      entity_id: albumId,
      message: "compró tu contenido.",
      is_read: false,
    });

    throwRepositoryError(notificationError, "No se pudo notificar la compra interna");
  }

  return {
    postIds,
    insertedRows: missingRows.length,
    alreadyCredited: missingRows.length === 0,
  };
};

export const creditApprovedTip = async ({
  admin,
  targetUserId,
  buyerUserId,
  paymentId,
  amount,
  externalReference,
}: {
  admin: SupabaseClient;
  targetUserId: string;
  buyerUserId: string;
  paymentId: string | number;
  amount: number;
  externalReference?: string | null;
}) => {
  const normalizedPaymentId = String(paymentId);
  const { data: existingTip, error: existingError } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", targetUserId)
    .eq("type", "tip")
    .eq("entity_id", normalizedPaymentId)
    .maybeSingle();

  throwRepositoryError(existingError, "No se pudo validar la propina");

  await recordMercadoPagoCreatorCreditTransaction({
    admin,
    kind: "tip",
    providerPaymentId: paymentId,
    buyerUserId,
    recipientUserId: targetUserId,
    transactionAmount: amount,
    sourceType: "user",
    sourceId: targetUserId,
    externalReference,
  });

  if (!existingTip) {
    const { error: insertError } = await admin.from("notifications").insert({
      user_id: targetUserId,
      actor_id: buyerUserId,
      type: "tip",
      entity_id: normalizedPaymentId,
      message: `te envió una propina de ${amount.toFixed(2)} ARS.`,
      is_read: false,
    });

    throwRepositoryError(insertError, "No se pudo acreditar la propina");
  }

  return { alreadyCredited: Boolean(existingTip) };
};

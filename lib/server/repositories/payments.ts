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

export const hasUserPurchasedAlbum = async (
  admin: SupabaseClient,
  buyerUserId: string,
  albumId: string,
) => {
  const postIds = await getAlbumPostIds(admin, albumId);
  if (postIds.length === 0) return false;

  const { data, error } = await admin
    .from("purchases")
    .select("id")
    .eq("user_id", buyerUserId)
    .in("post_id", postIds)
    .limit(1);

  throwRepositoryError(error, "No se pudo validar si el álbum ya estaba comprado");

  return (data ?? []).length > 0;
};

const persistAlbumPurchaseRows = async ({
  admin,
  buyerUserId,
  albumId,
  paymentId,
  amount,
  fallback,
}: {
  admin: SupabaseClient;
  buyerUserId: string;
  albumId: string;
  paymentId: string;
  amount: number;
  fallback: string;
}) => {
  const postIds = await getAlbumPostIds(admin, albumId);
  if (postIds.length === 0) {
    throw new Error("No se encontró contenido para acreditar.");
  }

  if (await hasUserPurchasedAlbum(admin, buyerUserId, albumId)) {
    return {
      postIds,
      insertedRows: 0,
      alreadyCredited: true,
      insertedAnyRow: false,
    };
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
    throwRepositoryError(insertError, fallback);
  }

  return {
    postIds,
    insertedRows: missingRows.length,
    alreadyCredited: missingRows.length === 0,
    insertedAnyRow: missingRows.length > 0,
  };
};

const ensureAlbumPurchaseNotification = async ({
  admin,
  sellerUserId,
  buyerUserId,
  albumId,
  fallback,
  shouldNotify,
}: {
  admin: SupabaseClient;
  sellerUserId: string;
  buyerUserId: string;
  albumId: string;
  fallback: string;
  shouldNotify: boolean;
}) => {
  const { data: existingNotification, error: existingNotificationError } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", sellerUserId)
    .eq("actor_id", buyerUserId)
    .eq("type", "purchase")
    .eq("entity_id", albumId)
    .limit(1)
    .maybeSingle();

  throwRepositoryError(existingNotificationError, fallback);

  if (!shouldNotify || existingNotification) return;

  const { error: notificationError } = await admin.from("notifications").insert({
    user_id: sellerUserId,
    actor_id: buyerUserId,
    type: "purchase",
    entity_id: albumId,
    message: "compró tu contenido.",
    is_read: false,
  });

  throwRepositoryError(notificationError, fallback);
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
  const normalizedPaymentId = String(paymentId);
  const persisted = await persistAlbumPurchaseRows({
    admin,
    buyerUserId,
    albumId,
    paymentId: normalizedPaymentId,
    amount,
    fallback: "No se pudo acreditar la compra",
  });

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

  await ensureAlbumPurchaseNotification({
    admin,
    sellerUserId,
    buyerUserId,
    albumId,
    fallback: "No se pudo notificar la compra",
    shouldNotify: persisted.insertedAnyRow,
  });

  return {
    postIds: persisted.postIds,
    insertedRows: persisted.insertedRows,
    alreadyCredited: persisted.alreadyCredited,
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
  const persisted = await persistAlbumPurchaseRows({
    admin,
    buyerUserId,
    albumId,
    paymentId: transactionId,
    amount,
    fallback: "No se pudo acreditar la compra interna",
  });

  await ensureAlbumPurchaseNotification({
    admin,
    sellerUserId,
    buyerUserId,
    albumId,
    fallback: "No se pudo notificar la compra interna",
    shouldNotify: persisted.insertedAnyRow,
  });

  return {
    postIds: persisted.postIds,
    insertedRows: persisted.insertedRows,
    alreadyCredited: persisted.alreadyCredited,
  };
};

export const creditApprovedTip = async ({
  admin,
  targetUserId,
  buyerUserId,
  paymentId,
  amount,
  externalReference,
  message,
}: {
  admin: SupabaseClient;
  targetUserId: string;
  buyerUserId: string;
  paymentId: string | number;
  amount: number;
  externalReference?: string | null;
  message?: string | null;
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
      message: message?.trim()
        ? `te envió una propina de ${amount.toFixed(2)} ARS. Mensaje: ${message.trim()}`
        : `te envió una propina de ${amount.toFixed(2)} ARS.`,
      is_read: false,
    });

    throwRepositoryError(insertError, "No se pudo acreditar la propina");
  }

  return { alreadyCredited: Boolean(existingTip) };
};

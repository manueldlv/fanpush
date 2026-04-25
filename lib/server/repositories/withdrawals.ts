import type { SupabaseClient } from "@supabase/supabase-js";
import {
  releaseRejectedWithdrawalReservation,
  reserveWithdrawalLedgerBalance,
  settleWithdrawalAsPaid,
} from "@/lib/server/repositories/ledger";
import {
  serializeWithdrawalHistory,
  serializeWithdrawalRecord,
  type WithdrawalRecord,
  type WithdrawalStatus,
} from "@/lib/withdrawals";

const mapTableStatusToLegacy = (
  value: string,
): WithdrawalStatus => {
  switch (value) {
    case "paid":
      return "sent";
    case "rejected":
    case "cancelled":
      return "rejected";
    case "requested":
    case "reserved":
    default:
      return "requested";
  }
};

export const getWithdrawalRequestById = async (
  admin: SupabaseClient,
  id: string,
) => {
  const { data: tableRow, error: tableError } = await admin
    .from("withdrawal_requests")
    .select("id,user_id,amount,status,requested_at,month_key")
    .eq("id", id)
    .maybeSingle();

  if (tableError) {
    throw new Error(`No se pudo leer la solicitud de retiro: ${tableError.message}`);
  }

  if (tableRow) {
    return {
      id: tableRow.id,
      userId: tableRow.user_id,
      createdAt: tableRow.requested_at,
      record: {
        amount: Number(tableRow.amount || 0),
        status: mapTableStatusToLegacy(tableRow.status),
        requestedAt: tableRow.requested_at,
        monthKey: tableRow.month_key || "",
      } satisfies WithdrawalRecord,
    };
  }
  return null;
};

export const listWithdrawalRequestsByUserId = async (
  admin: SupabaseClient,
  userId: string,
) => {
  const { data: tableRows, error: tableError } = await admin
    .from("withdrawal_requests")
    .select("id,amount,status,requested_at,month_key")
    .eq("user_id", userId)
    .order("requested_at", { ascending: false });

  if (tableError) {
    throw new Error(`No se pudieron leer los retiros: ${tableError.message}`);
  }

  return (tableRows ?? []).map((row) => ({
    id: row.id,
    createdAt: row.requested_at,
    record: {
      amount: Number(row.amount || 0),
      status: mapTableStatusToLegacy(row.status),
      requestedAt: row.requested_at,
      monthKey: row.month_key || "",
    } satisfies WithdrawalRecord,
  })).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
};

export const createWithdrawalRequest = async ({
  admin,
  userId,
  record,
}: {
  admin: SupabaseClient;
  userId: string;
  record: WithdrawalRecord;
}) => {
  const withdrawalId = crypto.randomUUID();

  await reserveWithdrawalLedgerBalance({
    admin,
    withdrawalId,
    userId,
    amount: record.amount,
    monthKey: record.monthKey,
  });

  const { error } = await admin.from("notifications").insert({
    id: withdrawalId,
    user_id: userId,
    actor_id: userId,
    type: "withdrawal_request",
    entity_id: userId,
    message: serializeWithdrawalRecord(record),
    is_read: true,
  });

  if (error) {
    throw new Error(`No se pudo guardar la solicitud de retiro: ${error.message}`);
  }
};

export const updateWithdrawalRequest = async ({
  admin,
  id,
  record,
  actorId,
  reason,
}: {
  admin: SupabaseClient;
  id: string;
  record: WithdrawalRecord;
  actorId?: string;
  reason?: string;
}) => {
  const mappedStatus =
    record.status === "sent"
      ? "paid"
      : record.status === "rejected"
        ? "rejected"
        : "requested";

  const { error: tableUpdateError } = await admin
    .from("withdrawal_requests")
    .update({
      status: mappedStatus,
      reviewed_at:
        record.status === "requested" ? null : new Date().toISOString(),
      reviewed_by: actorId ?? null,
      notes: reason?.trim() || null,
    })
    .eq("id", id);

  if (tableUpdateError) {
    throw new Error(`No se pudo actualizar el retiro en tabla: ${tableUpdateError.message}`);
  }

  if (record.status === "sent" && actorId) {
    await settleWithdrawalAsPaid({
      admin,
      withdrawalId: id,
      actorId,
    });
  }

  if (record.status === "rejected" && actorId) {
    await releaseRejectedWithdrawalReservation({
      admin,
      withdrawalId: id,
      actorId,
      reason,
    });
  }

  const { error } = await admin
    .from("notifications")
    .update({ message: serializeWithdrawalRecord(record) })
    .eq("id", id);

  if (error) {
    throw new Error(`No se pudo actualizar el retiro: ${error.message}`);
  }
};

export const createWithdrawalHistory = async ({
  admin,
  actorId,
  withdrawalId,
  amount,
  status,
  reason,
}: {
  admin: SupabaseClient;
  actorId: string;
  withdrawalId: string;
  amount: number;
  status: WithdrawalStatus;
  reason?: string;
}) => {
  const { error } = await admin.from("notifications").insert({
    user_id: actorId,
    actor_id: actorId,
    entity_id: withdrawalId,
    type: "withdrawal_history",
    message: serializeWithdrawalHistory({
      withdrawalId,
      status,
      amount,
      actedAt: new Date().toISOString(),
      reason: reason?.trim() || undefined,
    }),
    is_read: true,
  });

  if (error) {
    throw new Error(`No se pudo guardar el historial del retiro: ${error.message}`);
  }
};

export const notifyWithdrawalUpdate = async ({
  admin,
  userId,
  actorId,
  withdrawalId,
  message,
}: {
  admin: SupabaseClient;
  userId: string;
  actorId: string;
  withdrawalId: string;
  message: string;
}) => {
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    actor_id: actorId,
    entity_id: withdrawalId,
    type: "withdrawal_update",
    message,
    is_read: false,
  });

  if (error) {
    throw new Error(`No se pudo notificar el retiro: ${error.message}`);
  }
};

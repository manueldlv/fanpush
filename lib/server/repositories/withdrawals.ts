import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseWithdrawalRecord,
  serializeWithdrawalHistory,
  serializeWithdrawalRecord,
  type WithdrawalRecord,
  type WithdrawalStatus,
} from "@/lib/withdrawals";

export const getWithdrawalRequestById = async (
  admin: SupabaseClient,
  id: string,
) => {
  const { data, error } = await admin
    .from("notifications")
    .select("id,user_id,message,created_at")
    .eq("id", id)
    .eq("type", "withdrawal_request")
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer la solicitud de retiro: ${error.message}`);
  }

  return data
    ? {
        id: data.id,
        userId: data.user_id,
        createdAt: data.created_at,
        record: parseWithdrawalRecord(data.message),
      }
    : null;
};

export const listWithdrawalRequestsByUserId = async (
  admin: SupabaseClient,
  userId: string,
) => {
  const { data, error } = await admin
    .from("notifications")
    .select("id,message,created_at")
    .eq("user_id", userId)
    .eq("type", "withdrawal_request")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`No se pudieron leer los retiros: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => {
      const parsed = parseWithdrawalRecord(row.message);
      return parsed ? { id: row.id, createdAt: row.created_at, record: parsed } : null;
    })
    .filter(
      (
        value,
      ): value is {
        id: string;
        createdAt: string;
        record: WithdrawalRecord;
      } => Boolean(value),
    );
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
  const { error } = await admin.from("notifications").insert({
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
}: {
  admin: SupabaseClient;
  id: string;
  record: WithdrawalRecord;
}) => {
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

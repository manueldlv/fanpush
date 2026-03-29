import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseAuthorApplication,
  serializeAuthorApplication,
  serializeAuthorApplicationHistory,
  type AuthorApplicationRecord,
  type AuthorApplicationStatus,
} from "@/lib/authorApplications";

export const getAuthorApplicationByUserId = async (
  admin: SupabaseClient,
  userId: string,
) => {
  const { data, error } = await admin
    .from("notifications")
    .select("id,user_id,message,created_at")
    .eq("user_id", userId)
    .eq("type", "author_application")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer la solicitud de autor: ${error.message}`);
  }

  return data
    ? {
        id: data.id,
        userId: data.user_id,
        createdAt: data.created_at,
        record: parseAuthorApplication(data.message),
      }
    : null;
};

export const getAuthorApplicationById = async (
  admin: SupabaseClient,
  id: string,
) => {
  const { data, error } = await admin
    .from("notifications")
    .select("id,user_id,message,created_at")
    .eq("id", id)
    .eq("type", "author_application")
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer la solicitud de autor: ${error.message}`);
  }

  return data
    ? {
        id: data.id,
        userId: data.user_id,
        createdAt: data.created_at,
        record: parseAuthorApplication(data.message),
      }
    : null;
};

export const saveAuthorApplication = async ({
  admin,
  userId,
  record,
}: {
  admin: SupabaseClient;
  userId: string;
  record: AuthorApplicationRecord;
}) => {
  const existing = await getAuthorApplicationByUserId(admin, userId);

  if (existing?.id) {
    const { error } = await admin
      .from("notifications")
      .update({
        message: serializeAuthorApplication(record),
        is_read: false,
      })
      .eq("id", existing.id);

    if (error) {
      throw new Error(`No se pudo actualizar la solicitud: ${error.message}`);
    }

    return { id: existing.id, updated: true as const };
  }

  const { data, error } = await admin
    .from("notifications")
    .insert({
      user_id: userId,
      actor_id: userId,
      entity_id: userId,
      type: "author_application",
      message: serializeAuthorApplication(record),
      is_read: false,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo guardar la solicitud.");
  }

  return { id: data.id, updated: false as const };
};

export const updateAuthorApplicationRecord = async ({
  admin,
  id,
  record,
  markUnread = false,
}: {
  admin: SupabaseClient;
  id: string;
  record: AuthorApplicationRecord;
  markUnread?: boolean;
}) => {
  const { error } = await admin
    .from("notifications")
    .update({
      message: serializeAuthorApplication(record),
      ...(markUnread ? { is_read: false } : {}),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`No se pudo actualizar la solicitud: ${error.message}`);
  }
};

export const createAuthorApplicationHistory = async ({
  admin,
  userId,
  actorId,
  applicationId,
  action,
  reason,
}: {
  admin: SupabaseClient;
  userId: string;
  actorId: string;
  applicationId: string;
  action: AuthorApplicationStatus;
  reason?: string;
}) => {
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    actor_id: actorId,
    entity_id: applicationId,
    type: "author_application_history",
    message: serializeAuthorApplicationHistory({
      applicationId,
      action,
      actedAt: new Date().toISOString(),
      reason: reason?.trim() || undefined,
    }),
    is_read: true,
  });

  if (error) {
    throw new Error(`No se pudo guardar el historial de la solicitud: ${error.message}`);
  }
};

export const notifyAuthorApplicationUpdate = async ({
  admin,
  userId,
  actorId,
  applicationId,
  message,
}: {
  admin: SupabaseClient;
  userId: string;
  actorId: string;
  applicationId: string;
  message: string;
}) => {
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    actor_id: actorId,
    entity_id: applicationId,
    type: "author_application_update",
    message,
    is_read: false,
  });

  if (error) {
    throw new Error(`No se pudo notificar al usuario: ${error.message}`);
  }
};

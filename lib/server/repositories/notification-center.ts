import type { SupabaseClient } from "@supabase/supabase-js";
import { buildUserProfileHref } from "@/lib/profileRoute";

const USER_VISIBLE_ACTIVITY_TYPES = new Set([
  "follow",
  "tip",
  "purchase",
  "withdrawal_update",
  "author_application_update",
  "content_removed_update",
]);

const SYSTEM_ACTIVITY_TYPES = new Set([
  "withdrawal_update",
  "author_application_update",
  "content_removed_update",
]);

export type NotificationActivityItem = {
  id: string;
  type: string;
  text: string;
  createdAt: string;
  dateLabel: string;
  timeLabel: string;
  avatar: string | null;
  isRead: boolean;
  action: { label: string; href: string } | null;
};

export type NotificationThreadSummary = {
  id: string;
  topic: "support" | "author_application" | "withdrawal" | "moderation" | "system";
  subject: string;
  status: "open" | "closed";
  allowUserReply: boolean;
  lastMessagePreview: string;
  lastMessageAt: string;
  lastSenderRole: "user" | "admin" | "system";
  unread: boolean;
  sourceType: string | null;
  sourceId: string | null;
};

export type NotificationThreadMessage = {
  id: string;
  senderId: string | null;
  senderRole: "user" | "admin" | "system";
  senderName: string;
  senderAvatar: string | null;
  body: string;
  createdAt: string;
  isOwnMessage: boolean;
};

export type NotificationThreadDetail = NotificationThreadSummary & {
  messages: NotificationThreadMessage[];
};

const buildDateLabel = (value: string) =>
  new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });

const buildTimeLabel = (value: string) =>
  new Date(value).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

const buildActivityAction = ({
  type,
  actorUsername,
}: {
  type: string;
  actorUsername?: string | null;
}) => {
  if (type === "follow" && actorUsername) {
    return { label: "Ver perfil", href: buildUserProfileHref(actorUsername) };
  }
  if (type === "purchase" || type === "tip") {
    return { label: "Ver ventas", href: "/ventas" };
  }
  if (
    type === "withdrawal_update" ||
    type === "author_application_update" ||
    type === "content_removed_update"
  ) {
    return { label: "Abrir mensaje", href: "/notificaciones?tab=messages" };
  }
  return null;
};

const resolvePublicImageUrl = (admin: SupabaseClient, value: string | null) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return admin.storage.from("Imagenes").getPublicUrl(value).data.publicUrl;
};

const buildThreadPreview = (body: string) => body.trim().replace(/\s+/g, " ").slice(0, 180);

const normalizeThreadTopic = (
  value: string | null | undefined,
): NotificationThreadSummary["topic"] => {
  switch (value) {
    case "author_application":
    case "withdrawal":
    case "moderation":
    case "system":
      return value;
    case "support":
    default:
      return "support";
  }
};

const normalizeThreadStatus = (
  value: string | null | undefined,
): NotificationThreadSummary["status"] => (value === "closed" ? "closed" : "open");

const normalizeSenderRole = (
  value: string | null | undefined,
): NotificationThreadMessage["senderRole"] =>
  value === "user" || value === "admin" ? value : "system";

export const listUserNotificationActivity = async (
  admin: SupabaseClient,
  userId: string,
  limit = 60,
) => {
  const { data: rows, error } = await admin
    .from("notifications")
    .select("id,actor_id,entity_id,message,created_at,type,is_read")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`No se pudieron leer las notificaciones: ${error.message}`);
  }

  const filtered = (rows ?? []).filter((row) => USER_VISIBLE_ACTIVITY_TYPES.has(row.type ?? ""));
  const actorIds = Array.from(new Set(filtered.map((row) => row.actor_id).filter(Boolean)));
  const { data: actors, error: actorsError } = actorIds.length
    ? await admin.from("users").select("id,username,avatar_url").in("id", actorIds)
    : { data: [], error: null };

  if (actorsError) {
    throw new Error(`No se pudieron leer los actores de notificaciones: ${actorsError.message}`);
  }

  const actorMap = new Map((actors ?? []).map((row) => [row.id, row]));
  const seenFollowActors = new Set<string>();
  const dedupedRows = filtered.filter((row) => {
    if (row.type !== "follow" || !row.actor_id) {
      return true;
    }
    const key = `${row.type}:${row.actor_id}`;
    if (seenFollowActors.has(key)) {
      return false;
    }
    seenFollowActors.add(key);
    return true;
  });

  return dedupedRows.map((row) => {
    const actor = row.actor_id ? actorMap.get(row.actor_id) : null;
    const text = SYSTEM_ACTIVITY_TYPES.has(row.type ?? "")
      ? `FanPush ${row.message ?? ""}`
      : `${actor?.username ?? "alguien"} ${row.message ?? ""}`;

    return {
      id: row.id,
      type: row.type ?? "generic",
      text,
      createdAt: row.created_at,
      dateLabel: buildDateLabel(row.created_at),
      timeLabel: buildTimeLabel(row.created_at),
      avatar: SYSTEM_ACTIVITY_TYPES.has(row.type ?? "")
        ? null
        : resolvePublicImageUrl(admin, actor?.avatar_url ?? null),
      isRead: row.is_read ?? false,
      action: buildActivityAction({
        type: row.type ?? "",
        actorUsername: actor?.username,
      }),
    } satisfies NotificationActivityItem;
  });
};

export const listUserNotificationThreads = async (
  admin: SupabaseClient,
  userId: string,
  limit = 50,
) => {
  const { data: rows, error } = await admin
    .from("notification_threads")
    .select(
      "id,topic,subject,status,allow_user_reply,last_message_preview,last_message_at,last_sender_role,user_last_read_at,source_type,source_id",
    )
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`No se pudieron leer los hilos: ${error.message}`);
  }

  return (rows ?? []).map((row) => {
    const lastSenderRole = normalizeSenderRole(row.last_sender_role);
    const userLastReadAt = row.user_last_read_at ? new Date(row.user_last_read_at) : null;
    const lastMessageAt = new Date(row.last_message_at);

    return {
      id: row.id,
      topic: normalizeThreadTopic(row.topic),
      subject: row.subject?.trim() || "Conversación con FanPush",
      status: normalizeThreadStatus(row.status),
      allowUserReply: row.allow_user_reply ?? true,
      lastMessagePreview: row.last_message_preview ?? "",
      lastMessageAt: row.last_message_at,
      lastSenderRole,
      unread:
        lastSenderRole !== "user" && (!userLastReadAt || lastMessageAt > userLastReadAt),
      sourceType: row.source_type ?? null,
      sourceId: row.source_id ?? null,
    } satisfies NotificationThreadSummary;
  });
};

const loadThreadMessages = async ({
  admin,
  threadId,
  currentUserId,
}: {
  admin: SupabaseClient;
  threadId: string;
  currentUserId: string;
}) => {
  const { data: messageRows, error: messagesError } = await admin
    .from("notification_messages")
    .select("id,sender_id,sender_role,body,created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    throw new Error(`No se pudieron leer los mensajes: ${messagesError.message}`);
  }

  const senderIds = Array.from(new Set((messageRows ?? []).map((row) => row.sender_id).filter(Boolean)));
  const [{ data: users }, { data: profiles }] = await Promise.all([
    senderIds.length
      ? admin.from("users").select("id,username,avatar_url").in("id", senderIds)
      : Promise.resolve({ data: [] as Array<{ id: string; username: string | null; avatar_url: string | null }> }),
    senderIds.length
      ? admin.from("profiles").select("id,full_name").in("id", senderIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
  ]);

  const userMap = new Map((users ?? []).map((row) => [row.id, row]));
  const profileMap = new Map((profiles ?? []).map((row) => [row.id, row]));

  return (messageRows ?? []).map((row) => {
    const senderRole = normalizeSenderRole(row.sender_role);
    const senderUser = row.sender_id ? userMap.get(row.sender_id) : null;
    const senderProfile = row.sender_id ? profileMap.get(row.sender_id) : null;
    const senderName =
      row.sender_id === currentUserId && senderRole === "user"
        ? "Tú"
        : senderRole === "admin"
          ? senderProfile?.full_name?.trim() || senderUser?.username || "FanPush"
          : senderRole === "system"
            ? "FanPush"
            : senderUser?.username || "Usuario";

    return {
      id: row.id,
      senderId: row.sender_id ?? null,
      senderRole,
      senderName,
      senderAvatar:
        senderRole === "admin" || senderRole === "user"
          ? resolvePublicImageUrl(admin, senderUser?.avatar_url ?? null)
          : null,
      body: row.body,
      createdAt: row.created_at,
      isOwnMessage: row.sender_id === currentUserId,
    } satisfies NotificationThreadMessage;
  });
};

export const getUserNotificationThread = async ({
  admin,
  userId,
  threadId,
  markAsRead = true,
}: {
  admin: SupabaseClient;
  userId: string;
  threadId: string;
  markAsRead?: boolean;
}) => {
  const { data: thread, error } = await admin
    .from("notification_threads")
    .select(
      "id,user_id,topic,subject,status,allow_user_reply,last_message_preview,last_message_at,last_sender_role,user_last_read_at,source_type,source_id",
    )
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer el hilo: ${error.message}`);
  }

  if (!thread) return null;

  if (markAsRead) {
    const { error: readError } = await admin
      .from("notification_threads")
      .update({ user_last_read_at: new Date().toISOString() })
      .eq("id", threadId)
      .eq("user_id", userId);

    if (readError) {
      throw new Error(`No se pudo marcar el hilo como leído: ${readError.message}`);
    }
  }

  const messages = await loadThreadMessages({
    admin,
    threadId,
    currentUserId: userId,
  });

  return {
    id: thread.id,
    topic: normalizeThreadTopic(thread.topic),
    subject: thread.subject?.trim() || "Conversación con FanPush",
    status: normalizeThreadStatus(thread.status),
    allowUserReply: thread.allow_user_reply ?? true,
    lastMessagePreview: thread.last_message_preview ?? "",
    lastMessageAt: thread.last_message_at,
    lastSenderRole: normalizeSenderRole(thread.last_sender_role),
    unread: false,
    sourceType: thread.source_type ?? null,
    sourceId: thread.source_id ?? null,
    messages,
  } satisfies NotificationThreadDetail;
};

export const replyToUserNotificationThread = async ({
  admin,
  userId,
  threadId,
  body,
}: {
  admin: SupabaseClient;
  userId: string;
  threadId: string;
  body: string;
}) => {
  const normalizedBody = body.trim();
  if (!normalizedBody) {
    throw new Error("Debes escribir un mensaje para responder.");
  }

  const { data: thread, error: threadError } = await admin
    .from("notification_threads")
    .select("id,status,allow_user_reply")
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle();

  if (threadError) {
    throw new Error(`No se pudo validar el hilo: ${threadError.message}`);
  }

  if (!thread) {
    throw new Error("No se encontró la conversación.");
  }

  if (thread.status === "closed" || !thread.allow_user_reply) {
    throw new Error("Esta conversación ya no admite respuestas.");
  }

  const { error: insertError } = await admin.from("notification_messages").insert({
    thread_id: threadId,
    sender_id: userId,
    sender_role: "user",
    body: normalizedBody,
  });

  if (insertError) {
    throw new Error(`No se pudo enviar la respuesta: ${insertError.message}`);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("notification_threads")
    .update({
      last_message_preview: buildThreadPreview(normalizedBody),
      last_sender_role: "user",
      last_message_at: now,
      updated_at: now,
      user_last_read_at: now,
    })
    .eq("id", threadId)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(`No se pudo actualizar el hilo: ${updateError.message}`);
  }
};

export const createOrAppendAdminNotificationThread = async ({
  admin,
  userId,
  actorId,
  topic,
  subject,
  body,
  sourceType,
  sourceId,
  allowUserReply = true,
}: {
  admin: SupabaseClient;
  userId: string;
  actorId: string | null;
  topic: NotificationThreadSummary["topic"];
  subject: string;
  body: string;
  sourceType?: string;
  sourceId?: string;
  allowUserReply?: boolean;
}) => {
  const normalizedBody = body.trim();
  if (!normalizedBody) {
    throw new Error("El mensaje administrativo no puede quedar vacío.");
  }

  let threadId: string | null = null;

  if (sourceType && sourceId) {
    const { data: existingThread, error: existingError } = await admin
      .from("notification_threads")
      .select("id")
      .eq("user_id", userId)
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .eq("status", "open")
      .maybeSingle();

    if (existingError) {
      throw new Error(`No se pudo validar el hilo existente: ${existingError.message}`);
    }

    threadId = existingThread?.id ?? null;
  }

  const now = new Date().toISOString();

  if (!threadId) {
    const { data: createdThread, error: createThreadError } = await admin
      .from("notification_threads")
      .insert({
        user_id: userId,
        topic,
        subject,
        status: "open",
        source_type: sourceType ?? null,
        source_id: sourceId ?? null,
        allow_user_reply: allowUserReply,
        created_by: actorId,
        last_admin_user_id: actorId,
        last_message_preview: buildThreadPreview(normalizedBody),
        last_sender_role: "admin",
        last_message_at: now,
        admin_last_read_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (createThreadError || !createdThread?.id) {
      throw new Error(createThreadError?.message ?? "No se pudo crear el hilo.");
    }

    threadId = createdThread.id;
  }

  const { error: insertMessageError } = await admin.from("notification_messages").insert({
    thread_id: threadId,
    sender_id: actorId,
    sender_role: "admin",
    body: normalizedBody,
  });

  if (insertMessageError) {
    throw new Error(`No se pudo guardar el mensaje administrativo: ${insertMessageError.message}`);
  }

  const { error: updateThreadError } = await admin
    .from("notification_threads")
    .update({
      topic,
      subject,
      status: "open",
      allow_user_reply: allowUserReply,
      last_admin_user_id: actorId,
      last_message_preview: buildThreadPreview(normalizedBody),
      last_sender_role: "admin",
      last_message_at: now,
      admin_last_read_at: now,
      updated_at: now,
    })
    .eq("id", threadId);

  if (updateThreadError) {
    throw new Error(`No se pudo actualizar el hilo administrativo: ${updateThreadError.message}`);
  }

  return { threadId };
};

export const listAdminNotificationThreads = async (
  admin: SupabaseClient,
  limit = 100,
) => {
  const { data: rows, error } = await admin
    .from("notification_threads")
    .select(
      "id,user_id,topic,subject,status,allow_user_reply,last_message_preview,last_message_at,last_sender_role,admin_last_read_at,source_type,source_id",
    )
    .order("last_message_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`No se pudieron leer los hilos admin: ${error.message}`);
  }

  const userIds = Array.from(new Set((rows ?? []).map((row) => row.user_id).filter(Boolean)));
  const { data: users, error: usersError } = userIds.length
    ? await admin.from("users").select("id,username,avatar_url").in("id", userIds)
    : { data: [], error: null };
  const { data: profiles, error: profilesError } = userIds.length
    ? await admin.from("profiles").select("id,full_name").in("id", userIds)
    : { data: [], error: null };

  if (usersError) {
    throw new Error(`No se pudieron leer los usuarios de hilos: ${usersError.message}`);
  }
  if (profilesError) {
    throw new Error(`No se pudieron leer los perfiles de hilos: ${profilesError.message}`);
  }

  const userMap = new Map((users ?? []).map((row) => [row.id, row]));
  const profileMap = new Map((profiles ?? []).map((row) => [row.id, row]));

  return (rows ?? []).map((row) => {
    const lastSenderRole = normalizeSenderRole(row.last_sender_role);
    const adminLastReadAt = row.admin_last_read_at ? new Date(row.admin_last_read_at) : null;
    const lastMessageAt = new Date(row.last_message_at);
    const userRecord = userMap.get(row.user_id);
    const profileRecord = profileMap.get(row.user_id);

    return {
      id: row.id,
      userId: row.user_id,
      username: userRecord?.username ?? "usuario",
      fullName: profileRecord?.full_name?.trim() || userRecord?.username || "Usuario",
      avatar: resolvePublicImageUrl(admin, userRecord?.avatar_url ?? null),
      topic: normalizeThreadTopic(row.topic),
      subject: row.subject?.trim() || "Conversación con FanPush",
      status: normalizeThreadStatus(row.status),
      allowUserReply: row.allow_user_reply ?? true,
      lastMessagePreview: row.last_message_preview ?? "",
      lastMessageAt: row.last_message_at,
      lastSenderRole,
      unread:
        lastSenderRole === "user" && (!adminLastReadAt || lastMessageAt > adminLastReadAt),
      sourceType: row.source_type ?? null,
      sourceId: row.source_id ?? null,
    };
  });
};

export const getAdminNotificationThread = async ({
  admin,
  threadId,
  markAsRead = true,
}: {
  admin: SupabaseClient;
  threadId: string;
  markAsRead?: boolean;
}) => {
  const { data: thread, error } = await admin
    .from("notification_threads")
    .select(
      "id,user_id,topic,subject,status,allow_user_reply,last_message_preview,last_message_at,last_sender_role,admin_last_read_at,source_type,source_id",
    )
    .eq("id", threadId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer el hilo admin: ${error.message}`);
  }

  if (!thread) return null;

  if (markAsRead) {
    const { error: readError } = await admin
      .from("notification_threads")
      .update({ admin_last_read_at: new Date().toISOString() })
      .eq("id", threadId);

    if (readError) {
      throw new Error(`No se pudo marcar leído el hilo admin: ${readError.message}`);
    }
  }

  const messages = await loadThreadMessages({
    admin,
    threadId,
    currentUserId: thread.user_id,
  });

  return {
    id: thread.id,
    userId: thread.user_id,
    topic: normalizeThreadTopic(thread.topic),
    subject: thread.subject?.trim() || "Conversación con FanPush",
    status: normalizeThreadStatus(thread.status),
    allowUserReply: thread.allow_user_reply ?? true,
    lastMessagePreview: thread.last_message_preview ?? "",
    lastMessageAt: thread.last_message_at,
    lastSenderRole: normalizeSenderRole(thread.last_sender_role),
    unread: false,
    sourceType: thread.source_type ?? null,
    sourceId: thread.source_id ?? null,
    messages,
  };
};

export const replyAsAdminToNotificationThread = async ({
  admin,
  threadId,
  actorId,
  body,
  closeThread = false,
}: {
  admin: SupabaseClient;
  threadId: string;
  actorId: string;
  body: string;
  closeThread?: boolean;
}) => {
  const normalizedBody = body.trim();
  if (!normalizedBody) {
    throw new Error("Debes escribir un mensaje para responder.");
  }

  const { data: thread, error: threadError } = await admin
    .from("notification_threads")
    .select("id,status")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    throw new Error(`No se pudo validar el hilo admin: ${threadError.message}`);
  }

  if (!thread) {
    throw new Error("No se encontró la conversación.");
  }

  const { error: insertError } = await admin.from("notification_messages").insert({
    thread_id: threadId,
    sender_id: actorId,
    sender_role: "admin",
    body: normalizedBody,
  });

  if (insertError) {
    throw new Error(`No se pudo guardar la respuesta admin: ${insertError.message}`);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("notification_threads")
    .update({
      status: closeThread ? "closed" : thread.status === "closed" ? "closed" : "open",
      last_admin_user_id: actorId,
      last_message_preview: buildThreadPreview(normalizedBody),
      last_sender_role: "admin",
      last_message_at: now,
      admin_last_read_at: now,
      updated_at: now,
    })
    .eq("id", threadId);

  if (updateError) {
    throw new Error(`No se pudo actualizar el hilo admin: ${updateError.message}`);
  }
};

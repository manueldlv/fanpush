import type { SupabaseClient } from "@supabase/supabase-js";
import {
  coerceAccountState,
  getUnavailableAccountMessage,
  isPubliclyUnavailableAccount,
} from "@/lib/accountState";
import {
  buildDirectPremiumMediaPath,
  buildPremiumMediaPath,
  inferDisplayKind,
  parseLockedPreviewPath,
  PREMIUM_MEDIA_BUCKET,
  PUBLIC_MEDIA_BUCKET,
} from "@/lib/media";
import {
  getPurchaseAlbumTarget,
  hasUserPurchasedAlbum,
  recordInternalAlbumPurchase,
} from "@/lib/server/repositories/payments";
import { createSignedUrlMap } from "@/lib/server/storage";
import { getUserMetaEntries, USER_META_KEYS } from "@/lib/userMeta";
import { processInternalAlbumPurchase } from "@/lib/server/repositories/ledger";

type ThreadRow = {
  id: string;
  participant_low: string;
  participant_high: string;
  last_message_preview: string | null;
  last_message_at: string;
  last_sender_id: string | null;
};

type ThreadMemberRow = {
  thread_id: string;
  user_id: string;
  pinned: boolean;
  force_unread: boolean;
  hidden: boolean;
  last_read_at: string | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  kind: "text" | "attachment" | "premium" | "system";
  body: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type UserRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type DirectChatAttachmentMeta = {
  id: string;
  name: string;
  kind: "foto" | "video";
  previewMode?: "preview" | "locked";
  previewPath?: string | null;
  premiumPath?: string | null;
  publicPath?: string | null;
};

type DirectThreadSummary = {
  id: string;
  participantUserId: string;
  username: string;
  fullName: string;
  handle: string;
  preview: string;
  avatarUrl: string | null;
  participantIsAuthor: boolean;
  lastSeen: string;
  lastMessageAt: string;
  unread: boolean;
  pinned: boolean;
};

type DirectMessageView =
  | {
      id: string;
      kind: "text";
      sender: "me" | "them";
      body: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "attachment";
      sender: "me" | "them";
      attachments: Array<{
        id: string;
        name: string;
        kind: "foto" | "video";
        previewUrl: string;
        previewMode?: "preview" | "locked";
      }>;
      createdAt: string;
    }
  | {
      id: string;
      kind: "system";
      sender: "system";
      body: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "premium";
      sender: "me" | "them";
      title: string;
      caption: string;
      price: number;
      attachmentCount: number;
      attachmentPreviews: Array<{
        id: string;
        name: string;
        kind: "foto" | "video";
        previewUrl: string;
        previewMode?: "preview" | "locked";
      }>;
      status: "locked" | "purchased";
      createdAt: string;
    };

export type DirectThreadDetail = DirectThreadSummary & {
  messages: DirectMessageView[];
  pageInfo: {
    hasMoreOlder: boolean;
    oldestCursor: string | null;
  };
};

export type DirectBlockedUser = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  blockedAt: string;
};

const throwRepositoryError = (
  error: { message: string } | null,
  fallback: string,
) => {
  if (error) {
    throw new Error(`${fallback}: ${error.message}`);
  }
};

const resolvePublicUrl = (
  admin: SupabaseClient,
  value: string | null | undefined,
) => {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  return admin.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data
    .publicUrl;
};

const formatRelativeMessageTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ahora";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} d`;
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
};

const formatMessageTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ahora";
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();
  if (sameDay) {
    return `Hoy ${date.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toOrderedPair = (a: string, b: string) =>
  a < b ? { low: a, high: b } : { low: b, high: a };

const parseAttachments = (
  metadata: Record<string, unknown> | null | undefined,
) => {
  const raw = metadata?.attachments;
  if (!Array.isArray(raw)) return [] as DirectChatAttachmentMeta[];
  return raw.reduce<DirectChatAttachmentMeta[]>((attachments, entry) => {
    if (!entry || typeof entry !== "object") return attachments;
    const item = entry as Record<string, unknown>;
    const kind =
      item.kind === "video" ? "video" : item.kind === "foto" ? "foto" : null;
    if (!kind) return attachments;
    attachments.push({
      id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
      name: typeof item.name === "string" ? item.name : "archivo",
      kind,
      previewMode: item.previewMode === "locked" ? "locked" : "preview",
      previewPath:
        typeof item.previewPath === "string" ? item.previewPath : null,
      premiumPath:
        typeof item.premiumPath === "string" ? item.premiumPath : null,
      publicPath: typeof item.publicPath === "string" ? item.publicPath : null,
    });
    return attachments;
  }, []);
};

const parseAlbumId = (
  metadata: Record<string, unknown> | null | undefined,
) => (typeof metadata?.albumId === "string" ? metadata.albumId : null);

const buildPremiumCaption = (attachments: DirectChatAttachmentMeta[]) => {
  const photos = attachments.filter(
    (attachment) => attachment.kind === "foto",
  ).length;
  const videos = attachments.filter(
    (attachment) => attachment.kind === "video",
  ).length;
  const parts: string[] = [];
  if (videos > 0) parts.push(`${videos} ${videos === 1 ? "video" : "videos"}`);
  if (photos > 0) parts.push(`${photos} ${photos === 1 ? "foto" : "fotos"}`);
  return parts.join(", ") || "Contenido privado";
};

const buildThreadPreview = ({
  kind,
  body,
  attachments,
  price,
}: {
  kind: MessageRow["kind"];
  body?: string | null;
  attachments?: DirectChatAttachmentMeta[];
  price?: number;
}) => {
  if (kind === "text") return body?.trim() || "Mensaje";
  if (kind === "system") return body?.trim() || "Actividad del sistema";
  if (kind === "attachment") {
    const count = attachments?.length ?? 0;
    if (count <= 1) {
      return attachments?.[0]?.kind === "video" ? "Video" : "Foto";
    }
    return `${count} archivos`;
  }
  if (kind === "premium") {
    return `Contenido privado · $${Math.round(price ?? 0)}`;
  }
  return "Mensaje";
};

const createThreadParticipantMap = async (
  admin: SupabaseClient,
  userIds: string[],
) => {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return new Map<string, DirectThreadSummary>();

  const [
    { data: userRows, error: usersError },
    { data: profileRows, error: profilesError },
    { data: metaRows, error: metaError },
  ] = await Promise.all([
    admin
      .from("users")
      .select("id,username,avatar_url")
      .in("id", uniqueUserIds),
    admin.from("profiles").select("id,full_name").in("id", uniqueUserIds),
    admin
      .from("user_meta")
      .select("user_id,meta_key,meta_value")
      .in("user_id", uniqueUserIds)
      .eq("meta_key", USER_META_KEYS.accountState),
  ]);

  throwRepositoryError(usersError, "No se pudieron leer los usuarios del chat");
  throwRepositoryError(
    profilesError,
    "No se pudieron leer los perfiles del chat",
  );
  throwRepositoryError(
    metaError,
    "No se pudo leer el estado de cuenta del chat",
  );

  const userMap = new Map(
    (userRows ?? []).map((row) => [row.id, row as UserRow]),
  );
  const profileMap = new Map(
    (profileRows ?? []).map((row) => [row.id, row as ProfileRow]),
  );
  const accountStateMap = new Map(
    (metaRows ?? []).map((row) => [
      row.user_id as string,
      coerceAccountState(row.meta_value),
    ]),
  );
  const result = new Map<string, DirectThreadSummary>();

  uniqueUserIds.forEach((userId) => {
    const user = userMap.get(userId);
    const profile = profileMap.get(userId);
    const username = user?.username?.trim() || "usuario";
    const accountState = accountStateMap.get(userId);
    const unavailable = accountState
      ? isPubliclyUnavailableAccount(accountState)
      : false;
    result.set(userId, {
      id: "",
      participantUserId: userId,
      username,
      fullName: unavailable
        ? "Cuenta no disponible"
        : profile?.full_name?.trim() || username,
      handle: username,
      preview:
        unavailable && accountState
          ? getUnavailableAccountMessage(accountState)
          : "",
      avatarUrl: unavailable ? null : resolvePublicUrl(admin, user?.avatar_url),
      participantIsAuthor: false,
      lastSeen: "Ahora",
      lastMessageAt: new Date(0).toISOString(),
      unread: false,
      pinned: false,
    });
  });

  return result;
};

const ensureDirectThreadPair = async (
  admin: SupabaseClient,
  viewerUserId: string,
  otherUserId: string,
) => {
  if (viewerUserId === otherUserId) {
    throw new Error("No puedes abrir un chat contigo mismo.");
  }

  const { low, high } = toOrderedPair(viewerUserId, otherUserId);
  const { data: existing, error: existingError } = await admin
    .from("direct_threads")
    .select(
      "id,participant_low,participant_high,last_message_preview,last_message_at,last_sender_id",
    )
    .eq("participant_low", low)
    .eq("participant_high", high)
    .maybeSingle();

  throwRepositoryError(existingError, "No se pudo validar el chat");
  if (existing?.id) return existing as ThreadRow;

  const { data: created, error: createError } = await admin
    .from("direct_threads")
    .insert({
      participant_low: low,
      participant_high: high,
      last_message_preview: null,
      last_sender_id: null,
    })
    .select(
      "id,participant_low,participant_high,last_message_preview,last_message_at,last_sender_id",
    )
    .single();

  throwRepositoryError(createError, "No se pudo crear el chat");
  if (!created) throw new Error("No se pudo crear el chat.");

  const { error: membersError } = await admin
    .from("direct_thread_members")
    .upsert(
      [
        {
          thread_id: created.id,
          user_id: viewerUserId,
          last_read_at: new Date().toISOString(),
        },
        {
          thread_id: created.id,
          user_id: otherUserId,
        },
      ],
      { onConflict: "thread_id,user_id" },
    );

  throwRepositoryError(
    membersError,
    "No se pudieron preparar los miembros del chat",
  );
  return created as ThreadRow;
};

const touchThreadAfterMessage = async ({
  admin,
  thread,
  senderUserId,
  preview,
}: {
  admin: SupabaseClient;
  thread: ThreadRow;
  senderUserId: string;
  preview: string;
}) => {
  const now = new Date().toISOString();
  const otherUserId =
    thread.participant_low === senderUserId
      ? thread.participant_high
      : thread.participant_low;

  const { error: threadError } = await admin
    .from("direct_threads")
    .update({
      last_message_preview: preview,
      last_message_at: now,
      last_sender_id: senderUserId,
    })
    .eq("id", thread.id);

  throwRepositoryError(threadError, "No se pudo actualizar el hilo del chat");

  const { error: memberError } = await admin
    .from("direct_thread_members")
    .upsert(
      [
        {
          thread_id: thread.id,
          user_id: senderUserId,
          hidden: false,
          force_unread: false,
          last_read_at: now,
        },
        {
          thread_id: thread.id,
          user_id: otherUserId,
          hidden: false,
          force_unread: true,
        },
      ],
      { onConflict: "thread_id,user_id" },
    );

  throwRepositoryError(memberError, "No se pudo actualizar el estado del chat");
};

export const listBlockedDirectUsers = async (
  admin: SupabaseClient,
  viewerUserId: string,
): Promise<DirectBlockedUser[]> => {
  const { data: rows, error } = await admin
    .from("direct_user_blocks")
    .select("blocked_user_id,created_at")
    .eq("blocker_user_id", viewerUserId)
    .order("created_at", { ascending: false });

  throwRepositoryError(error, "No se pudieron leer los usuarios bloqueados");

  const blockedIds = (rows ?? []).map((row) => row.blocked_user_id as string);
  const participantMap = await createThreadParticipantMap(admin, blockedIds);

  return (rows ?? []).map((row) => {
    const participant = participantMap.get(row.blocked_user_id as string);
    return {
      id: row.blocked_user_id as string,
      username: participant?.username ?? "usuario",
      fullName: participant?.fullName ?? participant?.username ?? "Usuario",
      avatarUrl: participant?.avatarUrl ?? null,
      blockedAt: String(row.created_at),
    };
  });
};

export const unblockDirectUser = async (
  admin: SupabaseClient,
  viewerUserId: string,
  blockedUserId: string,
) => {
  const { error } = await admin
    .from("direct_user_blocks")
    .delete()
    .eq("blocker_user_id", viewerUserId)
    .eq("blocked_user_id", blockedUserId);
  throwRepositoryError(error, "No se pudo desbloquear al usuario");
};

export const listDirectThreads = async (
  admin: SupabaseClient,
  viewerUserId: string,
  limit = 80,
): Promise<DirectThreadSummary[]> => {
  const { data: memberRows, error: membersError } = await admin
    .from("direct_thread_members")
    .select("thread_id,user_id,pinned,force_unread,hidden,last_read_at")
    .eq("user_id", viewerUserId)
    .eq("hidden", false)
    .limit(limit);

  throwRepositoryError(membersError, "No se pudieron leer los chats");

  const threadIds = (memberRows ?? []).map((row) => row.thread_id as string);
  if (threadIds.length === 0) return [];

  const [
    { data: threadRows, error: threadsError },
    { data: blockedRows, error: blockedError },
  ] = await Promise.all([
    admin
      .from("direct_threads")
      .select(
        "id,participant_low,participant_high,last_message_preview,last_message_at,last_sender_id",
      )
      .in("id", threadIds),
    admin
      .from("direct_user_blocks")
      .select("blocked_user_id")
      .eq("blocker_user_id", viewerUserId),
  ]);

  throwRepositoryError(threadsError, "No se pudieron leer los hilos del chat");
  throwRepositoryError(blockedError, "No se pudo validar el bloqueo del chat");

  const threadMap = new Map(
    (threadRows ?? []).map((row) => [row.id, row as ThreadRow]),
  );
  const blockedIds = new Set(
    (blockedRows ?? []).map((row) => row.blocked_user_id as string),
  );
  const participantIds = (threadRows ?? []).map((row) =>
    row.participant_low === viewerUserId
      ? row.participant_high
      : row.participant_low,
  );
  const participantMap = await createThreadParticipantMap(
    admin,
    participantIds,
  );

  return (memberRows ?? [])
    .map((member) => {
      const thread = threadMap.get(member.thread_id as string);
      if (!thread) return null;
      const otherUserId =
        thread.participant_low === viewerUserId
          ? thread.participant_high
          : thread.participant_low;
      if (blockedIds.has(otherUserId)) return null;
      const participant = participantMap.get(otherUserId);
      if (!participant) return null;

      const unread =
        Boolean(member.force_unread) ||
        (thread.last_sender_id !== viewerUserId &&
          Boolean(thread.last_message_at) &&
          (!member.last_read_at ||
            new Date(thread.last_message_at).getTime() >
              new Date(member.last_read_at).getTime()));

      return {
        ...participant,
        id: thread.id,
        participantUserId: otherUserId,
        preview:
          thread.last_message_preview?.trim() || "Iniciá la conversación",
        lastSeen: formatRelativeMessageTime(thread.last_message_at),
        lastMessageAt: thread.last_message_at,
        unread,
        pinned: Boolean(member.pinned),
      } satisfies DirectThreadSummary;
    })
    .filter((item): item is DirectThreadSummary => Boolean(item))
    .sort((a, b) => {
      if (Number(b.pinned) !== Number(a.pinned)) {
        return Number(b.pinned) - Number(a.pinned);
      }
      return (
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime()
      );
    });
};

export const openDirectThreadByUsername = async ({
  admin,
  viewerUserId,
  username,
}: {
  admin: SupabaseClient;
  viewerUserId: string;
  username: string;
}) => {
  const normalized = username.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Falta el usuario del chat.");
  }

  const { data: userRow, error: userError } = await admin
    .from("users")
    .select("id,username")
    .ilike("username", normalized)
    .maybeSingle();

  throwRepositoryError(userError, "No se pudo abrir el chat");
  if (!userRow?.id)
    throw new Error("No encontramos al usuario para abrir el chat.");

  const accountStateResult = await getUserMetaEntries(admin, userRow.id, [
    USER_META_KEYS.accountState,
  ]);
  const accountState = coerceAccountState(
    accountStateResult.entries.get(USER_META_KEYS.accountState),
  );
  if (isPubliclyUnavailableAccount(accountState)) {
    throw new Error("No puedes abrir un chat con una cuenta no disponible.");
  }

  const { data: blockedByViewer } = await admin
    .from("direct_user_blocks")
    .select("blocked_user_id")
    .eq("blocker_user_id", viewerUserId)
    .eq("blocked_user_id", userRow.id)
    .maybeSingle();

  if (blockedByViewer?.blocked_user_id) {
    throw new Error("Primero tienes que desbloquear a este usuario.");
  }

  const thread = await ensureDirectThreadPair(admin, viewerUserId, userRow.id);
  return getDirectThread({
    admin,
    viewerUserId,
    threadId: thread.id,
    markAsRead: true,
  });
};

export const getDirectThread = async ({
  admin,
  viewerUserId,
  threadId,
  markAsRead,
  limit = 25,
  before,
}: {
  admin: SupabaseClient;
  viewerUserId: string;
  threadId: string;
  markAsRead: boolean;
  limit?: number;
  before?: string | null;
}): Promise<DirectThreadDetail | null> => {
  const { data: memberRow, error: memberError } = await admin
    .from("direct_thread_members")
    .select("thread_id,user_id,pinned,force_unread,hidden,last_read_at")
    .eq("thread_id", threadId)
    .eq("user_id", viewerUserId)
    .maybeSingle();

  throwRepositoryError(memberError, "No se pudo leer el miembro del chat");
  if (!memberRow) return null;

  const { data: threadRow, error: threadError } = await admin
    .from("direct_threads")
    .select(
      "id,participant_low,participant_high,last_message_preview,last_message_at,last_sender_id",
    )
    .eq("id", threadId)
    .maybeSingle();

  throwRepositoryError(threadError, "No se pudo leer el hilo del chat");
  if (!threadRow) return null;

  const otherUserId =
    threadRow.participant_low === viewerUserId
      ? threadRow.participant_high
      : threadRow.participant_low;
  const participantMap = await createThreadParticipantMap(admin, [otherUserId]);
  const participant = participantMap.get(otherUserId);
  if (!participant) return null;

  let messagesQuery = admin
    .from("direct_messages")
    .select("id,thread_id,sender_id,kind,body,metadata,created_at")
    .eq("thread_id", threadId);

  if (before) {
    messagesQuery = messagesQuery.lt("created_at", before);
  }

  const { data: messageRows, error: messagesError } = await messagesQuery
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 50)));

  throwRepositoryError(
    messagesError,
    "No se pudieron leer los mensajes del chat",
  );

  const orderedMessageRows = [...(messageRows ?? [])].reverse();
  const albumIds = Array.from(
    new Set(
      orderedMessageRows
        .map((message) => parseAlbumId(message.metadata))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const premiumMessageIds = orderedMessageRows
    .filter((message) => message.kind === "premium" && !parseAlbumId(message.metadata))
    .map((message) => message.id);
  const { data: purchaseRows, error: purchasesError } = premiumMessageIds.length
    ? await admin
        .from("direct_message_purchases")
        .select("message_id,buyer_user_id")
        .eq("buyer_user_id", viewerUserId)
        .in("message_id", premiumMessageIds)
    : { data: [], error: null };

  throwRepositoryError(
    purchasesError,
    "No se pudieron leer las compras del chat",
  );
  const purchasedIds = new Set(
    (purchaseRows ?? []).map((row) => row.message_id as string),
  );
  const attachmentsByMessageId = new Map<string, DirectChatAttachmentMeta[]>();
  const premiumPathsToSign: string[] = [];
  const { data: albumRows, error: albumError } = albumIds.length
    ? await admin
        .from("albums")
        .select(
          "id,user_id,description,price,visibility,album_posts(position,post_id,post:posts(id,media_url,media_type,is_locked))",
        )
        .in("id", albumIds)
        .in("visibility", ["published", "private"])
    : { data: [], error: null };

  throwRepositoryError(albumError, "No se pudo leer el contenido del chat");
  const albumMap = new Map((albumRows ?? []).map((row) => [row.id as string, row]));
  const albumPostRows = (albumRows ?? []).flatMap((row) =>
    Array.isArray(row.album_posts) ? row.album_posts : [],
  ) as Array<{
    post_id: string;
    post:
      | {
          id: string;
          media_url: string | null;
          media_type: string | null;
          is_locked: boolean | null;
        }
      | Array<{
          id: string;
          media_url: string | null;
          media_type: string | null;
          is_locked: boolean | null;
        }>
      | null;
  }>;
  const albumPostIds = Array.from(new Set(albumPostRows.map((row) => row.post_id).filter(Boolean)));
  const { data: albumPurchaseRows, error: albumPurchasesError } = albumPostIds.length
    ? await admin
        .from("purchases")
        .select("post_id")
        .eq("user_id", viewerUserId)
        .in("post_id", albumPostIds)
    : { data: [], error: null };

  throwRepositoryError(albumPurchasesError, "No se pudieron leer las compras del contenido");
  const purchasedAlbumPostIds = new Set((albumPurchaseRows ?? []).map((row) => row.post_id as string));
  const signedAlbumPremiumPaths = new Set<string>();

  orderedMessageRows.forEach((message) => {
    const albumId = parseAlbumId(message.metadata);
    if (albumId) {
      const album = albumMap.get(albumId);
      const albumPosts = Array.isArray(album?.album_posts)
        ? [...album.album_posts].sort(
            (left: any, right: any) =>
              Number(left?.position ?? 0) - Number(right?.position ?? 0),
          )
        : [];
      const canSeeAlbum =
        message.sender_id === viewerUserId ||
        albumPosts.some((row) => row.post_id && purchasedAlbumPostIds.has(row.post_id));
      if (canSeeAlbum) {
        albumPosts.forEach((row) => {
          const post = Array.isArray(row.post) ? (row.post[0] ?? null) : row.post;
          const path = post?.media_url ?? null;
          const parsed = parseLockedPreviewPath(path);
          if (parsed && album?.user_id) {
            signedAlbumPremiumPaths.add(
              buildPremiumMediaPath(album.user_id as string, parsed.token, parsed.originalExt),
            );
          }
        });
      }
      attachmentsByMessageId.set(message.id, []);
      return;
    }
    const attachments = parseAttachments(message.metadata);
    attachmentsByMessageId.set(message.id, attachments);
    const canSeePremium =
      message.kind === "attachment" ||
      message.sender_id === viewerUserId ||
      purchasedIds.has(message.id);
    if (!canSeePremium) return;
    attachments.forEach((attachment) => {
      if (attachment.premiumPath)
        premiumPathsToSign.push(attachment.premiumPath);
    });
  });

  const signedPremiumUrls = await createSignedUrlMap({
    admin,
    bucket: PREMIUM_MEDIA_BUCKET,
    paths: [...premiumPathsToSign, ...signedAlbumPremiumPaths],
    expiresIn: 60 * 5,
  });

  const messages: DirectMessageView[] = orderedMessageRows.map((message) => {
    if (message.kind === "system") {
      const systemBody =
        typeof message.metadata?.recipientUserId === "string" &&
        message.metadata.recipientUserId === viewerUserId &&
        typeof message.metadata?.recipientBody === "string"
          ? message.metadata.recipientBody
          : message.body?.trim() || "";
      return {
        id: message.id,
        kind: "system",
        sender: "system",
        body: systemBody,
        createdAt: formatMessageTimestamp(message.created_at),
      } satisfies DirectMessageView;
    }

    if (message.kind === "text") {
      return {
        id: message.id,
        kind: "text",
        sender: message.sender_id === viewerUserId ? "me" : "them",
        body: message.body?.trim() || "",
        createdAt: formatMessageTimestamp(message.created_at),
      } satisfies DirectMessageView;
    }

    const albumId = parseAlbumId(message.metadata);
    const attachments = attachmentsByMessageId.get(message.id) ?? [];
    const canSeePremium =
      message.kind === "attachment" ||
      message.sender_id === viewerUserId ||
      purchasedIds.has(message.id);

    if (message.kind === "premium" && albumId) {
      const album = albumMap.get(albumId);
      const albumPosts = Array.isArray(album?.album_posts)
        ? [...album.album_posts].sort(
            (left: any, right: any) =>
              Number(left?.position ?? 0) - Number(right?.position ?? 0),
          )
        : [];
      const canSeeAlbum =
        message.sender_id === viewerUserId ||
        albumPosts.some((row) => row.post_id && purchasedAlbumPostIds.has(row.post_id));
      const resolvedAlbumPreviews = albumPosts
        .map((row) => {
          const post = Array.isArray(row.post) ? (row.post[0] ?? null) : row.post;
          if (!post) return null;
          const previewUrl = resolvePublicUrl(admin, post.media_url);
          if (!previewUrl) return null;
          let finalUrl = previewUrl;
          if (canSeeAlbum && album?.user_id) {
            const parsed = parseLockedPreviewPath(post.media_url);
            if (parsed) {
              const premiumPath = buildPremiumMediaPath(
                album.user_id as string,
                parsed.token,
                parsed.originalExt,
              );
              finalUrl = signedPremiumUrls.get(premiumPath) || previewUrl;
            }
          }
          return {
            id: post.id,
            name: "archivo",
            kind: post.media_type === "video" ? ("video" as const) : ("foto" as const),
            previewUrl: finalUrl,
            previewMode: post.is_locked ? ("locked" as const) : ("preview" as const),
          };
        })
        .filter(Boolean) as DirectMessageView extends infer _T ? Array<{
          id: string;
          name: string;
          kind: "foto" | "video";
          previewUrl: string;
          previewMode: "preview" | "locked";
        }> : never;

      return {
        id: message.id,
        kind: "premium",
        sender: message.sender_id === viewerUserId ? "me" : "them",
        title:
          typeof message.metadata?.title === "string"
            ? message.metadata.title
            : album?.description?.trim() || "Contenido privado",
        caption:
          typeof message.metadata?.caption === "string"
            ? message.metadata.caption
            : buildPremiumCaption(
                resolvedAlbumPreviews.map((item) => ({
                  id: item.id,
                  name: item.name,
                  kind: item.kind,
                })),
              ),
        price:
          typeof message.metadata?.price === "number"
            ? message.metadata.price
            : Number(album?.price || 0),
        attachmentCount: resolvedAlbumPreviews.length,
        attachmentPreviews: resolvedAlbumPreviews,
        status: canSeeAlbum ? "purchased" : "locked",
        createdAt: formatMessageTimestamp(message.created_at),
      } satisfies DirectMessageView;
    }

    const resolvedPreviews = attachments.map((attachment) => {
      const resolvedPath = canSeePremium
        ? attachment.premiumPath
          ? signedPremiumUrls.get(attachment.premiumPath) ||
            resolvePublicUrl(admin, attachment.previewPath)
          : attachment.publicPath
            ? resolvePublicUrl(admin, attachment.publicPath)
            : resolvePublicUrl(admin, attachment.previewPath)
        : attachment.previewMode === "locked"
          ? resolvePublicUrl(admin, attachment.previewPath)
          : attachment.publicPath
            ? resolvePublicUrl(admin, attachment.publicPath)
            : resolvePublicUrl(admin, attachment.previewPath);

      return {
        id: attachment.id,
        name: attachment.name,
        kind: attachment.kind,
        previewUrl: resolvedPath || "",
        previewMode:
          attachment.previewMode === "locked"
            ? ("locked" as const)
            : ("preview" as const),
      };
    });

    if (message.kind === "attachment") {
      return {
        id: message.id,
        kind: "attachment",
        sender: message.sender_id === viewerUserId ? "me" : "them",
        attachments: resolvedPreviews,
        createdAt: formatMessageTimestamp(message.created_at),
      } satisfies DirectMessageView;
    }

    const title =
      typeof message.metadata?.title === "string"
        ? message.metadata.title
        : "Contenido privado";
    const caption =
      typeof message.metadata?.caption === "string"
        ? message.metadata.caption
        : buildPremiumCaption(attachments);
    const price =
      typeof message.metadata?.price === "number"
        ? message.metadata.price
        : Number(message.metadata?.price ?? 0);

    return {
      id: message.id,
      kind: "premium",
      sender: message.sender_id === viewerUserId ? "me" : "them",
      title,
      caption,
      price,
      attachmentCount: attachments.length,
      attachmentPreviews: resolvedPreviews,
      status: canSeePremium ? "purchased" : "locked",
      createdAt: formatMessageTimestamp(message.created_at),
    } satisfies DirectMessageView;
  });

  if (markAsRead) {
    const now = new Date().toISOString();
    const { error: readError } = await admin
      .from("direct_thread_members")
      .update({
        last_read_at: now,
        force_unread: false,
        hidden: false,
      })
      .eq("thread_id", threadId)
      .eq("user_id", viewerUserId);

    throwRepositoryError(readError, "No se pudo marcar el chat como leído");
  }

  const unread =
    Boolean(memberRow.force_unread) ||
    (threadRow.last_sender_id !== viewerUserId &&
      Boolean(threadRow.last_message_at) &&
      (!memberRow.last_read_at ||
        new Date(threadRow.last_message_at).getTime() >
          new Date(memberRow.last_read_at).getTime()));

  return {
    ...participant,
    id: threadRow.id,
    participantUserId: otherUserId,
    preview: threadRow.last_message_preview?.trim() || "Iniciá la conversación",
    lastSeen: formatRelativeMessageTime(threadRow.last_message_at),
    lastMessageAt: threadRow.last_message_at,
    unread,
    pinned: Boolean(memberRow.pinned),
    messages,
    pageInfo: {
      hasMoreOlder:
        (messageRows?.length ?? 0) >= Math.max(1, Math.min(limit, 50)),
      oldestCursor: orderedMessageRows[0]?.created_at ?? null,
    },
  };
};

export const sendDirectTextMessage = async ({
  admin,
  viewerUserId,
  threadId,
  body,
}: {
  admin: SupabaseClient;
  viewerUserId: string;
  threadId: string;
  body: string;
}) => {
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    throw new Error("El mensaje no puede estar vacío.");
  }

  const { data: threadRow, error: threadError } = await admin
    .from("direct_threads")
    .select(
      "id,participant_low,participant_high,last_message_preview,last_message_at,last_sender_id",
    )
    .eq("id", threadId)
    .maybeSingle();

  throwRepositoryError(threadError, "No se pudo validar el chat");
  if (!threadRow) throw new Error("No encontramos el chat.");
  if (
    ![threadRow.participant_low, threadRow.participant_high].includes(
      viewerUserId,
    )
  ) {
    throw new Error("No autorizado para responder en este chat.");
  }

  const { error: messageError } = await admin.from("direct_messages").insert({
    thread_id: threadId,
    sender_id: viewerUserId,
    kind: "text",
    body: trimmedBody,
  });

  throwRepositoryError(messageError, "No se pudo enviar el mensaje");
  await touchThreadAfterMessage({
    admin,
    thread: threadRow as ThreadRow,
    senderUserId: viewerUserId,
    preview: trimmedBody,
  });
};

export const sendDirectMediaMessage = async ({
  admin,
  viewerUserId,
  threadId,
  kind,
  title,
  price,
  attachments,
}: {
  admin: SupabaseClient;
  viewerUserId: string;
  threadId: string;
  kind: "attachment" | "premium";
  title?: string;
  price?: number;
  attachments: DirectChatAttachmentMeta[];
}) => {
  if (attachments.length === 0) {
    throw new Error("Necesitas adjuntar al menos un archivo.");
  }

  const { data: threadRow, error: threadError } = await admin
    .from("direct_threads")
    .select(
      "id,participant_low,participant_high,last_message_preview,last_message_at,last_sender_id",
    )
    .eq("id", threadId)
    .maybeSingle();

  throwRepositoryError(threadError, "No se pudo validar el chat");
  if (!threadRow) throw new Error("No encontramos el chat.");
  if (
    ![threadRow.participant_low, threadRow.participant_high].includes(
      viewerUserId,
    )
  ) {
    throw new Error("No autorizado para enviar contenido en este chat.");
  }

  const metadata =
    kind === "premium"
      ? {
          title: title?.trim() || "Contenido privado",
          price: Math.max(Number(price ?? 0), 0),
          caption: buildPremiumCaption(attachments),
          attachments,
        }
      : { attachments };

  if (kind === "premium" && Number(metadata.price ?? 0) <= 0) {
    throw new Error("El contenido premium necesita un precio válido.");
  }

  const { error: messageError } = await admin.from("direct_messages").insert({
    thread_id: threadId,
    sender_id: viewerUserId,
    kind,
    metadata,
  });

  throwRepositoryError(messageError, "No se pudo enviar el contenido");
  await touchThreadAfterMessage({
    admin,
    thread: threadRow as ThreadRow,
    senderUserId: viewerUserId,
    preview: buildThreadPreview({
      kind,
      attachments,
      price: Number(price ?? 0),
    }),
  });
};

export const sendDirectAlbumReferenceMessage = async ({
  admin,
  viewerUserId,
  threadId,
  albumId,
}: {
  admin: SupabaseClient;
  viewerUserId: string;
  threadId: string;
  albumId: string;
}) => {
  const album = await getPurchaseAlbumTarget(admin, albumId);
  if (!album) throw new Error("No encontramos el contenido a enviar.");
  if (album.userId !== viewerUserId) {
    throw new Error("Solo puedes enviar álbumes propios en el chat.");
  }

  const { data: threadRow, error: threadError } = await admin
    .from("direct_threads")
    .select(
      "id,participant_low,participant_high,last_message_preview,last_message_at,last_sender_id",
    )
    .eq("id", threadId)
    .maybeSingle();

  throwRepositoryError(threadError, "No se pudo validar el chat");
  if (!threadRow) throw new Error("No encontramos el chat.");
  if (
    ![threadRow.participant_low, threadRow.participant_high].includes(viewerUserId)
  ) {
    throw new Error("No autorizado para enviar contenido en este chat.");
  }

  const metadata = {
    albumId,
    title: album.description?.trim() || "Contenido privado",
    price: Math.max(Number(album.price ?? 0), 0),
  };

  const { error: messageError } = await admin.from("direct_messages").insert({
    thread_id: threadId,
    sender_id: viewerUserId,
    kind: "premium",
    metadata,
  });

  throwRepositoryError(messageError, "No se pudo enviar el contenido");
  await touchThreadAfterMessage({
    admin,
    thread: threadRow as ThreadRow,
    senderUserId: viewerUserId,
    preview: `Contenido privado · $${Math.round(Number(album.price ?? 0))}`,
  });
};

export const sendDirectSystemMessage = async ({
  admin,
  actorUserId,
  threadId,
  body,
  recipientUserId,
  recipientBody,
}: {
  admin: SupabaseClient;
  actorUserId: string;
  threadId: string;
  body: string;
  recipientUserId?: string;
  recipientBody?: string;
}) => {
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    throw new Error("El mensaje del sistema no puede estar vacío.");
  }

  const { data: threadRow, error: threadError } = await admin
    .from("direct_threads")
    .select(
      "id,participant_low,participant_high,last_message_preview,last_message_at,last_sender_id",
    )
    .eq("id", threadId)
    .maybeSingle();

  throwRepositoryError(threadError, "No se pudo validar el chat");
  if (!threadRow) throw new Error("No encontramos el chat.");
  if (
    ![threadRow.participant_low, threadRow.participant_high].includes(
      actorUserId,
    )
  ) {
    throw new Error("No autorizado para registrar actividad en este chat.");
  }

  const { error: messageError } = await admin.from("direct_messages").insert({
    thread_id: threadId,
    sender_id: actorUserId,
    kind: "system",
    body: trimmedBody,
    metadata:
      recipientUserId && recipientBody?.trim()
        ? {
            recipientUserId,
            recipientBody: recipientBody.trim(),
          }
        : null,
  });

  throwRepositoryError(
    messageError,
    "No se pudo registrar la actividad del chat",
  );
  await touchThreadAfterMessage({
    admin,
    thread: threadRow as ThreadRow,
    senderUserId: actorUserId,
    preview: trimmedBody,
  });
};

export const deleteDirectMessage = async ({
  admin,
  viewerUserId,
  messageId,
}: {
  admin: SupabaseClient;
  viewerUserId: string;
  messageId: string;
}) => {
  const { data: messageRow, error: messageError } = await admin
    .from("direct_messages")
    .select("id,thread_id,sender_id,kind,body,metadata,created_at")
    .eq("id", messageId)
    .maybeSingle();

  throwRepositoryError(messageError, "No se pudo validar el mensaje");
  if (!messageRow) throw new Error("No encontramos ese mensaje.");
  if (messageRow.sender_id !== viewerUserId) {
    throw new Error("Solo puedes eliminar mensajes enviados por ti.");
  }
  if (messageRow.kind === "system") {
    throw new Error("No se pueden eliminar mensajes del sistema.");
  }

  const { data: threadRow, error: threadError } = await admin
    .from("direct_threads")
    .select(
      "id,participant_low,participant_high,last_message_preview,last_message_at,last_sender_id,created_at",
    )
    .eq("id", messageRow.thread_id)
    .maybeSingle();

  throwRepositoryError(threadError, "No se pudo validar el chat del mensaje");
  if (!threadRow) throw new Error("No encontramos el chat del mensaje.");
  if (
    ![threadRow.participant_low, threadRow.participant_high].includes(
      viewerUserId,
    )
  ) {
    throw new Error("No autorizado para eliminar mensajes en este chat.");
  }

  const { error: deleteError } = await admin
    .from("direct_messages")
    .delete()
    .eq("id", messageId);
  throwRepositoryError(deleteError, "No se pudo eliminar el mensaje");

  const { data: latestMessage, error: latestError } = await admin
    .from("direct_messages")
    .select("id,sender_id,kind,body,metadata,created_at")
    .eq("thread_id", messageRow.thread_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  throwRepositoryError(latestError, "No se pudo recalcular el chat");

  if (!latestMessage) {
    const { error: resetThreadError } = await admin
      .from("direct_threads")
      .update({
        last_message_preview: null,
        last_message_at: threadRow.created_at ?? new Date().toISOString(),
        last_sender_id: null,
      })
      .eq("id", messageRow.thread_id);

    throwRepositoryError(resetThreadError, "No se pudo resetear el chat");

    await admin
      .from("direct_thread_members")
      .update({ force_unread: false })
      .eq("thread_id", messageRow.thread_id);

    return;
  }

  const latestAttachments = parseAttachments(latestMessage.metadata);
  const latestPreview = buildThreadPreview({
    kind: latestMessage.kind,
    body: latestMessage.body,
    attachments: latestAttachments,
    price:
      typeof latestMessage.metadata?.price === "number"
        ? latestMessage.metadata.price
        : Number(latestMessage.metadata?.price ?? 0),
  });

  const { error: updateThreadError } = await admin
    .from("direct_threads")
    .update({
      last_message_preview: latestPreview,
      last_message_at: latestMessage.created_at,
      last_sender_id: latestMessage.sender_id,
    })
    .eq("id", messageRow.thread_id);

  throwRepositoryError(
    updateThreadError,
    "No se pudo actualizar el chat después de eliminar",
  );
};

export const toggleDirectThreadPinned = async ({
  admin,
  viewerUserId,
  threadId,
}: {
  admin: SupabaseClient;
  viewerUserId: string;
  threadId: string;
}) => {
  const { data: memberRow, error } = await admin
    .from("direct_thread_members")
    .select("pinned")
    .eq("thread_id", threadId)
    .eq("user_id", viewerUserId)
    .maybeSingle();

  throwRepositoryError(error, "No se pudo leer el estado del chat");

  if (!memberRow?.pinned) {
    const { count, error: countError } = await admin
      .from("direct_thread_members")
      .select("thread_id", { count: "exact", head: true })
      .eq("user_id", viewerUserId)
      .eq("pinned", true);

    throwRepositoryError(
      countError,
      "No se pudo validar el límite de chats pineados",
    );

    if ((count ?? 0) >= 5) {
      throw new Error("Puedes pinear hasta 5 chats.");
    }
  }

  const { error: updateError } = await admin
    .from("direct_thread_members")
    .update({ pinned: !memberRow?.pinned })
    .eq("thread_id", threadId)
    .eq("user_id", viewerUserId);

  throwRepositoryError(updateError, "No se pudo actualizar el pin del chat");
};

export const toggleDirectThreadUnread = async ({
  admin,
  viewerUserId,
  threadId,
}: {
  admin: SupabaseClient;
  viewerUserId: string;
  threadId: string;
}) => {
  const { data: memberRow, error } = await admin
    .from("direct_thread_members")
    .select("force_unread")
    .eq("thread_id", threadId)
    .eq("user_id", viewerUserId)
    .maybeSingle();

  throwRepositoryError(error, "No se pudo leer el estado del chat");

  const { error: updateError } = await admin
    .from("direct_thread_members")
    .update({ force_unread: !memberRow?.force_unread })
    .eq("thread_id", threadId)
    .eq("user_id", viewerUserId);

  throwRepositoryError(updateError, "No se pudo actualizar el estado del chat");
};

export const hideDirectThreadForUser = async ({
  admin,
  viewerUserId,
  threadId,
}: {
  admin: SupabaseClient;
  viewerUserId: string;
  threadId: string;
}) => {
  const { error } = await admin
    .from("direct_thread_members")
    .update({ hidden: true, force_unread: false })
    .eq("thread_id", threadId)
    .eq("user_id", viewerUserId);

  throwRepositoryError(error, "No se pudo eliminar el chat");
};

export const blockDirectThreadParticipant = async ({
  admin,
  viewerUserId,
  threadId,
}: {
  admin: SupabaseClient;
  viewerUserId: string;
  threadId: string;
}) => {
  const { data: threadRow, error: threadError } = await admin
    .from("direct_threads")
    .select("participant_low,participant_high")
    .eq("id", threadId)
    .maybeSingle();

  throwRepositoryError(threadError, "No se pudo leer el chat para bloquear");
  if (!threadRow) throw new Error("No encontramos el chat.");

  const blockedUserId =
    threadRow.participant_low === viewerUserId
      ? threadRow.participant_high
      : threadRow.participant_low;

  const { error: blockError } = await admin.from("direct_user_blocks").upsert(
    {
      blocker_user_id: viewerUserId,
      blocked_user_id: blockedUserId,
    },
    { onConflict: "blocker_user_id,blocked_user_id" },
  );

  throwRepositoryError(blockError, "No se pudo bloquear al usuario");
  await hideDirectThreadForUser({ admin, viewerUserId, threadId });
  return blockedUserId;
};

export const purchaseDirectPremiumMessage = async ({
  admin,
  viewerUserId,
  messageId,
}: {
  admin: SupabaseClient;
  viewerUserId: string;
  messageId: string;
}) => {
  const { data: messageRow, error: messageError } = await admin
    .from("direct_messages")
    .select("id,thread_id,sender_id,metadata")
    .eq("id", messageId)
    .maybeSingle();

  throwRepositoryError(messageError, "No se pudo validar el contenido del chat");
  const albumId = parseAlbumId((messageRow?.metadata as Record<string, unknown> | null) ?? null);
  if (albumId) {
    const album = await getPurchaseAlbumTarget(admin, albumId);
    if (!album) throw new Error("No encontramos el contenido del chat.");
    if (album.userId === viewerUserId) {
      throw new Error("No puedes comprar tu propio contenido.");
    }
    if (await hasUserPurchasedAlbum(admin, viewerUserId, albumId)) {
      throw new Error("Ya habías comprado este contenido.");
    }
    const result = await processInternalAlbumPurchase({
      admin,
      buyerUserId: viewerUserId,
      albumId,
    });
    if (result.sellerUserId) {
      await recordInternalAlbumPurchase({
        admin,
        buyerUserId: viewerUserId,
        albumId,
        transactionId: result.transactionId,
        amount: result.transactionAmount,
        sellerUserId: result.sellerUserId,
      });
    }
    return {
      transactionId: result.transactionId,
      sellerUserId: result.sellerUserId ?? album.userId,
      threadId: messageRow?.thread_id as string,
      amount: result.transactionAmount,
      creatorAmount: result.creatorAmount,
      platformFeeAmount: result.platformFeeAmount,
    };
  }

  const { data, error } = await admin.rpc(
    "process_internal_direct_message_purchase",
    {
      p_buyer_user_id: viewerUserId,
      p_message_id: messageId,
    },
  );

  throwRepositoryError(error, "No se pudo comprar el contenido del chat");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("No se pudo confirmar la compra del contenido.");
  }
  return {
    transactionId: row.transaction_id as string,
    sellerUserId: row.seller_user_id as string,
    threadId: row.thread_id as string,
    amount: Number(row.transaction_amount ?? 0),
    creatorAmount: Number(row.creator_amount ?? 0),
    platformFeeAmount: Number(row.platform_fee_amount ?? 0),
  };
};

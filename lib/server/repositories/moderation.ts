import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseModerationArchive,
  serializeModerationArchive,
  serializeModerationContentState,
  type ModerationArchiveRecord,
  type ModerationArchivedPost,
  type ModerationContentStateRecord,
} from "@/lib/moderation";
import {
  parseContentReport,
  serializeContentReport,
  serializeModerationAction,
  type ContentReport,
  type ModerationActionRecord,
} from "@/lib/reports";

type RawAlbumRow = {
  id: string;
  user_id: string;
  description: string | null;
  price: number | string | null;
  created_at: string | null;
};

type RawPostRelation = {
  id?: string | null;
  user_id?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  is_locked?: boolean | null;
  likes_count?: number | null;
  caption?: string | null;
  created_at?: string | null;
};

export type ModerationAlbum = {
  id: string;
  user_id: string;
  description: string | null;
  price: number | null;
  created_at: string | null;
};

export type ModerationReportRow = {
  id: string;
  userId: string;
  actorId: string | null;
  entityId: string | null;
  createdAt: string;
  record: ContentReport;
};

export type ModerationArchiveRow = {
  id: string;
  userId: string;
  entityId: string | null;
  createdAt: string;
  record: ModerationArchiveRecord;
};

const throwRepositoryError = (
  error: { message: string } | null,
  fallback: string,
) => {
  if (error) {
    throw new Error(`${fallback}: ${error.message}`);
  }
};

const normalizeAlbum = (album: RawAlbumRow): ModerationAlbum => ({
  id: album.id,
  user_id: album.user_id,
  description: album.description ?? null,
  price: album.price == null ? null : Number(album.price),
  created_at: album.created_at ?? null,
});

const normalizeArchivePost = (
  albumUserId: string,
  relation: RawPostRelation | RawPostRelation[] | null,
): ModerationArchivedPost | null => {
  const post = Array.isArray(relation) ? relation[0] ?? null : relation;
  if (!post?.id) return null;

  return {
    id: post.id,
    user_id: post.user_id ?? albumUserId,
    media_url: post.media_url ?? null,
    media_type: post.media_type ?? null,
    is_locked: post.is_locked ?? null,
    likes_count: post.likes_count ?? null,
    caption: post.caption ?? null,
    created_at: post.created_at ?? null,
  };
};

export const getAlbumById = async (
  admin: SupabaseClient,
  albumId: string,
) => {
  const { data, error } = await admin
    .from("albums")
    .select("id,user_id,description,price,created_at")
    .eq("id", albumId)
    .maybeSingle();

  throwRepositoryError(error, "No se pudo leer el contenido");

  return data ? normalizeAlbum(data as RawAlbumRow) : null;
};

export const getAlbumModerationBundle = async (
  admin: SupabaseClient,
  albumId: string,
) => {
  const album = await getAlbumById(admin, albumId);
  if (!album) return null;

  const { data: links, error } = await admin
    .from("album_posts")
    .select(
      "post_id, post:posts(id,user_id,media_url,media_type,is_locked,likes_count,caption,created_at)",
    )
    .eq("album_id", albumId);

  throwRepositoryError(error, "No se pudo leer el contenido vinculado");

  const posts = (links ?? [])
    .map((row) =>
      normalizeArchivePost(
        album.user_id,
        row.post as RawPostRelation | RawPostRelation[] | null,
      ),
    )
    .filter((value): value is ModerationArchivedPost => Boolean(value));

  const postIds = posts.map((post) => post.id);

  return { album, posts, postIds };
};

export const createContentReport = async ({
  admin,
  ownerId,
  actorId,
  albumId,
  reason,
}: {
  admin: SupabaseClient;
  ownerId: string;
  actorId: string;
  albumId: string;
  reason: string;
}) => {
  const record: ContentReport = {
    albumId,
    reason,
    reportedAt: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("notifications")
    .insert({
      user_id: ownerId,
      actor_id: actorId,
      type: "content_report",
      entity_id: albumId,
      message: serializeContentReport(record),
      is_read: true,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo crear el reporte.");
  }

  return { id: data.id, record };
};

export const getContentReportById = async (
  admin: SupabaseClient,
  id: string,
) => {
  const { data, error } = await admin
    .from("notifications")
    .select("id,user_id,actor_id,entity_id,message,created_at")
    .eq("id", id)
    .eq("type", "content_report")
    .maybeSingle();

  throwRepositoryError(error, "No se pudo leer el reporte");

  const record = parseContentReport(data?.message);
  if (!data || !record) return null;

  return {
    id: data.id,
    userId: data.user_id,
    actorId: data.actor_id,
    entityId: data.entity_id,
    createdAt: data.created_at,
    record,
  } satisfies ModerationReportRow;
};

export const listContentReportsByAlbumId = async (
  admin: SupabaseClient,
  albumId: string,
) => {
  const { data, error } = await admin
    .from("notifications")
    .select("id,user_id,actor_id,entity_id,message,created_at")
    .eq("type", "content_report")
    .eq("entity_id", albumId)
    .order("created_at", { ascending: false });

  throwRepositoryError(error, "No se pudieron leer los reportes");

  return (data ?? [])
    .map((row) => {
      const record = parseContentReport(row.message);
      if (!record || record.albumId !== albumId) return null;

      return {
        id: row.id,
        userId: row.user_id,
        actorId: row.actor_id,
        entityId: row.entity_id,
        createdAt: row.created_at,
        record,
      } satisfies ModerationReportRow;
    })
    .filter((value): value is ModerationReportRow => Boolean(value));
};

export const updateContentReportRecord = async ({
  admin,
  id,
  record,
}: {
  admin: SupabaseClient;
  id: string;
  record: ContentReport;
}) => {
  const { error } = await admin
    .from("notifications")
    .update({ message: serializeContentReport(record) })
    .eq("id", id);

  throwRepositoryError(error, "No se pudo actualizar el reporte");
};

export const createModerationAction = async ({
  admin,
  userId,
  actorId,
  albumId,
  reportId,
  action,
  reason,
}: {
  admin: SupabaseClient;
  userId: string;
  actorId: string;
  albumId: string;
  reportId: string;
  action: ModerationActionRecord["action"];
  reason?: string;
}) => {
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    actor_id: actorId,
    entity_id: albumId,
    type: "moderation_action",
    message: serializeModerationAction({
      reportId,
      albumId,
      action,
      reason,
      actedAt: new Date().toISOString(),
    }),
    is_read: true,
  });

  throwRepositoryError(error, "No se pudo guardar la acción de moderación");
};

export const createModerationArchive = async ({
  admin,
  userId,
  actorId,
  record,
}: {
  admin: SupabaseClient;
  userId: string;
  actorId: string;
  record: ModerationArchiveRecord;
}) => {
  const { data, error } = await admin
    .from("notifications")
    .insert({
      user_id: userId,
      actor_id: actorId,
      entity_id: record.album.id,
      type: "moderation_archive",
      message: serializeModerationArchive(record),
      is_read: true,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo archivar el contenido.");
  }

  return { id: data.id };
};

export const getModerationArchiveById = async (
  admin: SupabaseClient,
  id: string,
) => {
  const { data, error } = await admin
    .from("notifications")
    .select("id,user_id,entity_id,message,created_at")
    .eq("id", id)
    .eq("type", "moderation_archive")
    .maybeSingle();

  throwRepositoryError(error, "No se pudo leer el archivo de moderación");

  const record = parseModerationArchive(data?.message);
  if (!data || !record) return null;

  return {
    id: data.id,
    userId: data.user_id,
    entityId: data.entity_id,
    createdAt: data.created_at,
    record,
  } satisfies ModerationArchiveRow;
};

export const createModerationContentState = async ({
  admin,
  userId,
  actorId,
  record,
}: {
  admin: SupabaseClient;
  userId: string;
  actorId: string;
  record: ModerationContentStateRecord;
}) => {
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    actor_id: actorId,
    entity_id: record.albumId,
    type: "moderation_content_state",
    message: serializeModerationContentState(record),
    is_read: true,
  });

  throwRepositoryError(error, "No se pudo guardar el estado del contenido");
};

export const notifyContentRemoved = async ({
  admin,
  userId,
  actorId,
  albumId,
  message,
}: {
  admin: SupabaseClient;
  userId: string;
  actorId: string;
  albumId: string;
  message: string;
}) => {
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    actor_id: actorId,
    entity_id: albumId,
    type: "content_removed_update",
    message,
    is_read: false,
  });

  throwRepositoryError(error, "No se pudo notificar al usuario");
};

export const deleteAlbumCascade = async ({
  admin,
  albumId,
  postIds,
}: {
  admin: SupabaseClient;
  albumId: string;
  postIds: string[];
}) => {
  if (postIds.length > 0) {
    const { error: likesError } = await admin.from("likes").delete().in("post_id", postIds);
    throwRepositoryError(likesError, "No se pudieron borrar los likes");

    const { error: purchasesError } = await admin
      .from("purchases")
      .delete()
      .in("post_id", postIds);
    throwRepositoryError(purchasesError, "No se pudieron borrar las compras");

    const { error: linkPostsError } = await admin
      .from("album_posts")
      .delete()
      .in("post_id", postIds);
    throwRepositoryError(linkPostsError, "No se pudieron borrar los enlaces del contenido");

    const { error: postsError } = await admin.from("posts").delete().in("id", postIds);
    throwRepositoryError(postsError, "No se pudieron borrar los posts");
  }

  const { error: linksError } = await admin
    .from("album_posts")
    .delete()
    .eq("album_id", albumId);
  throwRepositoryError(linksError, "No se pudieron borrar los enlaces del álbum");

  const { error: albumError } = await admin.from("albums").delete().eq("id", albumId);
  throwRepositoryError(albumError, "No se pudo borrar el álbum");
};

export const restoreModerationArchive = async ({
  admin,
  record,
}: {
  admin: SupabaseClient;
  record: ModerationArchiveRecord;
}) => {
  const { error: albumInsertError } = await admin.from("albums").insert({
    id: record.album.id,
    user_id: record.album.user_id,
    description: record.album.description,
    price: record.album.price,
  });
  throwRepositoryError(albumInsertError, "No se pudo restaurar el álbum");

  if (record.posts.length > 0) {
    const { error: postInsertError } = await admin.from("posts").insert(
      record.posts.map((post) => ({
        id: post.id,
        user_id: post.user_id,
        media_url: post.media_url,
        media_type: post.media_type,
        is_locked: post.is_locked,
        likes_count: post.likes_count ?? 0,
        caption: post.caption,
      })),
    );
    throwRepositoryError(postInsertError, "No se pudieron restaurar los posts");

    const { error: linkInsertError } = await admin.from("album_posts").insert(
      record.posts.map((post) => ({
        album_id: record.album.id,
        post_id: post.id,
      })),
    );
    throwRepositoryError(linkInsertError, "No se pudieron restaurar los enlaces");
  }
};

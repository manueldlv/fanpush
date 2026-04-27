import type { SupabaseClient } from "@supabase/supabase-js";
import { serializeUploadModerationMeta } from "@/lib/contentClassification";
import {
  buildLockedPreviewPath,
  buildPremiumMediaPath,
  buildPublicMediaPath,
  getExtensionFromFile,
  PREMIUM_MEDIA_BUCKET,
  PUBLIC_MEDIA_BUCKET,
} from "@/lib/media";
import { cleanupUploadedStorageObjects, type UploadedStorageObject } from "@/lib/uploadCleanup";

export type UploadAlbumItem = {
  file: File;
  fileName: string;
  kind: "image" | "video";
  isPreview: boolean;
  previewFile?: File | null;
};

export type ChatPickerAlbumItem = {
  id: string;
  title: string;
  price: number;
  coverUrl: string;
  itemCount: number;
  visibility: string;
  posts?: ChatPickerAlbumPostItem[];
};

export type ChatPickerAssetItem = {
  postId: string;
  albumId: string;
  previewUrl: string;
  kind: "image" | "video";
  price: number;
};

export type ChatPickerAlbumPostItem = {
  postId: string;
  previewUrl: string;
  kind: "image" | "video";
  position: number;
};

const throwRepositoryError = (
  error: { message: string } | null,
  fallback: string,
) => {
  if (error) throw new Error(`${fallback}: ${error.message}`);
};

const resolvePublicUrl = (
  admin: SupabaseClient,
  value: string | null | undefined,
) => {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  return admin.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data.publicUrl;
};

export const ensureMediaBuckets = async (admin: SupabaseClient) => {
  const { data: buckets } = await admin.storage.listBuckets();
  const bucketNames = new Set((buckets ?? []).map((bucket) => bucket.name));

  if (!bucketNames.has(PUBLIC_MEDIA_BUCKET)) {
    await admin.storage.createBucket(PUBLIC_MEDIA_BUCKET, { public: true });
  }

  if (!bucketNames.has(PREMIUM_MEDIA_BUCKET)) {
    const { error } = await admin.storage.createBucket(PREMIUM_MEDIA_BUCKET, {
      public: false,
    });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`No se pudo preparar el bucket privado: ${error.message}`);
    }
  }
};

const uploadWithBucketRetry = async ({
  admin,
  bucket,
  path,
  file,
  contentType,
}: {
  admin: SupabaseClient;
  bucket: string;
  path: string;
  file: File;
  contentType: string;
}) => {
  let result = await admin.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType,
  });

  if (result.error && /bucket not found/i.test(result.error.message)) {
    await ensureMediaBuckets(admin);
    result = await admin.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType,
    });
  }

  return result;
};

export const createSellableAlbumFromUploads = async ({
  admin,
  ownerUserId,
  description,
  price,
  visibility,
  items,
}: {
  admin: SupabaseClient;
  ownerUserId: string;
  description: string;
  price: number;
  visibility: "published" | "private";
  items: UploadAlbumItem[];
}) => {
  if (items.length === 0) throw new Error("Agrega al menos un archivo.");
  await ensureMediaBuckets(admin);

  const uploadedObjects: UploadedStorageObject[] = [];
  let createdAlbumId: string | null = null;
  let createdPostIds: string[] = [];

  try {
    const { data: album, error: albumError } = await admin
      .from("albums")
      .insert({
        user_id: ownerUserId,
        description: description.trim() || "Contenido privado",
        price,
        visibility,
      })
      .select("id")
      .single();

    if (albumError || !album?.id) {
      throw new Error(albumError?.message ?? "No se pudo crear el álbum.");
    }

    createdAlbumId = album.id;
    const moderationMeta = serializeUploadModerationMeta({
      version: 1,
      displayCaption: description.trim() || "Contenido privado",
      contentAudience: "adult_18",
      moderationCategory: "otro",
      tags: [],
      tipsEnabled: false,
    });

    const uploads = await Promise.all(
      items.map(async (item, index) => {
        const token = `${Date.now()}-${index}-${crypto.randomUUID()}`;
        const ext = getExtensionFromFile(item.file);

        if (price > 0 && !item.isPreview) {
          const previewFile = item.previewFile;
          if (!(previewFile instanceof File)) {
            throw new Error(`Falta la vista previa de ${item.fileName}.`);
          }

          const previewPath = buildLockedPreviewPath(ownerUserId, token, item.kind, ext);
          const premiumPath = buildPremiumMediaPath(ownerUserId, token, ext);
          const [{ error: previewError }, { error: premiumError }] = await Promise.all([
            uploadWithBucketRetry({
              admin,
              bucket: PUBLIC_MEDIA_BUCKET,
              path: previewPath,
              file: previewFile,
              contentType: previewFile.type || "image/jpeg",
            }),
            uploadWithBucketRetry({
              admin,
              bucket: PREMIUM_MEDIA_BUCKET,
              path: premiumPath,
              file: item.file,
              contentType:
                item.file.type || (item.kind === "video" ? "video/mp4" : "image/jpeg"),
            }),
          ]);

          if (previewError) throw new Error(previewError.message);
          if (premiumError) throw new Error(premiumError.message);

          uploadedObjects.push(
            { bucket: PUBLIC_MEDIA_BUCKET, path: previewPath },
            { bucket: PREMIUM_MEDIA_BUCKET, path: premiumPath },
          );

          return {
            user_id: ownerUserId,
            media_url: previewPath,
            media_type: item.kind,
            is_locked: true,
            likes_count: 0,
            caption: moderationMeta,
          };
        }

        const publicPath = buildPublicMediaPath(ownerUserId, token, item.fileName);
        const { error: publicError } = await uploadWithBucketRetry({
          admin,
          bucket: PUBLIC_MEDIA_BUCKET,
          path: publicPath,
          file: item.file,
          contentType:
            item.file.type || (item.kind === "video" ? "video/mp4" : "image/jpeg"),
        });

        if (publicError) throw new Error(publicError.message);
        uploadedObjects.push({ bucket: PUBLIC_MEDIA_BUCKET, path: publicPath });

        return {
          user_id: ownerUserId,
          media_url: publicPath,
          media_type: item.kind,
          is_locked: false,
          likes_count: 0,
          caption: moderationMeta,
        };
      }),
    );

    const { data: postRows, error: postsError } = await admin
      .from("posts")
      .insert(uploads)
      .select("id");

    throwRepositoryError(postsError, "No se pudo crear el contenido del álbum");
    createdPostIds = (postRows ?? []).map((row) => row.id);

    if (createdPostIds.length > 0) {
      const { error: linkError } = await admin.from("album_posts").insert(
        createdPostIds.map((postId, index) => ({
          album_id: album.id,
          post_id: postId,
          position: index,
        })),
      );
      throwRepositoryError(linkError, "No se pudo vincular el álbum con sus archivos");
    }

    return {
      albumId: album.id,
      postIds: createdPostIds,
    };
  } catch (error) {
    if (uploadedObjects.length > 0) {
      await cleanupUploadedStorageObjects(admin, uploadedObjects);
    }
    if (createdPostIds.length > 0) {
      await admin.from("album_posts").delete().in("post_id", createdPostIds);
      await admin.from("posts").delete().in("id", createdPostIds);
    }
    if (createdAlbumId) {
      await admin.from("albums").delete().eq("id", createdAlbumId);
    }
    throw error;
  }
};

export const createVirtualAlbumFromExistingPosts = async ({
  admin,
  ownerUserId,
  postIds,
  price,
  description,
}: {
  admin: SupabaseClient;
  ownerUserId: string;
  postIds: string[];
  price: number;
  description: string;
}) => {
  const uniquePostIds = Array.from(new Set(postIds.filter(Boolean)));
  if (uniquePostIds.length === 0) throw new Error("Selecciona al menos un archivo.");

  const { data: ownedPosts, error: postsError } = await admin
    .from("posts")
    .select("id,user_id")
    .in("id", uniquePostIds)
    .eq("user_id", ownerUserId);

  throwRepositoryError(postsError, "No se pudieron validar los archivos");
  if ((ownedPosts ?? []).length !== uniquePostIds.length) {
    throw new Error("Solo puedes reutilizar contenido propio.");
  }

  const { data: album, error: albumError } = await admin
    .from("albums")
    .insert({
      user_id: ownerUserId,
      description: description.trim() || "Contenido privado",
      price,
      visibility: "draft",
    })
    .select("id")
    .single();

  throwRepositoryError(albumError, "No se pudo crear el álbum virtual");
  if (!album?.id) throw new Error("No se pudo crear el álbum virtual.");

  const { error: linkError } = await admin.from("album_posts").insert(
    uniquePostIds.map((postId, index) => ({
      album_id: album.id,
      post_id: postId,
      position: index,
    })),
  );
  if (linkError) {
    await admin.from("albums").delete().eq("id", album.id);
    throw new Error(`No se pudo guardar el álbum virtual: ${linkError.message}`);
  }

  return { albumId: album.id };
};

export const listChatPickerContent = async ({
  admin,
  ownerUserId,
}: {
  admin: SupabaseClient;
  ownerUserId: string;
}) => {
  const { data: albumRows, error } = await admin
    .from("albums")
    .select(
      "id,description,price,visibility,created_at,album_posts(position,post:posts(id,media_url,media_type,is_locked,created_at))",
    )
    .eq("user_id", ownerUserId)
    .in("visibility", ["published", "draft"])
    .order("created_at", { ascending: false })
    .limit(100);

  throwRepositoryError(error, "No se pudo cargar el contenido del selector");

  const albums: ChatPickerAlbumItem[] = [];
  const chatAssets: ChatPickerAssetItem[] = [];

  for (const row of albumRows ?? []) {
    const posts = Array.isArray(row.album_posts)
      ? [...row.album_posts]
          .sort(
            (left, right) =>
              Number(left.position ?? 0) - Number(right.position ?? 0),
          )
          .map((link) => link.post)
          .filter(Boolean) as Array<{
            id: string;
            media_url: string | null;
            media_type: string | null;
          }>
      : [];
    const albumPosts = Array.isArray(row.album_posts)
      ? [...row.album_posts].sort(
          (left, right) =>
            Number(left.position ?? 0) - Number(right.position ?? 0),
        )
      : [];

    const coverUrl = resolvePublicUrl(admin, posts[0]?.media_url ?? null);
    albums.push({
      id: row.id,
      title: row.description?.trim() || "Contenido privado",
      price: Number(row.price || 0),
      coverUrl,
      itemCount: posts.length,
      visibility: row.visibility ?? "published",
      posts: albumPosts
        .map((link) => {
          const post = link.post;
          if (!post?.id) return null;
          return {
            postId: post.id,
            previewUrl: resolvePublicUrl(admin, post.media_url),
            kind: post.media_type === "video" ? "video" : "image",
            position: Number(link.position ?? 0),
          } satisfies ChatPickerAlbumPostItem;
        })
        .filter((value): value is ChatPickerAlbumPostItem => Boolean(value)),
    });

    if (row.visibility === "private") {
      posts.forEach((post) => {
        chatAssets.push({
          postId: post.id,
          albumId: row.id,
          previewUrl: resolvePublicUrl(admin, post.media_url),
          kind: post.media_type === "video" ? "video" : "image",
          price: Number(row.price || 0),
        });
      });
    }
  }

  return {
    albums: albums.filter((album) => album.visibility === "published"),
    chatAlbums: albums.filter((album) => album.visibility === "private"),
    chatAssets,
  };
};

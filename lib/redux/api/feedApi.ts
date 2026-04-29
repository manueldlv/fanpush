import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { getSessionAccessTokenWithRetry } from "@/lib/auth";
import { parseUploadModerationMeta } from "@/lib/contentClassification";
import {
  applyResolvedMediaAccess,
  buildInitialPostMediaState,
  type ResolvedAccessMedia,
} from "@/lib/postMediaState";
import { inferDisplayKind, PUBLIC_MEDIA_BUCKET } from "@/lib/media";
import { getSupabaseClient } from "@/lib/supabase";
import type { Post } from "@/lib/store/posts";
import { formatRelativeTime } from "@/lib/time";

type FeedData = {
  currentUserId: string | null;
  posts: Post[];
  followingIds: string[];
  likedPostIds: string[];
  purchasedPostIds: string[];
};

type AuthorPromotionRow = {
  user_id: string | null;
  is_active: boolean | null;
  promote_in_feed: boolean | null;
  feed_rank: number | null;
  expires_at?: string | null;
};

const FEED_ALBUM_LIMIT = 30;
const MEDIA_ACCESS_BATCH_SIZE = 50;

const buildError = (error: unknown, fallback: string) => ({
  error: error instanceof Error ? error.message : fallback,
});

const normalizeSingleRelation = <T>(
  value: T | T[] | null | undefined,
): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
};

const buildLikesCountMap = (
  rows: Array<{ post_id: string | null }> | null | undefined,
) => {
  const likesByPostId = new Map<string, number>();
  for (const row of rows ?? []) {
    const postId = row.post_id ?? "";
    if (!postId) continue;
    likesByPostId.set(postId, (likesByPostId.get(postId) ?? 0) + 1);
  }
  return likesByPostId;
};

const resolvePublicUrl = (
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  value: string | null,
) => {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  return supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data
    .publicUrl;
};

const resolveAccessibleMedia = async (
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  accessToken: string,
  incomingPosts: Post[],
) => {
  const allPostIds = Array.from(
    new Set(incomingPosts.flatMap((post) => post.mediaPostIds).filter(Boolean)),
  );
  if (allPostIds.length === 0) return incomingPosts;

  const batches = Array.from(
    { length: Math.ceil(allPostIds.length / MEDIA_ACCESS_BATCH_SIZE) },
    (_, index) =>
      allPostIds.slice(
        index * MEDIA_ACCESS_BATCH_SIZE,
        (index + 1) * MEDIA_ACCESS_BATCH_SIZE,
      ),
  );
  const resolvedItems: Record<string, ResolvedAccessMedia> = {};

  await Promise.all(
    batches.map(async (postIds) => {
      const response = await fetch("/api/media/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ postIds }),
      });

      if (!response.ok) return;
      const result = (await response.json()) as {
        items?: Record<string, ResolvedAccessMedia>;
      };
      Object.assign(resolvedItems, result.items ?? {});
    }),
  );

  return incomingPosts.map((post) => ({
    ...post,
    media: post.media.map((item, index): Post["media"][number] => {
      const postId = post.mediaPostIds[index];
      const resolved = postId ? resolvedItems[postId] : null;
      return applyResolvedMediaAccess(item, resolved);
    }),
  }));
};

export const feedApi = createApi({
  reducerPath: "feedApi",
  baseQuery: fakeBaseQuery<{ error: string }>(),
  tagTypes: ["Feed"],
  endpoints: (builder) => ({
    getFeed: builder.query<FeedData, void>({
      async queryFn() {
        try {
          const supabase = getSupabaseClient();
          if (!supabase) throw new Error("Falta configurar Supabase.");

          const { data: sessionData } = await supabase.auth.getSession();
          const currentUserId = sessionData.session?.user?.id ?? null;

          const { data: followRows } = currentUserId
            ? await supabase
                .from("follows")
                .select("following_id")
                .eq("follower_id", currentUserId)
            : { data: [] };
          const { data: promotionRows } = await supabase
            .from("author_promotions")
            .select("user_id,is_active,promote_in_feed,feed_rank,expires_at")
            .eq("is_active", true)
            .eq("promote_in_feed", true);

          const prioritizedAuthorIds = Array.from(
            new Set(
              ((promotionRows ?? []) as AuthorPromotionRow[])
                .filter(
                  (row) =>
                    row.user_id &&
                    row.promote_in_feed &&
                    row.is_active !== false &&
                    (!("expires_at" in row) ||
                      !row.expires_at ||
                      new Date(row.expires_at).getTime() > Date.now()),
                )
                .map((row) => row.user_id as string),
            ),
          );

          const [
            { data: recentAlbums, error: recentAlbumsError },
            { data: promotedAlbums, error: promotedAlbumsError },
          ] = await Promise.all([
            supabase
              .from("albums")
              .select(
                "id,user_id,description,price,visibility,created_at,users(username,avatar_url),album_posts(post:posts(id,media_url,media_type,is_locked,likes_count,caption))",
              )
              .eq("visibility", "published")
              .order("created_at", { ascending: false })
              .limit(FEED_ALBUM_LIMIT),
            prioritizedAuthorIds.length
              ? supabase
                  .from("albums")
                  .select(
                    "id,user_id,description,price,visibility,created_at,users(username,avatar_url),album_posts(post:posts(id,media_url,media_type,is_locked,likes_count,caption))",
                  )
                  .eq("visibility", "published")
                  .in("user_id", prioritizedAuthorIds)
                  .order("created_at", { ascending: false })
                  .limit(FEED_ALBUM_LIMIT)
              : Promise.resolve({ data: [], error: null }),
          ]);
          if (recentAlbumsError) throw recentAlbumsError;
          if (promotedAlbumsError) throw promotedAlbumsError;
          const data = Array.from(
            new Map(
              [...(promotedAlbums ?? []), ...(recentAlbums ?? [])].map((album) => [
                album.id,
                album,
              ]),
            ).values(),
          );

          const allMediaPostIds = data
            .flatMap((album) =>
              (
                (album.album_posts ?? []) as unknown as Array<{
                  post: { id: string | null } | null;
                }>
              ).map((item) => item.post?.id ?? ""),
            )
            .filter(Boolean);

          const { data: allLikesRows } = allMediaPostIds.length
            ? await supabase
                .from("likes")
                .select("post_id")
                .in("post_id", allMediaPostIds)
            : { data: [] };

          const likesByPostId = buildLikesCountMap(allLikesRows);
          const feedPromotionMap = new Map<string, number>();
          for (const row of (promotionRows ?? []) as AuthorPromotionRow[]) {
            if (!row.user_id || !row.promote_in_feed || row.is_active === false) continue;
            feedPromotionMap.set(row.user_id, Number(row.feed_rank ?? 9999));
          }

          const mapped: Post[] =
            data.map((post) => {
              const albumPosts = (post.album_posts ?? []) as unknown as Array<{
                post: {
                  id: string | null;
                  media_url: string | null;
                  media_type: string | null;
                  is_locked: boolean | null;
                  likes_count: number | null;
                  caption?: string | null;
                } | null;
              }>;
              const albumUser = normalizeSingleRelation(
                post.users as
                  | { username: string | null; avatar_url: string | null }
                  | {
                      username: string | null;
                      avatar_url: string | null;
                    }[]
                  | null
                  | undefined,
              );
              const mediaWithUrls: Post["media"] = albumPosts.map((item) =>
                buildInitialPostMediaState({
                  previewUrl: resolvePublicUrl(
                    supabase,
                    item.post?.media_url ?? "",
                  ),
                  previewKind: inferDisplayKind(
                    item.post?.media_url,
                    item.post?.media_type,
                    item.post?.is_locked,
                  ),
                  locked: item.post?.is_locked ?? false,
                }),
              );
              const mediaPostIds = albumPosts
                .map((item) => item.post?.id ?? "")
                .filter(Boolean);
              const postMeta = parseUploadModerationMeta(
                albumPosts[0]?.post?.caption ?? null,
              );
              const avatarUrl = resolvePublicUrl(
                supabase,
                albumUser?.avatar_url ?? "",
              );
              return {
                id: post.id,
                userId: post.user_id,
                mediaPostIds,
                author: albumUser?.username ?? "usuario",
                verified: false,
                time: formatRelativeTime(post.created_at ?? ""),
                suggestion: feedPromotionMap.has(post.user_id)
                  ? "Autor destacado"
                  : "Sugerencia para ti",
                caption: post.description ?? "",
                likes: mediaPostIds.reduce(
                  (sum, postId) => sum + (likesByPostId.get(postId) ?? 0),
                  0,
                ),
                avatar: avatarUrl || null,
                price: post.price ?? 0,
                tipEnabled: postMeta?.tipsEnabled ?? false,
                media: mediaWithUrls,
              } satisfies Post;
            })
              .sort((a, b) => {
                const aRank = feedPromotionMap.get(a.userId) ?? Number.MAX_SAFE_INTEGER;
                const bRank = feedPromotionMap.get(b.userId) ?? Number.MAX_SAFE_INTEGER;
                if (aRank !== bRank) return aRank - bRank;

                const aSource = data.find((item) => item.id === a.id);
                const bSource = data.find((item) => item.id === b.id);
                return (
                  new Date(bSource?.created_at ?? 0).getTime() -
                  new Date(aSource?.created_at ?? 0).getTime()
                );
              }) ?? [];

          const allPostIds = mapped
            .flatMap((post) => post.mediaPostIds)
            .filter(Boolean);
          let resolvedMapped = mapped;
          const accessToken =
            allPostIds.length > 0
              ? await getSessionAccessTokenWithRetry(supabase)
              : (sessionData.session?.access_token ?? null);
          if (accessToken && allPostIds.length > 0) {
            resolvedMapped = await resolveAccessibleMedia(
              supabase,
              accessToken,
              mapped,
            );
          }

          const { data: likesRows } = currentUserId
            ? await supabase
                .from("likes")
                .select("post_id")
                .eq("user_id", currentUserId)
                .in("post_id", allPostIds)
            : { data: [] };
          const { data: purchaseRows } = currentUserId
            ? await supabase
                .from("purchases")
                .select("post_id")
                .eq("user_id", currentUserId)
                .in("post_id", allPostIds)
            : { data: [] };

          return {
            data: {
              currentUserId,
              posts: resolvedMapped,
              followingIds: (followRows ?? []).map((row) => row.following_id),
              likedPostIds: (likesRows ?? []).map((row) => row.post_id),
              purchasedPostIds: (purchaseRows ?? []).map((row) => row.post_id),
            },
          };
        } catch (error) {
          return { error: buildError(error, "No se pudo cargar el feed.") };
        }
      },
      providesTags: ["Feed"],
      keepUnusedDataFor: 120,
    }),
  }),
});

export const { useGetFeedQuery } = feedApi;

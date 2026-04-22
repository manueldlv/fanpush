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

type FeedData = {
  currentUserId: string | null;
  posts: Post[];
  followingIds: string[];
  likedPostIds: string[];
  purchasedPostIds: string[];
};

const buildError = (error: unknown, fallback: string) => ({
  error: error instanceof Error ? error.message : fallback,
});

const normalizeSingleRelation = <T,>(
  value: T | T[] | null | undefined,
): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
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

const resolvePublicUrl = (supabase: NonNullable<ReturnType<typeof getSupabaseClient>>, value: string | null) => {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  return supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data.publicUrl;
};

const resolveAccessibleMedia = async (
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  accessToken: string,
  incomingPosts: Post[],
) => {
  const allPostIds = incomingPosts.flatMap((post) => post.mediaPostIds).filter(Boolean);
  if (allPostIds.length === 0) return incomingPosts;

  const response = await fetch("/api/media/access", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ postIds: allPostIds }),
  });

  if (!response.ok) return incomingPosts;
  const result = (await response.json()) as {
    items?: Record<string, ResolvedAccessMedia>;
  };
  const resolvedItems = result.items ?? {};

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

          const { data, error } = await supabase
            .from("albums")
            .select(
              "id,user_id,description,price,visibility,created_at,users(username,avatar_url),album_posts(post:posts(id,media_url,media_type,is_locked,likes_count,caption))",
            )
            .eq("visibility", "published")
            .order("created_at", { ascending: false });
          if (error) throw error;

          const allMediaPostIds = (data ?? [])
            .flatMap((album) =>
              ((album.album_posts ?? []) as unknown as Array<{
                post: { id: string | null } | null;
              }>).map((item) => item.post?.id ?? ""),
            )
            .filter(Boolean);

          const { data: allLikesRows } = allMediaPostIds.length
            ? await supabase
                .from("likes")
                .select("post_id")
                .in("post_id", allMediaPostIds)
            : { data: [] };

          const likesByPostId = buildLikesCountMap(allLikesRows);

          const mapped: Post[] =
            (await Promise.all(
              (data ?? []).map(async (post) => {
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
                  post.users as { username: string | null; avatar_url: string | null } | {
                    username: string | null;
                    avatar_url: string | null;
                  }[] | null | undefined,
                );
                const mediaWithUrls: Post["media"] = await Promise.all(
                  albumPosts.map(async (item) =>
                    buildInitialPostMediaState({
                      previewUrl: resolvePublicUrl(supabase, item.post?.media_url ?? ""),
                      previewKind: inferDisplayKind(
                        item.post?.media_url,
                        item.post?.media_type,
                        item.post?.is_locked,
                      ),
                      locked: item.post?.is_locked ?? false,
                    }),
                  ),
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
                  time: "Ahora",
                  suggestion: "Sugerencia para ti",
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
              }),
            )) ?? [];

          const allPostIds = mapped.flatMap((post) => post.mediaPostIds).filter(Boolean);
          let resolvedMapped = mapped;
          const accessToken =
            allPostIds.length > 0
              ? await getSessionAccessTokenWithRetry(supabase)
              : sessionData.session?.access_token ?? null;
          if (accessToken && allPostIds.length > 0) {
            resolvedMapped = await resolveAccessibleMedia(supabase, accessToken, mapped);
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

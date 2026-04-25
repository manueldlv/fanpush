import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { PUBLIC_MEDIA_BUCKET } from "@/lib/media";
import { getSupabaseClient } from "@/lib/supabase";

export type ExploreItem = {
  id: string;
  mediaUrl: string | null;
  mediaType: string;
  username: string;
  avatar: string | null;
  description: string;
  createdAt: string;
  isFollowing?: boolean;
};

type AuthorRoleRow = {
  user_id: string | null;
};

type UserRow = {
  id: string | null;
  username: string | null;
  avatar_url: string | null;
};

type AuthorAlbumPost = {
  post_id?: string | null;
  post:
    | {
        id?: string | null;
        media_url: string | null;
        media_type: string | null;
        is_locked: boolean | null;
        created_at: string | null;
      }
    | Array<{
        media_url: string | null;
        media_type: string | null;
        is_locked: boolean | null;
        created_at: string | null;
      }>
    | null;
};

type AuthorAlbumRow = {
  id?: string | null;
  user_id: string | null;
  description: string | null;
  created_at: string | null;
  album_posts: AuthorAlbumPost[] | null;
};

const hasTag = (description: string, tag: string) => {
  const normalizedTag = `#${tag.replace(/^#/, "").toLowerCase()}`;
  const matches: string[] =
    description.toLowerCase().match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return matches.includes(normalizedTag);
};

const buildError = (error: unknown, fallback: string) => ({
  error: error instanceof Error ? error.message : fallback,
});

const EXPLORE_AUTHOR_LIMIT = 80;
const EXPLORE_ALBUM_LIMIT = 160;
const EXPLORE_PURCHASE_LOOKBACK_LIMIT = 1000;

const resolvePublicUrl = (
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  value: string | null,
) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data
    .publicUrl;
};

type NormalizedAuthorPost = {
  id?: string | null;
  media_url: string | null;
  media_type: string | null;
  is_locked: boolean | null;
  created_at: string | null;
};

const normalizeAlbumPost = (
  value: AuthorAlbumPost["post"],
): NormalizedAuthorPost | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

const pickRandomItem = <T>(items: T[]) => {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
};

export const discoveryApi = createApi({
  reducerPath: "discoveryApi",
  baseQuery: fakeBaseQuery<{ error: string }>(),
  endpoints: (builder) => ({
    getExploreFeed: builder.query<ExploreItem[], void>({
      async queryFn() {
        try {
          const supabase = getSupabaseClient();
          if (!supabase) {
            throw new Error("Falta configurar Supabase.");
          }

          const { data: authData } = await supabase.auth.getUser();
          const currentUserId = authData?.user?.id ?? null;

          const { data: authorRoles, error: authorRolesError } = await supabase
            .from("user_roles")
            .select("user_id, role:roles!inner(code)")
            .eq("role.code", "author")
            .is("revoked_at", null)
            .limit(EXPLORE_AUTHOR_LIMIT);

          if (authorRolesError) {
            throw new Error(authorRolesError.message);
          }

          const authorIds = Array.from(
            new Set(
              ((authorRoles ?? []) as AuthorRoleRow[])
                .map((row) => row.user_id)
                .filter((value): value is string => Boolean(value)),
            ),
          );

          if (authorIds.length === 0) {
            return { data: [] };
          }

          const followedIds = new Set<string>();
          if (currentUserId) {
            const { data: followRows, error: followRowsError } = await supabase
              .from("follows")
              .select("following_id")
              .eq("follower_id", currentUserId);

            if (followRowsError) {
              throw new Error(followRowsError.message);
            }

            (followRows ?? []).forEach((row) => {
              if (row.following_id) followedIds.add(row.following_id);
            });
          }

          const [
            { data: users, error: usersError },
            { data: albums, error: albumsError },
          ] = await Promise.all([
            supabase
              .from("users")
              .select("id,username,avatar_url")
              .in("id", authorIds),
            supabase
              .from("albums")
              .select(
                "id,user_id,description,created_at,album_posts(post_id,post:posts(id,media_url,media_type,is_locked,created_at))",
              )
              .eq("visibility", "published")
              .in("user_id", authorIds)
              .order("created_at", { ascending: false })
              .limit(EXPLORE_ALBUM_LIMIT),
          ]);

          if (usersError) {
            throw new Error(usersError.message);
          }

          if (albumsError) {
            throw new Error(albumsError.message);
          }

          const albumsByUserId = new Map<string, AuthorAlbumRow[]>();
          const candidatePostIds: string[] = [];

          for (const album of (albums ?? []) as AuthorAlbumRow[]) {
            const userId = album.user_id ?? "";
            if (!userId) continue;

            const current = albumsByUserId.get(userId) ?? [];
            current.push(album);
            albumsByUserId.set(userId, current);

            for (const item of album.album_posts ?? []) {
              const post = normalizeAlbumPost(item.post);
              const postId = post?.id ?? item.post_id ?? null;
              if (postId) candidatePostIds.push(postId);
            }
          }

          const { data: purchases, error: purchasesError } =
            candidatePostIds.length
              ? await supabase
                  .from("purchases")
                  .select("post_id")
                  .in("post_id", Array.from(new Set(candidatePostIds)))
                  .limit(EXPLORE_PURCHASE_LOOKBACK_LIMIT)
              : { data: [], error: null };

          if (purchasesError) {
            throw new Error(purchasesError.message);
          }

          const purchaseCountByPostId = new Map<string, number>();
          for (const row of purchases ?? []) {
            const postId = typeof row.post_id === "string" ? row.post_id : null;
            if (!postId) continue;
            purchaseCountByPostId.set(
              postId,
              (purchaseCountByPostId.get(postId) ?? 0) + 1,
            );
          }

          const mapped: ExploreItem[] = ((users ?? []) as UserRow[])
            .map((user) => {
              const userId = user.id ?? "";
              if (!userId || !user.username?.trim()) return null;
              if (currentUserId && userId === currentUserId) return null;

              const userAlbums = albumsByUserId.get(userId) ?? [];
              const postCandidates = userAlbums.flatMap(
                (album) =>
                  (album.album_posts ?? [])
                    .map((item) => {
                      const post = normalizeAlbumPost(item.post);
                      const postId = post?.id ?? item.post_id ?? null;
                      if (!postId || !post?.media_url) return null;
                      if (post.is_locked) return null;
                      return {
                        postId,
                        mediaUrl: post.media_url,
                        mediaType: post.media_type ?? "image",
                        description: album.description ?? "",
                        createdAt: post.created_at ?? album.created_at ?? "",
                      };
                    })
                    .filter(Boolean) as Array<{
                    postId: string;
                    mediaUrl: string;
                    mediaType: string;
                    description: string;
                    createdAt: string;
                  }>,
              );

              if (postCandidates.length === 0) {
                return null;
              }

              const topSellingPost = [...postCandidates].sort((a, b) => {
                const purchaseDiff =
                  (purchaseCountByPostId.get(b.postId) ?? 0) -
                  (purchaseCountByPostId.get(a.postId) ?? 0);
                if (purchaseDiff !== 0) return purchaseDiff;

                const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bTime - aTime;
              })[0];

              const fallbackPost = pickRandomItem(postCandidates);
              const coverPost =
                (topSellingPost &&
                (purchaseCountByPostId.get(topSellingPost.postId) ?? 0) > 0
                  ? topSellingPost
                  : fallbackPost) ?? null;

              if (!coverPost) {
                return null;
              }

              return {
                id: userId,
                mediaUrl: resolvePublicUrl(supabase, coverPost.mediaUrl),
                mediaType: coverPost.mediaType,
                username: user.username.trim(),
                avatar: resolvePublicUrl(supabase, user.avatar_url ?? null),
                description: coverPost.description,
                createdAt: coverPost.createdAt,
                isFollowing: followedIds.has(userId),
              };
            })
            .filter(Boolean) as ExploreItem[];

          mapped.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });

          return { data: mapped };
        } catch (error) {
          return { error: buildError(error, "No se pudo cargar exploración.") };
        }
      },
      keepUnusedDataFor: 120,
    }),
    getHashtagFeed: builder.query<ExploreItem[], string>({
      async queryFn(tag) {
        try {
          const supabase = getSupabaseClient();
          if (!supabase) {
            throw new Error("Falta configurar Supabase.");
          }

          const { data } = await supabase
            .from("albums")
            .select(
              "id,description,created_at,price,users(username,avatar_url),album_posts(post_id,post:posts(id,media_url,media_type,is_locked,created_at))",
            )
            .order("created_at", { ascending: false })
            .limit(120);

          const mapped: ExploreItem[] = (data ?? [])
            .flatMap((album) => {
              const description = album.description ?? "";
              if (!hasTag(description, tag)) return [];

              const owner = Array.isArray(album.users)
                ? album.users[0]
                : album.users;
              const username = owner?.username ?? "usuario";
              const avatar = resolvePublicUrl(
                supabase,
                owner?.avatar_url ?? null,
              );

              return Array.isArray(album.album_posts)
                ? (album.album_posts
                    .map((link) => {
                      const post = Array.isArray(link.post)
                        ? link.post[0]
                        : link.post;
                      if (!post?.media_url) return null;
                      return {
                        id: post.id ?? link.post_id,
                        mediaUrl: resolvePublicUrl(
                          supabase,
                          post.media_url ?? null,
                        ),
                        mediaType: post.media_type ?? "image",
                        username,
                        avatar,
                        description,
                        createdAt: post.created_at ?? album.created_at,
                      };
                    })
                    .filter(Boolean) as ExploreItem[])
                : [];
            })
            .filter((item) => Boolean(item.mediaUrl));

          return { data: mapped };
        } catch (error) {
          return { error: buildError(error, "No se pudo cargar el hashtag.") };
        }
      },
      keepUnusedDataFor: 120,
    }),
  }),
});

export const { useGetExploreFeedQuery, useGetHashtagFeedQuery } = discoveryApi;

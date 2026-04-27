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

type ExplorePromotionRow = {
  user_id: string | null;
  is_active: boolean | null;
  promote_in_explore: boolean | null;
  explore_rank: number | null;
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

          const {
            data: { session },
          } = await supabase.auth.getSession();
          const response = await fetch("/api/explore", {
            headers: session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : undefined,
          });
          const result = (await response.json()) as {
            items?: ExploreItem[];
            error?: string;
          };

          if (!response.ok) {
            throw new Error(result.error ?? "No se pudo cargar exploración.");
          }

          const mapped = (result.items ?? []).map((item) => ({
            ...item,
            mediaUrl: resolvePublicUrl(supabase, item.mediaUrl),
            avatar: resolvePublicUrl(supabase, item.avatar),
          }));

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

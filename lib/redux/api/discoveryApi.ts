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
  post:
    | {
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

const resolvePublicUrl = (
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  value: string | null,
) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data.publicUrl;
};

const normalizeAlbumPost = (value: AuthorAlbumPost["post"]) =>
  Array.isArray(value) ? (value[0] ?? null) : value;

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

          const { data: authorRoles, error: authorRolesError } = await supabase
            .from("user_roles")
            .select("user_id, role:roles!inner(code)")
            .eq("role.code", "author")
            .is("revoked_at", null);

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

          const [{ data: users, error: usersError }, { data: albums, error: albumsError }] =
            await Promise.all([
              supabase
                .from("users")
                .select("id,username,avatar_url")
                .in("id", authorIds),
              supabase
                .from("albums")
                .select(
                  "user_id,description,created_at,album_posts(post:posts(media_url,media_type,is_locked,created_at))",
                )
                .eq("visibility", "published")
                .in("user_id", authorIds)
                .order("created_at", { ascending: false }),
            ]);

          if (usersError) {
            throw new Error(usersError.message);
          }

          if (albumsError) {
            throw new Error(albumsError.message);
          }

          const latestAlbumByUserId = new Map<string, AuthorAlbumRow>();
          for (const album of (albums ?? []) as AuthorAlbumRow[]) {
            const userId = album.user_id ?? "";
            if (!userId || latestAlbumByUserId.has(userId)) continue;
            latestAlbumByUserId.set(userId, album);
          }

          const mapped: ExploreItem[] = ((users ?? []) as UserRow[])
            .map((user) => {
              const userId = user.id ?? "";
              if (!userId || !user.username?.trim()) return null;

              const latestAlbum = latestAlbumByUserId.get(userId) ?? null;
              const firstVisibleMedia =
                latestAlbum?.album_posts
                  ?.map((item) => normalizeAlbumPost(item.post))
                  .find((post) => post?.media_url && !post.is_locked) ?? null;

              return {
                id: userId,
                mediaUrl: resolvePublicUrl(supabase, firstVisibleMedia?.media_url ?? null),
                mediaType: firstVisibleMedia?.media_type ?? "image",
                username: user.username.trim(),
                avatar: resolvePublicUrl(supabase, user.avatar_url ?? null),
                description: latestAlbum?.description ?? "",
                createdAt: latestAlbum?.created_at ?? "",
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

              const owner = Array.isArray(album.users) ? album.users[0] : album.users;
              const username = owner?.username ?? "usuario";
              const avatar = resolvePublicUrl(supabase, owner?.avatar_url ?? null);

              return Array.isArray(album.album_posts)
                ? album.album_posts
                    .map((link) => {
                      const post = Array.isArray(link.post) ? link.post[0] : link.post;
                      if (!post?.media_url) return null;
                      return {
                        id: post.id ?? link.post_id,
                        mediaUrl: resolvePublicUrl(supabase, post.media_url ?? null),
                        mediaType: post.media_type ?? "image",
                        username,
                        avatar,
                        description,
                        createdAt: post.created_at ?? album.created_at,
                      };
                    })
                    .filter(Boolean) as ExploreItem[]
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

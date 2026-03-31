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

          const { data } = await supabase
            .from("albums")
            .select(
              "id,description,created_at,price,users(username,avatar_url),album_posts(post_id,post:posts(id,media_url,media_type,is_locked,created_at))",
            )
            .lte("price", 0)
            .order("created_at", { ascending: false })
            .limit(60);

          const mapped: ExploreItem[] = (data ?? [])
            .flatMap((album) => {
              const owner = Array.isArray(album.users) ? album.users[0] : album.users;
              const username = owner?.username ?? "usuario";
              const avatar = resolvePublicUrl(supabase, owner?.avatar_url ?? null);
              const description = album.description ?? "";

              return Array.isArray(album.album_posts)
                ? album.album_posts
                    .map((link) => {
                      const post = Array.isArray(link.post) ? link.post[0] : link.post;
                      if (!post?.media_url) return null;
                      if (post.is_locked) return null;
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
          return { error: buildError(error, "No se pudo cargar exploración.") };
        }
      },
      keepUnusedDataFor: 120,
    }),
  }),
});

export const { useGetExploreFeedQuery } = discoveryApi;

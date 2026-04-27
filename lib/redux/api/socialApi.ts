import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { PUBLIC_MEDIA_BUCKET } from "@/lib/media";
import { getSupabaseClient } from "@/lib/supabase";

export type SuggestionItem = {
  id: string;
  name: string;
  fullName: string;
  handle: string;
  note: string;
  avatar: string | null;
  verified?: boolean;
  isFollowing?: boolean;
};

type AuthorPromotionSuggestionRow = {
  user_id: string | null;
  is_active: boolean | null;
  promote_in_suggestions: boolean | null;
  suggestions_rank: number | null;
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

export const socialApi = createApi({
  reducerPath: "socialApi",
  baseQuery: fakeBaseQuery<{ error: string }>(),
  tagTypes: ["SocialSuggestions"],
  endpoints: (builder) => ({
    getSuggestions: builder.query<SuggestionItem[], void>({
      async queryFn() {
        try {
          const supabase = getSupabaseClient();
          if (!supabase) {
            throw new Error("Falta configurar Supabase.");
          }
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData?.user?.id;

          const followedIds = new Set<string>();
          if (userId) {
            const { data: followRows } = await supabase
              .from("follows")
              .select("following_id")
              .eq("follower_id", userId);
            (followRows ?? []).forEach((row) => {
              if (row.following_id) followedIds.add(row.following_id);
            });
          }

          let query = supabase.from("users").select("id,username,avatar_url").limit(30);
          if (userId) {
            query = query.neq("id", userId);
          }
          const [{ data }, { data: promotionRows }] = await Promise.all([
            query,
            supabase
              .from("author_promotions")
              .select(
                "user_id,is_active,promote_in_suggestions,suggestions_rank",
              )
              .eq("is_active", true)
              .eq("promote_in_suggestions", true),
          ]);

          const suggestionRankMap = new Map<string, number>();
          for (const row of (promotionRows ?? []) as AuthorPromotionSuggestionRow[]) {
            if (!row.user_id || !row.promote_in_suggestions || row.is_active === false) continue;
            suggestionRankMap.set(row.user_id, Number(row.suggestions_rank ?? 9999));
          }

          const prioritizedIds = Array.from(suggestionRankMap.keys());
          const { data: prioritizedRows } = prioritizedIds.length
            ? await supabase
                .from("users")
                .select("id,username,avatar_url")
                .in("id", prioritizedIds)
            : { data: [] };

          const fallbackRows = data ?? [];
          const mergedRows = [
            ...(prioritizedRows ?? []),
            ...fallbackRows.filter((row) => !prioritizedIds.includes(row.id)),
          ].slice(0, 5);

          const mapped = await Promise.all(
            mergedRows.map(async (row) => ({
              id: row.id,
              name: row.username ?? "usuario",
              fullName: row.username ?? "",
              handle: `@${row.username ?? "usuario"}`,
              note: "Sugerencia para ti",
              avatar: resolvePublicUrl(supabase, row.avatar_url ?? null),
              isFollowing: followedIds.has(row.id),
            })),
          );

          mapped.sort((a, b) => {
            const aRank = suggestionRankMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
            const bRank = suggestionRankMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
            if (aRank !== bRank) return aRank - bRank;
            return a.name.localeCompare(b.name);
          });

          const finalMapped = mapped.slice(0, 5);

          return { data: finalMapped };
        } catch (error) {
          return { error: buildError(error, "No se pudieron cargar sugerencias.") };
        }
      },
      providesTags: ["SocialSuggestions"],
      keepUnusedDataFor: 120,
    }),
  }),
});

export const { useGetSuggestionsQuery } = socialApi;

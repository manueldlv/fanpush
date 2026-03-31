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

          if (userId) {
            const { data: followRows } = await supabase
              .from("follows")
              .select("following_id")
              .eq("follower_id", userId);
            void followRows;
          }

          let query = supabase.from("users").select("id,username,avatar_url").limit(5);
          if (userId) {
            query = query.neq("id", userId);
          }
          const { data } = await query;

          const mapped = await Promise.all(
            (data ?? []).map(async (row) => ({
              id: row.id,
              name: row.username ?? "usuario",
              fullName: row.username ?? "",
              handle: `@${row.username ?? "usuario"}`,
              note: "Sugerencia para ti",
              avatar: resolvePublicUrl(supabase, row.avatar_url ?? null),
            })),
          );

          return { data: mapped };
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

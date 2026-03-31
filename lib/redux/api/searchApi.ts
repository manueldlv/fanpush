import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { PUBLIC_MEDIA_BUCKET } from "@/lib/media";
import { getSupabaseClient } from "@/lib/supabase";
import type { SearchResultItem } from "@/lib/redux/slices/searchSlice";

const buildError = (error: unknown, fallback: string) => ({
  error: error instanceof Error ? error.message : fallback,
});

const resolveAvatar = async (value: string | null) => {
  const supabase = getSupabaseClient();
  if (!supabase || !value) return null;
  if (value.startsWith("http")) return value;
  return supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data.publicUrl;
};

export const searchApi = createApi({
  reducerPath: "searchApi",
  baseQuery: fakeBaseQuery<{ error: string }>(),
  endpoints: (builder) => ({
    searchUsers: builder.query<SearchResultItem[], string>({
      async queryFn(rawQuery) {
        const query = rawQuery.trim();
        if (!query) {
          return { data: [] };
        }

        try {
          const supabase = getSupabaseClient();
          if (!supabase) {
            throw new Error("Falta configurar Supabase.");
          }

          const { data, error } = await supabase
            .from("users")
            .select("id,username,avatar_url")
            .ilike("username", `%${query}%`)
            .limit(10);

          if (error) {
            throw error;
          }

          return {
            data: await Promise.all(
              (data ?? []).map(async (row) => ({
                id: row.id,
                name: row.username ?? "usuario",
                fullName: row.username ?? "",
                detail: "Sugerencia para ti",
                avatar: await resolveAvatar(row.avatar_url ?? null),
              })),
            ),
          };
        } catch (error) {
          return { error: buildError(error, "No se pudo cargar la búsqueda.") };
        }
      },
      serializeQueryArgs: ({ queryArgs }) => queryArgs.trim().toLowerCase(),
      keepUnusedDataFor: 120,
    }),
    getUsersByIds: builder.query<SearchResultItem[], string[]>({
      async queryFn(ids) {
        const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
        if (!uniqueIds.length) {
          return { data: [] };
        }

        try {
          const supabase = getSupabaseClient();
          if (!supabase) {
            throw new Error("Falta configurar Supabase.");
          }

          const { data, error } = await supabase
            .from("users")
            .select("id, username, avatar_url")
            .in("id", uniqueIds);

          if (error) {
            throw error;
          }

          return {
            data: await Promise.all(
              (data ?? []).map(async (row) => ({
                id: row.id,
                name: row.username ?? "usuario",
                fullName: row.username ?? "",
                detail: "Sugerencia para ti",
                avatar: await resolveAvatar(row.avatar_url ?? null),
              })),
            ),
          };
        } catch (error) {
          return { error: buildError(error, "No se pudo refrescar las búsquedas recientes.") };
        }
      },
      serializeQueryArgs: ({ queryArgs }) =>
        [...new Set(queryArgs.filter(Boolean))].sort().join(","),
      keepUnusedDataFor: 120,
    }),
  }),
});

export const { useGetUsersByIdsQuery, useSearchUsersQuery } = searchApi;

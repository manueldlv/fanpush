import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { getSupabaseClient } from "@/lib/supabase";

export type AuthorApplicationState = {
  status: "idle" | "pending" | "approved" | "rejected";
  current: {
    fullName: string;
    birthDate: string;
    documentType: string;
    documentNumber: string;
    country: string;
    province: string;
    city: string;
    address: string;
    documentFrontUrl: string;
    documentBackUrl: string;
    status: "pending" | "approved" | "rejected";
    submittedAt: string;
    archived?: boolean;
  } | null;
};

const buildError = (error: unknown, fallback: string) => ({
  error: error instanceof Error ? error.message : fallback,
});

export const authorApi = createApi({
  reducerPath: "authorApi",
  baseQuery: fakeBaseQuery<{ error: string }>(),
  endpoints: (builder) => ({
    getAuthorApplication: builder.query<AuthorApplicationState, void>({
      async queryFn() {
        try {
          const supabase = getSupabaseClient();
          if (!supabase) throw new Error("Falta configurar Supabase.");
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.access_token) {
            return { data: { status: "idle", current: null } };
          }

          const response = await fetch("/api/author/apply", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          const result = (await response.json()) as
            | AuthorApplicationState
            | { error?: string };

          if (!response.ok || !("status" in result)) {
            throw new Error(
              "error" in result && result.error
                ? result.error
                : "No se pudo cargar la solicitud.",
            );
          }

          return { data: result };
        } catch (error) {
          return { error: buildError(error, "No se pudo cargar la solicitud.") };
        }
      },
      keepUnusedDataFor: 120,
    }),
    submitAuthorApplication: builder.mutation<
      { ok: true },
      FormData
    >({
      async queryFn(formData) {
        try {
          const supabase = getSupabaseClient();
          if (!supabase) throw new Error("Falta configurar Supabase.");
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error("Necesitas iniciar sesión.");
          }
          const response = await fetch("/api/author/apply", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: formData,
          });
          const result = (await response.json()) as { error?: string };
          if (!response.ok) throw new Error(result.error ?? "No se pudo enviar la solicitud.");
          return { data: { ok: true } };
        } catch (error) {
          return { error: buildError(error, "No se pudo enviar la solicitud.") };
        }
      },
    }),
  }),
});

export const { useGetAuthorApplicationQuery, useSubmitAuthorApplicationMutation } = authorApi;

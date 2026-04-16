import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { getSupabaseClient } from "@/lib/supabase";

const buildError = (error: unknown, fallback: string) => ({
  error: error instanceof Error ? error.message : fallback,
});

const extractApiErrorMessage = async (response: Response) => {
  const data = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;

  return data?.error || data?.message || "Ocurrió un error.";
};

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fakeBaseQuery<{ error: string }>(),
  endpoints: (builder) => ({
    requestPasswordRecovery: builder.mutation<{ message?: string }, { email: string }>({
      async queryFn(body) {
        try {
          const response = await fetch("/api/auth/password/recovery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const result = (await response.json()) as { message?: string };
          if (!response.ok) {
            throw new Error(await extractApiErrorMessage(response));
          }
          return { data: result };
        } catch (error) {
          return { error: buildError(error, "No se pudo solicitar la recuperación.") };
        }
      },
    }),
    register: builder.mutation<
      { message?: string },
      {
        fullName: string;
        username: string;
        email: string;
        password: string;
        acceptedTerms: boolean;
        referralCode?: string;
      }
    >({
      async queryFn(body) {
        try {
          const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const result = (await response.json()) as { message?: string };
          if (!response.ok) {
            throw new Error(await extractApiErrorMessage(response));
          }
          return { data: result };
        } catch (error) {
          return { error: buildError(error, "No se pudo crear la cuenta.") };
        }
      },
    }),
    resendConfirmation: builder.mutation<{ message?: string }, { email: string }>({
      async queryFn(body) {
        try {
          const response = await fetch("/api/auth/register/resend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const result = (await response.json()) as { message?: string };
          if (!response.ok) {
            throw new Error(await extractApiErrorMessage(response));
          }
          return { data: result };
        } catch (error) {
          return { error: buildError(error, "No se pudo reenviar la confirmación.") };
        }
      },
    }),
    updateCurrentPassword: builder.mutation<void, { password: string }>({
      async queryFn({ password }) {
        try {
          const supabase = getSupabaseClient();
          if (!supabase) throw new Error("Falta configurar Supabase.");
          const { error } = await supabase.auth.updateUser({ password });
          if (error) throw error;
          return { data: undefined };
        } catch (error) {
          return { error: buildError(error, "No se pudo actualizar la contraseña.") };
        }
      },
    }),
  }),
});

export const {
  useRegisterMutation,
  useRequestPasswordRecoveryMutation,
  useResendConfirmationMutation,
  useUpdateCurrentPasswordMutation,
} = authApi;

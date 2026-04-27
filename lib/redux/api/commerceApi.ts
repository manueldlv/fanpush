import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { notificationsApi } from "@/lib/redux/api/notificationsApi";
import { profileApi } from "@/lib/redux/api/profileApi";
import { sessionApi } from "@/lib/redux/api/sessionApi";
import type { PayoutProfile } from "@/lib/payouts";
import { type WithdrawalStatus } from "@/lib/withdrawals";
import { getSupabaseClient } from "@/lib/supabase";

type PurchaseItem = {
  id: string;
  title: string;
  creator: string;
  date: string;
  price: number;
  cover: string;
  covers: string[];
  media: { url: string; kind: "image" | "video" }[];
  status: string;
  source?: "post" | "chat";
};

type SentTipItem = {
  id: string;
  recipient: string;
  recipientAvatar: string | null;
  date: string;
  amount: number;
  message: string;
};

type SaleItem = {
  id: string;
  albumId: string;
  type: string;
  title: string;
  href?: string;
  count: number;
  total: number;
  createdAt?: string;
  buyer: {
    id: string;
    name: string;
    full: string;
    avatar: string | null;
  };
};

type WithdrawalItem = {
  id: string;
  amount: number;
  status: WithdrawalStatus;
  statusLabel: string;
  requestedAt: string;
  monthKey: string;
  payoutAlias?: string;
  payoutHolderName?: string;
  payoutHolderDocument?: string;
  payoutBank?: string;
};

type CheckoutPreferenceArg =
  | {
      kind: "purchase";
      albumId: string;
      returnPath?: string;
    }
  | {
      kind: "tip";
      targetUserId: string;
      amount: number;
      returnPath?: string;
    }
  | {
      kind: "deposit";
      amount: number;
      returnPath?: string;
    };

type CheckoutPreferenceResult = {
  initPoint: string;
  preferenceId?: string;
};

type FinalizeMercadoPagoArg = {
  paymentId: string;
  accessToken: string;
};

type FinalizeMercadoPagoResult = {
  ok?: boolean;
  kind?: "purchase" | "tip" | "deposit";
  status?: string;
  amount?: number;
  error?: string;
};

type PurchasesResult = {
  items: PurchaseItem[];
  sentTips: SentTipItem[];
};

type SalesResult = {
  sales: SaleItem[];
  withdrawals: WithdrawalItem[];
  payoutProfile: PayoutProfile | null;
  availableToWithdraw: number;
  reservedToWithdraw: number;
};

const buildError = (error: unknown, fallback: string) => ({
  error: error instanceof Error ? error.message : fallback,
});

const getAccessToken = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Falta configurar Supabase.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Necesitas iniciar sesión para continuar.");
  }

  return session.access_token;
};

export const commerceApi = createApi({
  reducerPath: "commerceApi",
  baseQuery: fakeBaseQuery<{ error: string }>(),
  endpoints: (builder) => ({
    createCheckoutPreference: builder.mutation<
      CheckoutPreferenceResult,
      CheckoutPreferenceArg
    >({
      async queryFn(body) {
        try {
          const accessToken = await getAccessToken();
          const response = await fetch("/api/mercadopago/preference", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(body),
          });

          const result = (await response.json()) as CheckoutPreferenceResult & {
            error?: string;
          };

          if (!response.ok || !result.initPoint) {
            throw new Error(result.error ?? "No se pudo iniciar el checkout.");
          }

          return { data: result };
        } catch (error) {
          return {
            error: buildError(error, "No se pudo iniciar el checkout."),
          };
        }
      },
    }),
    finalizeMercadoPago: builder.mutation<
      FinalizeMercadoPagoResult,
      FinalizeMercadoPagoArg
    >({
      async queryFn({ paymentId, accessToken }) {
        try {
          const response = await fetch("/api/mercadopago/finalize", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ paymentId }),
          });

          const result = (await response.json()) as FinalizeMercadoPagoResult;

          if (!response.ok) {
            throw new Error(result.error ?? "No se pudo acreditar el pago.");
          }

          return { data: result };
        } catch (error) {
          return {
            error: buildError(error, "No se pudo acreditar el pago."),
          };
        }
      },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (!data.ok) return;

          dispatch(sessionApi.util.invalidateTags(["Viewer", "Session"]));
          dispatch(profileApi.util.invalidateTags(["ProfileView"]));
          dispatch(notificationsApi.util.invalidateTags(["NotificationCenter"]));
        } catch {
          // No-op: the component still handles the visible error state.
        }
      },
    }),
    getPurchases: builder.query<PurchasesResult, void>({
      async queryFn() {
        try {
          const accessToken = await getAccessToken();
          const response = await fetch("/api/purchases", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          const result = (await response.json()) as PurchasesResult & {
            error?: string;
          };

          if (!response.ok) {
            throw new Error(result.error ?? "No se pudieron cargar las compras.");
          }

          return {
            data: {
              items: result.items ?? [],
              sentTips: result.sentTips ?? [],
            },
          };
        } catch (error) {
          return { error: buildError(error, "No se pudieron cargar las compras.") };
        }
      },
      keepUnusedDataFor: 120,
    }),
    requestWithdrawal: builder.mutation<
      {
        record: {
          amount: number;
          status: WithdrawalStatus;
          requestedAt: string;
          monthKey: string;
        };
      },
      { amount: number }
    >({
      async queryFn({ amount }) {
        try {
          const accessToken = await getAccessToken();
          const response = await fetch("/api/withdrawals/request", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ amount }),
          });
          const result = (await response.json()) as {
            error?: string;
            record?: {
              amount: number;
              status: WithdrawalStatus;
              requestedAt: string;
              monthKey: string;
            };
          };
          if (!response.ok || !result.record) {
            throw new Error(result.error ?? "No se pudo solicitar el retiro.");
          }
          return { data: { record: result.record } };
        } catch (error) {
          return { error: buildError(error, "No se pudo solicitar el retiro.") };
        }
      },
    }),
    cancelWithdrawal: builder.mutation<
      {
        record: {
          amount: number;
          status: WithdrawalStatus;
          requestedAt: string;
          monthKey: string;
        };
      },
      { id: string }
    >({
      async queryFn({ id }) {
        try {
          const accessToken = await getAccessToken();
          const response = await fetch(`/api/withdrawals/${id}/cancel`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          const result = (await response.json()) as {
            error?: string;
            record?: {
              amount: number;
              status: WithdrawalStatus;
              requestedAt: string;
              monthKey: string;
            };
          };
          if (!response.ok || !result.record) {
            throw new Error(result.error ?? "No se pudo cancelar el retiro.");
          }
          return { data: { record: result.record } };
        } catch (error) {
          return { error: buildError(error, "No se pudo cancelar el retiro.") };
        }
      },
    }),
    getSales: builder.query<SalesResult, void>({
      async queryFn() {
        try {
          const accessToken = await getAccessToken();
          const response = await fetch("/api/sales", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          const result = (await response.json()) as SalesResult & { error?: string };
          if (!response.ok) {
            throw new Error(result.error ?? "No se pudieron cargar las ventas.");
          }

          return {
            data: {
              sales: result.sales ?? [],
              withdrawals: result.withdrawals ?? [],
              payoutProfile: result.payoutProfile ?? null,
              availableToWithdraw: Number(result.availableToWithdraw ?? 0),
              reservedToWithdraw: Number(result.reservedToWithdraw ?? 0),
            },
          };
        } catch (error) {
          return { error: buildError(error, "No se pudieron cargar las ventas.") };
        }
      },
      keepUnusedDataFor: 120,
    }),
  }),
});

export const {
  useCreateCheckoutPreferenceMutation,
  useFinalizeMercadoPagoMutation,
  useCancelWithdrawalMutation,
  useGetPurchasesQuery,
  useGetSalesQuery,
  useRequestWithdrawalMutation,
} = commerceApi;

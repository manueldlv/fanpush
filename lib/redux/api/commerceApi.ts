import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { notificationsApi } from "@/lib/redux/api/notificationsApi";
import { profileApi } from "@/lib/redux/api/profileApi";
import { sessionApi } from "@/lib/redux/api/sessionApi";
import { inferDisplayKind, PUBLIC_MEDIA_BUCKET } from "@/lib/media";
import { parseTipAmountFromMessage, parseTipNoteFromMessage } from "@/lib/earnings";
import { parsePayoutProfile, type PayoutProfile } from "@/lib/payouts";
import {
  getCurrentMonthKey,
  getWithdrawalStatusLabel,
  parseWithdrawalRecord,
  type WithdrawalStatus,
} from "@/lib/withdrawals";
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

const formatAssetCountLabel = (count: number, singular: string, plural: string) => {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? singular : plural}`;
};

const buildSaleContentSummary = (imageCount: number, videoCount: number) => {
  const parts = [
    formatAssetCountLabel(imageCount, "foto", "fotos"),
    formatAssetCountLabel(videoCount, "video", "videos"),
  ].filter(Boolean) as string[];

  if (parts.length === 0) return "Contenido";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} y ${parts[1]}`;
};

type WithdrawalItem = {
  id: string;
  amount: number;
  status: WithdrawalStatus;
  statusLabel: string;
  requestedAt: string;
  monthKey: string;
};

type ExploreItem = {
  id: string;
  mediaUrl: string | null;
  mediaType: string;
  username: string;
  avatar: string | null;
  description: string;
  createdAt: string;
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

type ExploreResult = {
  items: ExploreItem[];
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

const resolvePublicUrl = (supabase: NonNullable<ReturnType<typeof getSupabaseClient>>, value: string | null) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data.publicUrl;
};

const resolveAccessibleMedia = async (
  accessToken: string,
  postIds: string[],
) => {
  if (postIds.length === 0) return {};
  const response = await fetch("/api/media/access", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ postIds }),
  });
  if (!response.ok) return {};
  const result = (await response.json()) as {
    items?: Record<string, { url: string; kind: "image" | "video"; locked: boolean }>;
  };
  return result.items ?? {};
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
          const supabase = getSupabaseClient();
          if (!supabase) throw new Error("Falta configurar Supabase.");
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData?.user?.id;
          if (!userId) {
            return {
              data: {
                sales: [],
                withdrawals: [],
                payoutProfile: null,
                availableToWithdraw: 0,
                reservedToWithdraw: 0,
              },
            };
          }

          const { data: postRows } = await supabase
            .from("posts")
            .select("id,user_id,media_type,caption,album_posts(album_id)")
            .eq("user_id", userId);
          const postIds = (postRows ?? []).map((row) => row.id);
          const { data: purchaseRows } = postIds.length
            ? await supabase
                .from("purchases")
                .select("id,user_id,post_id,amount,created_at")
                .in("post_id", postIds)
                .order("created_at", { ascending: false })
            : { data: [] };
          const postMap = new Map((postRows ?? []).map((row) => [row.id, row]));
          const albumIds = Array.from(
            new Set((postRows ?? []).map((row) => row.album_posts?.[0]?.album_id).filter(Boolean) as string[]),
          );
          const { data: albumRows } = albumIds.length
            ? await supabase
                .from("albums")
                .select("id,description,price,album_posts(post:posts(media_type))")
                .in("id", albumIds)
            : { data: [] };
          const albumMap = new Map((albumRows ?? []).map((row) => [row.id, row]));
          const { data: albumPostRows } = albumIds.length
            ? await supabase.from("album_posts").select("album_id,post_id").in("album_id", albumIds)
            : { data: [] };
          const albumCountMap = new Map<string, number>();
          (albumPostRows ?? []).forEach((row) => {
            const current = albumCountMap.get(row.album_id) ?? 0;
            albumCountMap.set(row.album_id, current + 1);
          });
          const { data: directMessageRows } = await supabase
            .from("direct_messages")
            .select("id,thread_id,metadata,created_at")
            .eq("sender_id", userId)
            .eq("kind", "premium");
          const directMessageIds = Array.from(
            new Set((directMessageRows ?? []).map((row) => row.id)),
          );
          const { data: directPurchaseRows } = directMessageIds.length
            ? await supabase
                .from("direct_message_purchases")
                .select("message_id,buyer_user_id,amount,created_at")
                .in("message_id", directMessageIds)
                .order("created_at", { ascending: false })
            : { data: [] };
          const buyerIds = Array.from(
            new Set([
              ...(purchaseRows ?? []).map((row) => row.user_id),
              ...(directPurchaseRows ?? []).map((row) => row.buyer_user_id),
            ]),
          );
          const { data: buyers } = buyerIds.length
            ? await supabase
                .from("users")
                .select("id,username,avatar_url")
                .in("id", buyerIds)
            : { data: [] };
          const buyerMap = new Map((buyers ?? []).map((row) => [row.id, row]));
          const resolveAvatar = (value: string | null) => {
            if (!value) return null;
            if (value.startsWith("http")) return value;
            return supabase.storage.from("Imagenes").getPublicUrl(value).data.publicUrl;
          };
          const grouped = new Map<string, SaleItem>();
          (purchaseRows ?? []).forEach((row) => {
            const post = postMap.get(row.post_id);
            const buyer = buyerMap.get(row.user_id);
            const albumId = post?.album_posts?.[0]?.album_id ?? row.post_id;
            const album = albumMap.get(albumId);
            const groupKey = `${albumId}-${row.user_id}`;
            const current = grouped.get(groupKey);
            const mediaCount = albumCountMap.get(albumId) ?? (post?.media_type ? 1 : 0);
            const type = mediaCount > 1 ? "Album" : post?.media_type === "video" ? "Video" : "Foto";
            const albumMediaRows = Array.isArray(album?.album_posts) ? album.album_posts : [];
            const imageCount =
              albumMediaRows.length > 0
                ? albumMediaRows.filter((item: any) => item?.post?.media_type !== "video").length
                : post?.media_type === "video"
                  ? 0
                  : 1;
            const videoCount =
              albumMediaRows.length > 0
                ? albumMediaRows.filter((item: any) => item?.post?.media_type === "video").length
                : post?.media_type === "video"
                  ? 1
                  : 0;
            const normalizedSaleAmount = Number(album?.price || 0) > 0
              ? Number(album?.price || 0)
              : Number(row.amount || 0);
            const base: SaleItem = current ?? {
              id: groupKey,
              albumId,
              type,
              title: buildSaleContentSummary(imageCount, videoCount),
              href: `/perfil?post=${encodeURIComponent(albumId)}`,
              count: 1,
              total: 0,
              createdAt: row.created_at,
              buyer: {
                id: row.user_id,
                name: buyer?.username ?? "usuario",
                full: buyer?.username ?? "Usuario",
                avatar: resolveAvatar(buyer?.avatar_url ?? null),
              },
            };
            const purchaseAmount = Number(row.amount || 0);
            grouped.set(groupKey, {
              ...base,
              count: 1,
              total: base.total > 0 ? base.total : purchaseAmount > 0 ? normalizedSaleAmount : 0,
            });
          });
          const { data: tipRows } = await supabase
            .from("notifications")
            .select("id,actor_id,message,created_at")
            .eq("user_id", userId)
            .eq("type", "tip")
            .order("created_at", { ascending: false });
          (tipRows ?? []).forEach((row) => {
            const amount = parseTipAmountFromMessage(row.message);
            if (!amount) return;
            const buyer = buyerMap.get(row.actor_id);
            grouped.set(`tip-${row.id}`, {
              id: `tip-${row.id}`,
              albumId: `tip-${row.id}`,
              type: "Propina",
              title: "Propina directa",
              href: undefined,
              count: 1,
              total: amount,
              createdAt: row.created_at,
              buyer: {
                id: row.actor_id,
                name: buyer?.username ?? "usuario",
                full: buyer?.username ?? "Usuario",
                avatar: resolveAvatar(buyer?.avatar_url ?? null),
              },
            });
          });
          const directMessageMap = new Map(
            (directMessageRows ?? []).map((row) => [row.id, row]),
          );
          (directPurchaseRows ?? []).forEach((row) => {
            const message = directMessageMap.get(row.message_id);
            if (!message) return;
            const buyerId = row.buyer_user_id;
            const buyer = buyerMap.get(buyerId);
            const groupKey = `chat-${buyerId}`;
            const current = grouped.get(groupKey);
            const saleAmount = Number(row.amount || 0);
            const fallbackUsername = buyer?.username ?? "usuario";
            const base: SaleItem = current ?? {
              id: groupKey,
              albumId: groupKey,
              type: "Chat",
              title: `Chat con ${fallbackUsername}`,
              href: `/mensajes?user=${encodeURIComponent(fallbackUsername)}`,
              count: 0,
              total: 0,
              createdAt: row.created_at ?? message.created_at,
              buyer: {
                id: buyerId,
                name: fallbackUsername,
                full: buyer?.username ?? "Usuario",
                avatar: resolveAvatar(buyer?.avatar_url ?? null),
              },
            };

            grouped.set(groupKey, {
              ...base,
              title: `Chat con ${fallbackUsername}`,
              href: `/mensajes?user=${encodeURIComponent(fallbackUsername)}`,
              count: base.count + 1,
              total: base.total + saleAmount,
              createdAt:
                (base.createdAt ?? "") > (row.created_at ?? message.created_at ?? "")
                  ? base.createdAt
                  : row.created_at ?? message.created_at,
            });
          });
          const withdrawalRows = await supabase
            .from("notifications")
            .select("id,message,created_at")
            .eq("user_id", userId)
            .eq("type", "withdrawal_request")
            .order("created_at", { ascending: false });
          const withdrawals = (withdrawalRows.data ?? [])
            .map((row) => {
              const parsed = parseWithdrawalRecord(row.message);
              if (!parsed) return null;
              return {
                id: row.id,
                amount: parsed.amount,
                status: parsed.status,
                statusLabel: getWithdrawalStatusLabel(parsed.status),
                requestedAt: row.created_at,
                monthKey: parsed.monthKey,
              };
            })
            .filter(Boolean) as WithdrawalItem[];
          const payoutRow = await supabase
            .from("notifications")
            .select("message")
            .eq("user_id", userId)
            .eq("type", "payout_profile")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const balanceRow = await supabase
            .from("user_balances")
            .select("cash_available,cash_reserved")
            .eq("user_id", userId)
            .maybeSingle();

          const activeReserved = withdrawals.reduce((sum, item) => {
            if (item.status !== "requested") return sum;
            return sum + Number(item.amount || 0);
          }, 0);
          const currentAvailableToWithdraw = Number(balanceRow.data?.cash_available ?? 0);
          const reservedToWithdraw = activeReserved;
          const availableToWithdraw = currentAvailableToWithdraw;

          return {
            data: {
              sales: Array.from(grouped.values()).sort((a, b) =>
                (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
              ),
              withdrawals,
              payoutProfile: parsePayoutProfile(payoutRow.data?.message),
              availableToWithdraw,
              reservedToWithdraw,
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

import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { notificationsApi } from "@/lib/redux/api/notificationsApi";
import { profileApi } from "@/lib/redux/api/profileApi";
import { sessionApi } from "@/lib/redux/api/sessionApi";
import { inferDisplayKind, PUBLIC_MEDIA_BUCKET } from "@/lib/media";
import { parseTipAmountFromMessage } from "@/lib/earnings";
import { parsePayoutProfile, type PayoutProfile } from "@/lib/payouts";
import {
  getCurrentMonthKey,
  getWithdrawalReservedAmount,
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
};

type SaleItem = {
  id: string;
  type: string;
  title: string;
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
};

type SalesResult = {
  sales: SaleItem[];
  withdrawals: WithdrawalItem[];
  payoutProfile: PayoutProfile | null;
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
          const supabase = getSupabaseClient();
          if (!supabase) throw new Error("Falta configurar Supabase.");
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData?.user?.id;
          if (!userId) return { data: { items: [] } };

          const { data: purchaseRows } = await supabase
            .from("purchases")
            .select("id,post_id,amount,status,created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          const postIds = Array.from(new Set((purchaseRows ?? []).map((row) => row.post_id)));
          const { data: postRows } = postIds.length
            ? await supabase
                .from("posts")
                .select("id,user_id,media_url,media_type,is_locked,caption,album_posts(album_id)")
                .in("id", postIds)
            : { data: [] };
          const creatorIds = Array.from(new Set((postRows ?? []).map((row) => row.user_id)));
          const { data: creators } = creatorIds.length
            ? await supabase
                .from("users")
                .select("id,username,avatar_url")
                .in("id", creatorIds)
            : { data: [] };
          const creatorMap = new Map((creators ?? []).map((row) => [row.id, row.username ?? "usuario"]));
          const postMap = new Map((postRows ?? []).map((row) => [row.id, row]));
          const albumIds = Array.from(
            new Set((postRows ?? []).map((row) => row.album_posts?.[0]?.album_id).filter(Boolean) as string[]),
          );
          const { data: albumRows } = albumIds.length
            ? await supabase
                .from("albums")
                .select("id,description,price,album_posts(post_id,post:posts(id,media_url,media_type,is_locked))")
                .in("id", albumIds)
            : { data: [] };
          const albumMap = new Map((albumRows ?? []).map((row) => [row.id, row]));
          const accessToken = await getAccessToken();
          const resolvedAccess = await resolveAccessibleMedia(accessToken, postIds);
          const mapped = new Map<string, PurchaseItem>();

          (purchaseRows ?? []).forEach((row) => {
            const post = postMap.get(row.post_id);
            const albumId = post?.album_posts?.[0]?.album_id ?? row.post_id;
            const album = albumMap.get(albumId);
            const albumCovers = (album?.album_posts ?? [])
              .map((item: any) => (item?.post?.media_url ?? item?.media_url ?? "") as string)
              .filter(Boolean)
              .map((value) => resolvePublicUrl(supabase, value) ?? value);
            const albumMedia = (album?.album_posts ?? [])
              .map((item: any) => {
                const postId = item?.post_id ?? item?.post?.id ?? null;
                const resolved = postId ? resolvedAccess[postId] : null;
                const rawUrl = item?.post?.media_url ?? item?.media_url ?? null;
                return {
                  url: resolved?.url ?? resolvePublicUrl(supabase, rawUrl) ?? "",
                  kind:
                    resolved?.kind ??
                    inferDisplayKind(
                      rawUrl,
                      item?.post?.media_type ?? item?.media_type ?? null,
                      item?.post?.is_locked ?? true,
                    ),
                };
              })
              .filter((item) => item.url);
            const date = new Date(row.created_at).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "short",
            });
            const fallbackCover = resolvePublicUrl(supabase, post?.media_url ?? null) ?? "https://picsum.photos/seed/placeholder/600/600";
            mapped.set(albumId, {
              id: albumId,
              title: album?.description || post?.caption || "Publicación",
              creator: creatorMap.get(post?.user_id ?? "") ?? "usuario",
              date,
              price: album?.price ? Number(album.price) : 0,
              cover: albumCovers[0] ?? fallbackCover,
              covers: albumCovers.length > 0 ? albumCovers : [fallbackCover],
              media:
                albumMedia.length > 0
                  ? albumMedia
                  : [{ url: fallbackCover, kind: "image" as const }],
              status: row.status ?? "Desbloqueado",
            });
          });

          return { data: { items: Array.from(mapped.values()) } };
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
      void
    >({
      async queryFn() {
        try {
          const accessToken = await getAccessToken();
          const response = await fetch("/api/withdrawals/request", {
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
            throw new Error(result.error ?? "No se pudo solicitar el retiro.");
          }
          return { data: { record: result.record } };
        } catch (error) {
          return { error: buildError(error, "No se pudo solicitar el retiro.") };
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
          if (!userId) return { data: { sales: [], withdrawals: [], payoutProfile: null } };

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
          const buyerIds = Array.from(new Set((purchaseRows ?? []).map((row) => row.user_id)));
          const { data: buyers } = buyerIds.length
            ? await supabase
                .from("users")
                .select("id,username,avatar_url")
                .in("id", buyerIds)
            : { data: [] };
          const buyerMap = new Map((buyers ?? []).map((row) => [row.id, row]));
          const postMap = new Map((postRows ?? []).map((row) => [row.id, row]));
          const albumIds = Array.from(
            new Set((postRows ?? []).map((row) => row.album_posts?.[0]?.album_id).filter(Boolean) as string[]),
          );
          const { data: albumRows } = albumIds.length
            ? await supabase.from("albums").select("id,description").in("id", albumIds)
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
            const count = albumCountMap.get(albumId) ?? (post?.media_type ? 1 : 0);
            const type = count > 1 ? "Album" : post?.media_type === "video" ? "Video" : "Foto";
            const base: SaleItem = current ?? {
              id: groupKey,
              type,
              title: album?.description || post?.caption || "Publicación",
              count,
              total: 0,
              createdAt: row.created_at,
              buyer: {
                id: row.user_id,
                name: buyer?.username ?? "usuario",
                full: buyer?.username ?? "Usuario",
                avatar: resolveAvatar(buyer?.avatar_url ?? null),
              },
            };
            grouped.set(groupKey, { ...base, total: base.total + Number(row.amount || 0) });
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
              type: "Propina",
              title: "Propina directa",
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
          return {
            data: {
              sales: Array.from(grouped.values()).sort((a, b) =>
                (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
              ),
              withdrawals,
              payoutProfile: parsePayoutProfile(payoutRow.data?.message),
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
  useGetPurchasesQuery,
  useGetSalesQuery,
  useRequestWithdrawalMutation,
} = commerceApi;

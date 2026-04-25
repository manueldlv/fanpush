import { NextResponse } from "next/server";
import { coercePayoutProfile } from "@/lib/payouts";
import { getPayoutMetaEntries, PAYOUT_META_KEYS } from "@/lib/payoutMeta";
import { resolveTipAmountMap } from "@/lib/earnings";
import { PUBLIC_MEDIA_BUCKET } from "@/lib/media";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { getWithdrawalStatusLabel, type WithdrawalStatus } from "@/lib/withdrawals";

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

const resolvePublicUrl = (
  admin: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["admin"]>,
  value: string | null,
) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return admin.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data.publicUrl;
};

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const userId = user.id;

    const [postRowsResult, directMessageRowsResult, tipRowsResult, withdrawalsResult, balanceResult] =
      await Promise.all([
        admin
          .from("posts")
          .select("id,user_id,media_type,caption,album_posts(album_id)")
          .eq("user_id", userId),
        admin
          .from("direct_messages")
          .select("id,thread_id,metadata,created_at")
          .eq("sender_id", userId)
          .eq("kind", "premium"),
        admin
          .from("notifications")
          .select("id,actor_id,entity_id,message,created_at")
          .eq("user_id", userId)
          .eq("type", "tip")
          .order("created_at", { ascending: false }),
        admin
          .from("withdrawal_requests")
          .select("id,amount,status,requested_at,month_key")
          .eq("user_id", userId)
          .order("requested_at", { ascending: false }),
        admin
          .from("user_balances")
          .select("cash_available,cash_reserved")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

    if (postRowsResult.error) throw new Error(postRowsResult.error.message);
    if (directMessageRowsResult.error) throw new Error(directMessageRowsResult.error.message);
    if (tipRowsResult.error) throw new Error(tipRowsResult.error.message);
    if (withdrawalsResult.error) throw new Error(withdrawalsResult.error.message);
    if (balanceResult.error) throw new Error(balanceResult.error.message);

    const postRows = postRowsResult.data ?? [];
    const postIds = postRows.map((row) => row.id);
    const albumIds = Array.from(
      new Set(postRows.map((row) => row.album_posts?.[0]?.album_id).filter(Boolean) as string[]),
    );
    const directMessageRows = directMessageRowsResult.data ?? [];
    const directMessageIds = Array.from(new Set(directMessageRows.map((row) => row.id)));

    const [
      purchaseRowsResult,
      albumRowsResult,
      albumPostRowsResult,
      directPurchaseRowsResult,
    ] = await Promise.all([
      postIds.length
        ? admin
            .from("purchases")
            .select("id,user_id,post_id,amount,created_at")
            .in("post_id", postIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      albumIds.length
        ? admin
            .from("albums")
            .select("id,description,price,album_posts(post:posts(media_type))")
            .in("id", albumIds)
        : Promise.resolve({ data: [], error: null }),
      albumIds.length
        ? admin.from("album_posts").select("album_id,post_id").in("album_id", albumIds)
        : Promise.resolve({ data: [], error: null }),
      directMessageIds.length
        ? admin
            .from("direct_message_purchases")
            .select("message_id,buyer_user_id,amount,created_at")
            .in("message_id", directMessageIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (purchaseRowsResult.error) throw new Error(purchaseRowsResult.error.message);
    if (albumRowsResult.error) throw new Error(albumRowsResult.error.message);
    if (albumPostRowsResult.error) throw new Error(albumPostRowsResult.error.message);
    if (directPurchaseRowsResult.error) throw new Error(directPurchaseRowsResult.error.message);

    const purchaseRows = purchaseRowsResult.data ?? [];
    const directPurchaseRows = directPurchaseRowsResult.data ?? [];
    const buyerIds = Array.from(
      new Set([
        ...purchaseRows.map((row) => row.user_id),
        ...directPurchaseRows.map((row) => row.buyer_user_id),
        ...(tipRowsResult.data ?? []).map((row) => row.actor_id),
      ]),
    );

    const buyersResult = buyerIds.length
      ? await admin.from("users").select("id,username,avatar_url").in("id", buyerIds)
      : { data: [], error: null };
    if (buyersResult.error) throw new Error(buyersResult.error.message);

    const postMap = new Map(postRows.map((row) => [row.id, row]));
    const albumMap = new Map((albumRowsResult.data ?? []).map((row) => [row.id, row]));
    const directMessageMap = new Map(directMessageRows.map((row) => [row.id, row]));
    const buyerMap = new Map((buyersResult.data ?? []).map((row) => [row.id, row]));
    const albumCountMap = new Map<string, number>();

    (albumPostRowsResult.data ?? []).forEach((row) => {
      albumCountMap.set(row.album_id, (albumCountMap.get(row.album_id) ?? 0) + 1);
    });

    const grouped = new Map<string, SaleItem>();

    purchaseRows.forEach((row) => {
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
      const normalizedSaleAmount =
        Number(album?.price || 0) > 0 ? Number(album?.price || 0) : Number(row.amount || 0);
      const purchaseAmount = Number(row.amount || 0);
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
          avatar: resolvePublicUrl(admin, buyer?.avatar_url ?? null),
        },
      };

      grouped.set(groupKey, {
        ...base,
        count: 1,
        total: base.total > 0 ? base.total : purchaseAmount > 0 ? normalizedSaleAmount : 0,
      });
    });

    const tipAmountMap = await resolveTipAmountMap(admin, tipRowsResult.data ?? []);
    (tipRowsResult.data ?? []).forEach((row) => {
      const amount = Number(tipAmountMap.get(row.id) || 0);
      if (!amount) return;
      const buyer = buyerMap.get(row.actor_id);
      grouped.set(`tip-${row.id}`, {
        id: `tip-${row.id}`,
        albumId: `tip-${row.id}`,
        type: "Propina",
        title: "Propina directa",
        count: 1,
        total: amount,
        createdAt: row.created_at,
        buyer: {
          id: row.actor_id,
          name: buyer?.username ?? "usuario",
          full: buyer?.username ?? "Usuario",
          avatar: resolvePublicUrl(admin, buyer?.avatar_url ?? null),
        },
      });
    });

    directPurchaseRows.forEach((row) => {
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
          avatar: resolvePublicUrl(admin, buyer?.avatar_url ?? null),
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

    const withdrawals: WithdrawalItem[] = (withdrawalsResult.data ?? []).map((row) => {
      const status =
        row.status === "paid"
          ? ("sent" as const)
          : row.status === "rejected" || row.status === "cancelled"
            ? ("rejected" as const)
            : ("requested" as const);
      return {
        id: row.id,
        amount: Number(row.amount || 0),
        status,
        statusLabel: getWithdrawalStatusLabel(status),
        requestedAt: row.requested_at,
        monthKey: row.month_key || "",
      };
    });

    const payoutMetaResult = await getPayoutMetaEntries(admin, userId, [
      PAYOUT_META_KEYS.defaultAccount,
    ]);

    return NextResponse.json({
      sales: Array.from(grouped.values()).sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
      ),
      withdrawals,
      payoutProfile:
        coercePayoutProfile(payoutMetaResult.entries.get(PAYOUT_META_KEYS.defaultAccount)) ??
        null,
      availableToWithdraw: Number(balanceResult.data?.cash_available ?? 0),
      reservedToWithdraw: Number(balanceResult.data?.cash_reserved ?? 0),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudieron cargar las ventas.",
      },
      { status: 500 },
    );
  }
}

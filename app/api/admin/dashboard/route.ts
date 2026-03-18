import { NextResponse } from "next/server";
import { isAdminIdentity } from "@/lib/admin";
import { parseTipAmountFromMessage } from "@/lib/earnings";
import { getAuthenticatedUser } from "@/lib/mercadopago";
import { getWithdrawalStatusLabel, parseWithdrawalRecord } from "@/lib/withdrawals";

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    if (!isAdminIdentity({ email: user.email })) {
      return NextResponse.json({ error: "Solo admins." }, { status: 403 });
    }

    const [
      usersCountResult,
      albumsCountResult,
      postsCountResult,
      purchasesRowsResult,
      tipRowsResult,
      recentPurchasesResult,
      recentAlbumsResult,
      withdrawalRowsResult,
    ] = await Promise.all([
      admin.from("users").select("id", { count: "exact", head: true }),
      admin.from("albums").select("id", { count: "exact", head: true }),
      admin.from("posts").select("id", { count: "exact", head: true }),
      admin
        .from("purchases")
        .select("id, user_id, post_id, amount, created_at")
        .order("created_at", { ascending: false }),
      admin
        .from("notifications")
        .select("id, actor_id, user_id, message, created_at")
        .eq("type", "tip")
        .order("created_at", { ascending: false }),
      admin
        .from("purchases")
        .select("id, user_id, post_id, amount, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("albums")
        .select(
          "id,user_id,description,price,created_at,users(username,avatar_url),album_posts(post_id,post:posts(media_url,media_type))",
        )
        .order("created_at", { ascending: false })
        .limit(30),
      admin
        .from("notifications")
        .select("id,user_id,message,created_at")
        .eq("type", "withdrawal_request")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const buyerIds = Array.from(
      new Set((recentPurchasesResult.data ?? []).map((row) => row.user_id)),
    );
    const purchasePostIds = Array.from(
      new Set((recentPurchasesResult.data ?? []).map((row) => row.post_id)),
    );
    const albumUserIds = Array.from(
      new Set((recentAlbumsResult.data ?? []).map((row) => row.user_id)),
    );
    const tipActorIds = Array.from(
      new Set((tipRowsResult.data ?? []).map((row) => row.actor_id)),
    );
    const withdrawalUserIds = Array.from(
      new Set((withdrawalRowsResult.data ?? []).map((row) => row.user_id)),
    );

    const actorAndBuyerIds = Array.from(
      new Set([...buyerIds, ...albumUserIds, ...tipActorIds, ...withdrawalUserIds]),
    );

    const [{ data: usersRows }, { data: postOwnerRows }] = await Promise.all([
      actorAndBuyerIds.length
        ? admin
            .from("users")
            .select("id, username, avatar_url")
            .in("id", actorAndBuyerIds)
        : Promise.resolve({ data: [] }),
      purchasePostIds.length
        ? admin.from("posts").select("id, user_id").in("id", purchasePostIds)
        : Promise.resolve({ data: [] }),
    ]);

    const userMap = new Map((usersRows ?? []).map((row) => [row.id, row]));
    const postOwnerMap = new Map(
      (postOwnerRows ?? []).map((row) => [row.id, row.user_id]),
    );

    const purchaseGross = (purchasesRowsResult.data ?? []).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0,
    );
    const tipGross = (tipRowsResult.data ?? []).reduce(
      (sum, row) => sum + parseTipAmountFromMessage(row.message),
      0,
    );

    const recentPurchases = (recentPurchasesResult.data ?? []).map((row) => {
      const buyer = userMap.get(row.user_id);
      const sellerId = postOwnerMap.get(row.post_id);
      const seller = sellerId ? userMap.get(sellerId) : null;
      return {
        id: row.id,
        amount: Number(row.amount || 0),
        createdAt: row.created_at,
        buyer: buyer?.username ?? "usuario",
        seller: seller?.username ?? "usuario",
      };
    });

    const resolveAvatar = (value: string | null) => {
      if (!value) return null;
      if (value.startsWith("http")) return value;
      return admin.storage.from("Imagenes").getPublicUrl(value).data.publicUrl;
    };

    const content = (recentAlbumsResult.data ?? []).map((album) => {
      const albumUser = Array.isArray(album.users) ? album.users[0] : album.users;
      const firstLink = Array.isArray(album.album_posts)
        ? album.album_posts[0]
        : null;
      const firstPost =
        firstLink && firstLink.post
          ? Array.isArray(firstLink.post)
            ? firstLink.post[0]
            : firstLink.post
          : null;
      return {
        id: album.id,
        description: album.description ?? "",
        price: Number(album.price || 0),
        createdAt: album.created_at,
        username: albumUser?.username ?? "usuario",
        avatar: resolveAvatar(albumUser?.avatar_url ?? null),
        mediaUrl: resolveAvatar(firstPost?.media_url ?? null),
        mediaType: firstPost?.media_type ?? "image",
        itemsCount: Array.isArray(album.album_posts) ? album.album_posts.length : 0,
      };
    });

    return NextResponse.json({
      metrics: {
        users: usersCountResult.count ?? 0,
        albums: albumsCountResult.count ?? 0,
        posts: postsCountResult.count ?? 0,
        purchases: (purchasesRowsResult.data ?? []).length,
        purchaseGross,
        tipGross,
        totalGross: purchaseGross + tipGross,
      },
      commerce: {
        recentPurchases,
        recentTips: (tipRowsResult.data ?? []).slice(0, 20).map((row) => ({
          id: row.id,
          amount: parseTipAmountFromMessage(row.message),
          actor: userMap.get(row.actor_id)?.username ?? "usuario",
          receiver: userMap.get(row.user_id)?.username ?? "usuario",
          createdAt: row.created_at,
        })),
        withdrawals: (withdrawalRowsResult.data ?? [])
          .map((row) => {
            const parsed = parseWithdrawalRecord(row.message);
            if (!parsed) return null;
            return {
              id: row.id,
              username: userMap.get(row.user_id)?.username ?? "usuario",
              amount: parsed.amount,
              status: parsed.status,
              statusLabel: getWithdrawalStatusLabel(parsed.status),
              createdAt: row.created_at,
            };
          })
          .filter(Boolean),
      },
      content,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el panel admin.",
      },
      { status: 500 },
    );
  }
}

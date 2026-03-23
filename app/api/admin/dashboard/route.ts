import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { parseTipAmountFromMessage } from "@/lib/earnings";
import { getAuthenticatedUser } from "@/lib/mercadopago";
import { parsePayoutProfile } from "@/lib/payouts";
import {
  parseModerationAction,
  parseContentReport,
} from "@/lib/reports";
import { parseModerationArchive } from "@/lib/moderation";
import {
  parseAuthorApplication,
  parseAuthorApplicationHistory,
} from "@/lib/authorApplications";
import {
  getWithdrawalStatusLabel,
  parseWithdrawalHistory,
  parseWithdrawalRecord,
} from "@/lib/withdrawals";

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    if (!(await isAdminUser(admin, user))) {
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
      payoutRowsResult,
      reportRowsResult,
      authorApplicationRowsResult,
      authorApplicationHistoryRowsResult,
      moderationHistoryRowsResult,
      withdrawalHistoryRowsResult,
      moderationArchiveRowsResult,
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
      admin
        .from("notifications")
        .select("user_id,message,created_at")
        .eq("type", "payout_profile")
        .order("created_at", { ascending: false }),
      admin
        .from("notifications")
        .select("id,user_id,actor_id,entity_id,message,created_at")
        .eq("type", "content_report")
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("notifications")
        .select("id,user_id,actor_id,message,created_at")
        .eq("type", "author_application")
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("notifications")
        .select("id,user_id,actor_id,entity_id,message,created_at")
        .eq("type", "author_application_history")
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("notifications")
        .select("id,actor_id,entity_id,message,created_at")
        .eq("type", "moderation_action")
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("notifications")
        .select("id,actor_id,entity_id,message,created_at")
        .eq("type", "withdrawal_history")
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("notifications")
        .select("id,user_id,entity_id,message,created_at")
        .eq("type", "moderation_archive")
        .order("created_at", { ascending: false })
        .limit(100),
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
    const reportActorIds = Array.from(
      new Set((reportRowsResult.data ?? []).map((row) => row.actor_id)),
    );
    const authorApplicantIds = Array.from(
      new Set((authorApplicationRowsResult.data ?? []).map((row) => row.user_id)),
    );
    const authorHistoryActorIds = Array.from(
      new Set(
        (authorApplicationHistoryRowsResult.data ?? []).map((row) => row.actor_id),
      ),
    );

    const actorAndBuyerIds = Array.from(
      new Set([
        ...buyerIds,
        ...albumUserIds,
        ...tipActorIds,
        ...withdrawalUserIds,
        ...reportActorIds,
        ...authorApplicantIds,
        ...authorHistoryActorIds,
        ...(moderationHistoryRowsResult.data ?? []).map((row) => row.actor_id),
        ...(withdrawalHistoryRowsResult.data ?? []).map((row) => row.actor_id),
        ...(moderationArchiveRowsResult.data ?? []).map((row) => row.user_id),
      ]),
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
    const payoutMap = new Map(
      (payoutRowsResult.data ?? [])
        .map((row) => [row.user_id, parsePayoutProfile(row.message)] as const)
        .filter((entry) => Boolean(entry[1])),
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
        media: Array.isArray(album.album_posts)
          ? album.album_posts
              .map((link) => {
                const post = Array.isArray(link.post) ? link.post[0] : link.post;
                if (!post?.media_url) return null;
                return {
                  url: resolveAvatar(post.media_url ?? null),
                  type: post.media_type ?? "image",
                };
              })
              .filter(Boolean)
          : [],
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
        creatorsNet: (purchaseGross + tipGross) * 0.7,
        platformFee: (purchaseGross + tipGross) * 0.3,
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
            const payoutProfile = payoutMap.get(row.user_id);
            return {
              id: row.id,
              username: userMap.get(row.user_id)?.username ?? "usuario",
              amount: parsed.amount,
              status: parsed.status,
              statusLabel: getWithdrawalStatusLabel(parsed.status),
              createdAt: row.created_at,
              payoutAlias: payoutProfile?.alias ?? null,
              payoutHolder: payoutProfile?.holderName ?? null,
              payoutDocument: payoutProfile?.holderDocument ?? null,
            };
          })
          .filter((item) => item?.status === "requested")
          .filter(Boolean),
        reports: (reportRowsResult.data ?? [])
          .map((row) => {
            const parsed = parseContentReport(row.message);
            if (!parsed) return null;
            return {
              id: row.id,
              albumId: parsed.albumId,
              reason: parsed.reason,
              createdAt: row.created_at,
              reportedBy: userMap.get(row.actor_id)?.username ?? "usuario",
              owner: userMap.get(row.user_id)?.username ?? "usuario",
              status: parsed.status ?? "open",
              archived: parsed.archived ?? false,
            };
          })
          .filter(Boolean),
        authorApplications: (authorApplicationRowsResult.data ?? [])
          .map((row) => {
            const parsed = parseAuthorApplication(row.message);
            if (!parsed) return null;
            return {
              id: row.id,
              username: userMap.get(row.user_id)?.username ?? "usuario",
              fullName: parsed.fullName,
              birthDate: parsed.birthDate,
              documentType: parsed.documentType,
              documentNumber: parsed.documentNumber,
              country: parsed.country,
              province: parsed.province,
              city: parsed.city,
              address: parsed.address,
              documentFrontUrl: parsed.documentFrontUrl,
              documentBackUrl: parsed.documentBackUrl,
              status: parsed.status,
              submittedAt: parsed.submittedAt,
              archived: parsed.archived ?? false,
            };
          })
          .filter(Boolean),
        authorApplicationHistory: (authorApplicationHistoryRowsResult.data ?? [])
          .map((row) => {
            const parsed = parseAuthorApplicationHistory(row.message);
            if (!parsed) return null;
            return {
              id: row.id,
              applicationId: parsed.applicationId,
              action: parsed.action,
              reason: parsed.reason ?? "",
              actedAt: row.created_at,
              actor: userMap.get(row.actor_id)?.username ?? "admin",
            };
          })
          .filter(Boolean),
        reportHistory: (moderationHistoryRowsResult.data ?? [])
          .map((row) => {
            const parsed = parseModerationAction(row.message);
            if (!parsed) return null;
            return {
              id: row.id,
              reportId: parsed.reportId,
              albumId: parsed.albumId,
              action: parsed.action,
              reason: parsed.reason ?? "",
              actedAt: row.created_at,
              actor: userMap.get(row.actor_id)?.username ?? "admin",
            };
          })
          .filter(Boolean),
        archivedContent: (moderationArchiveRowsResult.data ?? [])
          .map((row) => {
            const parsed = parseModerationArchive(row.message);
            if (!parsed) return null;
            return {
              id: row.id,
              albumId: parsed.album.id,
              owner: userMap.get(parsed.album.user_id)?.username ?? "usuario",
              description: parsed.album.description ?? "Sin descripción",
              itemsCount: parsed.posts.length,
              archivedAt: parsed.archivedAt,
            };
          })
          .filter(Boolean),
        withdrawalHistory: (withdrawalHistoryRowsResult.data ?? [])
          .map((row) => {
            const parsed = parseWithdrawalHistory(row.message);
            if (!parsed) return null;
            return {
              id: row.id,
              withdrawalId: parsed.withdrawalId,
              status: parsed.status,
              statusLabel: getWithdrawalStatusLabel(parsed.status),
              amount: parsed.amount,
              actedAt: row.created_at,
              actor: userMap.get(row.actor_id)?.username ?? "admin",
              reason: parsed.reason ?? "",
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

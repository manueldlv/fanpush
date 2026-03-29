import { NextResponse } from "next/server";
import { parseTipAmountFromMessage } from "@/lib/earnings";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import {
  buildPremiumMediaPath,
  parseLockedPreviewPath,
  PREMIUM_MEDIA_BUCKET,
  PUBLIC_MEDIA_BUCKET,
} from "@/lib/media";
import { parsePayoutProfile } from "@/lib/payouts";
import {
  parseModerationAction,
  parseContentReport,
} from "@/lib/reports";
import {
  parseModerationArchive,
  parseModerationContentState,
} from "@/lib/moderation";
import {
  parseAuthorApplication,
  parseAuthorApplicationHistory,
} from "@/lib/authorApplications";
import {
  getWithdrawalStatusLabel,
  parseWithdrawalHistory,
  parseWithdrawalRecord,
} from "@/lib/withdrawals";
import {
  coerceUserCommissionProfile,
  getCreatorShareFromProfile,
  parseUserCommissionProfile,
} from "@/lib/userCommission";

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await requireAdminAccess(
      request,
      "admin.dashboard.read",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
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
      moderationStateRowsResult,
      allUsersRowsResult,
      profilesRowsResult,
      followsRowsResult,
      allAlbumsResult,
      commissionRowsResult,
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
          "id,user_id,description,price,created_at,users(username,avatar_url),album_posts(post_id,post:posts(id,media_url,media_type,is_locked,caption,created_at,likes_count))",
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
      admin
        .from("notifications")
        .select("id,user_id,entity_id,message,created_at")
        .eq("type", "moderation_content_state")
        .order("created_at", { ascending: false })
        .limit(200),
      admin.from("users").select("id,username,avatar_url,created_at"),
      admin.from("profiles").select("id,full_name,email,created_at"),
      admin.from("follows").select("follower_id,following_id"),
      admin
        .from("albums")
        .select(
          "id,user_id,description,price,created_at,album_posts(post_id,post:posts(id,media_url,media_type,is_locked,caption,created_at,likes_count))",
        )
        .order("created_at", { ascending: false }),
      admin
        .from("user_commission_profiles")
        .select("user_id,creator_share_rate,platform_share_rate,created_at")
        .order("created_at", { ascending: false }),
    ]);

    const purchasePostIds = Array.from(
      new Set((purchasesRowsResult.data ?? []).map((row) => row.post_id)),
    );

    const [{ data: postOwnerRows }] = await Promise.all([
      purchasePostIds.length
        ? admin.from("posts").select("id, user_id").in("id", purchasePostIds)
        : Promise.resolve({ data: [] as Array<{ id: string; user_id: string }> }),
    ]);

    const allUsersRows = allUsersRowsResult.data ?? [];
    const userMap = new Map(allUsersRows.map((row) => [row.id, row]));
    const profileMap = new Map(
      (profilesRowsResult.data ?? []).map((row) => [row.id, row]),
    );
    const postOwnerMap = new Map(
      (postOwnerRows ?? []).map((row) => [row.id, row.user_id]),
    );
    const payoutMap = new Map(
      (payoutRowsResult.data ?? [])
        .map((row) => [row.user_id, parsePayoutProfile(row.message)] as const)
        .filter((entry) => Boolean(entry[1])),
    );
    const commissionMap = new Map(
      (commissionRowsResult.data ?? [])
        .map(
          (row) =>
            [
              row.user_id,
              coerceUserCommissionProfile({
                id: "",
                creator_share_rate: row.creator_share_rate,
                platform_share_rate: row.platform_share_rate,
                created_at: row.created_at,
              }),
            ] as const,
        )
        .filter((entry) => Boolean(entry[1])),
    );

    const follows = followsRowsResult.data ?? [];
    const allAlbums = allAlbumsResult.data ?? [];
    const allPurchases = purchasesRowsResult.data ?? [];
    const allTips = tipRowsResult.data ?? [];
    const authorApplications = (authorApplicationRowsResult.data ?? [])
      .map((row) => ({
        userId: row.user_id,
        parsed: parseAuthorApplication(row.message),
        createdAt: row.created_at,
      }))
      .filter((entry) => Boolean(entry.parsed));

    const authorStatusMap = new Map<string, "pending" | "approved" | "rejected">();
    authorApplications.forEach((entry) => {
      if (!entry.parsed) return;
      if (!authorStatusMap.has(entry.userId)) {
        authorStatusMap.set(entry.userId, entry.parsed.status);
      }
    });

    const salesByUser = new Map<
      string,
      { purchasesGross: number; tipsGross: number }
    >();
    const addSales = (userId: string, purchaseAmount = 0, tipAmount = 0) => {
      const current = salesByUser.get(userId) ?? { purchasesGross: 0, tipsGross: 0 };
      current.purchasesGross += purchaseAmount;
      current.tipsGross += tipAmount;
      salesByUser.set(userId, current);
    };

    allPurchases.forEach((row) => {
      const ownerId = postOwnerMap.get(row.post_id);
      if (!ownerId) return;
      addSales(ownerId, Number(row.amount || 0), 0);
    });

    allTips.forEach((row) => {
      addSales(row.user_id, 0, parseTipAmountFromMessage(row.message));
    });

    const resolveAvatar = (value: string | null) => {
      if (!value) return null;
      if (value.startsWith("http")) return value;
      return admin.storage.from("Imagenes").getPublicUrl(value).data.publicUrl;
    };

    const resolveModerationMediaUrl = async ({
      value,
      ownerUserId,
      isLocked,
      fallbackKind,
    }: {
      value: string | null;
      ownerUserId: string;
      isLocked?: boolean | null;
      fallbackKind?: string | null;
    }) => {
      if (!value) return null;
      if (value.startsWith("http")) return value;

      if (isLocked) {
        const parsed = parseLockedPreviewPath(value);
        if (parsed) {
          const premiumPath = buildPremiumMediaPath(
            ownerUserId,
            parsed.token,
            parsed.originalExt,
          );
          const { data } = await admin.storage
            .from(PREMIUM_MEDIA_BUCKET)
            .createSignedUrl(premiumPath, 60 * 30);
          if (data?.signedUrl) return data.signedUrl;
        }
      }

      const bucket =
        value.startsWith("premium/") || fallbackKind === "premium"
          ? PREMIUM_MEDIA_BUCKET
          : PUBLIC_MEDIA_BUCKET;
      if (bucket === PREMIUM_MEDIA_BUCKET) {
        const { data } = await admin.storage
          .from(PREMIUM_MEDIA_BUCKET)
          .createSignedUrl(value, 60 * 30);
        return data?.signedUrl ?? null;
      }
      return admin.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data.publicUrl;
    };

    const latestContentStateByAlbum = new Map<
      string,
      ReturnType<typeof parseModerationContentState>
    >();
    for (const row of moderationStateRowsResult.data ?? []) {
      const parsed = parseModerationContentState(row.message);
      if (!parsed || latestContentStateByAlbum.has(parsed.albumId)) continue;
      latestContentStateByAlbum.set(parsed.albumId, parsed);
    }

    const usersDetailed = allUsersRows
      .map((row) => {
        const profile = profileMap.get(row.id);
        const authoredAlbums = allAlbums.filter((album) => album.user_id === row.id);
        const followers = follows
          .filter((follow) => follow.following_id === row.id)
          .map((follow) => {
            const follower = userMap.get(follow.follower_id);
            return {
              id: follow.follower_id,
              username: follower?.username ?? "usuario",
              avatar: follower?.avatar_url
                ? resolveAvatar(follower.avatar_url)
                : null,
            };
          });
        const following = follows
          .filter((follow) => follow.follower_id === row.id)
          .map((follow) => {
            const followed = userMap.get(follow.following_id);
            return {
              id: follow.following_id,
              username: followed?.username ?? "usuario",
              avatar: followed?.avatar_url
                ? resolveAvatar(followed.avatar_url)
                : null,
            };
          });

        const commissionProfile = commissionMap.get(row.id) ?? null;
        const creatorShare = getCreatorShareFromProfile(commissionProfile);
        const grosses = salesByUser.get(row.id) ?? { purchasesGross: 0, tipsGross: 0 };
        const totalGross = grosses.purchasesGross + grosses.tipsGross;
        const creatorNet = totalGross * creatorShare;
        const platformFee = totalGross - creatorNet;
        const authorStatus = authorStatusMap.get(row.id) ?? "idle";

        return {
          id: row.id,
          username: row.username ?? "usuario",
          avatar: row.avatar_url ? resolveAvatar(row.avatar_url) : null,
          fullName: profile?.full_name ?? "",
          email: profile?.email ?? "",
          createdAt: profile?.created_at ?? null,
          role: authorStatus === "approved" ? "author" : "user",
          authorStatus,
          followersCount: followers.length,
          followingCount: following.length,
          followers,
          following,
          commissionPercent: Math.round(creatorShare * 100),
          salesGross: totalGross,
          creatorNet,
          platformFee,
          tipsGross: grosses.tipsGross,
          purchasesGross: grosses.purchasesGross,
          posts: authoredAlbums.map((album) => {
            const media = Array.isArray(album.album_posts)
              ? album.album_posts
                  .map((link) => {
                    const post = Array.isArray(link.post) ? link.post[0] : link.post;
                    if (!post) return null;
                    return {
                      id: post.id ?? link.post_id,
                      url: post.media_url ? resolveAvatar(post.media_url) : null,
                      type: post.media_type ?? "image",
                      caption: post.caption ?? "",
                      isLocked: Boolean(post.is_locked || Number(album.price || 0) > 0),
                      createdAt: post.created_at ?? album.created_at,
                      likesCount: Number(post.likes_count || 0),
                    };
                  })
                  .filter(Boolean)
              : [];

            return {
              id: album.id,
              description: album.description ?? "",
              price: Number(album.price || 0),
              createdAt: album.created_at,
              visibility: Number(album.price || 0) > 0 ? "private" : "public",
              itemsCount: media.length,
              likesCount: media.reduce(
                (sum, item) => sum + Number(item?.likesCount || 0),
                0,
              ),
              media,
            };
          }),
        };
      })
      .sort((a, b) => a.username.localeCompare(b.username));

    const totalCreatorsNet = usersDetailed.reduce(
      (sum, item) => sum + item.creatorNet,
      0,
    );
    const totalPlatformFee = usersDetailed.reduce(
      (sum, item) => sum + item.platformFee,
      0,
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

    const content = await Promise.all((recentAlbumsResult.data ?? []).map(async (album) => {
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
      const moderationState = latestContentStateByAlbum.get(album.id);
      return {
        id: album.id,
        description: album.description ?? "",
        price: Number(album.price || 0),
        createdAt: album.created_at,
        username: albumUser?.username ?? "usuario",
        avatar: resolveAvatar(albumUser?.avatar_url ?? null),
        mediaUrl: await resolveModerationMediaUrl({
          value: firstPost?.media_url ?? null,
          ownerUserId: album.user_id,
          isLocked: firstPost?.is_locked ?? Number(album.price || 0) > 0,
        }),
        mediaType: firstPost?.media_type ?? "image",
        itemsCount: Array.isArray(album.album_posts) ? album.album_posts.length : 0,
        moderationState: moderationState?.action ?? null,
        media: Array.isArray(album.album_posts)
          ? (
              await Promise.all(
                album.album_posts.map(async (link) => {
                const post = Array.isArray(link.post) ? link.post[0] : link.post;
                if (!post?.media_url) return null;
                return {
                  id: post.id ?? link.post_id,
                  url: await resolveModerationMediaUrl({
                    value: post.media_url ?? null,
                    ownerUserId: album.user_id,
                    isLocked: post.is_locked ?? Number(album.price || 0) > 0,
                  }),
                  type: post.media_type ?? "image",
                  caption: post.caption ?? "",
                  isLocked: Boolean(post.is_locked ?? Number(album.price || 0) > 0),
                  createdAt: post.created_at ?? album.created_at,
                };
                }),
              )
            ).filter(Boolean)
          : [],
      };
    }));

    return NextResponse.json({
      metrics: {
        users: usersCountResult.count ?? 0,
        albums: albumsCountResult.count ?? 0,
        posts: postsCountResult.count ?? 0,
        purchases: (purchasesRowsResult.data ?? []).length,
        purchaseGross,
        tipGross,
        totalGross: purchaseGross + tipGross,
        creatorsNet: totalCreatorsNet,
        platformFee: totalPlatformFee,
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
        users: usersDetailed,
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

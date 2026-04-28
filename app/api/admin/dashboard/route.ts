import { NextResponse } from "next/server";
import { coerceAccountState } from "@/lib/accountState";
import { isAuthorPromotionsSchemaMissingError } from "@/lib/authorPromotions";
import { PAYOUT_META_KEYS } from "@/lib/payoutMeta";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import { hasPermission } from "@/lib/server/auth/roles";
import {
  buildPremiumMediaPath,
  parseLockedPreviewPath,
  PREMIUM_MEDIA_BUCKET,
  PUBLIC_MEDIA_BUCKET,
} from "@/lib/media";
import { parsePayoutProfile } from "@/lib/payouts";
import { coercePayoutProfile } from "@/lib/payouts";
import { parseUploadModerationMeta } from "@/lib/contentClassification";
import { parseModerationAction, parseContentReport } from "@/lib/reports";
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
} from "@/lib/withdrawals";
import {
  coerceUserCommissionProfile,
  getCreatorShareFromProfile,
  parseUserCommissionProfile,
} from "@/lib/userCommission";
import {
  getPlatformShareForReferralCount,
  getReferralTier,
} from "@/lib/referrals";
import { USER_META_KEYS } from "@/lib/userMeta";

const DASHBOARD_USER_LIMIT = 500;
const DASHBOARD_CONTENT_LIMIT = 500;
const DASHBOARD_RELATION_LIMIT = 5000;
const DASHBOARD_FINANCE_EVENT_LIMIT = 5000;

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
      canManageRoles,
      canViewFinance,
      canReviewAuthors,
      canModerateContent,
      canManageCommissions,
    ] = await Promise.all([
      hasPermission(admin, user, "roles.manage"),
      hasPermission(admin, user, "withdrawals.review"),
      hasPermission(admin, user, "authors.review"),
      hasPermission(admin, user, "content.moderate"),
      hasPermission(admin, user, "commissions.manage"),
    ]);

    const [
      usersCountResult,
      albumsCountResult,
      postsCountResult,
      purchasesRowsResult,
      tipRowsResult,
      recentPurchasesResult,
      recentAlbumsResult,
      withdrawalRowsResult,
      payoutMetaRowsResult,
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
      userMetaRowsResult,
      allAlbumsResult,
      commissionRowsResult,
      userReferralsRowsResult,
      authorPromotionsRowsResult,
    ] = await Promise.all([
      admin.from("users").select("id", { count: "exact", head: true }),
      admin.from("albums").select("id", { count: "exact", head: true }),
      admin.from("posts").select("id", { count: "exact", head: true }),
      canViewFinance
        ? admin
        .from("purchases")
        .select("id, user_id, post_id, amount, created_at")
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_FINANCE_EVENT_LIMIT)
        : Promise.resolve({ data: [], error: null }),
      canViewFinance
        ? admin
        .from("ledger_transactions")
        .select("id,buyer_user_id,recipient_user_id,transaction_amount,created_at")
        .eq("kind", "tip")
        .in("status", ["approved", "settled"])
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_FINANCE_EVENT_LIMIT)
        : Promise.resolve({ data: [], error: null }),
      canViewFinance
        ? admin
        .from("purchases")
        .select("id, user_id, post_id, amount, created_at")
        .order("created_at", { ascending: false })
        .limit(20)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("albums")
        .select(
          "id,user_id,description,price,created_at,users(username,avatar_url),album_posts(post_id,post:posts(id,media_url,media_type,is_locked,caption,created_at,likes_count))",
        )
        .order("created_at", { ascending: false })
        .limit(30),
      canViewFinance
        ? admin
        .from("withdrawal_requests")
        .select("id,user_id,amount,status,requested_at,month_key")
        .order("requested_at", { ascending: false })
        .limit(30)
        : Promise.resolve({ data: [], error: null }),
      canViewFinance
        ? admin
        .from("payouts_meta")
        .select("user_id,meta_key,meta_value,updated_at")
        .limit(DASHBOARD_USER_LIMIT)
        : Promise.resolve({ data: [], error: null }),
      canModerateContent
        ? admin
        .from("notifications")
        .select("id,user_id,actor_id,entity_id,message,created_at")
        .eq("type", "content_report")
        .order("created_at", { ascending: false })
        .limit(50)
        : Promise.resolve({ data: [], error: null }),
      canReviewAuthors
        ? admin
        .from("notifications")
        .select("id,user_id,actor_id,message,created_at")
        .eq("type", "author_application")
        .order("created_at", { ascending: false })
        .limit(100)
        : Promise.resolve({ data: [], error: null }),
      canReviewAuthors
        ? admin
        .from("notifications")
        .select("id,user_id,actor_id,entity_id,message,created_at")
        .eq("type", "author_application_history")
        .order("created_at", { ascending: false })
        .limit(100)
        : Promise.resolve({ data: [], error: null }),
      canModerateContent
        ? admin
        .from("notifications")
        .select("id,actor_id,entity_id,message,created_at")
        .eq("type", "moderation_action")
        .order("created_at", { ascending: false })
        .limit(100)
        : Promise.resolve({ data: [], error: null }),
      canViewFinance
        ? admin
        .from("withdrawal_requests")
        .select("id,user_id,amount,status,reviewed_at,reviewed_by,notes")
        .in("status", ["paid", "rejected", "cancelled"])
        .order("reviewed_at", { ascending: false })
        .limit(100)
        : Promise.resolve({ data: [], error: null }),
      canModerateContent
        ? admin
        .from("notifications")
        .select("id,user_id,entity_id,message,created_at")
        .eq("type", "moderation_archive")
        .order("created_at", { ascending: false })
        .limit(100)
        : Promise.resolve({ data: [], error: null }),
      canModerateContent
        ? admin
        .from("notifications")
        .select("id,user_id,entity_id,message,created_at")
        .eq("type", "moderation_content_state")
        .order("created_at", { ascending: false })
        .limit(200)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("users")
        .select("id,username,avatar_url,created_at")
        .limit(DASHBOARD_USER_LIMIT),
      admin
        .from("profiles")
        .select("id,full_name,email,created_at")
        .limit(DASHBOARD_USER_LIMIT),
      admin
        .from("follows")
        .select("follower_id,following_id")
        .limit(DASHBOARD_RELATION_LIMIT),
      admin
        .from("user_meta")
        .select("user_id,meta_key,meta_value")
        .eq("meta_key", USER_META_KEYS.accountState)
        .limit(DASHBOARD_USER_LIMIT),
      admin
        .from("albums")
        .select(
          "id,user_id,description,price,created_at,album_posts(post_id,post:posts(id,media_url,media_type,is_locked,caption,created_at,likes_count))",
        )
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_CONTENT_LIMIT),
      canManageCommissions
        ? admin
        .from("user_commission_profiles")
        .select(
          "user_id,creator_share_rate,platform_share_rate,created_at,reason,updated_by,expires_at",
        )
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_USER_LIMIT)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("user_referrals")
        .select("referrer_user_id,referred_user_id,created_at")
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_RELATION_LIMIT),
      admin
        .from("author_promotions")
        .select(
          "user_id,is_active,promote_in_feed,feed_rank,promote_in_suggestions,suggestions_rank,promote_in_explore,explore_rank,note,updated_at,expires_at",
        )
        .limit(DASHBOARD_USER_LIMIT),
    ]);

    const purchasePostIds = Array.from(
      new Set((purchasesRowsResult.data ?? []).map((row) => row.post_id)),
    );

    const [{ data: postOwnerRows }] = await Promise.all([
      purchasePostIds.length
        ? admin.from("posts").select("id, user_id").in("id", purchasePostIds)
        : Promise.resolve({
            data: [] as Array<{ id: string; user_id: string }>,
          }),
    ]);

    const allUsersRows = allUsersRowsResult.data ?? [];
    const userMap = new Map(allUsersRows.map((row) => [row.id, row]));
    const profileMap = new Map(
      (profilesRowsResult.data ?? []).map((row) => [row.id, row]),
    );
    const postOwnerMap = new Map(
      (postOwnerRows ?? []).map((row) => [row.id, row.user_id]),
    );
    const payoutMetaMap = new Map(
      (payoutMetaRowsResult.data ?? [])
        .filter((row) => row.meta_key === PAYOUT_META_KEYS.defaultAccount)
        .map(
          (row) => [row.user_id, coercePayoutProfile(row.meta_value)] as const,
        )
        .filter((entry) => Boolean(entry[1])),
    );
    const referralRows = userReferralsRowsResult.data ?? [];
    const referralsByUser = new Map<
      string,
      Array<{
        referredUserId: string;
        createdAt: string | null;
      }>
    >();
    referralRows.forEach((row) => {
      const current = referralsByUser.get(row.referrer_user_id) ?? [];
      current.push({
        referredUserId: row.referred_user_id,
        createdAt: row.created_at ?? null,
      });
      referralsByUser.set(row.referrer_user_id, current);
    });
    const commissionMap = new Map<
      string,
      NonNullable<ReturnType<typeof coerceUserCommissionProfile>>
    >();
    for (const row of commissionRowsResult.data ?? []) {
      if (commissionMap.has(row.user_id)) continue;
      const profile = coerceUserCommissionProfile({
        id: "",
        creator_share_rate: row.creator_share_rate,
        platform_share_rate: row.platform_share_rate,
        created_at: row.created_at,
        reason: row.reason,
        updated_by: row.updated_by,
        expires_at: row.expires_at,
      });
      if (profile) {
        commissionMap.set(row.user_id, profile);
      }
    }
    const authorPromotionRows = isAuthorPromotionsSchemaMissingError(
      authorPromotionsRowsResult.error,
    )
      ? []
      : (authorPromotionsRowsResult.data ?? []);
    const authorPromotionMap = new Map(
      authorPromotionRows.map((row) => [
        row.user_id,
        (() => {
          const expiresAt = row.expires_at ?? null;
          const isExpired =
            typeof expiresAt === "string" &&
            Number.isFinite(new Date(expiresAt).getTime()) &&
            new Date(expiresAt).getTime() <= Date.now();
          return {
          isActive: (row.is_active ?? true) && !isExpired,
          promoteInFeed: row.promote_in_feed ?? false,
          feedRank: Number(row.feed_rank ?? 9999),
          promoteInSuggestions: row.promote_in_suggestions ?? false,
          suggestionsRank: Number(row.suggestions_rank ?? 9999),
          promoteInExplore: row.promote_in_explore ?? false,
          exploreRank: Number(row.explore_rank ?? 9999),
          note: typeof row.note === "string" ? row.note : "",
          updatedAt: row.updated_at ?? null,
          expiresAt,
        };
        })(),
      ]),
    );

    const follows = followsRowsResult.data ?? [];
    const accountStateMap = new Map(
      (userMetaRowsResult.data ?? []).map((row) => [
        row.user_id,
        coerceAccountState(row.meta_value),
      ]),
    );
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

    const authorStatusMap = new Map<
      string,
      "pending" | "approved" | "rejected"
    >();
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
    const spendingByUser = new Map<
      string,
      { purchaseSpend: number; tipsSent: number; spendingPlatformFee: number }
    >();
    let purchaseGrossTotal = 0;
    let tipGrossTotal = 0;
    let purchasePlatformFeeTotal = 0;
    let tipPlatformFeeTotal = 0;
    const addSales = (userId: string, purchaseAmount = 0, tipAmount = 0) => {
      const current = salesByUser.get(userId) ?? {
        purchasesGross: 0,
        tipsGross: 0,
      };
      current.purchasesGross += purchaseAmount;
      current.tipsGross += tipAmount;
      salesByUser.set(userId, current);
    };
    const addSpending = (
      userId: string,
      purchaseAmount = 0,
      tipAmount = 0,
      platformFeeAmount = 0,
    ) => {
      const current = spendingByUser.get(userId) ?? {
        purchaseSpend: 0,
        tipsSent: 0,
        spendingPlatformFee: 0,
      };
      current.purchaseSpend += purchaseAmount;
      current.tipsSent += tipAmount;
      current.spendingPlatformFee += platformFeeAmount;
      spendingByUser.set(userId, current);
    };

    allPurchases.forEach((row) => {
      const ownerId = postOwnerMap.get(row.post_id);
      if (!ownerId) return;
      const amount = Number(row.amount || 0);
      const commissionProfile = commissionMap.get(ownerId) ?? null;
      const creatorShare = getCreatorShareFromProfile(commissionProfile);
      const platformFee = amount - amount * creatorShare;
      addSales(ownerId, amount, 0);
      addSpending(row.user_id, amount, 0, platformFee);
      purchaseGrossTotal += amount;
      purchasePlatformFeeTotal += platformFee;
    });

    allTips.forEach((row) => {
      const amount = Number(row.transaction_amount || 0);
      const commissionProfile = commissionMap.get(row.recipient_user_id) ?? null;
      const creatorShare = getCreatorShareFromProfile(commissionProfile);
      const platformFee = amount - amount * creatorShare;
      addSales(row.recipient_user_id, 0, amount);
      addSpending(row.buyer_user_id, 0, amount, platformFee);
      tipGrossTotal += amount;
      tipPlatformFeeTotal += platformFee;
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
      return admin.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data
        .publicUrl;
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
        const authoredAlbums = allAlbums.filter(
          (album) => album.user_id === row.id,
        );
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
        const grosses = salesByUser.get(row.id) ?? {
          purchasesGross: 0,
          tipsGross: 0,
        };
        const spending = spendingByUser.get(row.id) ?? {
          purchaseSpend: 0,
          tipsSent: 0,
          spendingPlatformFee: 0,
        };
        const totalGross = grosses.purchasesGross + grosses.tipsGross;
        const creatorNet = totalGross * creatorShare;
        const platformFee = totalGross - creatorNet;
        const authorStatus = authorStatusMap.get(row.id) ?? "idle";
        const latestAuthorApplication =
          authorApplications.find((entry) => entry.userId === row.id)?.parsed ??
          null;
        const accountState = accountStateMap.get(row.id);
        const referralEntries = referralsByUser.get(row.id) ?? [];
        const referralCount = referralEntries.length;
        const referralTier = getReferralTier(referralCount);
        const promotion = authorPromotionMap.get(row.id) ?? {
          isActive: false,
          promoteInFeed: false,
          feedRank: 9999,
          promoteInSuggestions: false,
          suggestionsRank: 9999,
          promoteInExplore: false,
          exploreRank: 9999,
          note: "",
          updatedAt: null,
        };
        const referralCreatorSharePercent = Math.round(creatorShare * 100);
        const referralPlatformSharePercent = commissionProfile
          ? Math.round((commissionProfile.platformShare ?? 0.3) * 100)
          : Math.round(getPlatformShareForReferralCount(referralCount) * 100);
        const referrals = referralEntries
          .map((entry) => {
            const referredUser = userMap.get(entry.referredUserId);
            const referredProfile = profileMap.get(entry.referredUserId);
            return {
              id: entry.referredUserId,
              username: referredUser?.username ?? "usuario",
              avatar: referredUser?.avatar_url
                ? resolveAvatar(referredUser.avatar_url)
                : null,
              fullName: referredProfile?.full_name ?? "",
              referredAt: entry.createdAt,
            };
          })
          .sort((a, b) =>
            (b.referredAt ?? "").localeCompare(a.referredAt ?? ""),
          );

        return {
          id: row.id,
          username: row.username ?? "usuario",
          avatar: row.avatar_url ? resolveAvatar(row.avatar_url) : null,
          fullName: profile?.full_name ?? "",
          email: profile?.email ?? "",
          createdAt: profile?.created_at ?? null,
          role: authorStatus === "approved" ? "author" : "user",
          authorStatus,
          authorApplication: latestAuthorApplication,
          followersCount: followers.length,
          followingCount: following.length,
          followers,
          following,
          referralsCount: referralCount,
          referrals,
          referralTierLabel: referralTier.label,
          badges: accountState?.badges ?? [],
          promotion,
          referralCreatorSharePercent,
          referralPlatformSharePercent,
          commissionPercent: Math.round(creatorShare * 100),
          commissionExpiresAt: commissionProfile?.expiresAt ?? null,
          salesGross: totalGross,
          creatorNet,
          platformFee,
          tipsGross: grosses.tipsGross,
          purchasesGross: grosses.purchasesGross,
          purchaseSpend: spending.purchaseSpend,
          tipsSent: spending.tipsSent,
          totalSpent: spending.purchaseSpend + spending.tipsSent,
          spendingPlatformFee: spending.spendingPlatformFee,
          posts: authoredAlbums.map((album) => {
            const media = Array.isArray(album.album_posts)
              ? album.album_posts
                  .map((link) => {
                    const post = Array.isArray(link.post)
                      ? link.post[0]
                      : link.post;
                    if (!post) return null;
                    return {
                      id: post.id ?? link.post_id,
                      url: post.media_url
                        ? resolveAvatar(post.media_url)
                        : null,
                      type: post.media_type ?? "image",
                      caption: post.caption ?? "",
                      isLocked: Boolean(
                        post.is_locked || Number(album.price || 0) > 0,
                      ),
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

    const authorsCount = usersDetailed.filter(
      (item) => item.role === "author",
    ).length;

    const totalCreatorsNet = usersDetailed.reduce(
      (sum, item) => sum + item.creatorNet,
      0,
    );
    const totalPlatformFee = usersDetailed.reduce(
      (sum, item) => sum + item.platformFee,
      0,
    );

    const purchaseGross = purchaseGrossTotal;
    const tipGross = tipGrossTotal;

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

    const content = await Promise.all(
      (recentAlbumsResult.data ?? []).map(async (album) => {
        const albumUser = Array.isArray(album.users)
          ? album.users[0]
          : album.users;
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
        const moderationMeta = parseUploadModerationMeta(
          firstPost?.caption ?? null,
        );
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
          itemsCount: Array.isArray(album.album_posts)
            ? album.album_posts.length
            : 0,
          moderationState: moderationState?.action ?? null,
          contentAudience: moderationMeta?.contentAudience ?? "general",
          moderationCategory: moderationMeta?.moderationCategory ?? "otro",
          moderationTags: moderationMeta?.tags ?? [],
          media: Array.isArray(album.album_posts)
            ? (
                await Promise.all(
                  album.album_posts.map(async (link) => {
                    const post = Array.isArray(link.post)
                      ? link.post[0]
                      : link.post;
                    if (!post?.media_url) return null;
                    return {
                      id: post.id ?? link.post_id,
                      url: await resolveModerationMediaUrl({
                        value: post.media_url ?? null,
                        ownerUserId: album.user_id,
                        isLocked:
                          post.is_locked ?? Number(album.price || 0) > 0,
                      }),
                      type: post.media_type ?? "image",
                      caption: post.caption ?? "",
                      isLocked: Boolean(
                        post.is_locked ?? Number(album.price || 0) > 0,
                      ),
                      createdAt: post.created_at ?? album.created_at,
                    };
                  }),
                )
              ).filter(Boolean)
            : [],
        };
      }),
    );

    return NextResponse.json({
      viewerAccess: {
        canManageRoles,
        canViewFinance,
        canReviewAuthors,
        canModerateContent,
        canManageCommissions,
      },
      metrics: {
        users: usersCountResult.count ?? 0,
        authors: authorsCount,
        albums: albumsCountResult.count ?? 0,
        posts: postsCountResult.count ?? 0,
        purchases: (purchasesRowsResult.data ?? []).length,
        purchaseGross,
        tipGross,
        totalGross: purchaseGross + tipGross,
        creatorsNet: totalCreatorsNet,
        platformFee: totalPlatformFee,
        purchasePlatformFee: purchasePlatformFeeTotal,
        tipPlatformFee: tipPlatformFeeTotal,
      },
      commerce: {
        recentPurchases,
        recentTips: (tipRowsResult.data ?? []).slice(0, 20).map((row) => ({
          id: row.id,
          amount: Number(row.transaction_amount || 0),
          actor: userMap.get(row.buyer_user_id)?.username ?? "usuario",
          receiver: userMap.get(row.recipient_user_id)?.username ?? "usuario",
          createdAt: row.created_at,
        })),
        withdrawals: (withdrawalRowsResult.data ?? [])
          .map((row) => {
            const payoutProfile = payoutMetaMap.get(row.user_id);
            const status =
              row.status === "paid"
                ? ("sent" as const)
                : row.status === "rejected" || row.status === "cancelled"
                  ? ("rejected" as const)
                  : ("requested" as const);
            return {
              id: row.id,
              username: userMap.get(row.user_id)?.username ?? "usuario",
              amount: Number(row.amount || 0),
              status,
              statusLabel: getWithdrawalStatusLabel(status),
              createdAt: row.requested_at,
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
        authorApplicationHistory: (
          authorApplicationHistoryRowsResult.data ?? []
        )
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
            const status =
              row.status === "paid"
                ? ("sent" as const)
                : ("rejected" as const);
            return {
              id: row.id,
              withdrawalId: row.id,
              status,
              statusLabel: getWithdrawalStatusLabel(status),
              amount: Number(row.amount || 0),
              actedAt: row.reviewed_at ?? "",
              actor: userMap.get(row.reviewed_by ?? "")?.username ?? "admin",
              reason: row.status === "paid" ? "" : row.notes ?? "",
            };
          })
          .filter((item) => Boolean(item.actedAt)),
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

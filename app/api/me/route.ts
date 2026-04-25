import { NextResponse } from "next/server";
import { getAuthorApplicationForUser } from "@/lib/authorApplications";
import {
  canAccessFinanceWhileBlocked,
  coerceAccountState,
} from "@/lib/accountState";
import { loadCreatorEarnings } from "@/lib/earnings";
import { getPayoutMetaEntries, PAYOUT_META_KEYS } from "@/lib/payoutMeta";
import { coercePayoutProfile, parsePayoutProfile } from "@/lib/payouts";
import {
  coerceProfileDetails,
  parseProfileDetails,
} from "@/lib/profileDetails";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { getUserAccessSnapshot } from "@/lib/server/auth/roles";
import { ensureLegacyCreatorBalanceBaseline } from "@/lib/server/repositories/ledger";
import { getUserMetaEntries, USER_META_KEYS } from "@/lib/userMeta";

const resolvePublicImageUrl = (
  admin: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["admin"]>,
  value?: string | null,
) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return admin.storage.from("Imagenes").getPublicUrl(value).data.publicUrl;
};

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: 401 },
      );
    }

    const [
      { data: userRow, error: userRowError },
      { data: profileRow, error: profileRowError },
      userMetaResult,
      payoutMetaResult,
      accessSnapshot,
      earnings,
      balanceSnapshot,
      application,
    ] = await Promise.all([
      admin
        .from("users")
        .select("id,username,avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("id,full_name,email")
        .eq("id", user.id)
        .maybeSingle(),
      getUserMetaEntries(admin, user.id, [
        USER_META_KEYS.profileDetails,
        USER_META_KEYS.payoutProfile,
        USER_META_KEYS.accountState,
      ]),
      getPayoutMetaEntries(admin, user.id, [PAYOUT_META_KEYS.defaultAccount]),
      getUserAccessSnapshot(admin, user),
      loadCreatorEarnings(admin, user.id),
      ensureLegacyCreatorBalanceBaseline(admin, user.id),
      getAuthorApplicationForUser(admin, user.id),
    ]);

    if (userRowError) {
      throw new Error(`No se pudo leer el usuario: ${userRowError.message}`);
    }
    if (profileRowError) {
      throw new Error(`No se pudo leer el perfil: ${profileRowError.message}`);
    }
    const profileDetails = coerceProfileDetails(
      userMetaResult.entries.get(USER_META_KEYS.profileDetails),
    );
    const payoutProfile =
      coercePayoutProfile(
        payoutMetaResult.entries.get(PAYOUT_META_KEYS.defaultAccount),
      ) ??
      coercePayoutProfile(
        userMetaResult.entries.get(USER_META_KEYS.payoutProfile),
      );
    const accountState = coerceAccountState(
      userMetaResult.entries.get(USER_META_KEYS.accountState),
    );
    const authorStatus = application?.record?.status ?? "idle";
    const permissions = Array.from(new Set(accessSnapshot.permissions));
    const roles = Array.from(new Set(accessSnapshot.roles));
    const isAuthor =
      authorStatus === "approved" ||
      roles.includes("author") ||
      permissions.includes("content.create");
    const canCreate = isAuthor && !accountState.isBlocked;
    const canWithdraw =
      (isAuthor || permissions.includes("withdrawals.request")) &&
      (!accountState.isBlocked || canAccessFinanceWhileBlocked(accountState));
    const canAccessAdmin =
      accessSnapshot.isAdmin || permissions.includes("admin.access");
    const cashAvailable = balanceSnapshot?.cashAvailable ?? 0;
    const cashPending = balanceSnapshot?.cashPending ?? 0;
    const cashReserved = balanceSnapshot?.cashReserved ?? 0;
    const bonusAvailable = balanceSnapshot?.bonusAvailable ?? 0;
    const availableBalance = cashAvailable + bonusAvailable;

    return NextResponse.json({
      auth: {
        isAuthenticated: true,
        userId: user.id,
        email: user.email ?? null,
      },
      viewer: {
        profile: {
          username: userRow?.username ?? null,
          avatarUrl: resolvePublicImageUrl(admin, userRow?.avatar_url ?? null),
          fullName: profileRow?.full_name ?? "",
          bio: profileDetails?.bio ?? "",
          website: profileDetails?.website ?? "",
          instagram: profileDetails?.instagram ?? "",
          badges: accountState.badges,
          isVerified: accountState.isVerified,
          isFeatured: accountState.isFeatured,
        },
        access: {
          roles,
          permissions,
          authorStatus,
          isAuthor,
          isBlocked: accountState.isBlocked,
          blockedReason: accountState.blockedReason,
          kycLevel: accountState.kycLevel,
          isAdmin: canAccessAdmin,
          canCreate,
          canWithdraw,
          canAccessAdmin,
        },
        commerce: {
          balance: availableBalance,
          cashAvailable,
          cashPending,
          cashReserved,
          bonusAvailable,
          lifetimeDeposited: balanceSnapshot?.lifetimeDeposited ?? 0,
          lifetimeEarned: balanceSnapshot?.lifetimeEarned ?? 0,
          lifetimeWithdrawn: balanceSnapshot?.lifetimeWithdrawn ?? 0,
          creatorShare: earnings.creatorShare,
          platformFee: earnings.platformFee,
          payoutProfile,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo cargar /api/me.",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { getAuthorApplicationForUser } from "@/lib/authorApplications";
import { coerceAccountState } from "@/lib/accountState";
import { loadCreatorEarnings } from "@/lib/earnings";
import { coercePayoutProfile, parsePayoutProfile } from "@/lib/payouts";
import { coerceProfileDetails, parseProfileDetails } from "@/lib/profileDetails";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { getUserAccessSnapshot } from "@/lib/server/auth/roles";
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
      { data: profileMetaRow, error: profileMetaError },
      { data: payoutRow, error: payoutError },
      userMetaResult,
      accessSnapshot,
      earnings,
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
      admin
        .from("notifications")
        .select("message")
        .eq("user_id", user.id)
        .eq("type", "profile_meta")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("notifications")
        .select("message")
        .eq("user_id", user.id)
        .eq("type", "payout_profile")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getUserMetaEntries(admin, user.id, [
        USER_META_KEYS.profileDetails,
        USER_META_KEYS.payoutProfile,
        USER_META_KEYS.accountState,
      ]),
      getUserAccessSnapshot(admin, user),
      loadCreatorEarnings(admin, user.id),
      getAuthorApplicationForUser(admin, user.id),
    ]);

    if (userRowError) {
      throw new Error(`No se pudo leer el usuario: ${userRowError.message}`);
    }
    if (profileRowError) {
      throw new Error(`No se pudo leer el perfil: ${profileRowError.message}`);
    }
    if (profileMetaError) {
      throw new Error(`No se pudo leer el detalle del perfil: ${profileMetaError.message}`);
    }
    if (payoutError) {
      throw new Error(`No se pudo leer el perfil de cobro: ${payoutError.message}`);
    }

    const profileDetails =
      coerceProfileDetails(userMetaResult.entries.get(USER_META_KEYS.profileDetails)) ??
      parseProfileDetails(profileMetaRow?.message);
    const payoutProfile =
      coercePayoutProfile(userMetaResult.entries.get(USER_META_KEYS.payoutProfile)) ??
      parsePayoutProfile(payoutRow?.message);
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
      !accountState.isBlocked;
    const canAccessAdmin =
      accessSnapshot.isAdmin || permissions.includes("admin.access");

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
          balance: earnings.creatorNet,
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

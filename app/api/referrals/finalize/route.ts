import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import {
  getCreatorShareForReferralCount,
  getPlatformShareForReferralCount,
  getReferralTier,
  normalizeReferralCode,
} from "@/lib/referrals";
import { getLatestUserCommissionProfile } from "@/lib/userCommission";

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error ? 401 : 500 },
      );
    }

    const referralCode = normalizeReferralCode(
      typeof user.user_metadata?.referral_code === "string"
        ? user.user_metadata.referral_code
        : "",
    );

    if (!referralCode) {
      return NextResponse.json({ ok: true, finalized: false });
    }

    const { data: referrerRow, error: referrerError } = await admin
      .from("users")
      .select("id, username")
      .eq("username", referralCode)
      .maybeSingle();

    if (referrerError) {
      throw new Error(referrerError.message);
    }

    if (!referrerRow?.id || referrerRow.id === user.id) {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          referral_code: null,
        },
      });
      return NextResponse.json({ ok: true, finalized: false });
    }

    const { error: insertError } = await admin.from("user_referrals").upsert(
      {
        referrer_user_id: referrerRow.id,
        referred_user_id: user.id,
        referral_code: referralCode,
      },
      { onConflict: "referred_user_id" },
    );

    if (insertError) {
      throw new Error(insertError.message);
    }

    const { count: referralsCount, error: countError } = await admin
      .from("user_referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", referrerRow.id);

    if (countError) {
      throw new Error(countError.message);
    }

    const referralTotal = referralsCount ?? 0;
    const nextCreatorShare = getCreatorShareForReferralCount(referralTotal);
    const nextPlatformShare = getPlatformShareForReferralCount(referralTotal);
    const latestCommission = await getLatestUserCommissionProfile(admin, referrerRow.id);
    const currentCreatorShare = latestCommission?.record?.creatorShare ?? 0.7;
    const currentPlatformShare = latestCommission?.record?.platformShare ?? 0.3;

    if (
      Math.abs(currentCreatorShare - nextCreatorShare) > 0.00001 ||
      Math.abs(currentPlatformShare - nextPlatformShare) > 0.00001
    ) {
      const tier = getReferralTier(referralTotal);
      const { error: commissionError } = await admin
        .from("user_commission_profiles")
        .insert({
          user_id: referrerRow.id,
          creator_share_rate: nextCreatorShare,
          platform_share_rate: nextPlatformShare,
          reason: `referrals_tier_upgrade:${tier.label}:${referralTotal}`,
          updated_by: user.id,
        });

      if (commissionError) {
        throw new Error(commissionError.message);
      }
    }

    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        referral_code: null,
      },
    });

    return NextResponse.json({
      ok: true,
      finalized: true,
      referrerId: referrerRow.id,
      referralsCount: referralTotal,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo finalizar el referido.",
      },
      { status: 500 },
    );
  }
}

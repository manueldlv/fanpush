import { NextResponse } from "next/server";
import { coerceAccountState } from "@/lib/accountState";
import { resolveBadgeSlugs } from "@/lib/badges";
import { loadCreatorEarnings } from "@/lib/earnings";
import { getAdminSupabase } from "@/lib/server/auth/session";
import { ensureLegacyCreatorBalanceBaseline } from "@/lib/server/repositories/ledger";
import { getUserMetaEntries, USER_META_KEYS } from "@/lib/userMeta";

export async function GET(request: Request) {
  try {
    const admin = getAdminSupabase();
    if (!admin) {
      return NextResponse.json(
        { error: "No se pudo inicializar el cliente admin." },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim();

    if (!userId) {
      return NextResponse.json({ error: "Falta userId." }, { status: 400 });
    }

    const [userMetaResult, referralCountResult, authorPromotionResult, balanceSnapshot, earnings] =
      await Promise.all([
        getUserMetaEntries(admin, userId, [USER_META_KEYS.accountState]),
        admin
          .from("user_referrals")
          .select("referred_user_id", { count: "exact", head: true })
          .eq("referrer_user_id", userId),
        admin
          .from("author_promotions")
          .select(
            "user_id,is_active,promote_in_feed,promote_in_suggestions,promote_in_explore",
          )
          .eq("user_id", userId)
          .maybeSingle(),
        ensureLegacyCreatorBalanceBaseline(admin, userId),
        loadCreatorEarnings(admin, userId),
      ]);

    const accountState = coerceAccountState(
      userMetaResult.entries.get(USER_META_KEYS.accountState),
    );
    const promotionRow = authorPromotionResult.data;
    const hasActivePromotion = Boolean(
      promotionRow &&
        promotionRow.is_active !== false &&
        (promotionRow.promote_in_feed ||
          promotionRow.promote_in_suggestions ||
          promotionRow.promote_in_explore),
    );

    const badges = resolveBadgeSlugs({
      persistedBadges: accountState.badges,
      lifetimeEarnedArs: balanceSnapshot?.lifetimeEarned ?? earnings.creatorNet,
      referralCount: referralCountResult.count ?? 0,
      hasActivePromotion,
      isFeatured: accountState.isFeatured,
    });

    return NextResponse.json({ badges });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron calcular las badges del perfil.",
      },
      { status: 500 },
    );
  }
}

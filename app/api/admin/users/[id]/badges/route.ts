import { NextResponse } from "next/server";
import { coerceAccountState } from "@/lib/accountState";
import { recordAdminAction } from "@/lib/server/admin/audit";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import { getUserMetaEntries, upsertUserMetaValue, USER_META_KEYS } from "@/lib/userMeta";

type BadgesBody = {
  badges?: string[];
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await requireAdminAccess(request, "admin.access");
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const userId = params.id?.trim();
    if (!userId) {
      return NextResponse.json({ error: "Falta el usuario." }, { status: 400 });
    }

    const body = (await request.json()) as BadgesBody;
    const nextBadges = Array.isArray(body.badges)
      ? Array.from(
          new Set(
            body.badges.filter(
              (badge): badge is string => typeof badge === "string" && badge.trim().length > 0,
            ),
          ),
        )
      : [];

    const userMetaResult = await getUserMetaEntries(admin, userId, [USER_META_KEYS.accountState]);
    const accountState = coerceAccountState(
      userMetaResult.entries.get(USER_META_KEYS.accountState),
    );

    await upsertUserMetaValue(admin, userId, USER_META_KEYS.accountState, {
      ...accountState,
      badges: nextBadges,
      updatedAt: new Date().toISOString(),
    });

    await recordAdminAction({
      admin,
      actorUserId: user.id,
      actionType: "user.badges.updated",
      targetType: "user",
      targetId: userId,
      summary: `Actualizo badges manuales del usuario ${userId}.`,
      metadata: {
        badges: nextBadges,
      },
    });

    return NextResponse.json({
      ok: true,
      badges: nextBadges,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron guardar las badges del usuario.",
      },
      { status: 500 },
    );
  }
}

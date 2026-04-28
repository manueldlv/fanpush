import { NextResponse } from "next/server";
import { normalizeAuthorPromotionsError } from "@/lib/authorPromotions";
import { recordAdminAction } from "@/lib/server/admin/audit";
import { requireAdminAccess } from "@/lib/server/auth/authorization";

type PromotionBody = {
  isActive?: boolean;
  promoteInFeed?: boolean;
  feedRank?: number;
  promoteInSuggestions?: boolean;
  suggestionsRank?: number;
  promoteInExplore?: boolean;
  exploreRank?: number;
  note?: string;
  durationDays?: number | null;
};

const normalizeRank = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 9999;
  return Math.max(0, Math.min(Math.round(numeric), 9999));
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
      return NextResponse.json(
        { error: "Falta el usuario." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as PromotionBody;
    const durationDays =
      body.durationDays == null || body.durationDays === ""
        ? null
        : Number(body.durationDays);
    if (
      durationDays != null &&
      (!Number.isFinite(durationDays) || durationDays <= 0)
    ) {
      return NextResponse.json(
        { error: "La duración debe ser un número mayor a 0 días." },
        { status: 400 },
      );
    }

    const expiresAt =
      durationDays != null
        ? new Date(
            Date.now() + Math.round(durationDays) * 24 * 60 * 60 * 1000,
          ).toISOString()
        : null;

    const payload = {
      user_id: userId,
      is_active: body.isActive !== false,
      promote_in_feed: body.promoteInFeed === true,
      feed_rank: normalizeRank(body.feedRank),
      promote_in_suggestions: body.promoteInSuggestions === true,
      suggestions_rank: normalizeRank(body.suggestionsRank),
      promote_in_explore: body.promoteInExplore === true,
      explore_rank: normalizeRank(body.exploreRank),
      note: typeof body.note === "string" ? body.note.trim() : "",
      expires_at: expiresAt,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await admin
      .from("author_promotions")
      .upsert(payload, { onConflict: "user_id" });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    await recordAdminAction({
      admin,
      actorUserId: user.id,
      actionType: "promotion.updated",
      targetType: "user",
      targetId: userId,
      summary: `Actualizo promocion del autor ${userId}.`,
      metadata: {
        isActive: payload.is_active,
        promoteInFeed: payload.promote_in_feed,
        feedRank: payload.feed_rank,
        promoteInSuggestions: payload.promote_in_suggestions,
        suggestionsRank: payload.suggestions_rank,
        promoteInExplore: payload.promote_in_explore,
        exploreRank: payload.explore_rank,
        note: payload.note,
        durationDays,
        expiresAt,
      },
    });

    return NextResponse.json({
      ok: true,
      promotion: {
        isActive: payload.is_active,
        promoteInFeed: payload.promote_in_feed,
        feedRank: payload.feed_rank,
        promoteInSuggestions: payload.promote_in_suggestions,
        suggestionsRank: payload.suggestions_rank,
        promoteInExplore: payload.promote_in_explore,
        exploreRank: payload.explore_rank,
        note: payload.note,
        expiresAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: normalizeAuthorPromotionsError(
          error,
          "No se pudo guardar la promoción del autor.",
        ),
      },
      { status: 500 },
    );
  }
}

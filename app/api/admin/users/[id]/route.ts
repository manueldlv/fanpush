import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import { serializeUserCommissionProfile } from "@/lib/userCommission";

type UpdateBody = {
  creatorShare?: number;
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await requireAdminAccess(
      request,
      "commissions.manage",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const body = (await request.json()) as UpdateBody;
    const creatorShare = Number(body.creatorShare);
    if (Number.isNaN(creatorShare) || creatorShare < 0 || creatorShare > 1) {
      return NextResponse.json(
        { error: "El porcentaje del creador debe estar entre 0% y 100%." },
        { status: 400 },
      );
    }

    const { data: targetUser } = await admin
      .from("users")
      .select("id")
      .eq("id", params.id)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });
    }

    const profile = {
      creatorShare,
      platformShare: 1 - creatorShare,
      updatedAt: new Date().toISOString(),
    };

    const { error: insertError } = await admin.from("notifications").insert({
      user_id: params.id,
      actor_id: user.id,
      entity_id: params.id,
      type: "user_commission_profile",
      message: serializeUserCommissionProfile(profile),
      is_read: true,
    });

    if (insertError) {
      throw new Error(`No se pudo guardar la comisión: ${insertError.message}`);
    }

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la comisión del usuario.",
      },
      { status: 500 },
    );
  }
}

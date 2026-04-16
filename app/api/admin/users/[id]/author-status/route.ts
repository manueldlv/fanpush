import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import { revokeRoleByCode } from "@/lib/server/auth/roles";
import {
  createAuthorApplicationHistory,
  getAuthorApplicationByUserId,
  notifyAuthorApplicationUpdate,
  updateAuthorApplicationRecord,
} from "@/lib/server/repositories/author-applications";
import { createOrAppendAdminNotificationThread } from "@/lib/server/repositories/notification-center";

const DEMOTE_MESSAGE =
  "un administrador removió tu acceso como autor. Si quieres volver a vender contenido, tendrás que enviar una nueva solicitud con tu documentación.";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await requireAdminAccess(
      request,
      "authors.review",
    );

    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const { data: targetUser } = await admin
      .from("users")
      .select("id,username")
      .eq("id", params.id)
      .maybeSingle();

    if (!targetUser?.id) {
      return NextResponse.json(
        { error: "No se encontró el usuario." },
        { status: 404 },
      );
    }

    const application = await getAuthorApplicationByUserId(admin, params.id);

    if (application?.id && application.record) {
      await updateAuthorApplicationRecord({
        admin,
        id: application.id,
        record: {
          ...application.record,
          status: "rejected",
          archived: false,
        },
        markUnread: true,
      });

      await createAuthorApplicationHistory({
        admin,
        userId: params.id,
        actorId: user.id,
        applicationId: application.id,
        action: "rejected",
        reason: "Acceso de autor revocado por administración.",
      });

      await createOrAppendAdminNotificationThread({
        admin,
        userId: params.id,
        actorId: user.id,
        topic: "author_application",
        subject: "Solicitud de autor",
        body: DEMOTE_MESSAGE,
        sourceType: "author_application",
        sourceId: application.id,
        allowUserReply: true,
      });

      await notifyAuthorApplicationUpdate({
        admin,
        userId: params.id,
        actorId: user.id,
        applicationId: application.id,
        message: DEMOTE_MESSAGE,
      });
    }

    await revokeRoleByCode(admin, params.id, "author");

    return NextResponse.json({
      ok: true,
      role: "user",
      authorStatus: "rejected",
      applicationId: application?.id ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo quitar el acceso de autor.",
      },
      { status: 500 },
    );
  }
}

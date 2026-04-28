import { NextResponse } from "next/server";
import { recordAdminAction } from "@/lib/server/admin/audit";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import {
  createModerationAction,
  createModerationArchive,
  createModerationContentState,
  deleteAlbumCascade,
  getAlbumById,
  getAlbumModerationBundle,
  listContentReportsByAlbumId,
  notifyContentRemoved,
  updateContentReportRecord,
} from "@/lib/server/repositories/moderation";
import { createOrAppendAdminNotificationThread } from "@/lib/server/repositories/notification-center";

type DeleteBody = {
  reason?: string;
};

type ReviewBody = {
  action?: "approved" | "archived";
};

export async function DELETE(
  request: Request,
  { params }: { params: { albumId: string } },
) {
  try {
    const { admin, user, error } = await requireAdminAccess(
      request,
      "content.moderate",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const { albumId } = params;
    const body = (await request.json().catch(() => ({}))) as DeleteBody;
    const reason = body.reason?.trim() || "Incumple las políticas de FanPush.";
    const bundle = await getAlbumModerationBundle(admin, albumId);
    if (!bundle) {
      return NextResponse.json({ error: "No se encontró el contenido." }, { status: 404 });
    }

    const reports = await listContentReportsByAlbumId(admin, albumId);

    if (reports.length > 0) {
      await Promise.all(
        reports.map((row) =>
          updateContentReportRecord({
            admin,
            id: row.id,
            record: {
              ...row.record,
              status: "removed",
            },
          }),
        ),
      );
    }

    await createModerationArchive({
      admin,
      userId: bundle.album.user_id,
      actorId: user.id,
      record: {
        album: bundle.album,
        posts: bundle.posts,
        archivedAt: new Date().toISOString(),
      },
    });

    await deleteAlbumCascade({
      admin,
      albumId,
      postIds: bundle.postIds,
    });

    await Promise.all(
      (reports.length > 0
        ? reports.map((row) => row.id)
        : [`delete-${bundle.album.id}`]
      ).map((reportId) =>
        createModerationAction({
          admin,
          userId: bundle.album.user_id,
          actorId: user.id,
          albumId: bundle.album.id,
          reportId,
          action: "removed",
          reason,
        }),
      ),
    );

    await createOrAppendAdminNotificationThread({
      admin,
      userId: bundle.album.user_id,
      actorId: user.id,
      topic: "moderation",
      subject: "Moderación de contenido",
      body: `Tu publicación fue removida. Motivo: ${reason}`,
      sourceType: "moderation_album",
      sourceId: bundle.album.id,
      allowUserReply: true,
    });

    await notifyContentRemoved({
      admin,
      userId: bundle.album.user_id,
      actorId: user.id,
      albumId: bundle.album.id,
      message: `eliminó una de tus publicaciones. Motivo: ${reason}`,
    });

    await recordAdminAction({
      admin,
      actorUserId: user.id,
      actionType: "content.removed",
      targetType: "album",
      targetId: bundle.album.id,
      summary: `Elimino contenido ${bundle.album.id}.`,
      metadata: {
        ownerUserId: bundle.album.user_id,
        reason,
        reportsAffected: reports.map((row) => row.id),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar el contenido.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { albumId: string } },
) {
  try {
    const { admin, user, error } = await requireAdminAccess(
      request,
      "content.moderate",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const { albumId } = params;
    const body = (await request.json().catch(() => ({}))) as ReviewBody;
    const action = body.action === "archived" ? "archived" : "approved";

    const album = await getAlbumById(admin, albumId);
    if (!album) {
      return NextResponse.json({ error: "No se encontró el contenido." }, { status: 404 });
    }

    const reportRows = (await listContentReportsByAlbumId(admin, albumId)).filter(
      (row) => (row.record.status ?? "open") === "open" && !row.record.archived,
    );

    if (reportRows.length > 0) {
      await Promise.all(
        reportRows.map((row) =>
          updateContentReportRecord({
            admin,
            id: row.id,
            record: {
              ...row.record,
              status: action === "approved" ? "reviewed" : "dismissed",
            },
          }),
        ),
      );
    }

    await createModerationContentState({
      admin,
      userId: album.user_id,
      actorId: user.id,
      record: {
        albumId,
        action,
        actedAt: new Date().toISOString(),
        actorId: user.id,
      },
    });

    if (reportRows.length > 0) {
      await Promise.all(
        reportRows.map((row) =>
          createModerationAction({
            admin,
            userId: album.user_id,
            actorId: user.id,
            albumId,
            reportId: row.id,
            action: action === "approved" ? "reviewed" : "dismissed",
            reason:
              action === "approved"
                ? "Contenido aprobado y mantenido en el sitio."
                : "Contenido archivado como revisión completa.",
          }),
        ),
      );
    }

    await recordAdminAction({
      admin,
      actorUserId: user.id,
      actionType: "content.reviewed",
      targetType: "album",
      targetId: albumId,
      summary: `Marco contenido ${albumId} como ${action}.`,
      metadata: {
        action,
        ownerUserId: album.user_id,
        reportsAffected: reportRows.map((row) => row.id),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el estado del contenido.",
      },
      { status: 500 },
    );
  }
}

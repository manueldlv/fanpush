import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import {
  createModerationAction,
  getAlbumById,
  getModerationArchiveById,
  restoreModerationArchive,
} from "@/lib/server/repositories/moderation";

export async function POST(
  request: Request,
  { params }: { params: { archiveId: string } },
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

    const archive = await getModerationArchiveById(admin, params.archiveId);
    if (!archive) {
      return NextResponse.json(
        { error: "No se encontró el archivo de moderación." },
        { status: 404 },
      );
    }

    const existingAlbum = await getAlbumById(admin, archive.record.album.id);
    if (existingAlbum) {
      return NextResponse.json(
        { error: "Ese contenido ya fue restablecido." },
        { status: 409 },
      );
    }

    await restoreModerationArchive({
      admin,
      record: archive.record,
    });

    await createModerationAction({
      admin,
      userId: archive.record.album.user_id,
      actorId: user.id,
      albumId: archive.record.album.id,
      reportId: `restore-${archive.record.album.id}`,
      action: "reviewed",
      reason: "Contenido restablecido desde historial de moderación",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo restablecer el contenido.",
      },
      { status: 500 },
    );
  }
}

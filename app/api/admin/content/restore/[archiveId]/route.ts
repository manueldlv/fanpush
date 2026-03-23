import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { parseModerationArchive } from "@/lib/moderation";
import { serializeModerationAction } from "@/lib/reports";
import { getAuthenticatedUser } from "@/lib/mercadopago";

export async function POST(
  request: Request,
  { params }: { params: { archiveId: string } },
) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    if (!(await isAdminUser(admin, user))) {
      return NextResponse.json({ error: "Solo admins." }, { status: 403 });
    }

    const { data: archiveRow } = await admin
      .from("notifications")
      .select("id,user_id,entity_id,message")
      .eq("id", params.archiveId)
      .eq("type", "moderation_archive")
      .maybeSingle();

    const archive = parseModerationArchive(archiveRow?.message);
    if (!archiveRow || !archive) {
      return NextResponse.json(
        { error: "No se encontró el archivo de moderación." },
        { status: 404 },
      );
    }

    const { data: existingAlbum } = await admin
      .from("albums")
      .select("id")
      .eq("id", archive.album.id)
      .maybeSingle();

    if (existingAlbum) {
      return NextResponse.json(
        { error: "Ese contenido ya fue restablecido." },
        { status: 409 },
      );
    }

    const { error: albumInsertError } = await admin.from("albums").insert({
      id: archive.album.id,
      user_id: archive.album.user_id,
      description: archive.album.description,
      price: archive.album.price,
    });
    if (albumInsertError) throw albumInsertError;

    if (archive.posts.length > 0) {
      const { error: postInsertError } = await admin.from("posts").insert(
        archive.posts.map((post) => ({
          id: post.id,
          user_id: post.user_id,
          media_url: post.media_url,
          media_type: post.media_type,
          is_locked: post.is_locked,
          likes_count: post.likes_count ?? 0,
          caption: post.caption,
        })),
      );
      if (postInsertError) throw postInsertError;

      const { error: linkInsertError } = await admin.from("album_posts").insert(
        archive.posts.map((post) => ({
          album_id: archive.album.id,
          post_id: post.id,
        })),
      );
      if (linkInsertError) throw linkInsertError;
    }

    await admin.from("notifications").insert({
      user_id: archive.album.user_id,
      actor_id: user.id,
      entity_id: archive.album.id,
      type: "moderation_action",
      message: serializeModerationAction({
        reportId: `restore-${archive.album.id}`,
        albumId: archive.album.id,
        action: "reviewed",
        reason: "Contenido restablecido desde historial de moderación",
        actedAt: new Date().toISOString(),
      }),
      is_read: true,
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

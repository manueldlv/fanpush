import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { serializeModerationAction } from "@/lib/reports";
import { serializeModerationArchive } from "@/lib/moderation";
import { getAuthenticatedUser } from "@/lib/mercadopago";

type DeleteBody = {
  reason?: string;
};

export async function DELETE(
  request: Request,
  { params }: { params: { albumId: string } },
) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    if (!(await isAdminUser(admin, user))) {
      return NextResponse.json({ error: "Solo admins." }, { status: 403 });
    }

    const { albumId } = params;
    const body = (await request.json().catch(() => ({}))) as DeleteBody;
    const reason = body.reason?.trim() || "Incumple las políticas de FanPush.";
    const { data: album, error: albumSelectError } = await admin
      .from("albums")
      .select("id,user_id,description,price,created_at")
      .eq("id", albumId)
      .maybeSingle();

    if (albumSelectError) throw albumSelectError;
    if (!album) {
      return NextResponse.json({ error: "No se encontró el contenido." }, { status: 404 });
    }

    const { data: links, error: linksError } = await admin
      .from("album_posts")
      .select(
        "post_id, post:posts(id,user_id,media_url,media_type,is_locked,likes_count,caption,created_at)",
      )
      .eq("album_id", albumId);

    if (linksError) throw linksError;

    const normalizedLinks = (links ?? []).map((row) => {
      const postRelation = row.post as
        | {
            id?: string | null;
            user_id?: string | null;
            media_url?: string | null;
            media_type?: string | null;
            is_locked?: boolean | null;
            likes_count?: number | null;
            caption?: string | null;
            created_at?: string | null;
          }
        | Array<{
            id?: string | null;
            user_id?: string | null;
            media_url?: string | null;
            media_type?: string | null;
            is_locked?: boolean | null;
            likes_count?: number | null;
            caption?: string | null;
            created_at?: string | null;
          }>
        | null;

      return {
        postId: row.post_id,
        post: Array.isArray(postRelation) ? postRelation[0] ?? null : postRelation,
      };
    });

    const postIds = normalizedLinks.map((row) => row.postId).filter(Boolean);
    const archivedPosts = normalizedLinks
      .map((row) => row.post)
      .filter(
        (
          value,
        ): value is {
          id?: string | null;
          user_id?: string | null;
          media_url?: string | null;
          media_type?: string | null;
          is_locked?: boolean | null;
          likes_count?: number | null;
          caption?: string | null;
          created_at?: string | null;
        } => Boolean(value),
      )
      .map((post) => ({
        id: post.id ?? "",
        user_id: post.user_id ?? album.user_id,
        media_url: post.media_url ?? null,
        media_type: post.media_type ?? null,
        is_locked: post.is_locked ?? null,
        likes_count: post.likes_count ?? null,
        caption: post.caption ?? null,
        created_at: post.created_at ?? null,
      }))
      .filter((post) => Boolean(post.id));

    const { error: archiveError } = await admin.from("notifications").insert({
      user_id: album.user_id,
      actor_id: user.id,
      entity_id: album.id,
      type: "moderation_archive",
      message: serializeModerationArchive({
        album: {
          id: album.id,
          user_id: album.user_id,
          description: album.description,
          price: Number(album.price || 0),
          created_at: album.created_at,
        },
        posts: archivedPosts,
        archivedAt: new Date().toISOString(),
      }),
      is_read: true,
    });

    if (archiveError) throw archiveError;

    if (postIds.length > 0) {
      await admin.from("likes").delete().in("post_id", postIds);
      await admin.from("purchases").delete().in("post_id", postIds);
      await admin.from("album_posts").delete().in("post_id", postIds);
      await admin.from("posts").delete().in("id", postIds);
    }

    await admin.from("album_posts").delete().eq("album_id", albumId);
    const { error: albumError } = await admin
      .from("albums")
      .delete()
      .eq("id", albumId);
    if (albumError) throw albumError;

    await admin.from("notifications").insert({
      user_id: album.user_id,
      actor_id: user.id,
      entity_id: album.id,
      type: "moderation_action",
      message: serializeModerationAction({
        reportId: `delete-${album.id}`,
        albumId: album.id,
        action: "removed",
        reason,
        actedAt: new Date().toISOString(),
      }),
      is_read: true,
    });

    await admin.from("notifications").insert({
      user_id: album.user_id,
      actor_id: user.id,
      entity_id: album.id,
      type: "content_removed_update",
      message: `eliminó una de tus publicaciones. Motivo: ${reason}`,
      is_read: false,
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

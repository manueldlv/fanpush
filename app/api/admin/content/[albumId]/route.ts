import { NextResponse } from "next/server";
import { isAdminIdentity } from "@/lib/admin";
import { getAuthenticatedUser } from "@/lib/mercadopago";

export async function DELETE(
  request: Request,
  { params }: { params: { albumId: string } },
) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    if (!isAdminIdentity({ email: user.email })) {
      return NextResponse.json({ error: "Solo admins." }, { status: 403 });
    }

    const { albumId } = params;
    const { data: links, error: linksError } = await admin
      .from("album_posts")
      .select("post_id, post:posts(media_url)")
      .eq("album_id", albumId);

    if (linksError) throw linksError;

    const normalizedLinks = (links ?? []).map((row) => {
      const postRelation = row.post as
        | { media_url?: string | null }
        | Array<{ media_url?: string | null }>
        | null;

      return {
        postId: row.post_id,
        mediaUrl: Array.isArray(postRelation)
          ? postRelation[0]?.media_url ?? null
          : postRelation?.media_url ?? null,
      };
    });

    const postIds = normalizedLinks.map((row) => row.postId).filter(Boolean);
    const mediaPaths = normalizedLinks
      .map((row) => row.mediaUrl)
      .filter((value): value is string => Boolean(value));

    if (postIds.length > 0) {
      await admin.from("likes").delete().in("post_id", postIds);
      await admin.from("purchases").delete().in("post_id", postIds);
      await admin.from("album_posts").delete().in("post_id", postIds);
      await admin.from("posts").delete().in("id", postIds);
    }

    if (mediaPaths.length > 0) {
      await admin.storage.from("Imagenes").remove(mediaPaths);
    }

    await admin.from("album_posts").delete().eq("album_id", albumId);
    const { error: albumError } = await admin
      .from("albums")
      .delete()
      .eq("id", albumId);
    if (albumError) throw albumError;

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

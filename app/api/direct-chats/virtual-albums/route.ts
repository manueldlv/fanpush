import { NextResponse } from "next/server";
import { requireApprovedAuthor } from "@/lib/server/auth/authorization";
import { MAX_CONTENT_PRICE_ARS, MIN_CONTENT_PRICE_ARS } from "@/lib/pricing";
import { createVirtualAlbumFromExistingPosts } from "@/lib/server/repositories/chatContent";

type Body = {
  postIds?: string[];
  price?: number;
  description?: string;
};

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await requireApprovedAuthor(request);
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Necesitas aprobación como autor para publicar." ? 403 : 401 },
      );
    }

    const body = (await request.json()) as Body;
    const price = Math.min(
      Math.max(Number(body.price ?? 0), MIN_CONTENT_PRICE_ARS),
      MAX_CONTENT_PRICE_ARS,
    );
    const result = await createVirtualAlbumFromExistingPosts({
      admin,
      ownerUserId: user.id,
      postIds: body.postIds ?? [],
      price,
      description: body.description ?? "Contenido privado",
    });

    return NextResponse.json({ ok: true, albumId: result.albumId });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear el álbum virtual.",
      },
      { status: 400 },
    );
  }
}

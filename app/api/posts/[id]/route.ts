import { NextResponse } from "next/server";
import { MAX_CONTENT_PRICE_ARS, MIN_CONTENT_PRICE_ARS } from "@/lib/pricing";
import { getAuthenticatedUser } from "@/lib/server/auth/session";

type UpdatePostBody = {
  description?: string;
  price?: number;
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: 401 },
      );
    }

    const id = params.id;
    const body = (await request.json()) as UpdatePostBody;
    const description = String(body.description ?? "").trim();
    const rawPrice = Number(body.price ?? 0);

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Falta el identificador de la publicación." },
        { status: 400 },
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: "La descripción no puede quedar vacía." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(rawPrice)) {
      return NextResponse.json(
        { error: "El precio no es válido." },
        { status: 400 },
      );
    }

    const normalizedPrice =
      rawPrice <= 0
        ? 0
        : Math.round(
            Math.min(
              Math.max(rawPrice, MIN_CONTENT_PRICE_ARS),
              MAX_CONTENT_PRICE_ARS,
            ),
          );

    const { data: album, error: albumError } = await admin
      .from("albums")
      .select("id,user_id,visibility")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (albumError) {
      throw new Error(albumError.message);
    }

    if (!album?.id) {
      return NextResponse.json(
        { error: "No encontramos la publicación o no tienes permisos." },
        { status: 404 },
      );
    }

    if (album.visibility !== "published") {
      return NextResponse.json(
        { error: "Solo puedes editar publicaciones visibles en tu perfil." },
        { status: 400 },
      );
    }

    const { error: updateError } = await admin
      .from("albums")
      .update({
        description,
        price: normalizedPrice,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      ok: true,
      post: {
        id,
        description,
        price: normalizedPrice,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo editar la publicación.",
      },
      { status: 500 },
    );
  }
}

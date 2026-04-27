import { NextResponse } from "next/server";
import { requireApprovedAuthor } from "@/lib/server/auth/authorization";
import { MAX_CONTENT_PRICE_ARS, MIN_CONTENT_PRICE_ARS } from "@/lib/pricing";

type UpdateBody = {
  price?: number;
  title?: string;
  postIds?: string[];
};

const loadOwnedPrivateAlbum = async ({
  request,
  albumId,
}: {
  request: Request;
  albumId: string;
}) => {
  const { admin, user, error } = await requireApprovedAuthor(request);
  if (error || !admin || !user) {
    return {
      errorResponse: NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Necesitas aprobación como autor para publicar." ? 403 : 401 },
      ),
      admin: null,
      album: null,
    };
  }

  const { data: album, error: albumError } = await admin
    .from("albums")
    .select("id,user_id,visibility,description,price")
    .eq("id", albumId)
    .maybeSingle();

  if (albumError) {
    throw new Error(albumError.message);
  }

  if (!album || album.user_id !== user.id) {
    return {
      errorResponse: NextResponse.json({ error: "Álbum no encontrado." }, { status: 404 }),
      admin,
      album: null,
    };
  }

  if (album.visibility !== "private") {
    return {
      errorResponse: NextResponse.json(
        { error: "Solo puedes administrar contenido privado de chat desde aquí." },
        { status: 400 },
      ),
      admin,
      album: null,
    };
  }

  return {
    errorResponse: null,
    admin,
    album,
  };
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const albumId = params.id?.trim();
    if (!albumId) {
      return NextResponse.json({ error: "Falta el álbum." }, { status: 400 });
    }

    const loaded = await loadOwnedPrivateAlbum({ request, albumId });
    if (loaded.errorResponse) {
      return loaded.errorResponse;
    }

    const body = (await request.json()) as UpdateBody;
    const nextPrice = Math.min(
      Math.max(Number(body.price ?? loaded.album?.price ?? 0), MIN_CONTENT_PRICE_ARS),
      MAX_CONTENT_PRICE_ARS,
    );
    const nextTitle =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : loaded.album?.description ?? "Contenido privado";
    const nextPostIds = Array.isArray(body.postIds)
      ? Array.from(
          new Set(
            body.postIds
              .map((value) => (typeof value === "string" ? value.trim() : ""))
              .filter(Boolean),
          ),
        )
      : null;

    const { error: updateError } = await loaded.admin!
      .from("albums")
      .update({
        description: nextTitle,
        price: nextPrice,
      })
      .eq("id", albumId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (nextPostIds) {
      const { data: existingLinks, error: linksError } = await loaded.admin!
        .from("album_posts")
        .select("post_id")
        .eq("album_id", albumId);

      if (linksError) {
        throw new Error(linksError.message);
      }

      const existingPostIds = (existingLinks ?? [])
        .map((row) => row.post_id)
        .filter(Boolean) as string[];
      const missingPostIds = nextPostIds.filter(
        (postId) => !existingPostIds.includes(postId),
      );

      if (missingPostIds.length > 0 || nextPostIds.length !== existingPostIds.length) {
        return NextResponse.json(
          { error: "El orden enviado no coincide con el contenido del álbum." },
          { status: 400 },
        );
      }

      const reorderResults = await Promise.all(
        nextPostIds.map((postId, index) =>
          loaded.admin!
            .from("album_posts")
            .update({ position: index })
            .eq("album_id", albumId)
            .eq("post_id", postId),
        ),
      );

      const reorderError = reorderResults.find((result) => result.error)?.error;
      if (reorderError) {
        throw new Error(reorderError.message);
      }
    }

    return NextResponse.json({
      ok: true,
      album: {
        id: albumId,
        title: nextTitle,
        price: nextPrice,
        postIds: nextPostIds,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el álbum.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const albumId = params.id?.trim();
    if (!albumId) {
      return NextResponse.json({ error: "Falta el álbum." }, { status: 400 });
    }

    const loaded = await loadOwnedPrivateAlbum({ request, albumId });
    if (loaded.errorResponse) {
      return loaded.errorResponse;
    }

    const { error: updateError } = await loaded.admin!
      .from("albums")
      .update({ visibility: "removed" })
      .eq("id", albumId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo borrar el álbum.",
      },
      { status: 500 },
    );
  }
}

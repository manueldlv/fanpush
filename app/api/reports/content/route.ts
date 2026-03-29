import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { createContentReport } from "@/lib/server/repositories/moderation";

type ReportBody = {
  albumId?: string;
  ownerId?: string;
  reason?: string;
};

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const body = (await request.json()) as ReportBody;
    if (!body.albumId || !body.ownerId || !body.reason?.trim()) {
      return NextResponse.json(
        { error: "Faltan datos para enviar el reporte." },
        { status: 400 },
      );
    }

    if (body.ownerId === user.id) {
      return NextResponse.json(
        { error: "No puedes reportar tu propio contenido." },
        { status: 400 },
      );
    }

    await createContentReport({
      admin,
      ownerId: body.ownerId,
      actorId: user.id,
      albumId: body.albumId,
      reason: body.reason.trim(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo enviar el reporte.",
      },
      { status: 500 },
    );
  }
}

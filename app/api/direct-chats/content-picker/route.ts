import { NextResponse } from "next/server";
import { requireApprovedAuthor } from "@/lib/server/auth/authorization";
import { listChatPickerContent } from "@/lib/server/repositories/chatContent";

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await requireApprovedAuthor(request);
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Necesitas aprobación como autor para publicar." ? 403 : 401 },
      );
    }

    const result = await listChatPickerContent({
      admin,
      ownerUserId: user.id,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el selector de contenido.",
      },
      { status: 500 },
    );
  }
}

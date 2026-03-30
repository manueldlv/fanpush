import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import { getAdminNotificationThread } from "@/lib/server/repositories/notification-center";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await requireAdminAccess(
      request,
      "admin.dashboard.read",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const thread = await getAdminNotificationThread({
      admin,
      threadId: params.id,
      markAsRead: true,
    });

    if (!thread) {
      return NextResponse.json({ error: "No se encontró la conversación." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, thread });
  } catch (requestError) {
    return NextResponse.json(
      {
        error:
          requestError instanceof Error
            ? requestError.message
            : "No se pudo cargar la conversación admin.",
      },
      { status: 500 },
    );
  }
}

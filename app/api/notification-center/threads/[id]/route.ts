import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { getUserNotificationThread } from "@/lib/server/repositories/notification-center";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const thread = await getUserNotificationThread({
      admin,
      userId: user.id,
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
            : "No se pudo cargar la conversación.",
      },
      { status: 500 },
    );
  }
}

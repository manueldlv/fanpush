import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { normalizeDirectChatRouteError } from "@/lib/server/direct-chat-schema";
import { getDirectThread } from "@/lib/server/repositories/direct-chats";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const url = new URL(request.url);
    const before = url.searchParams.get("before");
    const requestedLimit = Number(url.searchParams.get("limit") ?? 25);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.floor(requestedLimit), 50))
      : 25;

    const thread = await getDirectThread({
      admin,
      viewerUserId: user.id,
      threadId: params.id,
      markAsRead: true,
      limit,
      before,
    });

    if (!thread) {
      return NextResponse.json({ error: "No se encontró el chat." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, thread });
  } catch (requestError) {
    return NextResponse.json(
      {
        error: normalizeDirectChatRouteError(requestError, "No se pudo cargar el chat."),
      },
      { status: 500 },
    );
  }
}

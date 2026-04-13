import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { normalizeDirectChatRouteError } from "@/lib/server/direct-chat-schema";
import {
  blockDirectThreadParticipant,
  getDirectThread,
  hideDirectThreadForUser,
  toggleDirectThreadPinned,
  toggleDirectThreadUnread,
} from "@/lib/server/repositories/direct-chats";

type ActionBody = {
  action?: "togglePinned" | "toggleUnread" | "delete" | "block";
};

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const payload = (await request.json()) as ActionBody;
    switch (payload.action) {
      case "togglePinned":
        await toggleDirectThreadPinned({
          admin,
          viewerUserId: user.id,
          threadId: params.id,
        });
        break;
      case "toggleUnread":
        await toggleDirectThreadUnread({
          admin,
          viewerUserId: user.id,
          threadId: params.id,
        });
        break;
      case "delete":
        await hideDirectThreadForUser({
          admin,
          viewerUserId: user.id,
          threadId: params.id,
        });
        return NextResponse.json({ ok: true, deleted: true });
      case "block":
        await blockDirectThreadParticipant({
          admin,
          viewerUserId: user.id,
          threadId: params.id,
        });
        return NextResponse.json({ ok: true, blocked: true });
      default:
        return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    }

    const thread = await getDirectThread({
      admin,
      viewerUserId: user.id,
      threadId: params.id,
      markAsRead: false,
    });

    return NextResponse.json({ ok: true, thread });
  } catch (requestError) {
    return NextResponse.json(
      {
        error: normalizeDirectChatRouteError(
          requestError,
          "No se pudo actualizar el chat.",
        ),
      },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { normalizeDirectChatRouteError } from "@/lib/server/direct-chat-schema";
import {
  deleteDirectMessage,
  getDirectThread,
} from "@/lib/server/repositories/direct-chats";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const threadId = new URL(request.url).searchParams.get("threadId")?.trim();
    if (!threadId) {
      return NextResponse.json({ error: "Falta el chat del mensaje." }, { status: 400 });
    }

    await deleteDirectMessage({
      admin,
      viewerUserId: user.id,
      messageId: params.id,
    });

    const thread = await getDirectThread({
      admin,
      viewerUserId: user.id,
      threadId,
      markAsRead: false,
    });

    return NextResponse.json({ ok: true, thread });
  } catch (requestError) {
    return NextResponse.json(
      {
        error: normalizeDirectChatRouteError(
          requestError,
          "No se pudo eliminar el mensaje.",
        ),
      },
      { status: 400 },
    );
  }
}

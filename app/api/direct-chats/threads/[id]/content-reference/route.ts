import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { normalizeDirectChatRouteError } from "@/lib/server/direct-chat-schema";
import {
  getDirectThread,
  sendDirectAlbumReferenceMessage,
} from "@/lib/server/repositories/direct-chats";

type Body = {
  albumId?: string;
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

    const body = (await request.json()) as Body;
    const albumId = body.albumId?.trim();
    if (!albumId) {
      return NextResponse.json({ error: "Falta el álbum a enviar." }, { status: 400 });
    }

    await sendDirectAlbumReferenceMessage({
      admin,
      viewerUserId: user.id,
      threadId: params.id,
      albumId,
    });

    const thread = await getDirectThread({
      admin,
      viewerUserId: user.id,
      threadId: params.id,
      markAsRead: true,
      limit: 25,
    });

    return NextResponse.json({ ok: true, thread });
  } catch (error) {
    return NextResponse.json(
      {
        error: normalizeDirectChatRouteError(
          error,
          "No se pudo enviar el contenido al chat.",
        ),
      },
      { status: 400 },
    );
  }
}

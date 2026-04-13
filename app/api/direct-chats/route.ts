import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { normalizeDirectChatRouteError } from "@/lib/server/direct-chat-schema";
import {
  listDirectThreads,
  openDirectThreadByUsername,
} from "@/lib/server/repositories/direct-chats";

type OpenChatBody = {
  username?: string;
};

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const threads = await listDirectThreads(admin, user.id, 100);
    return NextResponse.json({ ok: true, threads });
  } catch (requestError) {
    return NextResponse.json(
      {
        error: normalizeDirectChatRouteError(
          requestError,
          "No se pudieron cargar los chats.",
        ),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const payload = (await request.json()) as OpenChatBody;
    const username = payload.username?.trim();
    if (!username) {
      return NextResponse.json({ error: "Falta el usuario del chat." }, { status: 400 });
    }

    const thread = await openDirectThreadByUsername({
      admin,
      viewerUserId: user.id,
      username,
    });

    return NextResponse.json({ ok: true, thread });
  } catch (requestError) {
    return NextResponse.json(
      {
        error: normalizeDirectChatRouteError(requestError, "No se pudo abrir el chat."),
      },
      { status: 400 },
    );
  }
}

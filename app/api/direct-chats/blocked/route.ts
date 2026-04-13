import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { normalizeDirectChatRouteError } from "@/lib/server/direct-chat-schema";
import { listBlockedDirectUsers } from "@/lib/server/repositories/direct-chats";

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const users = await listBlockedDirectUsers(admin, user.id);
    return NextResponse.json({ ok: true, users });
  } catch (requestError) {
    return NextResponse.json(
      {
        error: normalizeDirectChatRouteError(
          requestError,
          "No se pudieron cargar los usuarios bloqueados.",
        ),
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { normalizeDirectChatRouteError } from "@/lib/server/direct-chat-schema";
import { unblockDirectUser } from "@/lib/server/repositories/direct-chats";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    await unblockDirectUser(admin, user.id, params.id);
    return NextResponse.json({ ok: true });
  } catch (requestError) {
    return NextResponse.json(
      {
        error: normalizeDirectChatRouteError(
          requestError,
          "No se pudo desbloquear al usuario.",
        ),
      },
      { status: 400 },
    );
  }
}

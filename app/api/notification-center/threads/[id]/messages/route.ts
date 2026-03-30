import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import {
  getUserNotificationThread,
  replyToUserNotificationThread,
} from "@/lib/server/repositories/notification-center";

type ReplyBody = {
  body?: string;
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

    const payload = (await request.json()) as ReplyBody;
    await replyToUserNotificationThread({
      admin,
      userId: user.id,
      threadId: params.id,
      body: payload.body ?? "",
    });

    const thread = await getUserNotificationThread({
      admin,
      userId: user.id,
      threadId: params.id,
      markAsRead: true,
    });

    return NextResponse.json({ ok: true, thread });
  } catch (requestError) {
    const message =
      requestError instanceof Error
        ? requestError.message
        : "No se pudo enviar la respuesta.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

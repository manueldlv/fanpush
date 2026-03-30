import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import {
  getAdminNotificationThread,
  replyAsAdminToNotificationThread,
} from "@/lib/server/repositories/notification-center";

type ReplyBody = {
  body?: string;
  closeThread?: boolean;
};

export async function POST(
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

    const payload = (await request.json()) as ReplyBody;
    await replyAsAdminToNotificationThread({
      admin,
      threadId: params.id,
      actorId: user.id,
      body: payload.body ?? "",
      closeThread: payload.closeThread ?? false,
    });

    const thread = await getAdminNotificationThread({
      admin,
      threadId: params.id,
      markAsRead: true,
    });

    return NextResponse.json({ ok: true, thread });
  } catch (requestError) {
    return NextResponse.json(
      {
        error:
          requestError instanceof Error
            ? requestError.message
            : "No se pudo responder la conversación.",
      },
      { status: 400 },
    );
  }
}

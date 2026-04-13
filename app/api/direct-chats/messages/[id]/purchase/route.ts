import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { normalizeDirectChatRouteError } from "@/lib/server/direct-chat-schema";
import {
  getDirectThread,
  purchaseDirectPremiumMessage,
} from "@/lib/server/repositories/direct-chats";
import { getUserBalanceSnapshot } from "@/lib/server/repositories/ledger";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const result = await purchaseDirectPremiumMessage({
      admin,
      viewerUserId: user.id,
      messageId: params.id,
    });
    const [thread, balance] = await Promise.all([
      getDirectThread({
        admin,
        viewerUserId: user.id,
        threadId: result.threadId,
        markAsRead: true,
      }),
      getUserBalanceSnapshot(admin, user.id),
    ]);

    return NextResponse.json({
      ok: true,
      thread,
      transactionId: result.transactionId,
      amount: result.amount,
      balance: (balance?.cashAvailable ?? 0) + (balance?.bonusAvailable ?? 0),
    });
  } catch (requestError) {
    const message = normalizeDirectChatRouteError(
      requestError,
      "No se pudo comprar el contenido del chat.",
    );

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

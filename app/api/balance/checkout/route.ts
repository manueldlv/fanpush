import { NextResponse } from "next/server";
import {
  getUserBalanceSnapshot,
  processInternalAlbumPurchase,
  processInternalTipPayment,
} from "@/lib/server/repositories/ledger";
import { getPurchaseAlbumTarget } from "@/lib/server/repositories/payments";
import { getAuthenticatedUser } from "@/lib/server/auth/session";

type CheckoutBody =
  | {
      kind: "purchase";
      albumId: string;
    }
  | {
      kind: "tip";
      targetUserId: string;
      amount: number;
    };

const mapCheckoutError = (message: string) => {
  switch (message) {
    case "album_not_found":
      return { status: 404, error: "No se encontró la publicación a comprar." };
    case "cannot_buy_own_content":
      return { status: 400, error: "No puedes comprar tu propio contenido." };
    case "invalid_album_price":
      return { status: 400, error: "Esta publicación no tiene un precio válido." };
    case "album_has_no_posts":
      return { status: 400, error: "La publicación no tiene contenido para acreditar." };
    case "album_already_purchased":
      return { status: 400, error: "Ya habías comprado este contenido." };
    case "recipient_not_found":
      return { status: 404, error: "No se encontró el usuario receptor." };
    case "cannot_tip_self":
      return { status: 400, error: "No puedes enviarte una propina a ti mismo." };
    case "invalid_tip_amount":
      return { status: 400, error: "La propina debe tener un monto válido." };
    case "insufficient_balance":
      return {
        status: 400,
        error: "No tienes saldo suficiente. Carga saldo en Mi saldo para continuar.",
      };
    default:
      return null;
  }
};

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const body = (await request.json()) as CheckoutBody;

    if (body.kind === "purchase") {
      const album = await getPurchaseAlbumTarget(admin, body.albumId);
      if (!album) {
        return NextResponse.json(
          { error: "No se encontró la publicación a comprar." },
          { status: 404 },
        );
      }

      const result = await processInternalAlbumPurchase({
        admin,
        buyerUserId: user.id,
        albumId: body.albumId,
      });
      const balance = await getUserBalanceSnapshot(admin, user.id);

      return NextResponse.json({
        ok: true,
        kind: "purchase",
        transactionId: result.transactionId,
        amount: result.transactionAmount,
        creatorAmount: result.creatorAmount,
        platformFeeAmount: result.platformFeeAmount,
        bonusUsed: result.bonusUsed,
        cashUsed: result.cashUsed,
        balance: (balance?.cashAvailable ?? 0) + (balance?.bonusAvailable ?? 0),
      });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "La propina debe tener un monto válido." },
        { status: 400 },
      );
    }

    const result = await processInternalTipPayment({
      admin,
      buyerUserId: user.id,
      recipientUserId: body.targetUserId,
      amount,
    });
    const balance = await getUserBalanceSnapshot(admin, user.id);

    return NextResponse.json({
      ok: true,
      kind: "tip",
      transactionId: result.transactionId,
      amount: result.transactionAmount,
      creatorAmount: result.creatorAmount,
      platformFeeAmount: result.platformFeeAmount,
      bonusUsed: result.bonusUsed,
      cashUsed: result.cashUsed,
      balance: (balance?.cashAvailable ?? 0) + (balance?.bonusAvailable ?? 0),
    });
  } catch (checkoutError) {
    if (checkoutError instanceof Error) {
      const mapped = mapCheckoutError(checkoutError.message);
      if (mapped) {
        return NextResponse.json({ error: mapped.error }, { status: mapped.status });
      }
    }

    return NextResponse.json(
      {
        error:
          checkoutError instanceof Error
            ? checkoutError.message
            : "No se pudo procesar el checkout con saldo.",
      },
      { status: 500 },
    );
  }
}

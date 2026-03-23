import { NextResponse } from "next/server";
import {
  finalizeMercadoPagoPayment,
  getAuthenticatedUser,
} from "@/lib/mercadopago";

type FinalizeBody = {
  paymentId?: string | number | null;
};

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const body = (await request.json()) as FinalizeBody;
    const paymentId = body.paymentId;
    if (!paymentId) {
      return NextResponse.json({ error: "Falta paymentId." }, { status: 400 });
    }

    const result = await finalizeMercadoPagoPayment({
      admin,
      paymentId,
      expectedBuyerId: user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo acreditar el pago.",
      },
      { status: 500 },
    );
  }
}

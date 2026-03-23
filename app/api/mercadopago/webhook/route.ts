import { NextResponse } from "next/server";
import {
  finalizeMercadoPagoPayment,
  getAdminSupabase,
} from "@/lib/mercadopago";

const getPaymentIdFromRequest = async (request: Request) => {
  const url = new URL(request.url);
  const searchId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    url.searchParams.get("payment_id");

  if (searchId) return searchId;

  try {
    const body = (await request.json()) as
      | {
          data?: { id?: string | number };
          type?: string;
          action?: string;
        }
      | null;

    return body?.data?.id ?? null;
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  try {
    const admin = getAdminSupabase();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Supabase no configurado." }, { status: 500 });
    }

    const paymentId = await getPaymentIdFromRequest(request);
    if (!paymentId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const result = await finalizeMercadoPagoPayment({
      admin,
      paymentId,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo procesar el webhook.",
      },
      { status: 500 },
    );
  }
}

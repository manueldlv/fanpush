import { NextResponse } from "next/server";
import {
  finalizeMercadoPagoPayment,
  getMercadoPagoWebhookToken,
  verifyMercadoPagoWebhookSignature,
} from "@/lib/mercadopago";
import { getAdminSupabase } from "@/lib/server/auth/session";

const parseWebhookBody = async (request: Request) => {
  try {
    return (await request.json()) as
      | {
          data?: { id?: string | number };
          type?: string;
          action?: string;
        }
      | null;
  } catch {
    return null;
  }
};

const getPaymentIdFromRequest = async (
  request: Request,
  body?: Awaited<ReturnType<typeof parseWebhookBody>>,
) => {
  const url = new URL(request.url);
  const searchId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    url.searchParams.get("payment_id");

  if (searchId) return searchId;

  return body?.data?.id ?? null;
};

export async function POST(request: Request) {
  try {
    const admin = getAdminSupabase();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Supabase no configurado." }, { status: 500 });
    }

    const body = await parseWebhookBody(request);
    const paymentId = await getPaymentIdFromRequest(request, body);
    if (!paymentId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const eventType = body?.type ?? body?.action ?? request.headers.get("x-topic") ?? "";
    const normalizedEventType = eventType.toLowerCase();
    if (
      normalizedEventType &&
      !normalizedEventType.includes("payment") &&
      !normalizedEventType.includes("merchant_order")
    ) {
      return NextResponse.json({ ok: true, ignored: true, reason: "unsupported_event" });
    }

    const configuredToken = getMercadoPagoWebhookToken();
    const requestToken = new URL(request.url).searchParams.get("token");
    if (configuredToken && requestToken !== configuredToken) {
      return NextResponse.json({ ok: false, error: "Webhook no autenticado." }, { status: 401 });
    }

    const signatureResult = verifyMercadoPagoWebhookSignature({
      dataId: String(paymentId),
      requestId: request.headers.get("x-request-id"),
      signatureHeader: request.headers.get("x-signature"),
    });
    if (signatureResult.mode === "secret" && !signatureResult.verified) {
      return NextResponse.json({ ok: false, error: "Webhook no autenticado." }, { status: 401 });
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
        error: "No se pudo procesar el webhook.",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  isPublicHttpsUrl,
  mercadopagoFetch,
  resolveAppBaseUrl,
} from "@/lib/mercadopago";
import { ensureUserRow } from "@/lib/supabase";

type PreferenceBody =
  | {
      kind: "purchase";
      albumId: string;
      returnPath?: string;
    }
  | {
      kind: "tip";
      targetUserId: string;
      amount: number;
      returnPath?: string;
    };

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    await ensureUserRow(admin, user);

    const body = (await request.json()) as PreferenceBody;
    const baseUrl = resolveAppBaseUrl(request);
    const hasPublicBase = isPublicHttpsUrl(baseUrl);

    if (body.kind === "purchase") {
      const { data: album } = await admin
        .from("albums")
        .select("id,user_id,description,price")
        .eq("id", body.albumId)
        .maybeSingle();

      if (!album) {
        return NextResponse.json(
          { error: "No se encontro la publicacion a comprar." },
          { status: 404 },
        );
      }

      if (album.user_id === user.id) {
        return NextResponse.json(
          { error: "No puedes comprar tu propio contenido." },
          { status: 400 },
        );
      }

      const unitPrice = Number(album.price || 0);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return NextResponse.json(
          { error: "Esta publicacion no tiene un precio valido." },
          { status: 400 },
        );
      }

      const returnPath = body.returnPath || "/";
      const returnUrl = `${baseUrl}/checkout/return?kind=purchase&target=${encodeURIComponent(
        returnPath,
      )}`;

      const preference = await mercadopagoFetch<{
        init_point: string;
        sandbox_init_point?: string;
        id: string;
      }>("/checkout/preferences", {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              id: album.id,
              title: album.description || "Contenido FanPush",
              quantity: 1,
              currency_id: "ARS",
              unit_price: unitPrice,
            },
          ],
          external_reference: `purchase:${user.id}:${album.id}:${unitPrice.toFixed(2)}`,
          back_urls: {
            success: returnUrl,
            pending: returnUrl,
            failure: returnUrl,
          },
          auto_return: "approved",
          payer: {
            email: user.email,
          },
          ...(hasPublicBase
            ? {
                notification_url: `${baseUrl}/api/mercadopago/webhook`,
              }
            : {}),
        }),
      });

      return NextResponse.json({
        initPoint: preference.init_point || preference.sandbox_init_point,
        preferenceId: preference.id,
      });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "La propina debe tener un monto valido." },
        { status: 400 },
      );
    }

    if (body.targetUserId === user.id) {
      return NextResponse.json(
        { error: "No puedes enviarte propina a ti mismo." },
        { status: 400 },
      );
    }

    const { data: targetUser } = await admin
      .from("users")
      .select("id,username")
      .eq("id", body.targetUserId)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json(
        { error: "No se encontro el usuario receptor." },
        { status: 404 },
      );
    }

    const returnPath = body.returnPath || `/user/${targetUser.username ?? ""}`;
    const returnUrl = `${baseUrl}/checkout/return?kind=tip&target=${encodeURIComponent(
      returnPath,
    )}`;

    const preference = await mercadopagoFetch<{
      init_point: string;
      sandbox_init_point?: string;
      id: string;
    }>("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            id: `tip-${targetUser.id}`,
            title: `Propina para @${targetUser.username ?? "usuario"}`,
            quantity: 1,
            currency_id: "ARS",
            unit_price: amount,
          },
        ],
        external_reference: `tip:${user.id}:${targetUser.id}:${amount.toFixed(2)}`,
        back_urls: {
          success: returnUrl,
          pending: returnUrl,
          failure: returnUrl,
        },
        auto_return: "approved",
        payer: {
          email: user.email,
        },
        ...(hasPublicBase
          ? {
              notification_url: `${baseUrl}/api/mercadopago/webhook`,
            }
          : {}),
      }),
    });

    return NextResponse.json({
      initPoint: preference.init_point || preference.sandbox_init_point,
      preferenceId: preference.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear la preferencia de Mercado Pago.",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  mercadopagoFetch,
  parseExternalReference,
} from "@/lib/mercadopago";
import { ensureUserRow } from "@/lib/supabase";

type FinalizeBody = {
  paymentId?: string | number | null;
};

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    await ensureUserRow(admin, user);

    const body = (await request.json()) as FinalizeBody;
    const paymentId = body.paymentId;
    if (!paymentId) {
      return NextResponse.json({ error: "Falta paymentId." }, { status: 400 });
    }

    const payment = await mercadopagoFetch<{
      id: number | string;
      status?: string;
      status_detail?: string;
      external_reference?: string;
    }>(`/v1/payments/${paymentId}`);

    if (payment.status !== "approved") {
      return NextResponse.json({
        ok: false,
        status: payment.status ?? "unknown",
        statusDetail: payment.status_detail ?? null,
      });
    }

    const reference = parseExternalReference(payment.external_reference);
    if (!reference) {
      return NextResponse.json(
        { error: "No se pudo interpretar el pago recibido." },
        { status: 400 },
      );
    }

    if (reference.buyerId !== user.id) {
      return NextResponse.json(
        { error: "Este pago no pertenece a la sesion actual." },
        { status: 403 },
      );
    }

    if (reference.kind === "purchase") {
      const albumId = reference.targetId;
      const { data: album } = await admin
        .from("albums")
        .select("id,user_id,description,price")
        .eq("id", albumId)
        .maybeSingle();

      if (!album) {
        return NextResponse.json(
          { error: "No se encontro el album pagado." },
          { status: 404 },
        );
      }

      const { data: links } = await admin
        .from("album_posts")
        .select("post_id")
        .eq("album_id", albumId);

      const postIds = (links ?? []).map((row) => row.post_id).filter(Boolean);
      if (postIds.length === 0) {
        return NextResponse.json(
          { error: "No se encontro contenido para acreditar." },
          { status: 400 },
        );
      }

      const rows = postIds.map((postId, index) => ({
        user_id: user.id,
        post_id: postId,
        payment_id: `${payment.id}-${postId}`,
        amount: index === 0 ? Number(reference.amount || album.price || 0) : 0,
        status: "approved",
      }));

      const { data: existingRows } = await admin
        .from("purchases")
        .select("payment_id")
        .in(
          "payment_id",
          rows.map((row) => row.payment_id),
        );

      if ((existingRows ?? []).length === 0) {
        const { error: insertError } = await admin.from("purchases").insert(rows);
        if (insertError) throw insertError;

        await admin.from("notifications").insert({
          user_id: album.user_id,
          actor_id: user.id,
          type: "purchase",
          entity_id: user.id,
          message: "compró tu contenido.",
          is_read: false,
        });
      }

      return NextResponse.json({ ok: true, kind: "purchase" });
    }

    if (reference.kind === "tip") {
      const targetUserId = reference.targetId;
      const amount = Number(reference.amount || 0);

      const { data: existingTip } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("actor_id", user.id)
        .eq("type", "tip")
        .eq("message", `te envió una propina de ${amount.toFixed(2)} ARS.`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!existingTip) {
        const { error: tipError } = await admin.from("notifications").insert({
          user_id: targetUserId,
          actor_id: user.id,
          type: "tip",
          entity_id: user.id,
          message: `te envió una propina de ${amount.toFixed(2)} ARS.`,
          is_read: false,
        });
        if (tipError) throw tipError;
      }

      return NextResponse.json({ ok: true, kind: "tip", amount });
    }

    return NextResponse.json(
      { error: "Tipo de pago no soportado." },
      { status: 400 },
    );
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

import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getAuthenticatedUser } from "@/lib/mercadopago";
import {
  parseWithdrawalRecord,
  serializeWithdrawalHistory,
  serializeWithdrawalRecord,
  type WithdrawalStatus,
} from "@/lib/withdrawals";

type UpdateBody = {
  status: WithdrawalStatus;
  reason?: string;
};

const buildWithdrawalUpdateMessage = (
  status: WithdrawalStatus,
  reason?: string,
) => {
  switch (status) {
    case "sent":
      return "marcó tu retiro como enviado.";
    case "rejected":
      return reason?.trim()
        ? `rechazó tu retiro. Motivo: ${reason.trim()}`
        : "rechazó tu retiro. Revisá ventas para más detalle.";
    case "requested":
    default:
      return "actualizó el estado de tu retiro.";
  }
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    if (!(await isAdminUser(admin, user))) {
      return NextResponse.json({ error: "Solo admins." }, { status: 403 });
    }

    const body = (await request.json()) as UpdateBody;
    const { data: row } = await admin
      .from("notifications")
      .select("id,user_id,message")
      .eq("id", params.id)
      .eq("type", "withdrawal_request")
      .maybeSingle();

    const current = parseWithdrawalRecord(row?.message);
    if (!row || !current) {
      return NextResponse.json(
        { error: "No se encontró la solicitud de retiro." },
        { status: 404 },
      );
    }

    const nextRecord = { ...current, status: body.status };
    const { error: updateError } = await admin
      .from("notifications")
      .update({ message: serializeWithdrawalRecord(nextRecord) })
      .eq("id", params.id);

    if (updateError) throw updateError;

    const { error: historyError } = await admin.from("notifications").insert({
      user_id: user.id,
      actor_id: user.id,
      entity_id: params.id,
      type: "withdrawal_history",
      message: serializeWithdrawalHistory({
        withdrawalId: params.id,
        status: body.status,
        amount: current.amount,
        actedAt: new Date().toISOString(),
        reason: body.reason?.trim() || undefined,
      }),
      is_read: true,
    });

    if (historyError) throw historyError;

    const { error: notifyError } = await admin.from("notifications").insert({
      user_id: row.user_id,
      actor_id: user.id,
      entity_id: params.id,
      type: "withdrawal_update",
      message: buildWithdrawalUpdateMessage(body.status, body.reason),
      is_read: false,
    });

    if (notifyError) throw notifyError;

    return NextResponse.json({ ok: true, record: nextRecord });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el retiro.",
      },
      { status: 500 },
    );
  }
}

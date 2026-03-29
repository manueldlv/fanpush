import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import {
  createWithdrawalHistory,
  getWithdrawalRequestById,
  notifyWithdrawalUpdate,
  updateWithdrawalRequest,
} from "@/lib/server/repositories/withdrawals";
import {
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
    const { admin, user, error } = await requireAdminAccess(
      request,
      "withdrawals.review",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const body = (await request.json()) as UpdateBody;
    const row = await getWithdrawalRequestById(admin, params.id);
    if (!row || !row.record) {
      return NextResponse.json(
        { error: "No se encontró la solicitud de retiro." },
        { status: 404 },
      );
    }

    const nextRecord = { ...row.record, status: body.status };
    await updateWithdrawalRequest({
      admin,
      id: params.id,
      record: nextRecord,
      actorId: user.id,
      reason: body.reason,
    });

    await createWithdrawalHistory({
      admin,
      actorId: user.id,
      withdrawalId: params.id,
      amount: row.record.amount,
      status: body.status,
      reason: body.reason,
    });

    await notifyWithdrawalUpdate({
      admin,
      userId: row.userId,
      actorId: user.id,
      withdrawalId: params.id,
      message: buildWithdrawalUpdateMessage(body.status, body.reason),
    });

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

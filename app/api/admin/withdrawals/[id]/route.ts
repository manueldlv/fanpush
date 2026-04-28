import { NextResponse } from "next/server";
import { recordAdminAction } from "@/lib/server/admin/audit";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import {
  createWithdrawalHistory,
  getWithdrawalRequestById,
  notifyWithdrawalUpdate,
  updateWithdrawalRequest,
} from "@/lib/server/repositories/withdrawals";
import { createOrAppendAdminNotificationThread } from "@/lib/server/repositories/notification-center";
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

    try {
      await createWithdrawalHistory({
        admin,
        actorId: user.id,
        withdrawalId: params.id,
        amount: row.record.amount,
        status: body.status,
        reason: body.reason,
      });
    } catch (historyError) {
      console.error(
        "No se pudo guardar el historial legacy del retiro:",
        historyError instanceof Error ? historyError.message : historyError,
      );
    }

    try {
      await createOrAppendAdminNotificationThread({
        admin,
        userId: row.userId,
        actorId: user.id,
        topic: "withdrawal",
        subject: "Retiro de saldo",
        body: buildWithdrawalUpdateMessage(body.status, body.reason),
        sourceType: "withdrawal",
        sourceId: params.id,
        allowUserReply: body.status !== "sent",
      });
    } catch (threadError) {
      console.error(
        "No se pudo actualizar el thread admin del retiro:",
        threadError instanceof Error ? threadError.message : threadError,
      );
    }

    try {
      await notifyWithdrawalUpdate({
        admin,
        userId: row.userId,
        actorId: user.id,
        withdrawalId: params.id,
        message: buildWithdrawalUpdateMessage(body.status, body.reason),
      });
    } catch (notifyError) {
      console.error(
        "No se pudo notificar el retiro al usuario:",
        notifyError instanceof Error ? notifyError.message : notifyError,
      );
    }

    await recordAdminAction({
      admin,
      actorUserId: user.id,
      actionType: "withdrawal.reviewed",
      targetType: "withdrawal_request",
      targetId: params.id,
      summary: `Actualizo retiro de @${row.record.payoutAlias || row.userId} a estado ${body.status}.`,
      metadata: {
        status: body.status,
        reason: body.reason?.trim() || null,
        amount: row.record.amount,
        userId: row.userId,
      },
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

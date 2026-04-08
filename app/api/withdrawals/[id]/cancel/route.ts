import { NextResponse } from "next/server";
import { requireAuthorPermission } from "@/lib/server/auth/authorization";
import {
  getWithdrawalRequestById,
  updateWithdrawalRequest,
} from "@/lib/server/repositories/withdrawals";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await requireAuthorPermission(
      request,
      "withdrawals.request",
      "Necesitas aprobación como autor para gestionar retiros.",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error?.includes("Necesitas aprobación") ? 403 : 401 },
      );
    }

    const withdrawal = await getWithdrawalRequestById(admin, params.id);
    if (!withdrawal?.record) {
      return NextResponse.json(
        { error: "No se encontró la solicitud de retiro." },
        { status: 404 },
      );
    }

    if (withdrawal.userId !== user.id) {
      return NextResponse.json(
        { error: "No puedes cancelar un retiro de otro usuario." },
        { status: 403 },
      );
    }

    if (withdrawal.record.status !== "requested") {
      return NextResponse.json(
        { error: "Solo se pueden cancelar retiros pendientes." },
        { status: 400 },
      );
    }

    const record = {
      ...withdrawal.record,
      status: "rejected" as const,
    };

    await updateWithdrawalRequest({
      admin,
      id: params.id,
      record,
      actorId: user.id,
      reason: "Cancelado por el autor.",
    });

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cancelar el retiro.",
      },
      { status: 500 },
    );
  }
}

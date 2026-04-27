import { NextResponse } from "next/server";
import { requireAuthorPermission } from "@/lib/server/auth/authorization";
import {
  createWithdrawalRequest,
  listWithdrawalRequestsByUserId,
} from "@/lib/server/repositories/withdrawals";
import { getDefaultPayoutProfile } from "@/lib/payoutMeta";
import { parsePayoutProfile } from "@/lib/payouts";
import {
  ensureLegacyCreatorBalanceBaseline,
} from "@/lib/server/repositories/ledger";
import {
  getCurrentMonthKey,
} from "@/lib/withdrawals";
import { FANPUSH_WITHDRAWAL_MIN_ARS } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await requireAuthorPermission(
      request,
      "withdrawals.request",
      "Necesitas aprobación como autor para solicitar retiros.",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        {
          status:
            error === "Necesitas aprobación como autor para solicitar retiros."
              ? 403
              : 401,
        },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      amount?: number | string;
    };
    const requestedAmount = Number(body.amount ?? 0);
    const payoutProfile = await getDefaultPayoutProfile(admin, user.id);
    if (!payoutProfile) {
      return NextResponse.json(
        {
          error:
            "Completa tus datos de cobro en Configuración antes de solicitar un retiro.",
        },
        { status: 400 },
      );
    }

    const normalizedRecords = (await listWithdrawalRequestsByUserId(admin, user.id)).map(
      (row) => ({
        id: row.id,
        ...row.record,
      }),
    );

    const monthKey = getCurrentMonthKey();
    const existingThisMonth = normalizedRecords.find(
      (record) => record.monthKey === monthKey && record.status !== "rejected",
    );
    if (existingThisMonth) {
      return NextResponse.json(
        { error: "Ya tienes una solicitud de retiro registrada este mes." },
        { status: 400 },
      );
    }

    let balanceSnapshot = await ensureLegacyCreatorBalanceBaseline(admin, user.id);

    const availableToRequest = Math.max(balanceSnapshot?.cashAvailable ?? 0, 0);

    if (availableToRequest < FANPUSH_WITHDRAWAL_MIN_ARS) {
      return NextResponse.json(
        {
          error:
            "Necesitas al menos $50.000 ARS disponibles para solicitar un retiro.",
        },
        { status: 400 },
      );
    }

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json(
        { error: "Ingresa un monto válido para retirar." },
        { status: 400 },
      );
    }

    if (requestedAmount < FANPUSH_WITHDRAWAL_MIN_ARS) {
      return NextResponse.json(
        {
          error: `El retiro mínimo es de ${FANPUSH_WITHDRAWAL_MIN_ARS.toLocaleString("es-AR")} ARS.`,
        },
        { status: 400 },
      );
    }

    if (requestedAmount > availableToRequest) {
      return NextResponse.json(
        { error: "No puedes retirar más de lo que tienes disponible." },
        { status: 400 },
      );
    }

    const record = {
      amount: requestedAmount,
      status: "requested" as const,
      requestedAt: new Date().toISOString(),
      monthKey,
      payoutAlias: payoutProfile.alias,
      payoutHolderName: payoutProfile.holderName,
      payoutHolderDocument: payoutProfile.holderDocument,
      payoutBank: payoutProfile.notes ?? "",
    };

    await createWithdrawalRequest({ admin, userId: user.id, record });

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo solicitar el retiro.",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { loadCreatorEarnings } from "@/lib/earnings";
import { requireAuthorPermission } from "@/lib/server/auth/authorization";
import {
  createWithdrawalRequest,
  listWithdrawalRequestsByUserId,
} from "@/lib/server/repositories/withdrawals";
import { parsePayoutProfile } from "@/lib/payouts";
import {
  getCurrentMonthKey,
  getWithdrawalReservedAmount,
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

    const earnings = await loadCreatorEarnings(admin, user.id);
    const { data: payoutRow } = await admin
      .from("notifications")
      .select("message")
      .eq("user_id", user.id)
      .eq("type", "payout_profile")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payoutProfile = parsePayoutProfile(payoutRow?.message);
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
      (record) => record.monthKey === monthKey,
    );
    if (existingThisMonth) {
      return NextResponse.json(
        { error: "Ya tienes una solicitud de retiro registrada este mes." },
        { status: 400 },
      );
    }

    const reserved = getWithdrawalReservedAmount(normalizedRecords);
    const availableToRequest = Math.max(earnings.creatorNet - reserved, 0);

    if (availableToRequest < FANPUSH_WITHDRAWAL_MIN_ARS) {
      return NextResponse.json(
        {
          error:
            "Necesitas al menos $50.000 ARS disponibles para solicitar un retiro.",
        },
        { status: 400 },
      );
    }

    const record = {
      amount: availableToRequest,
      status: "requested" as const,
      requestedAt: new Date().toISOString(),
      monthKey,
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

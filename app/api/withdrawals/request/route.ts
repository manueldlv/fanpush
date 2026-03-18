import { NextResponse } from "next/server";
import { loadCreatorEarnings } from "@/lib/earnings";
import { getAuthenticatedUser } from "@/lib/mercadopago";
import {
  getCurrentMonthKey,
  getWithdrawalReservedAmount,
  parseWithdrawalRecord,
  serializeWithdrawalRecord,
} from "@/lib/withdrawals";
import { FANPUSH_WITHDRAWAL_MIN_ARS } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const earnings = await loadCreatorEarnings(admin, user.id);
    const { data: rows } = await admin
      .from("notifications")
      .select("id,message,created_at")
      .eq("user_id", user.id)
      .eq("type", "withdrawal_request")
      .order("created_at", { ascending: false });

    const normalizedRecords = (rows ?? [])
      .map((row) => {
        const parsed = parseWithdrawalRecord(row.message);
        return parsed ? { id: row.id, ...parsed } : null;
      })
      .filter(
        (value): value is {
          id: string;
          amount: number;
          status: "requested" | "scheduled" | "sent" | "rejected";
          requestedAt: string;
          monthKey: string;
        } => Boolean(value),
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

    const { error: insertError } = await admin.from("notifications").insert({
      user_id: user.id,
      actor_id: user.id,
      type: "withdrawal_request",
      entity_id: user.id,
      message: serializeWithdrawalRecord(record),
      is_read: true,
    });

    if (insertError) throw insertError;

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

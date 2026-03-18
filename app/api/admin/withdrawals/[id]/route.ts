import { NextResponse } from "next/server";
import { isAdminIdentity } from "@/lib/admin";
import { getAuthenticatedUser } from "@/lib/mercadopago";
import {
  parseWithdrawalRecord,
  serializeWithdrawalRecord,
  type WithdrawalStatus,
} from "@/lib/withdrawals";

type UpdateBody = {
  status: WithdrawalStatus;
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

    if (!isAdminIdentity({ email: user.email })) {
      return NextResponse.json({ error: "Solo admins." }, { status: 403 });
    }

    const body = (await request.json()) as UpdateBody;
    const { data: row } = await admin
      .from("notifications")
      .select("id,message")
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

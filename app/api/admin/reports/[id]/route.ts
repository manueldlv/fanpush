import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getAuthenticatedUser } from "@/lib/mercadopago";
import {
  parseContentReport,
  serializeContentReport,
  serializeModerationAction,
  type ContentReport,
} from "@/lib/reports";

type UpdateBody = {
  status: "reviewed" | "dismissed" | "removed";
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
      .select("id,user_id,actor_id,entity_id,message")
      .eq("id", params.id)
      .eq("type", "content_report")
      .maybeSingle();

    const current = parseContentReport(row?.message);
    if (!row || !current) {
      return NextResponse.json(
        { error: "No se encontró el reporte." },
        { status: 404 },
      );
    }

    const nextRecord: ContentReport = {
      ...current,
      status: body.status,
    };

    const { error: updateError } = await admin
      .from("notifications")
      .update({ message: serializeContentReport(nextRecord) })
      .eq("id", params.id);

    if (updateError) throw updateError;

    const { error: historyError } = await admin.from("notifications").insert({
      user_id: row.user_id,
      actor_id: user.id,
      entity_id: row.entity_id,
      type: "moderation_action",
      message: serializeModerationAction({
        reportId: row.id,
        albumId: current.albumId,
        action: body.status,
        reason: current.reason,
        actedAt: new Date().toISOString(),
      }),
      is_read: true,
    });

    if (historyError) throw historyError;

    return NextResponse.json({ ok: true, report: nextRecord });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el reporte.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    const { data: row } = await admin
      .from("notifications")
      .select("id,message")
      .eq("id", params.id)
      .eq("type", "content_report")
      .maybeSingle();

    const current = parseContentReport(row?.message);
    if (!row || !current) {
      return NextResponse.json({ error: "No se encontró el reporte." }, { status: 404 });
    }

    if ((current.status ?? "open") === "open") {
      return NextResponse.json(
        { error: "Solo puedes archivar reportes ya procesados." },
        { status: 400 },
      );
    }

    const { error: updateError } = await admin
      .from("notifications")
      .update({
        message: serializeContentReport({ ...current, archived: true }),
      })
      .eq("id", params.id);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo archivar el reporte.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
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

    const { data: row } = await admin
      .from("notifications")
      .select("id,message")
      .eq("id", params.id)
      .eq("type", "content_report")
      .maybeSingle();

    const current = parseContentReport(row?.message);
    if (!row || !current) {
      return NextResponse.json({ error: "No se encontró el reporte." }, { status: 404 });
    }

    const { error: updateError } = await admin
      .from("notifications")
      .update({
        message: serializeContentReport({ ...current, archived: false }),
      })
      .eq("id", params.id);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo restaurar el reporte.",
      },
      { status: 500 },
    );
  }
}

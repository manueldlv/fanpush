import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import {
  parseAuthorApplication,
  serializeAuthorApplication,
  serializeAuthorApplicationHistory,
  type AuthorApplicationStatus,
} from "@/lib/authorApplications";
import { ensureServerUserRows, getAuthenticatedUser } from "@/lib/mercadopago";

type UpdateBody = {
  status: AuthorApplicationStatus;
  reason?: string;
};

const buildAuthorMessage = (
  status: AuthorApplicationStatus,
  reason?: string,
) => {
  switch (status) {
    case "approved":
      return "aprobó tu solicitud para vender contenido. Ya puedes crear publicaciones.";
    case "rejected":
      return reason?.trim()
        ? `rechazó tu solicitud para vender contenido. Motivo: ${reason.trim()}`
        : "rechazó tu solicitud para vender contenido. Revisa tus datos y vuelve a intentarlo.";
    case "pending":
    default:
      return "actualizó el estado de tu solicitud de autor.";
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
      .eq("type", "author_application")
      .maybeSingle();

    const current = parseAuthorApplication(row?.message);
    if (!row || !current) {
      return NextResponse.json(
        { error: "No se encontró la solicitud de autor." },
        { status: 404 },
      );
    }

    const { data: targetAuthUser, error: targetAuthError } = await admin.auth.admin.getUserById(
      row.user_id,
    );
    if (targetAuthError) {
      throw new Error(`No se pudo validar al solicitante: ${targetAuthError.message}`);
    }
    if (targetAuthUser?.user) {
      await ensureServerUserRows(admin, targetAuthUser.user);
    }

    const nextRecord = { ...current, status: body.status };

    const { error: updateError } = await admin
      .from("notifications")
      .update({
        message: serializeAuthorApplication(nextRecord),
        is_read: false,
      })
      .eq("id", params.id);
    if (updateError) throw new Error(`No se pudo actualizar la solicitud: ${updateError.message}`);

    const { error: historyError } = await admin.from("notifications").insert({
      user_id: row.user_id,
      actor_id: user.id,
      entity_id: params.id,
      type: "author_application_history",
      message: serializeAuthorApplicationHistory({
        applicationId: params.id,
        action: body.status,
        actedAt: new Date().toISOString(),
        reason: body.reason?.trim() || undefined,
      }),
      is_read: true,
    });
    if (historyError) {
      throw new Error(`No se pudo guardar el historial de la solicitud: ${historyError.message}`);
    }

    const { error: notifyError } = await admin.from("notifications").insert({
      user_id: row.user_id,
      actor_id: user.id,
      entity_id: params.id,
      type: "author_application_update",
      message: buildAuthorMessage(body.status, body.reason),
      is_read: false,
    });
    if (notifyError) {
      throw new Error(`No se pudo notificar al usuario: ${notifyError.message}`);
    }

    return NextResponse.json({ ok: true, record: nextRecord });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la solicitud.",
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
      .eq("type", "author_application")
      .maybeSingle();

    const current = parseAuthorApplication(row?.message);
    if (!row || !current) {
      return NextResponse.json(
        { error: "No se encontró la solicitud de autor." },
        { status: 404 },
      );
    }

    if (current.status === "pending") {
      return NextResponse.json(
        { error: "Solo puedes archivar solicitudes ya procesadas." },
        { status: 400 },
      );
    }

    const nextRecord = { ...current, archived: true };
    const { error: updateError } = await admin
      .from("notifications")
      .update({
        message: serializeAuthorApplication(nextRecord),
      })
      .eq("id", params.id);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo archivar la solicitud.",
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
      .eq("type", "author_application")
      .maybeSingle();

    const current = parseAuthorApplication(row?.message);
    if (!row || !current) {
      return NextResponse.json(
        { error: "No se encontró la solicitud de autor." },
        { status: 404 },
      );
    }

    const nextRecord = { ...current, archived: false };
    const { error: updateError } = await admin
      .from("notifications")
      .update({
        message: serializeAuthorApplication(nextRecord),
      })
      .eq("id", params.id);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo restaurar la solicitud.",
      },
      { status: 500 },
    );
  }
}

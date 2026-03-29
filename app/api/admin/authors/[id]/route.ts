import { NextResponse } from "next/server";
import {
  type AuthorApplicationStatus,
} from "@/lib/authorApplications";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import {
  grantRoleByCode,
  revokeRoleByCode,
} from "@/lib/server/auth/roles";
import {
  createAuthorApplicationHistory,
  getAuthorApplicationById,
  notifyAuthorApplicationUpdate,
  updateAuthorApplicationRecord,
} from "@/lib/server/repositories/author-applications";
import {
  ensureServerUserRows,
} from "@/lib/server/auth/session";

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
    const { admin, user, error } = await requireAdminAccess(
      request,
      "authors.review",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const body = (await request.json()) as UpdateBody;
    const row = await getAuthorApplicationById(admin, params.id);
    if (!row || !row.record) {
      return NextResponse.json(
        { error: "No se encontró la solicitud de autor." },
        { status: 404 },
      );
    }

    const { data: targetAuthUser, error: targetAuthError } = await admin.auth.admin.getUserById(
      row.userId,
    );
    if (targetAuthError) {
      throw new Error(`No se pudo validar al solicitante: ${targetAuthError.message}`);
    }
    if (targetAuthUser?.user) {
      await ensureServerUserRows(admin, targetAuthUser.user);
    }

    const nextRecord = { ...row.record, status: body.status };

    await updateAuthorApplicationRecord({
      admin,
      id: params.id,
      record: nextRecord,
      markUnread: true,
    });

    if (body.status === "approved") {
      await grantRoleByCode(admin, row.userId, "author", user.id);
    } else {
      await revokeRoleByCode(admin, row.userId, "author");
    }

    await createAuthorApplicationHistory({
      admin,
      userId: row.userId,
      actorId: user.id,
      applicationId: params.id,
      action: body.status,
      reason: body.reason,
    });

    await notifyAuthorApplicationUpdate({
      admin,
      userId: row.userId,
      actorId: user.id,
      applicationId: params.id,
      message: buildAuthorMessage(body.status, body.reason),
    });

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
    const { admin, user, error } = await requireAdminAccess(
      request,
      "authors.review",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const row = await getAuthorApplicationById(admin, params.id);
    if (!row || !row.record) {
      return NextResponse.json(
        { error: "No se encontró la solicitud de autor." },
        { status: 404 },
      );
    }

    if (row.record.status === "pending") {
      return NextResponse.json(
        { error: "Solo puedes archivar solicitudes ya procesadas." },
        { status: 400 },
      );
    }

    await updateAuthorApplicationRecord({
      admin,
      id: params.id,
      record: { ...row.record, archived: true },
    });

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
    const { admin, user, error } = await requireAdminAccess(
      request,
      "authors.review",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const row = await getAuthorApplicationById(admin, params.id);
    if (!row || !row.record) {
      return NextResponse.json(
        { error: "No se encontró la solicitud de autor." },
        { status: 404 },
      );
    }

    await updateAuthorApplicationRecord({
      admin,
      id: params.id,
      record: { ...row.record, archived: false },
    });

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

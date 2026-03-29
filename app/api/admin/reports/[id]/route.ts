import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import {
  type ContentReport,
} from "@/lib/reports";
import {
  createModerationAction,
  getContentReportById,
  updateContentReportRecord,
} from "@/lib/server/repositories/moderation";

type UpdateBody = {
  status: "reviewed" | "dismissed" | "removed";
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await requireAdminAccess(
      request,
      "content.moderate",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const body = (await request.json()) as UpdateBody;
    const current = await getContentReportById(admin, params.id);
    if (!current) {
      return NextResponse.json(
        { error: "No se encontró el reporte." },
        { status: 404 },
      );
    }

    const nextRecord: ContentReport = {
      ...current.record,
      status: body.status,
    };

    await updateContentReportRecord({
      admin,
      id: params.id,
      record: nextRecord,
    });

    await createModerationAction({
      admin,
      userId: current.userId,
      actorId: user.id,
      albumId: current.record.albumId,
      reportId: current.id,
      action: body.status,
      reason: current.record.reason,
    });

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
    const { admin, user, error } = await requireAdminAccess(
      request,
      "content.moderate",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const current = await getContentReportById(admin, params.id);
    if (!current) {
      return NextResponse.json({ error: "No se encontró el reporte." }, { status: 404 });
    }

    if ((current.record.status ?? "open") === "open") {
      return NextResponse.json(
        { error: "Solo puedes archivar reportes ya procesados." },
        { status: 400 },
      );
    }

    await updateContentReportRecord({
      admin,
      id: params.id,
      record: { ...current.record, archived: true },
    });

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
    const { admin, user, error } = await requireAdminAccess(
      request,
      "content.moderate",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const current = await getContentReportById(admin, params.id);
    if (!current) {
      return NextResponse.json({ error: "No se encontró el reporte." }, { status: 404 });
    }

    await updateContentReportRecord({
      admin,
      id: params.id,
      record: { ...current.record, archived: false },
    });

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

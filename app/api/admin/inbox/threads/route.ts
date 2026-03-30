import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import { listAdminNotificationThreads } from "@/lib/server/repositories/notification-center";

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await requireAdminAccess(
      request,
      "admin.dashboard.read",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const threads = await listAdminNotificationThreads(admin, 120);
    return NextResponse.json({ ok: true, threads });
  } catch (requestError) {
    return NextResponse.json(
      {
        error:
          requestError instanceof Error
            ? requestError.message
            : "No se pudo cargar la bandeja admin.",
      },
      { status: 500 },
    );
  }
}

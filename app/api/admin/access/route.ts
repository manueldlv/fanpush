import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/auth/authorization";

export async function GET(request: Request) {
  try {
    const { user, error, isAdmin } = await requireAdminAccess(request);
    if (error || !user) {
      return NextResponse.json(
        { ok: false, isAdmin: false, error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      isAdmin,
      email: user.email ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        isAdmin: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo validar el acceso admin.",
      },
      { status: 500 },
    );
  }
}

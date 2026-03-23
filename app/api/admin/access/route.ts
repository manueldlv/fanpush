import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getAuthenticatedUser } from "@/lib/mercadopago";

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json(
        { ok: false, isAdmin: false, error: error ?? "No autorizado." },
        { status: 401 },
      );
    }

    const isAdmin = await isAdminUser(admin, user);

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

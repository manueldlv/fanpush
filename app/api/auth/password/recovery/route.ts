import { NextResponse } from "next/server";
import { sendPasswordRecoveryEmail } from "@/lib/server/auth/emails";
import { getAdminSupabase } from "@/lib/server/auth/session";

type RecoveryBody = {
  email?: string;
};

const normalizeEmail = (value: string) =>
  value.replace(/\s+/g, "").toLowerCase();

const resolveRedirectTo = (request: Request) => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return configured || new URL(request.url).origin.replace(/\/$/, "");
};

export async function POST(request: Request) {
  try {
    const admin = getAdminSupabase();
    if (!admin) {
      return NextResponse.json(
        { error: "No se pudo inicializar Supabase en el servidor." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as RecoveryBody;
    const email = normalizeEmail(body.email ?? "");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "El correo no es válido." }, { status: 400 });
    }

    const redirectTo = `${resolveRedirectTo(request)}/auth?reset=1`;

    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo,
      },
    });

    if (!error && data?.properties?.action_link) {
      await sendPasswordRecoveryEmail({
        to: email,
        recoveryUrl: data.properties.action_link,
      });
    }

    return NextResponse.json({
      ok: true,
      message:
        "Si existe una cuenta con ese correo, te enviamos un enlace para restablecer la contraseña.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo procesar la recuperación.",
      },
      { status: 500 },
    );
  }
}

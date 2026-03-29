import { NextResponse } from "next/server";
import { sendSignupConfirmationEmail } from "@/lib/server/auth/emails";
import { getAdminSupabase } from "@/lib/server/auth/session";

type ResendBody = {
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

    const body = (await request.json()) as ResendBody;
    const email = normalizeEmail(body.email ?? "");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "El correo no es válido." }, { status: 400 });
    }

    const redirectTo = `${resolveRedirectTo(request)}/auth`;

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo,
      },
    });

    if (error || !data?.properties?.action_link) {
      const message = error?.message ?? "No se pudo reenviar la confirmación.";
      const normalizedMessage = message.toLowerCase();

      if (
        normalizedMessage.includes("user not found") ||
        normalizedMessage.includes("email not found")
      ) {
        return NextResponse.json(
          {
            ok: true,
            message:
              "Si existe una cuenta con ese correo, te reenviamos el enlace de acceso o confirmación.",
          },
        );
      }

      throw new Error(message);
    }

    await sendSignupConfirmationEmail({
      to: email,
      confirmationUrl: data.properties.action_link,
    });

    return NextResponse.json({
      ok: true,
      message:
        "Te reenviamos el correo de confirmación. Revisa también la carpeta de spam.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo reenviar la confirmación.",
      },
      { status: 500 },
    );
  }
}

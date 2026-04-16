import { NextResponse } from "next/server";
import { sendSignupConfirmationEmail } from "@/lib/server/auth/emails";
import { getAdminSupabase } from "@/lib/server/auth/session";

type RegisterBody = {
  fullName?: string;
  username?: string;
  email?: string;
  password?: string;
  acceptedTerms?: boolean;
  referralCode?: string;
};

const normalizeEmail = (value: string) =>
  value.replace(/\s+/g, "").toLowerCase();

const normalizeUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, "");

const hasPasswordLetter = (value: string) => /[a-z]/i.test(value);
const hasPasswordNumber = (value: string) => /\d/.test(value);

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

    const body = (await request.json()) as RegisterBody;
    const fullName = body.fullName?.trim() ?? "";
    const username = normalizeUsername(body.username ?? "");
    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";
    const referralCode =
      body.referralCode?.trim().toLowerCase().replace(/^@+/, "") ?? "";

    if (fullName.length < 2) {
      return NextResponse.json(
        { error: "El nombre completo es obligatorio." },
        { status: 400 },
      );
    }

    if (username.length < 3 || !/^[a-z0-9._]+$/.test(username)) {
      return NextResponse.json(
        {
          error:
            "El nombre de usuario debe tener al menos 3 caracteres y solo usar letras, números, punto y guion bajo.",
        },
        { status: 400 },
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "El correo no es válido." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 },
      );
    }
    if (!hasPasswordLetter(password)) {
      return NextResponse.json(
        { error: "La contraseña debe incluir al menos una letra." },
        { status: 400 },
      );
    }
    if (!hasPasswordNumber(password)) {
      return NextResponse.json(
        { error: "La contraseña debe incluir al menos un número." },
        { status: 400 },
      );
    }

    if (!body.acceptedTerms) {
      return NextResponse.json(
        { error: "Debes aceptar los términos y condiciones." },
        { status: 400 },
      );
    }

    const { data: existingUsername, error: usernameError } = await admin
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (usernameError) {
      throw new Error(`No se pudo validar el nombre de usuario: ${usernameError.message}`);
    }

    if (existingUsername?.id) {
      return NextResponse.json(
        { error: "Ese nombre de usuario ya está en uso." },
        { status: 409 },
      );
    }

    const redirectTo = `${resolveRedirectTo(request)}/auth`;

    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        redirectTo,
        data: {
          full_name: fullName,
          username,
          accepted_terms: true,
          accepted_terms_at: new Date().toISOString(),
          ...(referralCode ? { referral_code: referralCode } : {}),
        },
      },
    });

    if (error || !data?.properties?.action_link) {
      const message = error?.message ?? "No se pudo crear la cuenta.";
      const normalizedMessage = message.toLowerCase();

      if (
        normalizedMessage.includes("already been registered") ||
        normalizedMessage.includes("already registered") ||
        normalizedMessage.includes("user already registered")
      ) {
        return NextResponse.json(
          { error: "Ya existe una cuenta con ese correo." },
          { status: 409 },
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
        "Cuenta creada. Te enviamos un correo para confirmar tu dirección antes de iniciar sesión.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear la cuenta.",
      },
      { status: 500 },
    );
  }
}

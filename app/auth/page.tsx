"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  const normalizeEmail = (value: string) => {
    const compact = value.replace(/\s+/g, "").toLowerCase();
    if (!compact) return "";
    if (/^[^\s@]+@[^\s@]+$/.test(compact)) {
      return `${compact}.com`;
    }
    return compact;
  };

  const validate = () => {
    if (mode === "register" && fullName.trim().length < 2) {
      return "El nombre completo es obligatorio.";
    }
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return "El correo es obligatorio.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return "El correo no es válido.";
    }
    if (password.length < 6) {
      return "La contraseña debe tener al menos 6 caracteres.";
    }
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError("Falta configurar SUPABASE_URL o SUPABASE_ANON_KEY.");
        return;
      }

      if (mode === "register") {
        const normalizedEmail = normalizeEmail(email);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { full_name: fullName.trim() },
          },
        });

        if (signUpError) throw signUpError;

        setSuccess(
          "Cuenta creada. Revisa tu correo para confirmar si es necesario.",
        );
        setMode("login");
      } else {
        const normalizedEmail = normalizeEmail(email);
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError) throw signInError;
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setSuccess(null);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Falta configurar SUPABASE_URL o SUPABASE_ANON_KEY.");
      return;
    }
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setError("Ingresa tu correo para reenviar la confirmación.");
      return;
    }
    setResendLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
      });
      if (resendError) throw resendError;
      setSuccess("Correo de confirmación reenviado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-6 py-12">
        <div className="mb-8 text-center">
          <div className="text-3xl font-semibold">Fanpush</div>
          <div className="mt-2 text-sm text-zinc-500">
            La plataforma social para creadores y fans.
          </div>
        </div>

        <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-[5px] px-3 py-2 text-sm font-semibold ${
                mode === "login"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700"
              }`}
            >
              Iniciar sesion
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 rounded-[5px] px-3 py-2 text-sm font-semibold ${
                mode === "register"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {mode === "register" ? (
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <input
                type="email"
                placeholder="Correo"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-[5px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-[5px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {success}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-6 w-full rounded-[5px] bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting
              ? "Procesando..."
              : mode === "login"
                ? "Entrar"
                : "Crear cuenta"}
          </button>

          {mode === "login" ? (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              className="mt-3 w-full rounded-[5px] border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {resendLoading
                ? "Reenviando..."
                : "Reenviar confirmación de email"}
            </button>
          ) : null}

          <div className="mt-4 text-center text-xs text-zinc-500">
            Al continuar aceptas los terminos y condiciones.
          </div>
        </div>
      </div>
    </div>
  );
}

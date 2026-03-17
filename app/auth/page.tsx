"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import Image from "next/image";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [forgot, setForgot] = useState(false);
  const [reset, setReset] = useState(false);
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const normalizeEmail = (value: string) => {
    const compact = value.replace(/\s+/g, "").toLowerCase();
    if (!compact) return "";
    if (/^[^\s@]+@[^\s@]+$/.test(compact)) {
      return `${compact}.com`;
    }
    return compact;
  };

  const validate = () => {
    if (reset) {
      if (newPassword.length < 6) {
        return "La contraseña debe tener al menos 6 caracteres.";
      }
      if (newPassword !== confirmPassword) {
        return "Las contraseñas no coinciden.";
      }
      return null;
    }
    if (forgot) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) return "El correo es obligatorio.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return "El correo no es válido.";
      }
      return null;
    }
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
      if (!supabase) throw new Error("Falta configurar Supabase.");
      if (reset) {
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (updateError) throw updateError;
        setSuccess("Contraseña actualizada. Ya podes iniciar sesión.");
        setReset(false);
        setForgot(false);
        setNewPassword("");
        setConfirmPassword("");
        await supabase.auth.signOut();
        window.location.assign("/auth?reset=done");
        return;
      }
      if (forgot) {
        const normalizedEmail = normalizeEmail(email);
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          { redirectTo: `${window.location.origin}/auth?reset=1` },
        );
        if (resetError) throw resetError;
        setSuccess("Te enviamos un mail para recuperar tu contraseña.");
        return;
      }

      if (mode === "register") {
        const normalizedEmail = normalizeEmail(email);
        const { error: signUpError } = await supabase.auth.signUp({
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

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const search =
      typeof window !== "undefined" ? window.location.search : "";
    if (search.includes("reset=done")) {
      setReset(false);
      setForgot(false);
      setMode("login");
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/auth");
      }
      return;
    }
    if (hash.includes("type=recovery") || search.includes("reset=1")) {
      setReset(true);
      setForgot(false);
      setMode("login");
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/auth?reset=1");
      }
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReset(true);
        setForgot(false);
        setMode("login");
      }
    });
    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto grid min-h-screen w-full max-w-[1400px] grid-cols-1 gap-0 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative hidden items-center justify-center border-r border-zinc-200 bg-white lg:flex">
          <div className="absolute left-10 top-10 text-3xl font-semibold">
            Fanpush
          </div>
          <div className="max-w-[480px] text-center">
            <h1 className="text-4xl font-semibold leading-tight">
              Mira los momentos cotidianos de tus <span className="text-pink-500">mejores amigos</span>.
            </h1>
            <div className="mt-10 flex items-center justify-center">
              <Image
                src="/auth-illustration.svg"
                alt="Fanpush ilustración"
                width={420}
                height={420}
                className="rounded-[24px]"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[420px]">
            <div className="mb-6 text-left">
              <div className="text-sm font-semibold text-zinc-900">
                {forgot
                  ? "Recuperar contraseña"
                  : mode === "login"
                    ? "Iniciar sesión en Fanpush"
                    : "Crear cuenta en Fanpush"}
              </div>
            </div>

            <form
              className="rounded-[12px] border border-zinc-200 bg-white p-6 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              {!forgot ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className={`flex-1 rounded-[8px] px-3 py-2 text-sm font-semibold ${
                      mode === "login"
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    Iniciar sesión
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className={`flex-1 rounded-[8px] px-3 py-2 text-sm font-semibold ${
                      mode === "register"
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    Crear cuenta
                  </button>
                </div>
              ) : null}

              <div className="mt-6 space-y-4">
                {mode === "register" && !forgot && !reset ? (
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="w-full rounded-[10px] border border-zinc-200 px-4 py-3 text-sm"
                  />
                ) : null}
                {!reset ? (
                  <input
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-[10px] border border-zinc-200 px-4 py-3 text-sm"
                  />
                ) : null}
                {!forgot && !reset ? (
                  <input
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-[10px] border border-zinc-200 px-4 py-3 text-sm"
                  />
                ) : null}
                {reset ? (
                  <>
                    <input
                      type="password"
                      placeholder="Nueva contraseña"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="w-full rounded-[10px] border border-zinc-200 px-4 py-3 text-sm"
                    />
                    <input
                      type="password"
                      placeholder="Confirmar contraseña"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="w-full rounded-[10px] border border-zinc-200 px-4 py-3 text-sm"
                    />
                  </>
                ) : null}
              </div>

              {error ? (
                <div className="mt-4 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </div>
              ) : null}
              {success ? (
                <div className="mt-4 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {success}
                </div>
              ) : null}

              <button
                type="submit"
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-6 w-full rounded-[999px] bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting
                  ? "Procesando..."
                  : reset
                    ? "Actualizar contraseña"
                    : forgot
                    ? "Enviar enlace"
                    : mode === "login"
                      ? "Iniciar sesión"
                      : "Crear cuenta"}
              </button>

              {!forgot && !reset ? (
                <button
                  type="button"
                  onClick={() => setForgot(true)}
                  className="mt-4 w-full text-center text-sm font-semibold text-zinc-700"
                >
                  ¿Has olvidado la contraseña?
                </button>
              ) : forgot ? (
                <button
                  type="button"
                  onClick={() => setForgot(false)}
                  className="mt-4 w-full text-center text-sm font-semibold text-zinc-700"
                >
                  Volver a iniciar sesión
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setReset(false)}
                  className="mt-4 w-full text-center text-sm font-semibold text-zinc-700"
                >
                  Volver a iniciar sesión
                </button>
              )}

              {mode === "login" && !forgot ? (
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="mt-4 w-full rounded-[999px] border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900"
                >
                  Crear una cuenta
                </button>
              ) : null}
            </form>

            <div className="mt-6 text-center text-xs text-zinc-500">
              Al continuar aceptas los términos y condiciones de Fanpush.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

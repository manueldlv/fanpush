"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRequestPasswordRecoveryMutation } from "@/lib/redux/api/authApi";
import {
  getSupabaseAdminBrowserClient,
  getSupabaseSessionSafely,
} from "@/lib/supabase";

const normalizeEmail = (value: string) =>
  value.replace(/\s+/g, "").toLowerCase();

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgot, setForgot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [requestPasswordRecovery] = useRequestPasswordRecoveryMutation();

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        throw new Error("El correo es obligatorio.");
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new Error("El correo no es válido.");
      }

      if (forgot) {
        const result = await requestPasswordRecovery({
          email: normalizedEmail,
        }).unwrap();
        setSuccess(
          result.message ??
            "Si existe una cuenta con ese correo, te enviamos un enlace para restablecer la contraseña.",
        );
        return;
      }

      if (!password) {
        throw new Error("La contraseña es obligatoria.");
      }

      const supabase = getSupabaseAdminBrowserClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError) throw signInError;

      const session =
        data.session ??
        (await getSupabaseSessionSafely(supabase, {
          storageKey: "fanpush-admin-auth",
        }));

      if (!session?.access_token) {
        throw new Error("No se pudo validar la sesión admin.");
      }

      let adminResponse: Response;
      try {
        adminResponse = await fetch("/api/admin/access", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      } catch {
        throw new Error(
          "No se pudo contactar al servidor para validar el acceso admin.",
        );
      }

      const adminResult = (await adminResponse.json().catch(() => null)) as {
        isAdmin?: boolean;
        error?: string;
      } | null;

      if (!adminResponse.ok || !adminResult?.isAdmin) {
        await supabase.auth.signOut();
        throw new Error(
          adminResult?.error ?? "Esa cuenta no tiene acceso al panel admin.",
        );
      }

      window.location.assign("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-4 py-10 text-zinc-950">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1280px] items-center justify-center">
        <div className="w-full max-w-[460px] rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
          <div>
            <Image
              src="/fanpush-logo.png"
              alt="FanPush"
              width={180}
              height={44}
              className="h-auto w-[122px]"
              priority
            />
            <h1 className="mt-5 text-3xl font-semibold text-zinc-950">Ingresar</h1>
          </div>

          <p className="mt-3 text-sm text-zinc-500">
            {forgot
              ? "Te enviaremos el mismo enlace seguro de recuperación que usa el login principal."
              : "Accede con una cuenta habilitada como admin para revisar métricas, moderación y pagos."}
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Correo admin"
              autoComplete="email"
              className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none placeholder:text-zinc-400"
            />
            {!forgot ? (
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Contraseña"
                type="password"
                autoComplete="current-password"
                className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none placeholder:text-zinc-400"
              />
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-2xl bg-[#5A3EE7] font-semibold text-white transition hover:bg-[#4c32d1] disabled:opacity-60"
            >
              {submitting
                ? forgot
                  ? "Enviando..."
                  : "Ingresando..."
                : forgot
                  ? "Enviar enlace"
                  : "Entrar al panel admin"}
            </button>
            {!forgot ? (
              <button
                type="button"
                onClick={() => {
                  setForgot(true);
                  setError(null);
                  setSuccess(null);
                }}
                className="w-full text-center text-sm font-semibold text-zinc-700 transition hover:text-zinc-900"
              >
                ¿Has olvidado la contraseña?
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setForgot(false);
                  setError(null);
                  setSuccess(null);
                }}
                className="w-full text-center text-sm font-semibold text-zinc-700 transition hover:text-zinc-900"
              >
                Volver a iniciar sesión
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

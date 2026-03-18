"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { isAdminIdentity } from "@/lib/admin";
import { getSupabaseClient } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) throw signInError;

      const isAdmin = isAdminIdentity({
        email: data.user?.email,
        username:
          typeof data.user?.user_metadata?.username === "string"
            ? data.user.user_metadata.username
            : null,
      });

      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error("Esa cuenta no tiene acceso al panel admin.");
      }

      window.location.assign("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-zinc-950 px-4 text-zinc-50">
      <div className="w-full max-w-[460px] rounded-[28px] border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-zinc-400">
              FanPush Admin
            </div>
            <h1 className="text-3xl font-semibold text-white">Ingresar</h1>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Correo admin"
            className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-white outline-none"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contraseña"
            type="password"
            className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-white outline-none"
          />
          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="h-12 w-full rounded-2xl bg-emerald-400 font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-60"
          >
            {submitting ? "Ingresando..." : "Entrar al panel admin"}
          </button>
        </div>
      </div>
    </div>
  );
}

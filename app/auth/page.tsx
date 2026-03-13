"use client";

import { useState } from "react";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

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
              <input
                type="text"
                placeholder="Nombre completo"
                className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm"
              />
            ) : null}
            <input
              type="email"
              placeholder="Correo"
              className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm"
            />
            <input
              type="password"
              placeholder="Contraseña"
              className="w-full rounded-[5px] border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="button"
            className="mt-6 w-full rounded-[5px] bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
          >
            {mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>

          <div className="mt-4 text-center text-xs text-zinc-500">
            Al continuar aceptas los terminos y condiciones.
          </div>
        </div>
      </div>
    </div>
  );
}

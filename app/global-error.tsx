"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="bg-zinc-50 text-zinc-950">
        <main className="flex min-h-screen items-center justify-center px-6 py-10">
          <div className="w-full max-w-[720px] rounded-[20px] border border-rose-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-medium text-rose-600">
              Error de aplicación
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-950">
              Algo falló en el cliente
            </h1>
            <p className="mt-4 rounded-[14px] bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-800">
              {error.message || "Error desconocido."}
            </p>
            {error.digest ? (
              <p className="mt-3 text-xs text-zinc-500">Digest: {error.digest}</p>
            ) : null}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-[12px] bg-zinc-950 px-4 py-3 text-sm font-semibold text-white"
              >
                Reintentar
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}

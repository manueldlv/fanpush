"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CreditCard, Shield, Trash2 } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { getSupabaseClient } from "@/lib/supabase";
import { formatARS } from "@/lib/utils";

type AdminDashboardData = {
  metrics: {
    users: number;
    albums: number;
    posts: number;
    purchases: number;
    purchaseGross: number;
    tipGross: number;
    totalGross: number;
  };
  commerce: {
    recentPurchases: Array<{
      id: string;
      amount: number;
      createdAt: string;
      buyer: string;
      seller: string;
    }>;
    recentTips: Array<{
      id: string;
      amount: number;
      actor: string;
      receiver: string;
      createdAt: string;
    }>;
    withdrawals: Array<{
      id: string;
      username: string;
      amount: number;
      status: "requested" | "scheduled" | "sent" | "rejected";
      statusLabel: string;
      createdAt: string;
    }>;
  };
  content: Array<{
    id: string;
    description: string;
    price: number;
    createdAt: string;
    username: string;
    avatar: string | null;
    mediaUrl: string | null;
    mediaType: string;
    itemsCount: number;
  }>;
};

export default function AdminPage() {
  const [tab, setTab] = useState<"metrics" | "commerce" | "content">("metrics");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingWithdrawalId, setUpdatingWithdrawalId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminDashboardData | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Necesitas iniciar sesión.");

      const response = await fetch("/api/admin/dashboard", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = (await response.json()) as AdminDashboardData & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo cargar el panel admin.");
      }
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el panel admin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(
    () => [
      { label: "Usuarios", value: data?.metrics.users ?? 0 },
      { label: "Álbumes", value: data?.metrics.albums ?? 0 },
      { label: "Posts", value: data?.metrics.posts ?? 0 },
      { label: "Compras", value: data?.metrics.purchases ?? 0 },
      { label: "Ventas brutas", value: formatARS(data?.metrics.purchaseGross ?? 0) },
      { label: "Propinas brutas", value: formatARS(data?.metrics.tipGross ?? 0) },
    ],
    [data],
  );

  const handleDeleteContent = async (albumId: string) => {
    const confirmed = window.confirm(
      "¿Eliminar este contenido del sitio? Esta acción borra el álbum y sus archivos.",
    );
    if (!confirmed) return;

    try {
      setDeletingId(albumId);
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Necesitas iniciar sesión.");

      const response = await fetch(`/api/admin/content/${albumId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo borrar el contenido.");
      }

      setData((prev) =>
        prev
          ? { ...prev, content: prev.content.filter((item) => item.id !== albumId) }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar el contenido.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateWithdrawal = async (
    id: string,
    status: "requested" | "scheduled" | "sent" | "rejected",
  ) => {
    try {
      setUpdatingWithdrawalId(id);
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Necesitas iniciar sesión.");

      const response = await fetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo actualizar el retiro.");
      }

      setData((prev) =>
        prev
          ? {
              ...prev,
              commerce: {
                ...prev.commerce,
                withdrawals: prev.commerce.withdrawals.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        status,
                        statusLabel:
                          status === "requested"
                            ? "Solicitado"
                            : status === "scheduled"
                              ? "Programado"
                              : status === "sent"
                                ? "Enviado"
                                : "Rechazado",
                      }
                    : item,
                ),
              },
            }
          : prev,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar el retiro.",
      );
    } finally {
      setUpdatingWithdrawalId(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-50 md:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-emerald-300">
              FanPush Admin
            </div>
            <h1 className="mt-2 text-4xl font-semibold">Panel de control</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Métricas globales, actividad comercial y moderación del contenido.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-200"
          >
            Actualizar
          </button>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {[
            { id: "metrics", label: "Métricas", icon: BarChart3 },
            { id: "commerce", label: "Compras y ventas", icon: CreditCard },
            { id: "content", label: "Moderación de contenido", icon: Shield },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-emerald-400 text-zinc-950"
                    : "border border-zinc-800 bg-zinc-900 text-zinc-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-400">
            Cargando panel admin...
          </div>
        ) : null}

        {!loading && data && tab === "metrics" ? (
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {metrics.map((item) => (
              <div
                key={item.label}
                className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="text-sm text-zinc-400">{item.label}</div>
                <div className="mt-3 text-3xl font-semibold text-white">
                  {item.value}
                </div>
              </div>
            ))}
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 md:col-span-3">
              <div className="text-sm text-emerald-200">Facturación total del sitio</div>
              <div className="mt-3 text-4xl font-semibold text-white">
                {formatARS(data.metrics.totalGross)}
              </div>
            </div>
          </div>
        ) : null}

        {!loading && data && tab === "commerce" ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Compras recientes</h2>
              <div className="mt-4 space-y-3">
                {data.commerce.recentPurchases.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm"
                  >
                    <div className="font-semibold text-white">
                      {item.buyer} compró a {item.seller}
                    </div>
                    <div className="mt-1 text-zinc-400">
                      {formatARS(item.amount)} ·{" "}
                      {new Date(item.createdAt).toLocaleString("es-AR")}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Propinas recientes</h2>
              <div className="mt-4 space-y-3">
                {data.commerce.recentTips.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm"
                  >
                    <div className="font-semibold text-white">
                      {item.actor} le envió propina a {item.receiver}
                    </div>
                    <div className="mt-1 text-zinc-400">
                      {formatARS(item.amount)} ·{" "}
                      {new Date(item.createdAt).toLocaleString("es-AR")}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
              <h2 className="text-xl font-semibold">Retiros</h2>
              <div className="mt-4 space-y-3">
                {data.commerce.withdrawals.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                    No hay retiros solicitados.
                  </div>
                ) : (
                  data.commerce.withdrawals.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-semibold text-white">
                            @{item.username} · {formatARS(item.amount)}
                          </div>
                          <div className="mt-1 text-zinc-400">
                            {item.statusLabel} ·{" "}
                            {new Date(item.createdAt).toLocaleString("es-AR")}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateWithdrawal(item.id, "scheduled")}
                            disabled={updatingWithdrawalId === item.id}
                            className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 disabled:opacity-60"
                          >
                            Programar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateWithdrawal(item.id, "sent")}
                            disabled={updatingWithdrawalId === item.id}
                            className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                          >
                            Marcar enviado
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateWithdrawal(item.id, "rejected")}
                            disabled={updatingWithdrawalId === item.id}
                            className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-200 disabled:opacity-60"
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {!loading && data && tab === "content" ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.content.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900"
              >
                <div className="aspect-[4/3] bg-zinc-950">
                  {item.mediaUrl ? (
                    item.mediaType === "video" ? (
                      <video
                        src={item.mediaUrl}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={item.mediaUrl}
                        alt={item.description || item.username}
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                      Sin preview
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <UserAvatar src={item.avatar} alt={item.username} />
                    <div>
                      <div className="text-sm font-semibold text-white">
                        @{item.username}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {new Date(item.createdAt).toLocaleString("es-AR")}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-zinc-300">
                    {item.description || "Sin descripción"}
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">
                    {item.itemsCount} archivos · {formatARS(item.price)}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteContent(item.id)}
                    disabled={deletingId === item.id}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingId === item.id ? "Eliminando..." : "Eliminar contenido"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

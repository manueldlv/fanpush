"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  RefreshCcw,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { getSupabaseAdminBrowserClient } from "@/lib/supabase";
import { cn, formatARS } from "@/lib/utils";

type AdminDashboardData = {
  metrics: {
    users: number;
    albums: number;
    posts: number;
    purchases: number;
    purchaseGross: number;
    tipGross: number;
    totalGross: number;
    creatorsNet: number;
    platformFee: number;
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
      status: "requested" | "sent" | "rejected";
      statusLabel: string;
      createdAt: string;
      payoutAlias: string | null;
      payoutHolder: string | null;
      payoutDocument: string | null;
    }>;
    reports: Array<{
      id: string;
      albumId: string;
      reason: string;
      createdAt: string;
      reportedBy: string;
      owner: string;
      status: "open" | "reviewed" | "dismissed" | "removed";
      archived: boolean;
    }>;
    authorApplications: Array<{
      id: string;
      username: string;
      fullName: string;
      birthDate: string;
      documentType: string;
      documentNumber: string;
      country: string;
      province: string;
      city: string;
      address: string;
      documentFrontUrl: string;
      documentBackUrl: string;
      status: "pending" | "approved" | "rejected";
      submittedAt: string;
      archived?: boolean;
    }>;
    authorApplicationHistory: Array<{
      id: string;
      applicationId: string;
      action: "pending" | "approved" | "rejected";
      reason: string;
      actedAt: string;
      actor: string;
    }>;
    reportHistory: Array<{
      id: string;
      reportId: string;
      albumId: string;
      action: "reviewed" | "dismissed" | "removed";
      reason: string;
      actedAt: string;
      actor: string;
    }>;
    archivedContent: Array<{
      id: string;
      albumId: string;
      owner: string;
      description: string;
      itemsCount: number;
      archivedAt: string;
    }>;
    withdrawalHistory: Array<{
      id: string;
      withdrawalId: string;
      status: "requested" | "sent" | "rejected";
      statusLabel: string;
      amount: number;
      actedAt: string;
      actor: string;
      reason: string;
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
    media: Array<{
      url: string | null;
      type: string;
    }>;
  }>;
};

type ContentItem = AdminDashboardData["content"][number];

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "emerald" | "blue";
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border p-5 shadow-sm",
        tone === "default" && "border-zinc-200 bg-white",
        tone === "emerald" && "border-emerald-200 bg-emerald-50",
        tone === "blue" && "border-blue-200 bg-blue-50",
      )}
    >
      <div className="text-sm font-medium text-zinc-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
        {value}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<
    "metrics" | "commerce" | "authors" | "reports" | "content"
  >("metrics");
  const [commerceView, setCommerceView] = useState<
    "purchases" | "tips" | "withdrawals" | "withdrawal-history"
  >("purchases");
  const [authorsView, setAuthorsView] = useState<"pending" | "history" | "archived">("pending");
  const [reportsView, setReportsView] = useState<"pending" | "history" | "archived">("pending");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingWithdrawalId, setUpdatingWithdrawalId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [restoringArchiveId, setRestoringArchiveId] = useState<string | null>(null);
  const [updatingAuthorId, setUpdatingAuthorId] = useState<string | null>(null);
  const [archivingAuthorId, setArchivingAuthorId] = useState<string | null>(null);
  const [restoringAuthorId, setRestoringAuthorId] = useState<string | null>(null);
  const [archivingReportId, setArchivingReportId] = useState<string | null>(null);
  const [restoringReportId, setRestoringReportId] = useState<string | null>(null);
  const [rejectingAuthor, setRejectingAuthor] = useState<{
    id: string;
    username: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deletingContent, setDeletingContent] = useState<{
    id: string;
    username: string;
    reportId?: string;
  } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [rejectingWithdrawal, setRejectingWithdrawal] = useState<{
    id: string;
    username: string;
  } | null>(null);
  const [withdrawalRejectReason, setWithdrawalRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseAdminBrowserClient();
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
      setError(
        err instanceof Error ? err.message : "No se pudo cargar el panel admin.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedContent) return;
    const maxIndex = Math.max((selectedContent.media?.length ?? 1) - 1, 0);
    setSelectedMediaIndex((prev) => Math.min(prev, maxIndex));
  }, [selectedContent]);

  const overviewStats = useMemo(
    () => [
      { label: "Usuarios registrados", value: data?.metrics.users ?? 0 },
      { label: "Álbumes publicados", value: data?.metrics.albums ?? 0 },
      { label: "Archivos totales", value: data?.metrics.posts ?? 0 },
      { label: "Compras realizadas", value: data?.metrics.purchases ?? 0 },
    ],
    [data],
  );

  const financeStats = useMemo(
    () => [
      {
        label: "Ventas totales de usuarios",
        value: formatARS(data?.metrics.creatorsNet ?? 0),
        tone: "emerald" as const,
      },
      {
        label: "Comisión FanPush",
        value: formatARS(data?.metrics.platformFee ?? 0),
        tone: "blue" as const,
      },
      {
        label: "Facturación bruta del sitio",
        value: formatARS(data?.metrics.totalGross ?? 0),
        tone: "default" as const,
      },
      {
        label: "Propinas brutas",
        value: formatARS(data?.metrics.tipGross ?? 0),
        tone: "default" as const,
      },
    ],
    [data],
  );

  const pendingAuthorApplications = useMemo(
    () =>
      data?.commerce.authorApplications.filter(
        (item) => item.status === "pending" && !item.archived,
      ) ??
      [],
    [data],
  );

  const reviewedAuthorApplications = useMemo(
    () =>
      data?.commerce.authorApplications.filter(
        (item) => item.status !== "pending" && !item.archived,
      ) ??
      [],
    [data],
  );

  const archivedAuthorApplications = useMemo(
    () =>
      (data?.commerce.authorApplications ?? []).filter((item) => item.archived),
    [data],
  );

  const pendingReports = useMemo(
    () =>
      (data?.commerce.reports ?? []).filter(
        (item) => item.status === "open" && !item.archived,
      ),
    [data],
  );

  const reviewedReports = useMemo(
    () =>
      (data?.commerce.reports ?? []).filter(
        (item) => item.status !== "open" && !item.archived,
      ),
    [data],
  );

  const archivedReports = useMemo(
    () => (data?.commerce.reports ?? []).filter((item) => item.archived),
    [data],
  );

  const handleDeleteContent = async (albumId: string, reason: string) => {
    try {
      setDeletingId(albumId);
      const supabase = getSupabaseAdminBrowserClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Necesitas iniciar sesión.");

      const response = await fetch(`/api/admin/content/${albumId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reason }),
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
      if (selectedContent?.id === albumId) {
        setSelectedContent(null);
      }
      if (deletingContent?.reportId) {
        await handleUpdateReport(deletingContent.reportId, "removed");
      }
      setDeletingContent(null);
      setDeleteReason("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo borrar el contenido.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateWithdrawal = async (
    id: string,
    status: "requested" | "sent" | "rejected",
    reason = "",
  ) => {
    try {
      setUpdatingWithdrawalId(id);
      const supabase = getSupabaseAdminBrowserClient();
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
        body: JSON.stringify({ status, reason }),
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
                withdrawals: prev.commerce.withdrawals.filter((item) => item.id !== id),
              },
            }
          : prev,
      );
      if (status === "rejected") {
        setRejectingWithdrawal(null);
        setWithdrawalRejectReason("");
      }
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar el retiro.",
      );
    } finally {
      setUpdatingWithdrawalId(null);
    }
  };

  const handleUpdateReport = async (
    id: string,
    status: "reviewed" | "dismissed" | "removed",
  ) => {
    try {
      setUpdatingReportId(id);
      const supabase = getSupabaseAdminBrowserClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Necesitas iniciar sesión.");

      const response = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo actualizar el reporte.");
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar el reporte.",
      );
    } finally {
      setUpdatingReportId(null);
    }
  };

  const handleUpdateAuthor = async (
    id: string,
    status: "approved" | "rejected",
    reason = "",
  ) => {
    try {
      setUpdatingAuthorId(id);
      const supabase = getSupabaseAdminBrowserClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Necesitas iniciar sesión.");

      const response = await fetch(`/api/admin/authors/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          status,
          reason: status === "rejected" ? reason.trim() : "",
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error ?? "No se pudo actualizar la solicitud de autor.",
        );
      }

      if (status === "rejected") {
        setRejectingAuthor(null);
        setRejectReason("");
      }

      setData((prev) =>
        prev
          ? {
              ...prev,
              commerce: {
                ...prev.commerce,
                authorApplications: prev.commerce.authorApplications.map((item) =>
                  item.id === id ? { ...item, status } : item,
                ),
              },
            }
          : prev,
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la solicitud de autor.",
      );
    } finally {
      setUpdatingAuthorId(null);
    }
  };

  const handleArchiveAuthor = async (id: string) => {
    try {
      setArchivingAuthorId(id);
      const supabase = getSupabaseAdminBrowserClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Necesitas iniciar sesión.");

      const response = await fetch(`/api/admin/authors/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo archivar la solicitud.");
      }

      setData((prev) =>
        prev
          ? {
              ...prev,
              commerce: {
                ...prev.commerce,
                authorApplications: prev.commerce.authorApplications.filter(
                  (item) => item.id !== id,
                ),
              },
            }
          : prev,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo archivar la solicitud.",
      );
    } finally {
      setArchivingAuthorId(null);
    }
  };

  const handleRestoreAuthor = async (id: string) => {
    try {
      setRestoringAuthorId(id);
      const supabase = getSupabaseAdminBrowserClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Necesitas iniciar sesión.");

      const response = await fetch(`/api/admin/authors/${id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo restaurar la solicitud.");
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo restaurar la solicitud.",
      );
    } finally {
      setRestoringAuthorId(null);
    }
  };

  const handleArchiveReport = async (id: string) => {
    try {
      setArchivingReportId(id);
      const supabase = getSupabaseAdminBrowserClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Necesitas iniciar sesión.");

      const response = await fetch(`/api/admin/reports/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo archivar el reporte.");
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo archivar el reporte.",
      );
    } finally {
      setArchivingReportId(null);
    }
  };

  const handleRestoreReport = async (id: string) => {
    try {
      setRestoringReportId(id);
      const supabase = getSupabaseAdminBrowserClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Necesitas iniciar sesión.");

      const response = await fetch(`/api/admin/reports/${id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo restaurar el reporte.");
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo restaurar el reporte.",
      );
    } finally {
      setRestoringReportId(null);
    }
  };

  const handleExportWithdrawals = () => {
    if (!data?.commerce.withdrawals.length) return;
    const csvRows = [
      ["usuario", "monto", "estado", "fecha", "alias", "titular", "documento"].join(","),
      ...data.commerce.withdrawals.map((item) =>
        [
          item.username,
          item.amount,
          item.statusLabel,
          new Date(item.createdAt).toLocaleString("es-AR"),
          item.payoutAlias ?? "",
          item.payoutHolder ?? "",
          item.payoutDocument ?? "",
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "retiros-fanpush.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSeedDemo = async () => {
    try {
      setSeedingDemo(true);
      const supabase = getSupabaseAdminBrowserClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Necesitas iniciar sesión.");

      const response = await fetch("/api/admin/dev/seed", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudieron cargar datos demo.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudieron cargar datos demo.",
      );
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleRestoreContent = async (archiveId: string) => {
    try {
      setRestoringArchiveId(archiveId);
      const supabase = getSupabaseAdminBrowserClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Necesitas iniciar sesión.");

      const response = await fetch(`/api/admin/content/restore/${archiveId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo restablecer el contenido.");
      }
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo restablecer el contenido.",
      );
    } finally {
      setRestoringArchiveId(null);
    }
  };

  const selectedMedia = selectedContent
    ? selectedContent.media?.[selectedMediaIndex] || {
        url: selectedContent.mediaUrl,
        type: selectedContent.mediaType,
      }
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 pb-10 pt-6 md:px-6">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-400">
                FanPush Admin
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
                Panel de control
              </h1>
              <p className="mt-3 max-w-[720px] text-sm text-zinc-500 md:text-base">
                Supervisá métricas del sitio, flujo de compras, retiros y todo el
                contenido publicado desde un solo lugar.
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-800 shadow-sm"
            >
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </button>
            <button
              type="button"
              onClick={handleSeedDemo}
              disabled={seedingDemo}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] border border-zinc-200 bg-zinc-950 px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            >
              {seedingDemo ? "Cargando demo..." : "Cargar datos demo"}
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { id: "metrics", label: "Métricas", icon: BarChart3 },
              { id: "commerce", label: "Compras, ventas y retiros", icon: CreditCard },
              { id: "authors", label: "Autores y verificación", icon: Shield },
              { id: "reports", label: "Reportes y denuncias", icon: Eye },
              { id: "content", label: "Moderación de contenido", icon: Shield },
            ].map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id as typeof tab)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-[18px] px-4 py-3 text-sm font-semibold transition",
                    active
                      ? "bg-zinc-950 text-white"
                      : "border border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[24px] border border-zinc-200 bg-white p-10 text-center text-zinc-500 shadow-sm">
            Cargando panel admin...
          </div>
        ) : null}

        {!loading && data && tab === "metrics" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {overviewStats.map((item) => (
                <StatCard key={item.label} label={item.label} value={item.value} />
              ))}
            </div>

            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-zinc-950">
                Ingresos del sitio
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Separación entre lo que corresponde a creadores y la comisión de
                FanPush.
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {financeStats.map((item) => (
                  <StatCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    tone={item.tone}
                  />
                ))}
              </div>

              <div className="mt-6 overflow-hidden rounded-[20px] border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Concepto</th>
                      <th className="px-4 py-3 font-medium">Monto</th>
                      <th className="px-4 py-3 font-medium">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        Compras brutas
                      </td>
                      <td className="px-4 py-3 text-zinc-900">
                        {formatARS(data.metrics.purchaseGross)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        Total facturado por contenido bloqueado.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        Propinas brutas
                      </td>
                      <td className="px-4 py-3 text-zinc-900">
                        {formatARS(data.metrics.tipGross)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        Total cobrado en propinas directas.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        Neto de usuarios
                      </td>
                      <td className="px-4 py-3 text-emerald-700">
                        {formatARS(data.metrics.creatorsNet)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        70% acreditable a creadores.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        Comisión FanPush
                      </td>
                      <td className="px-4 py-3 text-blue-700">
                        {formatARS(data.metrics.platformFee)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        30% retenido por la plataforma.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && data && tab === "commerce" ? (
          <div className="space-y-6">
            <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setCommerceView("purchases")}
                  className={cn(
                    "rounded-[16px] px-4 py-3 text-sm font-semibold transition",
                    commerceView === "purchases"
                      ? "bg-zinc-950 text-white"
                      : "border border-zinc-200 bg-zinc-100 text-zinc-700",
                  )}
                >
                  Compras
                </button>
                <button
                  type="button"
                  onClick={() => setCommerceView("tips")}
                  className={cn(
                    "rounded-[16px] px-4 py-3 text-sm font-semibold transition",
                    commerceView === "tips"
                      ? "bg-zinc-950 text-white"
                      : "border border-zinc-200 bg-zinc-100 text-zinc-700",
                  )}
                >
                  Propinas
                </button>
                <button
                  type="button"
                  onClick={() => setCommerceView("withdrawals")}
                  className={cn(
                    "rounded-[16px] px-4 py-3 text-sm font-semibold transition",
                    commerceView === "withdrawals"
                      ? "bg-zinc-950 text-white"
                      : "border border-zinc-200 bg-zinc-100 text-zinc-700",
                  )}
                >
                  Retiros
                </button>
                <button
                  type="button"
                  onClick={() => setCommerceView("withdrawal-history")}
                  className={cn(
                    "rounded-[16px] px-4 py-3 text-sm font-semibold transition",
                    commerceView === "withdrawal-history"
                      ? "bg-zinc-950 text-white"
                      : "border border-zinc-200 bg-zinc-100 text-zinc-700",
                  )}
                >
                  Historial de retiros
                </button>
              </div>
            </div>

            {commerceView === "purchases" ? (
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-zinc-950">Compras</div>
              <div className="mt-4 max-h-[420px] overflow-auto rounded-[20px] border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Comprador</th>
                      <th className="px-4 py-3 font-medium">Vendedor</th>
                      <th className="px-4 py-3 font-medium">Monto</th>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {data.commerce.recentPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                          Todavía no hay compras.
                        </td>
                      </tr>
                    ) : (
                      data.commerce.recentPurchases.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            @{item.buyer}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">@{item.seller}</td>
                          <td className="px-4 py-3 text-zinc-900">
                            {formatARS(item.amount)}
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {new Date(item.createdAt).toLocaleString("es-AR")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            ) : null}

            {commerceView === "tips" ? (
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-zinc-950">Propinas</div>
              <div className="mt-4 max-h-[420px] overflow-auto rounded-[20px] border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Usuario que envía</th>
                      <th className="px-4 py-3 font-medium">Usuario que recibe</th>
                      <th className="px-4 py-3 font-medium">Monto</th>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {data.commerce.recentTips.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                          Todavía no hay propinas.
                        </td>
                      </tr>
                    ) : (
                      data.commerce.recentTips.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            @{item.actor}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">@{item.receiver}</td>
                          <td className="px-4 py-3 text-zinc-900">
                            {formatARS(item.amount)}
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {new Date(item.createdAt).toLocaleString("es-AR")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            ) : null}

            {commerceView === "withdrawals" ? (
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-zinc-950">Retiros</div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleExportWithdrawals}
                  className="rounded-[12px] border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700"
                >
                  Exportar CSV
                </button>
              </div>
              <div className="mt-4 max-h-[420px] overflow-auto rounded-[20px] border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Usuario</th>
                      <th className="px-4 py-3 font-medium">Monto</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Alias / CVU / CBU</th>
                      <th className="px-4 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {data.commerce.withdrawals.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                          No hay retiros solicitados.
                        </td>
                      </tr>
                    ) : (
                      data.commerce.withdrawals.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            @{item.username}
                          </td>
                          <td className="px-4 py-3 text-zinc-900">
                            {formatARS(item.amount)}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {item.statusLabel}
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {new Date(item.createdAt).toLocaleString("es-AR")}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            <div>{item.payoutAlias ?? "Sin datos"}</div>
                            {item.payoutHolder ? (
                              <div className="text-xs text-zinc-500">
                                {item.payoutHolder} · {item.payoutDocument ?? "Sin doc"}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateWithdrawal(item.id, "sent")}
                                disabled={updatingWithdrawalId === item.id}
                                className="rounded-[12px] bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                              >
                                Enviado
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingWithdrawal({
                                    id: item.id,
                                    username: item.username,
                                  });
                                  setWithdrawalRejectReason("");
                                }}
                                disabled={updatingWithdrawalId === item.id}
                                className="rounded-[12px] bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                              >
                                Rechazar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            ) : null}

            {commerceView === "withdrawal-history" ? (
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-zinc-950">Historial de retiros</div>
              <div className="mt-4 max-h-[320px] overflow-auto rounded-[20px] border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Acción</th>
                      <th className="px-4 py-3 font-medium">Monto</th>
                      <th className="px-4 py-3 font-medium">Motivo</th>
                      <th className="px-4 py-3 font-medium">Admin</th>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {data.commerce.withdrawalHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                          No hay movimientos todavía.
                        </td>
                      </tr>
                    ) : (
                      data.commerce.withdrawalHistory.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            {item.statusLabel}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {formatARS(item.amount)}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {item.reason || "Sin motivo"}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">@{item.actor}</td>
                          <td className="px-4 py-3 text-zinc-500">
                            {new Date(item.actedAt).toLocaleString("es-AR")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            ) : null}

          </div>
        ) : null}

        {!loading && data && tab === "authors" ? (
          <div className="space-y-6">
            <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setAuthorsView("pending")}
                  className={cn(
                    "rounded-[16px] px-4 py-3 text-sm font-semibold transition",
                    authorsView === "pending"
                      ? "bg-zinc-950 text-white"
                      : "border border-zinc-200 bg-zinc-100 text-zinc-700",
                  )}
                >
                  Pendientes
                </button>
                <button
                  type="button"
                  onClick={() => setAuthorsView("history")}
                  className={cn(
                    "rounded-[16px] px-4 py-3 text-sm font-semibold transition",
                    authorsView === "history"
                      ? "bg-zinc-950 text-white"
                      : "border border-zinc-200 bg-zinc-100 text-zinc-700",
                  )}
                >
                  Historial
                </button>
                <button
                  type="button"
                  onClick={() => setAuthorsView("archived")}
                  className={cn(
                    "rounded-[16px] px-4 py-3 text-sm font-semibold transition",
                    authorsView === "archived"
                      ? "bg-zinc-950 text-white"
                      : "border border-zinc-200 bg-zinc-100 text-zinc-700",
                  )}
                >
                  Archivadas
                </button>
              </div>
            </div>

            {authorsView === "pending" ? (
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-zinc-950">
                Solicitudes de autor
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Revisa identidad, edad y documentación antes de habilitar la
                creación y venta de contenido.
              </div>
              <div className="mt-4 max-h-[520px] overflow-auto rounded-[20px] border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Usuario</th>
                      <th className="px-4 py-3 font-medium">Identidad</th>
                      <th className="px-4 py-3 font-medium">Ubicación</th>
                      <th className="px-4 py-3 font-medium">Documentos</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Enviada</th>
                      <th className="px-4 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {pendingAuthorApplications.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                          No hay solicitudes pendientes para revisar.
                        </td>
                      </tr>
                    ) : (
                      pendingAuthorApplications.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium text-zinc-900">@{item.username}</div>
                          </td>
                          <td className="px-4 py-3 align-top text-zinc-700">
                            <div className="font-medium text-zinc-900">{item.fullName}</div>
                            <div className="text-xs text-zinc-500">
                              {item.documentType} {item.documentNumber}
                            </div>
                            <div className="text-xs text-zinc-500">
                              Nacimiento: {new Date(item.birthDate).toLocaleDateString("es-AR")}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-zinc-700">
                            <div>{item.city}, {item.province}</div>
                            <div className="text-xs text-zinc-500">{item.country}</div>
                            <div className="text-xs text-zinc-500">{item.address}</div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex gap-2">
                              <a
                                href={item.documentFrontUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-[12px] border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-800"
                              >
                                Ver frente
                              </a>
                              <a
                                href={item.documentBackUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-[12px] border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-800"
                              >
                                Ver dorso
                              </a>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-zinc-700">
                            {item.status === "approved"
                              ? "Aprobado"
                              : item.status === "rejected"
                                ? "Rechazado"
                                : "Pendiente"}
                          </td>
                          <td className="px-4 py-3 align-top text-zinc-500">
                            {new Date(item.submittedAt).toLocaleString("es-AR")}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateAuthor(item.id, "approved")}
                                disabled={updatingAuthorId === item.id}
                                className="rounded-[12px] bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingAuthor({
                                    id: item.id,
                                    username: item.username,
                                  });
                                  setRejectReason("");
                                }}
                                disabled={updatingAuthorId === item.id}
                                className="rounded-[12px] bg-red-100 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                              >
                                Rechazar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            ) : null}

            {authorsView === "history" ? (
              <>
                <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-zinc-950">
                Solicitudes resueltas
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Consultas puntuales sobre solicitudes ya aprobadas o rechazadas. Desde acá puedes cambiar la decisión si fue un error.
              </div>
              <div className="mt-4 max-h-[420px] overflow-auto rounded-[20px] border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Usuario</th>
                      <th className="px-4 py-3 font-medium">Estado actual</th>
                      <th className="px-4 py-3 font-medium">Documentos</th>
                      <th className="px-4 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {reviewedAuthorApplications.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                          No hay solicitudes resueltas todavía.
                        </td>
                      </tr>
                    ) : (
                      reviewedAuthorApplications.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium text-zinc-900">@{item.username}</div>
                            <div className="text-xs text-zinc-500">{item.fullName}</div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-[12px] px-3 py-2 text-xs font-semibold",
                                item.status === "approved"
                                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border border-red-200 bg-red-50 text-red-700",
                              )}
                            >
                              {item.status === "approved" ? "Aprobado" : "Rechazado"}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex gap-2">
                              <a
                                href={item.documentFrontUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-[12px] border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-800"
                              >
                                Ver frente
                              </a>
                              <a
                                href={item.documentBackUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-[12px] border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-800"
                              >
                                Ver dorso
                              </a>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-wrap gap-2">
                              {item.status === "rejected" ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateAuthor(item.id, "approved")}
                                  disabled={updatingAuthorId === item.id}
                                  className="rounded-[12px] bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                                >
                                  Aprobar
                                </button>
                              ) : null}
                              {item.status === "approved" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectingAuthor({
                                      id: item.id,
                                      username: item.username,
                                    });
                                    setRejectReason("");
                                  }}
                                  disabled={updatingAuthorId === item.id}
                                  className="rounded-[12px] bg-red-100 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                                >
                                  Rechazar
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleArchiveAuthor(item.id)}
                                disabled={archivingAuthorId === item.id}
                                className="rounded-[12px] border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                              >
                                {archivingAuthorId === item.id ? "Archivando..." : "Archivar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
                </div>

                <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-zinc-950">
                Historial de movimientos
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Registro cronológico de cada aprobación o rechazo con su motivo.
              </div>
              <div className="mt-4 max-h-[320px] overflow-auto rounded-[20px] border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Motivo</th>
                      <th className="px-4 py-3 font-medium">Admin</th>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {data.commerce.authorApplicationHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                          No hay movimientos todavía.
                        </td>
                      </tr>
                    ) : (
                      data.commerce.authorApplicationHistory.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            {item.action === "approved"
                              ? "Aprobado"
                              : item.action === "rejected"
                                ? "Rechazado"
                                : "Pendiente"}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {item.reason || "Sin motivo"}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">@{item.actor}</td>
                          <td className="px-4 py-3 text-zinc-500">
                            {new Date(item.actedAt).toLocaleString("es-AR")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
                </div>
              </>
            ) : null}

            {authorsView === "archived" ? (
              <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="text-lg font-semibold text-zinc-950">
                  Solicitudes archivadas
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Solicitudes ya procesadas y archivadas. Puedes restaurarlas para volver a verlas en historial.
                </div>
                <div className="mt-4 max-h-[420px] overflow-auto rounded-[20px] border border-zinc-200">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-100 text-left text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Usuario</th>
                        <th className="px-4 py-3 font-medium">Estado</th>
                        <th className="px-4 py-3 font-medium">Enviada</th>
                        <th className="px-4 py-3 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 bg-white">
                      {archivedAuthorApplications.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                            No hay solicitudes archivadas.
                          </td>
                        </tr>
                      ) : (
                        archivedAuthorApplications.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 font-medium text-zinc-900">
                              @{item.username}
                            </td>
                            <td className="px-4 py-3 text-zinc-700">
                              {item.status === "approved" ? "Aprobado" : "Rechazado"}
                            </td>
                            <td className="px-4 py-3 text-zinc-500">
                              {new Date(item.submittedAt).toLocaleString("es-AR")}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => handleRestoreAuthor(item.id)}
                                disabled={restoringAuthorId === item.id}
                                className="rounded-[12px] border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                              >
                                {restoringAuthorId === item.id ? "Restaurando..." : "Restaurar"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {!loading && data && tab === "reports" ? (
          <div className="space-y-6">
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-zinc-950">
                Reportes de contenido
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Denuncias enviadas por usuarios para que moderación pueda revisar y
                abrir la publicación exacta denunciada.
              </div>
            </div>

            <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap gap-3">
                {(["pending", "history", "archived"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setReportsView(view)}
                    className={cn(
                      "rounded-[16px] px-4 py-3 text-sm font-semibold transition",
                      reportsView === view
                        ? "bg-zinc-950 text-white"
                        : "border border-zinc-200 bg-zinc-100 text-zinc-700",
                    )}
                  >
                    {view === "pending"
                      ? "Pendientes"
                      : view === "history"
                        ? "Historial"
                        : "Archivados"}
                  </button>
                ))}
              </div>
            </div>

            {reportsView === "pending" ? (
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-950">
                    Cola de denuncias
                  </div>
                  <div className="text-sm text-zinc-500">
                    {pendingReports.length} reportes pendientes de revisión visual.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTab("content")}
                  className="rounded-[14px] border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-800"
                >
                  Ir a moderación
                </button>
              </div>

              <div className="max-h-[420px] overflow-auto rounded-[20px] border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Reportado por</th>
                      <th className="px-4 py-3 font-medium">Creador</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Motivo</th>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Contenido</th>
                      <th className="px-4 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {pendingReports.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                          No hay reportes todavía.
                        </td>
                      </tr>
                    ) : (
                      pendingReports.map((item) => {
                        const contentItem =
                          data.content.find((content) => content.id === item.albumId) ??
                          null;
                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-3 font-medium text-zinc-900">
                              @{item.reportedBy}
                            </td>
                            <td className="px-4 py-3 text-zinc-700">@{item.owner}</td>
                            <td className="px-4 py-3 text-zinc-700">
                              {item.status === "open"
                                ? "Abierto"
                                : item.status === "reviewed"
                                  ? "Revisado"
                                  : item.status === "dismissed"
                                    ? "Descartado"
                                    : "Contenido eliminado"}
                            </td>
                            <td className="px-4 py-3 text-zinc-700">{item.reason}</td>
                            <td className="px-4 py-3 text-zinc-500">
                              {new Date(item.createdAt).toLocaleString("es-AR")}
                            </td>
                            <td className="px-4 py-3">
                              {contentItem ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedContent(contentItem);
                                    setSelectedMediaIndex(0);
                                  }}
                                  className="rounded-[12px] border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800"
                                >
                                  Ver contenido
                                </button>
                              ) : (
                                <span className="text-zinc-400">No disponible</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReport(item.id, "reviewed")}
                                  disabled={updatingReportId === item.id}
                                  className="rounded-[12px] border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                                >
                                  Revisado
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReport(item.id, "dismissed")}
                                  disabled={updatingReportId === item.id}
                                  className="rounded-[12px] bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                                >
                                  Descartar
                                </button>
                                {contentItem ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeletingContent({
                                        id: contentItem.id,
                                        username: contentItem.username,
                                        reportId: item.id,
                                      });
                                      setDeleteReason(item.reason || "");
                                    }}
                                    disabled={updatingReportId === item.id || deletingId === contentItem.id}
                                    className="rounded-[12px] bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                                  >
                                    Eliminar
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            ) : null}

            {reportsView === "history" ? (
            <>
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-zinc-950">Reportes resueltos</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    Reportes ya revisados, descartados o con contenido eliminado.
                  </div>
                </div>
              </div>
              <div className="max-h-[420px] overflow-auto rounded-[20px] border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Reportado por</th>
                      <th className="px-4 py-3 font-medium">Creador</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Motivo</th>
                      <th className="px-4 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {reviewedReports.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                          No hay reportes resueltos.
                        </td>
                      </tr>
                    ) : (
                      reviewedReports.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-zinc-900">@{item.reportedBy}</td>
                          <td className="px-4 py-3 text-zinc-700">@{item.owner}</td>
                          <td className="px-4 py-3 text-zinc-700">
                            {item.status === "reviewed"
                              ? "Revisado"
                              : item.status === "dismissed"
                                ? "Descartado"
                                : "Contenido eliminado"}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{item.reason}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleArchiveReport(item.id)}
                              disabled={archivingReportId === item.id}
                              className="rounded-[12px] border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                            >
                              {archivingReportId === item.id ? "Archivando..." : "Archivar"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-zinc-950">Historial de moderación</div>
              <div className="mt-4 max-h-[320px] overflow-auto rounded-[20px] border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Acción</th>
                      <th className="px-4 py-3 font-medium">Motivo</th>
                      <th className="px-4 py-3 font-medium">Admin</th>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {data.commerce.reportHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                          No hay acciones de moderación todavía.
                        </td>
                      </tr>
                    ) : (
                      data.commerce.reportHistory.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            {item.action === "reviewed"
                              ? "Revisado"
                              : item.action === "dismissed"
                                ? "Descartado"
                                : "Contenido eliminado"}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{item.reason}</td>
                          <td className="px-4 py-3 text-zinc-700">@{item.actor}</td>
                          <td className="px-4 py-3 text-zinc-500">
                            {new Date(item.actedAt).toLocaleString("es-AR")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </>
            ) : null}

            {reportsView === "archived" ? (
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-zinc-950">Reportes archivados</div>
              <div className="mt-1 text-sm text-zinc-500">
                Reportes ya procesados y archivados para limpieza operativa. Puedes restaurarlos.
              </div>
              <div className="mt-4 max-h-[420px] overflow-auto rounded-[20px] border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Reportado por</th>
                      <th className="px-4 py-3 font-medium">Creador</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Motivo</th>
                      <th className="px-4 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {archivedReports.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                          No hay reportes archivados.
                        </td>
                      </tr>
                    ) : (
                      archivedReports.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-zinc-900">@{item.reportedBy}</td>
                          <td className="px-4 py-3 text-zinc-700">@{item.owner}</td>
                          <td className="px-4 py-3 text-zinc-700">
                            {item.status === "reviewed"
                              ? "Revisado"
                              : item.status === "dismissed"
                                ? "Descartado"
                                : "Contenido eliminado"}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{item.reason}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleRestoreReport(item.id)}
                              disabled={restoringReportId === item.id}
                              className="rounded-[12px] border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                            >
                              {restoringReportId === item.id ? "Restaurando..." : "Restaurar"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            ) : null}

            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-zinc-950">
                Historial de contenido eliminado
              </div>
              <div className="mt-4 max-h-[320px] overflow-auto rounded-[20px] border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Creador</th>
                      <th className="px-4 py-3 font-medium">Descripción</th>
                      <th className="px-4 py-3 font-medium">Archivos</th>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {data.commerce.archivedContent.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                          No hay contenido archivado.
                        </td>
                      </tr>
                    ) : (
                      data.commerce.archivedContent.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            @{item.owner}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            <div className="line-clamp-2 max-w-[360px]">
                              {item.description}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{item.itemsCount}</td>
                          <td className="px-4 py-3 text-zinc-500">
                            {new Date(item.archivedAt).toLocaleString("es-AR")}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleRestoreContent(item.id)}
                              disabled={restoringArchiveId === item.id}
                              className="rounded-[12px] border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-60"
                            >
                              Restablecer
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && data && tab === "content" ? (
          <div className="space-y-6">
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-zinc-950">
                Moderación de contenido
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Vista tipo mosaico para revisar rápido y abrir cada publicación con
                todos sus archivos.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {data.content.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedContent(item);
                      setSelectedMediaIndex(0);
                    }}
                    className="block aspect-square w-full bg-zinc-100 text-left"
                  >
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
                  </button>

                  <div className="p-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar src={item.avatar} alt={item.username} />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-zinc-950">
                          @{item.username}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {new Date(item.createdAt).toLocaleDateString("es-AR")}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 line-clamp-2 min-h-8 text-xs text-zinc-600">
                      {item.description || "Sin descripción"}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>{item.itemsCount} archivos</span>
                      <span>{formatARS(item.price)}</span>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedContent(item);
                          setSelectedMediaIndex(0);
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-[14px] border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700"
                      >
                        <Eye className="h-4 w-4" />
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeletingContent({
                            id: item.id,
                            username: item.username,
                          });
                          setDeleteReason("");
                        }}
                        disabled={deletingId === item.id}
                        className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {selectedContent ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
          <button
            type="button"
            onClick={() => setSelectedContent(null)}
            className="absolute inset-0"
            aria-label="Cerrar visor"
          />
          <div className="relative flex max-h-[92vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl lg:flex-row">
            <div className="relative flex min-h-[360px] flex-1 items-center justify-center bg-zinc-950">
              {selectedMedia?.url ? (
                selectedMedia.type === "video" ? (
                  <video
                    src={selectedMedia.url}
                    className="max-h-[72vh] w-full object-contain"
                    controls
                    playsInline
                  />
                ) : (
                  <img
                    src={selectedMedia.url}
                    alt={selectedContent.description || selectedContent.username}
                    className="max-h-[72vh] w-full object-contain"
                  />
                )
              ) : (
                <div className="text-sm text-zinc-400">Sin archivo visible</div>
              )}

              {(selectedContent.media?.length ?? 0) > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedMediaIndex((prev) =>
                        prev === 0
                          ? (selectedContent.media?.length ?? 1) - 1
                          : prev - 1,
                      )
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-3 text-zinc-900 shadow"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedMediaIndex((prev) =>
                        (prev + 1) % (selectedContent.media?.length ?? 1),
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-3 text-zinc-900 shadow"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>

            <div className="w-full border-t border-zinc-200 p-5 lg:w-[360px] lg:border-l lg:border-t-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <UserAvatar src={selectedContent.avatar} alt={selectedContent.username} />
                  <div>
                    <div className="text-sm font-semibold text-zinc-950">
                      @{selectedContent.username}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {new Date(selectedContent.createdAt).toLocaleString("es-AR")}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedContent(null)}
                  className="rounded-[12px] border border-zinc-200 p-2 text-zinc-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 rounded-[18px] bg-zinc-100 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Descripción
                </div>
                <div className="mt-2 text-sm text-zinc-700">
                  {selectedContent.description || "Sin descripción"}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[18px] border border-zinc-200 p-4">
                  <div className="text-xs text-zinc-500">Precio</div>
                  <div className="mt-2 text-lg font-semibold text-zinc-950">
                    {formatARS(selectedContent.price)}
                  </div>
                </div>
                <div className="rounded-[18px] border border-zinc-200 p-4">
                  <div className="text-xs text-zinc-500">Archivos</div>
                  <div className="mt-2 text-lg font-semibold text-zinc-950">
                    {selectedContent.itemsCount}
                  </div>
                </div>
              </div>

              {(selectedContent.media?.length ?? 0) > 1 ? (
                <div className="mt-4">
                  <div className="text-sm font-semibold text-zinc-900">
                    Todos los archivos del post
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {selectedContent.media.map((media, index) => (
                      <button
                        key={`${media.url}-${index}`}
                        type="button"
                        onClick={() => setSelectedMediaIndex(index)}
                        className={cn(
                          "overflow-hidden rounded-[14px] border bg-zinc-100",
                          selectedMediaIndex === index
                            ? "border-zinc-950"
                            : "border-zinc-200",
                        )}
                      >
                        {media.url ? (
                          media.type === "video" ? (
                            <video
                              src={media.url}
                              className="aspect-square h-full w-full object-cover"
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={media.url}
                              alt={`Archivo ${index + 1}`}
                              className="aspect-square h-full w-full object-cover"
                            />
                          )
                        ) : (
                          <div className="aspect-square" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setDeletingContent({
                    id: selectedContent.id,
                    username: selectedContent.username,
                  });
                  setDeleteReason("");
                }}
                disabled={deletingId === selectedContent.id}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {deletingId === selectedContent.id ? "Eliminando..." : "Eliminar contenido"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deletingContent ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4">
          <button
            type="button"
            aria-label="Cerrar eliminación"
            onClick={() => {
              if (deletingId) return;
              setDeletingContent(null);
              setDeleteReason("");
            }}
            className="absolute inset-0"
          />
          <div className="relative z-10 w-full max-w-[560px] rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="text-2xl font-semibold text-zinc-950">
              Eliminar publicación
            </div>
            <div className="mt-2 text-sm text-zinc-500">
              Este contenido se dará de baja del sitio y el usuario recibirá una notificación de FanPush con el motivo.
            </div>
            <div className="mt-5 rounded-[18px] bg-zinc-100 p-4 text-sm text-zinc-700">
              Usuario: <span className="font-semibold">@{deletingContent.username}</span>
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-zinc-900">
                Motivo para el usuario
              </label>
              <textarea
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                rows={5}
                placeholder="Explica por qué se eliminó la publicación."
                className="w-full rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-0"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (deletingId) return;
                  setDeletingContent(null);
                  setDeleteReason("");
                }}
                className="rounded-[16px] border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDeleteContent(
                    deletingContent.id,
                    deleteReason.trim() || "Incumple las políticas de FanPush.",
                  )
                }
                disabled={deletingId === deletingContent.id}
                className="rounded-[16px] bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deletingId === deletingContent.id ? "Eliminando..." : "Eliminar publicación"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectingWithdrawal ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4">
          <button
            type="button"
            aria-label="Cerrar rechazo de retiro"
            onClick={() => {
              if (updatingWithdrawalId) return;
              setRejectingWithdrawal(null);
              setWithdrawalRejectReason("");
            }}
            className="absolute inset-0"
          />
          <div className="relative z-10 w-full max-w-[560px] rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="text-2xl font-semibold text-zinc-950">
              Rechazar retiro
            </div>
            <div className="mt-2 text-sm text-zinc-500">
              El usuario recibirá una notificación de FanPush con el motivo del rechazo.
            </div>
            <div className="mt-5 rounded-[18px] bg-zinc-100 p-4 text-sm text-zinc-700">
              Usuario: <span className="font-semibold">@{rejectingWithdrawal.username}</span>
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-zinc-900">
                Motivo del rechazo
              </label>
              <textarea
                value={withdrawalRejectReason}
                onChange={(event) => setWithdrawalRejectReason(event.target.value)}
                rows={5}
                placeholder="Explica por qué se rechazó el retiro."
                className="w-full rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-0"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (updatingWithdrawalId) return;
                  setRejectingWithdrawal(null);
                  setWithdrawalRejectReason("");
                }}
                className="rounded-[16px] border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateWithdrawal(
                    rejectingWithdrawal.id,
                    "rejected",
                    withdrawalRejectReason.trim() || "No cumple los requisitos para retiro.",
                  )
                }
                disabled={updatingWithdrawalId === rejectingWithdrawal.id}
                className="rounded-[16px] bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {updatingWithdrawalId === rejectingWithdrawal.id
                  ? "Rechazando..."
                  : "Rechazar retiro"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectingAuthor ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4">
          <button
            type="button"
            aria-label="Cerrar rechazo"
            onClick={() => {
              if (updatingAuthorId) return;
              setRejectingAuthor(null);
              setRejectReason("");
            }}
            className="absolute inset-0"
          />
          <div className="relative w-full max-w-[560px] rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  Solicitud de autor
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                  Rechazar a @{rejectingAuthor.username}
                </h3>
                <p className="mt-2 text-sm text-zinc-500">
                  Escribe el motivo que le va a llegar al usuario por notificación.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (updatingAuthorId) return;
                  setRejectingAuthor(null);
                  setRejectReason("");
                }}
                className="rounded-[12px] border border-zinc-200 p-2 text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Ejemplo: La foto del DNI no se ve con claridad. Volvé a cargar frente y dorso completos."
              className="mt-5 min-h-[160px] w-full rounded-[18px] border border-zinc-200 px-4 py-3 text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (updatingAuthorId) return;
                  setRejectingAuthor(null);
                  setRejectReason("");
                }}
                className="rounded-[14px] border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateAuthor(
                    rejectingAuthor.id,
                    "rejected",
                    rejectReason,
                  )
                }
                disabled={!rejectReason.trim() || updatingAuthorId === rejectingAuthor.id}
                className="rounded-[14px] bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {updatingAuthorId === rejectingAuthor.id
                  ? "Enviando rechazo..."
                  : "Rechazar solicitud"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

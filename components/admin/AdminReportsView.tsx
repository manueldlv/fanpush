"use client";

import { cn } from "@/lib/utils";

type ReportsView = "pending" | "history" | "archived";

type ReportItem = {
  id: string;
  albumId: string;
  reason: string;
  createdAt: string;
  reportedBy: string;
  owner: string;
  status: "open" | "reviewed" | "dismissed" | "removed";
  archived: boolean;
};

type ReportHistoryItem = {
  id: string;
  action: "reviewed" | "dismissed" | "removed";
  reason: string;
  actedAt: string;
  actor: string;
};

type ArchivedContentItem = {
  id: string;
  owner: string;
  description: string;
  itemsCount: number;
  archivedAt: string;
};

type ContentLookupItem = {
  id: string;
  username: string;
};

export default function AdminReportsView({
  reportsView,
  setReportsView,
  pendingReports,
  reviewedReports,
  archivedReports,
  reportHistory,
  archivedContent,
  updatingReportId,
  archivingReportId,
  restoringReportId,
  restoringArchiveId,
  onGoToContent,
  findContentByAlbumId,
  openContent,
  openReportReason,
  handleUpdateReport,
  handleArchiveReport,
  handleRestoreReport,
  openDeleteContent,
  handleRestoreContent,
}: {
  reportsView: ReportsView;
  setReportsView: (view: ReportsView) => void;
  pendingReports: ReportItem[];
  reviewedReports: ReportItem[];
  archivedReports: ReportItem[];
  reportHistory: ReportHistoryItem[];
  archivedContent: ArchivedContentItem[];
  updatingReportId: string | null;
  archivingReportId: string | null;
  restoringReportId: string | null;
  restoringArchiveId: string | null;
  onGoToContent: () => void;
  findContentByAlbumId: (albumId: string) => ContentLookupItem | null;
  openContent: (content: ContentLookupItem) => void;
  openReportReason: (payload: { title: string; reason: string }) => void;
  handleUpdateReport: (id: string, status: "reviewed" | "dismissed") => void;
  handleArchiveReport: (id: string) => void;
  handleRestoreReport: (id: string) => void;
  openDeleteContent: (payload: { id: string; username: string; reportId?: string; reason?: string }) => void;
  handleRestoreContent: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold text-zinc-950">Reportes de contenido</div>
        <div className="mt-1 text-sm text-zinc-500">
          Denuncias enviadas por usuarios para que moderación pueda revisar y abrir
          la publicación exacta denunciada.
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
              <div className="text-sm font-semibold text-zinc-950">Cola de denuncias</div>
              <div className="text-sm text-zinc-500">
                {pendingReports.length} reportes pendientes de revisión visual.
              </div>
            </div>
            <button
              type="button"
              onClick={onGoToContent}
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
                    const contentItem = findContentByAlbumId(item.albumId);
                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium text-zinc-900">@{item.reportedBy}</td>
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
                        <td className="px-4 py-3 text-zinc-700">
                          <div className="max-w-[280px] truncate">{item.reason}</div>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {new Date(item.createdAt).toLocaleString("es-AR")}
                        </td>
                        <td className="px-4 py-3">
                          {contentItem ? (
                            <button
                              type="button"
                              onClick={() => openContent(contentItem)}
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
                              onClick={() =>
                                openReportReason({
                                  title: `Denuncia de @${item.reportedBy}`,
                                  reason: item.reason || "Sin motivo",
                                })
                              }
                              className="rounded-[12px] border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700"
                            >
                              Ver detalle
                            </button>
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
                                onClick={() =>
                                  openDeleteContent({
                                    id: contentItem.id,
                                    username: contentItem.username,
                                    reportId: item.id,
                                    reason: item.reason || "",
                                  })
                                }
                                disabled={
                                  updatingReportId === item.id
                                }
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
                        <td className="px-4 py-3 text-zinc-700">
                          <div className="max-w-[280px] truncate">{item.reason}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openReportReason({
                                  title: `Reporte resuelto de @${item.reportedBy}`,
                                  reason: item.reason || "Sin motivo",
                                })
                              }
                              className="rounded-[12px] border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700"
                            >
                              Ver detalle
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchiveReport(item.id)}
                              disabled={archivingReportId === item.id}
                              className="rounded-[12px] border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                            >
                              {archivingReportId === item.id ? "Archivando..." : "Archivar"}
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
                  {reportHistory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                        No hay acciones de moderación todavía.
                      </td>
                    </tr>
                  ) : (
                    reportHistory.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {item.action === "reviewed"
                            ? "Revisado"
                            : item.action === "dismissed"
                              ? "Descartado"
                              : "Contenido eliminado"}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">
                          <div className="max-w-[320px] truncate">{item.reason}</div>
                          <button
                            type="button"
                            onClick={() =>
                              openReportReason({
                                title: `Acción de moderación · @${item.actor}`,
                                reason: item.reason || "Sin motivo",
                              })
                            }
                            className="mt-2 text-xs font-semibold text-zinc-700 underline decoration-zinc-300 underline-offset-4"
                          >
                            Ver detalle
                          </button>
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

      {reportsView === "archived" ? (
        <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-zinc-950">Reportes archivados</div>
          <div className="mt-1 text-sm text-zinc-500">
            Reportes ya procesados y archivados para limpieza operativa. Puedes
            restaurarlos.
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
                      <td className="px-4 py-3 text-zinc-700">
                        <div className="max-w-[280px] truncate">{item.reason}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openReportReason({
                                title: `Reporte archivado de @${item.reportedBy}`,
                                reason: item.reason || "Sin motivo",
                              })
                            }
                            className="rounded-[12px] border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700"
                          >
                            Ver detalle
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestoreReport(item.id)}
                            disabled={restoringReportId === item.id}
                            className="rounded-[12px] border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                          >
                            {restoringReportId === item.id ? "Restaurando..." : "Restaurar"}
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

      <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold text-zinc-950">Historial de contenido eliminado</div>
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
              {archivedContent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    No hay contenido archivado.
                  </td>
                </tr>
              ) : (
                archivedContent.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-zinc-900">@{item.owner}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      <div className="line-clamp-2 max-w-[360px]">{item.description}</div>
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
  );
}

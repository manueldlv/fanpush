"use client";

import { Eye, Filter, Search, Trash2 } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import {
  CONTENT_AUDIENCE_OPTIONS,
  MODERATION_CATEGORY_OPTIONS,
  getContentAudienceLabel,
  getModerationCategoryLabel,
  type ContentAudience,
  type ModerationCategory,
} from "@/lib/contentClassification";
import { cn, formatARS } from "@/lib/utils";

type ContentView = "queue" | "reported" | "resolved" | "archived";
type ContentFilter = "all" | "free" | "paid" | "image" | "video";

type ContentItem = {
  id: string;
  description: string;
  price: number;
  createdAt: string;
  username: string;
  avatar: string | null;
  mediaUrl: string | null;
  mediaType: string;
  itemsCount: number;
  moderationState: "approved" | "archived" | null;
  contentAudience: ContentAudience;
  moderationCategory: ModerationCategory;
  moderationTags: string[];
  media: Array<{
    id: string;
    url: string | null;
    type: string;
    caption: string;
    isLocked: boolean;
    createdAt: string;
  }>;
};

type ArchivedContentItem = {
  id: string;
  owner: string;
  description: string;
  itemsCount: number;
  archivedAt: string;
};

export default function AdminContentView({
  contentView,
  setContentView,
  contentSearch,
  setContentSearch,
  contentFilter,
  setContentFilter,
  contentAudienceFilter,
  setContentAudienceFilter,
  contentCategoryFilter,
  setContentCategoryFilter,
  contentCount,
  reportedContent,
  visibleContentQueue,
  resolvedContent,
  archivedContent,
  pendingReportCountByAlbum,
  updatingContentId,
  deletingId,
  restoringArchiveId,
  openContent,
  handleReviewContent,
  openDeleteContent,
  handleRestoreContent,
}: {
  contentView: ContentView;
  setContentView: (view: ContentView) => void;
  contentSearch: string;
  setContentSearch: (value: string) => void;
  contentFilter: ContentFilter;
  setContentFilter: (value: ContentFilter) => void;
  contentAudienceFilter: "all" | ContentAudience;
  setContentAudienceFilter: (value: "all" | ContentAudience) => void;
  contentCategoryFilter: "all" | ModerationCategory;
  setContentCategoryFilter: (value: "all" | ModerationCategory) => void;
  contentCount: number;
  reportedContent: ContentItem[];
  visibleContentQueue: ContentItem[];
  resolvedContent: ContentItem[];
  archivedContent: ArchivedContentItem[];
  pendingReportCountByAlbum: Map<string, number>;
  updatingContentId: string | null;
  deletingId: string | null;
  restoringArchiveId: string | null;
  openContent: (item: ContentItem) => void;
  handleReviewContent: (id: string) => void;
  openDeleteContent: (payload: { id: string; username: string; reportId?: string }) => void;
  handleRestoreContent: (id: string) => void;
}) {
  const visibleItems =
    contentView === "reported"
      ? reportedContent
      : contentView === "resolved"
        ? resolvedContent
        : visibleContentQueue;

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-zinc-950">Moderación de contenido</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Activos", value: contentCount, tone: "default" as const },
              { label: "Reportados", value: reportedContent.length, tone: "blue" as const },
              { label: "En cola", value: visibleContentQueue.length, tone: "default" as const },
              { label: "Eliminados", value: archivedContent.length, tone: "emerald" as const },
            ].map((item) => (
              <div
                key={`content-metric-${item.label}`}
                className={cn(
                  "min-w-[132px] rounded-[14px] border px-4 py-3",
                  item.tone === "default" && "border-zinc-200 bg-white",
                  item.tone === "blue" && "border-blue-200 bg-blue-50",
                  item.tone === "emerald" && "border-emerald-200 bg-emerald-50",
                )}
              >
                <div className="text-sm font-medium text-zinc-500">{item.label}</div>
                <div className="mt-1.5 text-[0.95rem] font-semibold text-zinc-950 md:text-[1.05rem]">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-start">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "queue", label: "Cola activa", count: visibleContentQueue.length },
              { id: "reported", label: "Reportados", count: reportedContent.length },
              { id: "resolved", label: "Resueltos", count: resolvedContent.length },
              { id: "archived", label: "Eliminados", count: archivedContent.length },
            ].map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setContentView(section.id as ContentView)}
                className={cn(
                  "inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition",
                  contentView === section.id
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-600",
                )}
              >
                {section.label}
                <span
                  className={cn(
                    "ml-2 rounded-full px-2 py-0.5 text-xs",
                    contentView === section.id
                      ? "bg-white/15 text-white"
                      : "bg-zinc-100 text-zinc-600",
                  )}
                >
                  {section.count}
                </span>
              </button>
            ))}
          </div>

          {contentView !== "archived" ? (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              <label className="relative block min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={contentSearch}
                  onChange={(event) => setContentSearch(event.target.value)}
                  placeholder="Buscar por usuario o descripción"
                  className="w-full rounded-[14px] border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                />
              </label>
              <label className="relative block min-w-0">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <select
                  value={contentFilter}
                  onChange={(event) => setContentFilter(event.target.value as ContentFilter)}
                  className="w-full appearance-none rounded-[14px] border border-zinc-200 bg-white py-2.5 pl-10 pr-8 text-sm font-medium text-zinc-900 outline-none"
                >
                  <option value="all">Todo el contenido</option>
                  <option value="paid">Solo pago</option>
                  <option value="free">Solo gratis</option>
                  <option value="image">Solo imágenes</option>
                  <option value="video">Solo videos</option>
                </select>
              </label>
              <label className="relative block min-w-0">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <select
                  value={contentAudienceFilter}
                  onChange={(event) =>
                    setContentAudienceFilter(event.target.value as "all" | ContentAudience)
                  }
                  className="w-full appearance-none rounded-[14px] border border-zinc-200 bg-white py-2.5 pl-10 pr-8 text-sm font-medium text-zinc-900 outline-none"
                >
                  <option value="all">Toda audiencia</option>
                  {CONTENT_AUDIENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="relative block min-w-0">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <select
                  value={contentCategoryFilter}
                  onChange={(event) =>
                    setContentCategoryFilter(event.target.value as "all" | ModerationCategory)
                  }
                  className="w-full appearance-none rounded-[14px] border border-zinc-200 bg-white py-2.5 pl-10 pr-8 text-sm font-medium text-zinc-900 outline-none"
                >
                  <option value="all">Toda categoría</option>
                  {MODERATION_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>
      </div>

      {contentView !== "archived" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => openContent(item)}
                className="relative block aspect-square w-full bg-zinc-100 text-left"
              >
                {item.mediaUrl ? (
                  item.mediaType === "video" ? (
                    <video src={item.mediaUrl} className="h-full w-full object-cover" muted playsInline />
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
                <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                  {item.moderationState ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-bold text-white",
                        item.moderationState === "approved" ? "bg-emerald-600" : "bg-zinc-700",
                      )}
                    >
                      {item.moderationState === "approved" ? "Aprobado" : "Archivado"}
                    </span>
                  ) : null}
                  {(pendingReportCountByAlbum.get(item.id) ?? 0) > 0 ? (
                    <span className="rounded-full bg-red-600 px-2 py-1 text-[10px] font-bold text-white">
                      {pendingReportCountByAlbum.get(item.id)} reporte
                      {(pendingReportCountByAlbum.get(item.id) ?? 0) > 1 ? "s" : ""}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-zinc-700">
                    {item.price > 0 ? "Pago" : "Gratis"}
                  </span>
                  <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-zinc-700">
                    {item.mediaType === "video" ? "Video" : "Imagen"}
                  </span>
                  <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-zinc-700">
                    {getContentAudienceLabel(item.contentAudience)}
                  </span>
                  <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-zinc-700">
                    {getModerationCategoryLabel(item.moderationCategory)}
                  </span>
                </div>
              </button>

              <div className="p-3">
                <div className="flex items-center gap-3">
                  <UserAvatar src={item.avatar} alt={item.username} />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-zinc-950">@{item.username}</div>
                    <div className="text-xs text-zinc-500">
                      {new Date(item.createdAt).toLocaleDateString("es-AR")}
                    </div>
                  </div>
                </div>

                <div className="mt-2 line-clamp-2 min-h-8 text-xs text-zinc-600">
                  {item.description || "Sin descripción"}
                </div>
                {item.moderationTags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.moderationTags.slice(0, 3).map((tag) => (
                      <span
                        key={`${item.id}-${tag}`}
                        className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-600"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{item.itemsCount} archivos</span>
                  <span>{formatARS(item.price)}</span>
                </div>

                <div className="mt-3 flex gap-2">
                  {contentView !== "resolved" ? (
                    <button
                      type="button"
                      onClick={() => handleReviewContent(item.id)}
                      disabled={updatingContentId === item.id}
                      className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-60"
                    >
                      Aprobar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openContent(item)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-[12px] border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Revisar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openDeleteContent({
                        id: item.id,
                        username: item.username,
                      })
                    }
                    disabled={deletingId === item.id}
                    className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {visibleItems.length === 0 ? (
            <div className="col-span-full rounded-[24px] border border-dashed border-zinc-200 bg-white px-6 py-10 text-center text-sm text-zinc-500">
              {contentView === "reported"
                ? "No hay publicaciones reportadas pendientes."
                : contentView === "resolved"
                  ? "No hay publicaciones resueltas para mostrar."
                  : "No hay publicaciones para revisar con los filtros actuales."}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[24px] border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Archivos</th>
                  <th className="px-4 py-3 font-medium">Archivado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
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
      )}
    </div>
  );
}

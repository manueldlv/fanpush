"use client";

import { Search } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { cn, formatARS } from "@/lib/utils";

type AuthorsView = "pending" | "history" | "archived" | "promotion";

type AuthorApplication = {
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
};

type AuthorApplicationHistoryItem = {
  id: string;
  action: "pending" | "approved" | "rejected";
  reason: string;
  actedAt: string;
  actor: string;
};

type PromotionUser = {
  id: string;
  username: string;
  avatar: string | null;
  fullName: string;
  email: string;
  followersCount: number;
  followingCount: number;
  salesGross: number;
  posts: Array<unknown>;
  promotion: {
    isActive: boolean;
    promoteInFeed: boolean;
    feedRank: number;
    promoteInSuggestions: boolean;
    suggestionsRank: number;
    promoteInExplore: boolean;
    exploreRank: number;
    note: string;
    updatedAt: string | null;
    expiresAt: string | null;
  };
};

export default function AdminAuthorsView({
  authorsView,
  setAuthorsView,
  pendingAuthorApplications,
  reviewedAuthorApplications,
  archivedAuthorApplications,
  authorApplicationHistory,
  updatingAuthorId,
  archivingAuthorId,
  restoringAuthorId,
  handleUpdateAuthor,
  openRejectAuthor,
  handleArchiveAuthor,
  handleRestoreAuthor,
  promotionSearch,
  setPromotionSearch,
  promotionSort,
  setPromotionSort,
  curatedAuthors,
  updatingPromotionUserId,
  promotionDurationDrafts,
  setPromotionDurationDrafts,
  handleUpdateAuthorPromotion,
  updatePromotionDraft,
}: {
  authorsView: AuthorsView;
  setAuthorsView: (view: AuthorsView) => void;
  pendingAuthorApplications: AuthorApplication[];
  reviewedAuthorApplications: AuthorApplication[];
  archivedAuthorApplications: AuthorApplication[];
  authorApplicationHistory: AuthorApplicationHistoryItem[];
  updatingAuthorId: string | null;
  archivingAuthorId: string | null;
  restoringAuthorId: string | null;
  handleUpdateAuthor: (id: string, status: "approved" | "rejected") => void;
  openRejectAuthor: (payload: { id: string; username: string }) => void;
  handleArchiveAuthor: (id: string) => void;
  handleRestoreAuthor: (id: string) => void;
  promotionSearch: string;
  setPromotionSearch: (value: string) => void;
  promotionSort: "sales" | "followers" | "posts" | "recent";
  setPromotionSort: (value: "sales" | "followers" | "posts" | "recent") => void;
  curatedAuthors: PromotionUser[];
  updatingPromotionUserId: string | null;
  promotionDurationDrafts: Record<string, string>;
  setPromotionDurationDrafts: (
    updater: (prev: Record<string, string>) => Record<string, string>,
  ) => void;
  handleUpdateAuthorPromotion: (
    userId: string,
    patch: Partial<PromotionUser["promotion"]>,
  ) => void;
  updatePromotionDraft: (
    userId: string,
    patch: Partial<PromotionUser["promotion"]>,
  ) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["pending", "Pendientes"],
              ["history", "Historial"],
              ["archived", "Archivadas"],
              ["promotion", "Curación manual"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAuthorsView(id)}
              className={cn(
                "rounded-[16px] px-4 py-3 text-sm font-semibold transition",
                authorsView === id
                  ? "bg-zinc-950 text-white"
                  : "border border-zinc-200 bg-zinc-100 text-zinc-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {authorsView === "pending" ? (
        <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-zinc-950">Solicitudes de autor</div>
          <div className="mt-1 text-sm text-zinc-500">
            Revisa identidad, edad y documentación antes de habilitar la creación
            y venta de contenido.
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
                      <td className="px-4 py-3 align-top font-medium text-zinc-900">
                        @{item.username}
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
                        <div>
                          {item.city}, {item.province}
                        </div>
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
                            onClick={() =>
                              openRejectAuthor({
                                id: item.id,
                                username: item.username,
                              })
                            }
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
            <div className="text-lg font-semibold text-zinc-950">Solicitudes resueltas</div>
            <div className="mt-1 text-sm text-zinc-500">
              Consultas puntuales sobre solicitudes ya aprobadas o rechazadas.
              Desde acá puedes cambiar la decisión si fue un error.
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
                                onClick={() =>
                                  openRejectAuthor({
                                    id: item.id,
                                    username: item.username,
                                  })
                                }
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
            <div className="text-lg font-semibold text-zinc-950">Historial de movimientos</div>
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
                  {authorApplicationHistory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                        No hay movimientos todavía.
                      </td>
                    </tr>
                  ) : (
                    authorApplicationHistory.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {item.action === "approved"
                            ? "Aprobado"
                            : item.action === "rejected"
                              ? "Rechazado"
                              : "Pendiente"}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{item.reason || "Sin motivo"}</td>
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
          <div className="text-lg font-semibold text-zinc-950">Solicitudes archivadas</div>
          <div className="mt-1 text-sm text-zinc-500">
            Solicitudes ya procesadas y archivadas. Puedes restaurarlas para volver
            a verlas en historial.
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
                      <td className="px-4 py-3 font-medium text-zinc-900">@{item.username}</td>
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

      {authorsView === "promotion" ? (
        <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-lg font-semibold text-zinc-950">Curación manual de autores</div>
              <div className="mt-1 max-w-[760px] text-sm text-zinc-500">
                Define qué autores quieres empujar manualmente en feed, sugerencias
                y explorar. Sirve para destacar cuentas clave, ordenar exposición y
                dar publicidad interna sin depender de follows.
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={promotionSearch}
                  onChange={(event) => setPromotionSearch(event.target.value)}
                  placeholder="Buscar autor"
                  className="h-11 rounded-[14px] border border-zinc-200 bg-white pl-10 pr-4 text-sm text-zinc-900 outline-none"
                />
              </div>
              <select
                value={promotionSort}
                onChange={(event) =>
                  setPromotionSort(event.target.value as typeof promotionSort)
                }
                className="h-11 rounded-[14px] border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 outline-none"
              >
                <option value="sales">Ordenar por ventas</option>
                <option value="followers">Ordenar por seguidores</option>
                <option value="posts">Ordenar por posts</option>
                <option value="recent">Ordenar por alta reciente</option>
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-auto rounded-[20px] border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-100 text-left text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Autor</th>
                  <th className="px-4 py-3 font-medium">Ventas</th>
                  <th className="px-4 py-3 font-medium">Seguidores</th>
                  <th className="px-4 py-3 font-medium">Feed</th>
                  <th className="px-4 py-3 font-medium">Sugerencias</th>
                  <th className="px-4 py-3 font-medium">Explorar</th>
                  <th className="px-4 py-3 font-medium">Duración</th>
                  <th className="px-4 py-3 font-medium">Nota interna</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {curatedAuthors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">
                      No encontramos autores con ese filtro.
                    </td>
                  </tr>
                ) : (
                  curatedAuthors.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-3">
                          <UserAvatar src={item.avatar} alt={item.username} />
                          <div>
                            <div className="font-medium text-zinc-900">@{item.username}</div>
                            <div className="text-xs text-zinc-500">
                              {item.fullName || item.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-zinc-900">
                        <div className="font-medium">{formatARS(item.salesGross)}</div>
                        <div className="text-xs text-zinc-500">{item.posts.length} posts</div>
                      </td>
                      <td className="px-4 py-3 align-top text-zinc-900">
                        <div className="font-medium">{item.followersCount}</div>
                        <div className="text-xs text-zinc-500">
                          {item.followingCount} seguidos
                        </div>
                      </td>
                      {(
                        [
                          ["promoteInFeed", "feedRank"],
                          ["promoteInSuggestions", "suggestionsRank"],
                          ["promoteInExplore", "exploreRank"],
                        ] as const
                      ).map(([flagKey, rankKey]) => (
                        <td key={`${item.id}-${flagKey}`} className="px-4 py-3 align-top">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.promotion[flagKey]}
                              disabled={updatingPromotionUserId === item.id}
                              onChange={(event) =>
                                handleUpdateAuthorPromotion(item.id, {
                                  [flagKey]: event.target.checked,
                                } as Partial<PromotionUser["promotion"]>)
                              }
                            />
                            <span className="text-xs font-medium text-zinc-700">Activar</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            value={item.promotion[rankKey]}
                            disabled={updatingPromotionUserId === item.id}
                            onChange={(event) =>
                              updatePromotionDraft(item.id, {
                                [rankKey]: Number(event.target.value || 0),
                              } as Partial<PromotionUser["promotion"]>)
                            }
                            onBlur={(event) =>
                              handleUpdateAuthorPromotion(item.id, {
                                [rankKey]: Number(event.target.value || 0),
                              } as Partial<PromotionUser["promotion"]>)
                            }
                            className="mt-2 h-10 w-[92px] rounded-[12px] border border-zinc-200 px-3 text-sm text-zinc-900 outline-none"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3 align-top">
                        <input
                          type="number"
                          min={1}
                          placeholder="Días"
                          value={promotionDurationDrafts[item.id] ?? ""}
                          disabled={updatingPromotionUserId === item.id}
                          onChange={(event) =>
                            setPromotionDurationDrafts((prev) => ({
                              ...prev,
                              [item.id]: event.target.value,
                            }))
                          }
                          className="h-10 w-[92px] rounded-[12px] border border-zinc-200 px-3 text-sm text-zinc-900 outline-none"
                        />
                        <div className="mt-2 text-xs text-zinc-500">
                          {item.promotion.expiresAt
                            ? `Vence ${new Date(item.promotion.expiresAt).toLocaleDateString("es-AR")}`
                            : "Fijo hasta cambiarlo"}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <textarea
                          value={item.promotion.note}
                          disabled={updatingPromotionUserId === item.id}
                          onChange={(event) =>
                            updatePromotionDraft(item.id, {
                              note: event.target.value,
                            })
                          }
                          onBlur={(event) =>
                            handleUpdateAuthorPromotion(item.id, {
                              note: event.target.value,
                            })
                          }
                          rows={3}
                          className="min-h-[86px] w-[240px] rounded-[12px] border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none"
                          placeholder="Motivo interno, campaña, prioridad, etc."
                        />
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
  );
}

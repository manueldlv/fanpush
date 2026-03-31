"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bell,
  ChevronRight,
  MessageSquareText,
  Send,
} from "lucide-react";
import SidebarLeft from "@/components/SidebarLeft";
import UserAvatar from "@/components/UserAvatar";
import { useAppDispatch } from "@/lib/redux/hooks";
import {
  hydrateNotificationsState,
  markNotificationsAsRead,
} from "@/lib/redux/slices/notificationsSlice";
import { getSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type {
  NotificationActivityItem,
  NotificationThreadDetail,
  NotificationThreadSummary,
} from "@/lib/server/repositories/notification-center";

type CenterPayload = {
  ok: true;
  activity: NotificationActivityItem[];
  threads: NotificationThreadSummary[];
};

const authedRequest = async <T,>(
  input: string,
  init?: RequestInit,
) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Falta configurar Supabase.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Necesitas iniciar sesión para continuar.");
  }

  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers ?? {}),
    },
  });

  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(result.error ?? "No se pudo completar la operación.");
  }

  return result;
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  follow: "Seguidores",
  tip: "Propinas",
  purchase: "Ventas",
  withdrawal_update: "Retiros",
  author_application_update: "Solicitud de autor",
  content_removed_update: "Moderacion",
};

const formatActivityTypeLabel = (type: string) =>
  ACTIVITY_TYPE_LABELS[type] ??
  type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

function ActivityCenterSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`notification-center-overview-skeleton-${index}`}
            className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="fanpush-skeleton h-3 w-24 rounded-full" />
            <div className="mt-4 fanpush-skeleton h-10 w-16 rounded-full" />
            <div className="mt-4 fanpush-skeleton h-3 w-full rounded-full" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={`notification-center-card-skeleton-${index}`}
            className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="fanpush-skeleton h-12 w-12 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="fanpush-skeleton h-4 w-28 rounded-full" />
                  <div className="fanpush-skeleton h-3 w-16 rounded-full" />
                </div>
                <div className="mt-4 fanpush-skeleton h-4 w-full rounded-full" />
                <div className="mt-2 fanpush-skeleton h-4 w-3/4 rounded-full" />
                <div className="mt-5 fanpush-skeleton h-10 w-40 rounded-[14px]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="fanpush-skeleton h-11 flex-1 rounded-[14px]" />
          <div className="fanpush-skeleton h-11 flex-1 rounded-[14px]" />
        </div>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`notification-center-skeleton-${index}`}
              className="rounded-[18px] border border-zinc-200 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="fanpush-skeleton h-11 w-11 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="fanpush-skeleton h-4 w-32 rounded-full" />
                  <div className="mt-2 fanpush-skeleton h-3 w-full rounded-full" />
                  <div className="mt-2 fanpush-skeleton h-3 w-24 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="fanpush-skeleton h-7 w-48 rounded-full" />
        <div className="mt-3 fanpush-skeleton h-4 w-64 rounded-full" />
        <div className="mt-8 space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`notification-center-message-skeleton-${index}`}
              className={cn(
                "max-w-[78%] rounded-[18px] px-4 py-3",
                index % 2 === 0 ? "bg-zinc-100" : "ml-auto bg-blue-50",
              )}
            >
              <div className="fanpush-skeleton h-3 w-20 rounded-full" />
              <div className="mt-3 fanpush-skeleton h-3 w-full rounded-full" />
              <div className="mt-2 fanpush-skeleton h-3 w-40 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NotificacionesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const tabParam = searchParams.get("tab");
  const selectedThreadParam = searchParams.get("thread");
  const [activeTab, setActiveTab] = useState<"activity" | "messages">(
    tabParam === "messages" ? "messages" : "activity",
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<NotificationActivityItem[]>([]);
  const [threads, setThreads] = useState<NotificationThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    selectedThreadParam,
  );
  const [selectedThread, setSelectedThread] = useState<NotificationThreadDetail | null>(
    null,
  );
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const unreadActivityCount = useMemo(
    () => activity.filter((item) => !item.isRead).length,
    [activity],
  );

  const actionableActivityCount = useMemo(
    () => activity.filter((item) => Boolean(item.action)).length,
    [activity],
  );

  const unreadActivity = useMemo(
    () => activity.filter((item) => !item.isRead),
    [activity],
  );

  const readActivity = useMemo(
    () => activity.filter((item) => item.isRead),
    [activity],
  );

  const unreadThreadCount = useMemo(
    () => threads.filter((thread) => thread.unread).length,
    [threads],
  );

  const syncUrl = (tab: "activity" | "messages", threadId?: string | null) => {
    const next = new URLSearchParams();
    if (tab === "messages") {
      next.set("tab", "messages");
      if (threadId) next.set("thread", threadId);
    }
    router.replace(`/notificaciones${next.toString() ? `?${next.toString()}` : ""}`);
  };

  const loadCenter = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await authedRequest<CenterPayload>("/api/notification-center");
      setActivity(result.activity);
      setThreads(result.threads);
      const unreadActivityIds = result.activity
        .filter((item) => !item.isRead)
        .map((item) => item.id);
      if (unreadActivityIds.length > 0) {
        void dispatch(markNotificationsAsRead(unreadActivityIds));
        void dispatch(hydrateNotificationsState());
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar tu centro de notificaciones.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadThread = async (threadId: string) => {
    setThreadLoading(true);
    setError(null);
    try {
      const result = await authedRequest<{ ok: true; thread: NotificationThreadDetail }>(
        `/api/notification-center/threads/${threadId}`,
      );
      setSelectedThread(result.thread);
      setSelectedThreadId(threadId);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === threadId ? { ...thread, unread: false } : thread,
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo abrir la conversación.",
      );
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    void loadCenter();
  }, []);

  useEffect(() => {
    if (tabParam === "messages") {
      setActiveTab("messages");
    } else {
      setActiveTab("activity");
    }
  }, [tabParam]);

  useEffect(() => {
    const nextSelectedThreadId = selectedThreadParam || null;
    setSelectedThreadId(nextSelectedThreadId);
  }, [selectedThreadParam]);

  useEffect(() => {
    if (activeTab !== "messages") return;

    const targetThreadId = selectedThreadParam || threads[0]?.id || null;
    if (!targetThreadId) {
      setSelectedThread(null);
      return;
    }

    if (selectedThread?.id === targetThreadId) return;
    void loadThread(targetThreadId);
  }, [activeTab, selectedThread?.id, selectedThreadParam, threads]);

  const handleOpenThread = (threadId: string) => {
    setActiveTab("messages");
    syncUrl("messages", threadId);
    void loadThread(threadId);
  };

  const handleSendReply = async () => {
    if (!selectedThreadId || !replyBody.trim()) return;
    setSendingReply(true);
    setError(null);
    try {
      const result = await authedRequest<{ ok: true; thread: NotificationThreadDetail }>(
        `/api/notification-center/threads/${selectedThreadId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ body: replyBody }),
        },
      );
      setSelectedThread(result.thread);
      setReplyBody("");
      await loadCenter({ silent: true });
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "No se pudo enviar la respuesta.",
      );
    } finally {
      setSendingReply(false);
    }
  };

  const threadTitle =
    selectedThread?.subject ||
    (selectedThread?.topic === "author_application"
      ? "Solicitud de autor"
      : selectedThread?.topic === "withdrawal"
        ? "Retiro"
        : selectedThread?.topic === "moderation"
          ? "Moderación"
          : "Conversación con FanPush");

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <SidebarLeft />

      <div className="md:pl-60">
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">
                FanPush
              </div>
              <h1 className="mt-3 text-3xl font-semibold">Centro de notificaciones</h1>
              <p className="mt-2 max-w-[760px] text-sm text-zinc-500">
                Revisa actividad de tu cuenta, mensajes del equipo y conversaciones que
                necesitan respuesta.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadCenter({ silent: true })}
              className="rounded-[14px] border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              {refreshing ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          {error ? (
            <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <section className="rounded-[24px] border border-zinc-200 bg-white p-2 shadow-sm">
            <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-zinc-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("activity");
                  syncUrl("activity");
                }}
                className={cn(
                  "rounded-[14px] px-4 py-3 text-sm font-semibold transition",
                  activeTab === "activity"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-zinc-500",
                )}
              >
                Centro
                {unreadActivityCount > 0 ? (
                  <span className="ml-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] text-white">
                    {unreadActivityCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("messages");
                  syncUrl("messages", selectedThreadId || threads[0]?.id || null);
                }}
                className={cn(
                  "rounded-[14px] px-4 py-3 text-sm font-semibold transition",
                  activeTab === "messages"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-zinc-500",
                )}
              >
                Mensajes
                {unreadThreadCount > 0 ? (
                  <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-[11px] text-white">
                    {unreadThreadCount}
                  </span>
                ) : null}
              </button>
            </div>
          </section>

          {loading ? (
            activeTab === "messages" ? <MessagesSkeleton /> : <ActivityCenterSkeleton />
          ) : activeTab === "activity" ? (
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    Nuevas
                  </div>
                  <div className="mt-4 text-4xl font-semibold text-zinc-950">
                    {unreadActivityCount}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">
                    Actividad reciente que merece una mirada, sin forzarte a abrir una
                    vista tipo inbox.
                  </p>
                </div>

                <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    Con accion
                  </div>
                  <div className="mt-4 text-4xl font-semibold text-zinc-950">
                    {actionableActivityCount}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">
                    Notificaciones que sí te llevan a otro lugar o te piden seguimiento.
                  </p>
                </div>

                <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    Conversaciones
                  </div>
                  <div className="mt-4 text-4xl font-semibold text-zinc-950">
                    {threads.length}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">
                    Los mensajes con el equipo quedan aparte, en una bandeja pensada para
                    responder.
                  </p>
                </div>
              </section>

              {activity.length === 0 ? (
                <div className="rounded-[24px] border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="mt-5 text-lg font-semibold text-zinc-950">
                    No tienes actividad visible
                  </div>
                  <p className="mt-2 text-sm leading-7 text-zinc-500">
                    Cuando haya seguimiento de ventas, retiros, moderación o nuevos
                    movimientos, vas a verlo acá como centro de notificaciones.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {unreadActivity.length > 0 ? (
                    <section className="space-y-4">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
                            Centro de notificaciones
                          </div>
                          <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                            Nuevas
                          </h2>
                        </div>
                        <div className="text-sm text-zinc-500">
                          Se muestran primero para que no parezca una bandeja de email.
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        {unreadActivity.map((item) => (
                          <article
                            key={item.id}
                            className="rounded-[24px] border border-zinc-900 bg-white p-5 shadow-sm"
                          >
                            <div className="flex items-start gap-4">
                              {item.avatar ? (
                                <UserAvatar
                                  src={item.avatar}
                                  alt={item.text}
                                  sizeClassName="h-12 w-12"
                                  iconClassName="h-4 w-4"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                                  <Bell className="h-4 w-4" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                                      {formatActivityTypeLabel(item.type)}
                                    </span>
                                    <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-white">
                                      Nuevo
                                    </span>
                                  </div>
                                  <span className="text-xs text-zinc-400">{item.dateLabel}</span>
                                </div>

                                <p className="mt-4 text-base leading-7 text-zinc-900">
                                  {item.text}
                                </p>

                                <div className="mt-5 flex flex-wrap items-center gap-3">
                                  {item.action ? (
                                    <Link
                                      href={item.action.href}
                                      className="inline-flex items-center gap-2 rounded-[14px] bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                                    >
                                      {item.action.label}
                                      <ArrowRight className="h-4 w-4" />
                                    </Link>
                                  ) : (
                                    <div className="inline-flex rounded-[14px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-500">
                                      Solo informativa
                                    </div>
                                  )}
                                  <span className="text-xs text-zinc-500">
                                    {new Date(item.createdAt).toLocaleString("es-AR")}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {readActivity.length > 0 ? (
                    <section className="space-y-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
                          Historial
                        </div>
                        <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                          {unreadActivity.length > 0 ? "Anteriores" : "Ultimas notificaciones"}
                        </h2>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        {readActivity.map((item) => (
                          <article
                            key={item.id}
                            className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm"
                          >
                            <div className="flex items-start gap-4">
                              {item.avatar ? (
                                <UserAvatar
                                  src={item.avatar}
                                  alt={item.text}
                                  sizeClassName="h-12 w-12"
                                  iconClassName="h-4 w-4"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                                  <Bell className="h-4 w-4" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                                    {formatActivityTypeLabel(item.type)}
                                  </span>
                                  <span className="text-xs text-zinc-400">{item.dateLabel}</span>
                                </div>

                                <p className="mt-4 text-base leading-7 text-zinc-700">
                                  {item.text}
                                </p>

                                <div className="mt-5 flex flex-wrap items-center gap-3">
                                  {item.action ? (
                                    <Link
                                      href={item.action.href}
                                      className="inline-flex items-center gap-2 rounded-[14px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                                    >
                                      {item.action.label}
                                      <ArrowRight className="h-4 w-4" />
                                    </Link>
                                  ) : (
                                    <div className="inline-flex rounded-[14px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-500">
                                      Solo informativa
                                    </div>
                                  )}
                                  <span className="text-xs text-zinc-500">
                                    {new Date(item.createdAt).toLocaleString("es-AR")}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <section className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                      Bandeja
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-950">
                      Mensajes del equipo
                    </div>
                  </div>
                  {unreadThreadCount > 0 ? (
                    <div className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                      {unreadThreadCount} nuevos
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 max-h-[72vh] space-y-3 overflow-y-auto pr-1">
                  {threads.length === 0 ? (
                    <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                      No tienes conversaciones abiertas con el equipo por ahora.
                    </div>
                  ) : (
                    threads.map((thread) => (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => handleOpenThread(thread.id)}
                        className={cn(
                          "w-full rounded-[18px] border px-4 py-4 text-left transition",
                          selectedThreadId === thread.id
                            ? "border-zinc-900 bg-zinc-50"
                            : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-zinc-950">
                                {thread.subject}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-[11px] font-semibold",
                                  thread.status === "open"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-zinc-100 text-zinc-600",
                                )}
                              >
                                {thread.status === "open" ? "Abierto" : "Cerrado"}
                              </span>
                            </div>
                            <div className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
                              {thread.lastMessagePreview}
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-400">
                              <span>{new Date(thread.lastMessageAt).toLocaleString("es-AR")}</span>
                              {thread.unread ? (
                                <span className="rounded-full bg-blue-600 px-2 py-1 font-semibold text-white">
                                  Nuevo
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
                {threadLoading ? (
                  <MessagesSkeleton />
                ) : selectedThread ? (
                  <div className="flex h-full min-h-[640px] flex-col">
                    <div className="border-b border-zinc-200 pb-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
                        Mensajes
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-semibold text-zinc-950">{threadTitle}</h2>
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            selectedThread.status === "open"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-zinc-100 text-zinc-600",
                          )}
                        >
                          {selectedThread.status === "open"
                            ? "Conversación abierta"
                            : "Conversación cerrada"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-500">
                        Usa este espacio para responder mensajes administrativos que
                        requieren seguimiento.
                      </p>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto py-6">
                      {selectedThread.messages.length === 0 ? (
                        <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                          Esta conversación todavía no tiene mensajes.
                        </div>
                      ) : (
                        selectedThread.messages.map((message) => (
                          <div
                            key={message.id}
                            className={cn(
                              "max-w-[82%] rounded-[20px] px-4 py-4 shadow-sm",
                              message.isOwnMessage
                                ? "ml-auto bg-zinc-950 text-white"
                                : "border border-zinc-200 bg-zinc-50 text-zinc-900",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              {!message.isOwnMessage ? (
                                <UserAvatar
                                  src={message.senderAvatar}
                                  alt={message.senderName}
                                  sizeClassName="h-9 w-9"
                                  iconClassName="h-4 w-4"
                                />
                              ) : null}
                              <div>
                                <div
                                  className={cn(
                                    "text-xs font-semibold uppercase tracking-[0.18em]",
                                    message.isOwnMessage ? "text-zinc-300" : "text-zinc-400",
                                  )}
                                >
                                  {message.senderName}
                                </div>
                                <div
                                  className={cn(
                                    "mt-1 text-xs",
                                    message.isOwnMessage ? "text-zinc-400" : "text-zinc-500",
                                  )}
                                >
                                  {new Date(message.createdAt).toLocaleString("es-AR")}
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 whitespace-pre-wrap text-sm leading-7">
                              {message.body}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {selectedThread.status === "open" && selectedThread.allowUserReply ? (
                      <div className="border-t border-zinc-200 pt-5">
                        <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4">
                          <label
                            htmlFor="notification-center-reply"
                            className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400"
                          >
                            Responder al equipo
                          </label>
                          <textarea
                            id="notification-center-reply"
                            value={replyBody}
                            onChange={(event) => setReplyBody(event.target.value)}
                            placeholder="Escribe una respuesta clara y breve para que el equipo pueda ayudarte mejor."
                            className="mt-3 min-h-[120px] w-full resize-none rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-950"
                          />
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs text-zinc-500">
                              Tu respuesta queda dentro de esta conversación.
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleSendReply()}
                              disabled={sendingReply || !replyBody.trim()}
                              className="inline-flex items-center gap-2 rounded-[14px] bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                            >
                              {sendingReply ? "Enviando..." : "Enviar respuesta"}
                              <Send className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t border-zinc-200 pt-5">
                        <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500">
                          Esta conversación ya no admite respuestas.
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[20px] border border-dashed border-zinc-200 bg-zinc-50 px-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm">
                      <MessageSquareText className="h-5 w-5" />
                    </div>
                    <div className="mt-5 text-lg font-semibold text-zinc-950">
                      No hay conversación seleccionada
                    </div>
                    <p className="mt-2 max-w-[420px] text-sm leading-7 text-zinc-500">
                      Abre un hilo desde la columna izquierda para ver los mensajes y
                      responder cuando haga falta.
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

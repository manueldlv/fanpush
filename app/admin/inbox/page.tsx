"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { getSupabaseAdminBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { NotificationThreadMessage } from "@/lib/server/repositories/notification-center";

type AdminThreadSummary = {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  avatar: string | null;
  topic: "support" | "author_application" | "withdrawal" | "moderation" | "system";
  subject: string;
  status: "open" | "closed";
  allowUserReply: boolean;
  lastMessagePreview: string;
  lastMessageAt: string;
  lastSenderRole: "user" | "admin" | "system";
  unread: boolean;
  sourceType: string | null;
  sourceId: string | null;
};

type AdminThreadDetail = {
  id: string;
  userId: string;
  topic: AdminThreadSummary["topic"];
  subject: string;
  status: "open" | "closed";
  allowUserReply: boolean;
  lastMessagePreview: string;
  lastMessageAt: string;
  lastSenderRole: "user" | "admin" | "system";
  unread: boolean;
  sourceType: string | null;
  sourceId: string | null;
  messages: NotificationThreadMessage[];
};

const adminAuthedRequest = async <T,>(input: string, init?: RequestInit) => {
  const supabase = getSupabaseAdminBrowserClient();
  if (!supabase) {
    throw new Error("Falta configurar Supabase.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Necesitas iniciar sesión como admin.");
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
    throw new Error(result.error ?? "No se pudo completar la operación admin.");
  }

  return result;
};

export default function AdminInboxPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<AdminThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<AdminThreadDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [closeAfterReply, setCloseAfterReply] = useState(false);

  const selectedSummary = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null,
    [threads, selectedThreadId],
  );

  const loadThreads = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await adminAuthedRequest<{
        ok: true;
        threads: AdminThreadSummary[];
      }>("/api/admin/inbox/threads");
      setThreads(result.threads);
      if (!selectedThreadId && result.threads.length > 0) {
        setSelectedThreadId(result.threads[0].id);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "No se pudo cargar la bandeja admin.",
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
      const result = await adminAuthedRequest<{
        ok: true;
        thread: AdminThreadDetail;
      }>(`/api/admin/inbox/threads/${threadId}`);
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
          : "No se pudo abrir la conversación admin.",
      );
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    void loadThreads();
  }, []);

  useEffect(() => {
    if (!selectedSummary) {
      setSelectedThread(null);
      return;
    }
    if (selectedThread?.id === selectedSummary.id) return;
    void loadThread(selectedSummary.id);
  }, [selectedSummary?.id, selectedThread?.id]);

  const handleReply = async () => {
    if (!selectedThreadId || !replyBody.trim()) return;
    setSendingReply(true);
    setError(null);
    try {
      const result = await adminAuthedRequest<{
        ok: true;
        thread: AdminThreadDetail;
      }>(`/api/admin/inbox/threads/${selectedThreadId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body: replyBody,
          closeThread: closeAfterReply,
        }),
      });
      setSelectedThread(result.thread);
      setReplyBody("");
      setCloseAfterReply(false);
      await loadThreads({ silent: true });
    } catch (replyError) {
      setError(
        replyError instanceof Error
          ? replyError.message
          : "No se pudo responder la conversación.",
      );
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 pb-10 pt-6 md:px-6">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-400">
                FanPush Admin
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                Inbox
              </h1>
              <p className="mt-3 max-w-[720px] text-sm text-zinc-500 md:text-base">
                Revisa respuestas de usuarios, continúa conversaciones abiertas y cierra hilos cuando el caso quede resuelto.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al panel
              </Link>
              <button
                type="button"
                onClick={() => void loadThreads({ silent: true })}
                className="rounded-[18px] bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                {refreshing ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`admin-inbox-skeleton-${index}`}
                    className="rounded-[18px] border border-zinc-200 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="fanpush-skeleton h-11 w-11 rounded-full" />
                      <div className="min-w-0 flex-1">
                        <div className="fanpush-skeleton h-4 w-28 rounded-full" />
                        <div className="mt-2 fanpush-skeleton h-3 w-full rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="fanpush-skeleton h-7 w-40 rounded-full" />
              <div className="mt-6 space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`admin-inbox-message-skeleton-${index}`}
                    className={cn(
                      "max-w-[78%] rounded-[18px] px-4 py-3",
                      index % 2 === 0 ? "bg-zinc-100" : "ml-auto bg-blue-50",
                    )}
                  >
                    <div className="fanpush-skeleton h-3 w-24 rounded-full" />
                    <div className="mt-3 fanpush-skeleton h-3 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="space-y-3">
                {threads.length === 0 ? (
                  <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                    No hay conversaciones abiertas ni históricas todavía.
                  </div>
                ) : (
                  threads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => void loadThread(thread.id)}
                      className={cn(
                        "w-full rounded-[18px] border px-4 py-4 text-left transition",
                        selectedSummary?.id === thread.id
                          ? "border-zinc-900 bg-zinc-50"
                          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <UserAvatar
                          src={thread.avatar}
                          alt={thread.username}
                          sizeClassName="h-11 w-11"
                          iconClassName="h-4 w-4"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate text-sm font-semibold text-zinc-950">
                              {thread.fullName}
                            </div>
                            {thread.unread ? (
                              <span className="rounded-full bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white">
                                Nuevo
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                            {thread.subject}
                          </div>
                          <div className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
                            {thread.lastMessagePreview}
                          </div>
                          <div className="mt-3 text-xs text-zinc-400">
                            @{thread.username} · {new Date(thread.lastMessageAt).toLocaleString("es-AR")}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              {threadLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`admin-thread-loading-${index}`}
                      className={cn(
                        "max-w-[78%] rounded-[18px] px-4 py-3",
                        index % 2 === 0 ? "bg-zinc-100" : "ml-auto bg-blue-50",
                      )}
                    >
                      <div className="fanpush-skeleton h-3 w-24 rounded-full" />
                      <div className="mt-3 fanpush-skeleton h-3 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              ) : selectedThread ? (
                <div className="flex min-h-[680px] flex-col">
                  <div className="border-b border-zinc-200 pb-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
                      Conversación
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold text-zinc-950">
                      {selectedThread.subject}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-500">
                      Usa este hilo para continuar el caso sin perder contexto del usuario.
                    </p>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto py-6">
                    {selectedThread.messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "max-w-[82%] rounded-[20px] px-4 py-4 shadow-sm",
                          message.senderRole === "admin"
                            ? "ml-auto bg-zinc-950 text-white"
                            : "border border-zinc-200 bg-zinc-50 text-zinc-900",
                        )}
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                          {message.senderName}
                        </div>
                        <div
                          className={cn(
                            "mt-1 text-xs",
                            message.senderRole === "admin"
                              ? "text-zinc-400"
                              : "text-zinc-500",
                          )}
                        >
                          {new Date(message.createdAt).toLocaleString("es-AR")}
                        </div>
                        <div className="mt-4 whitespace-pre-wrap text-sm leading-7">
                          {message.body}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-zinc-200 pt-5">
                    <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4">
                      <label
                        htmlFor="admin-inbox-reply"
                        className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400"
                      >
                        Responder al usuario
                      </label>
                      <textarea
                        id="admin-inbox-reply"
                        value={replyBody}
                        onChange={(event) => setReplyBody(event.target.value)}
                        placeholder="Escribe una respuesta clara para el usuario."
                        className="mt-3 min-h-[120px] w-full resize-none rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-950"
                      />
                      <label className="mt-4 flex items-center gap-2 text-sm text-zinc-600">
                        <input
                          type="checkbox"
                          checked={closeAfterReply}
                          onChange={(event) => setCloseAfterReply(event.target.checked)}
                          className="h-4 w-4 rounded border-zinc-300 text-zinc-950"
                        />
                        Cerrar conversación después de enviar
                      </label>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleReply()}
                          disabled={sendingReply || !replyBody.trim()}
                          className="inline-flex items-center gap-2 rounded-[14px] bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                        >
                          {sendingReply ? "Enviando..." : "Enviar respuesta"}
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[520px] items-center justify-center rounded-[20px] border border-dashed border-zinc-200 bg-zinc-50 px-6 text-center text-sm text-zinc-500">
                  Selecciona una conversación para verla y responderla.
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  NotificationActivityItem,
  NotificationThreadDetail,
  NotificationThreadSummary,
} from "@/lib/server/repositories/notification-center";

type NotificationCenterData = {
  activity: NotificationActivityItem[];
  threads: NotificationThreadSummary[];
};

const buildError = (error: unknown, fallback: string) => ({
  error: error instanceof Error ? error.message : fallback,
});

const authedRequest = async <T,>(input: string, init?: RequestInit) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Falta configurar Supabase.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return null;
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

export const notificationsApi = createApi({
  reducerPath: "notificationsApi",
  baseQuery: fakeBaseQuery<{ error: string }>(),
  tagTypes: ["NotificationCenter", "NotificationThread"],
  endpoints: (builder) => ({
    getNotificationCenter: builder.query<NotificationCenterData, void>({
      async queryFn() {
        try {
          const result = await authedRequest<{
            ok: true;
            activity: NotificationActivityItem[];
            threads: NotificationThreadSummary[];
          }>("/api/notification-center");

          if (!result) {
            return { data: { activity: [], threads: [] } };
          }

          return {
            data: {
              activity: result.activity,
              threads: result.threads,
            },
          };
        } catch (error) {
          return {
            error: buildError(
              error,
              "No se pudo cargar tu centro de notificaciones.",
            ),
          };
        }
      },
      keepUnusedDataFor: 120,
      providesTags: ["NotificationCenter"],
    }),
    getNotificationThread: builder.query<NotificationThreadDetail, string>({
      async queryFn(threadId) {
        try {
          const result = await authedRequest<{ ok: true; thread: NotificationThreadDetail }>(
            `/api/notification-center/threads/${threadId}`,
          );

          if (!result) {
            throw new Error("Necesitas iniciar sesión para continuar.");
          }

          return { data: result.thread };
        } catch (error) {
          return {
            error: buildError(error, "No se pudo abrir la conversación."),
          };
        }
      },
      providesTags: (_result, _error, threadId) => [
        { type: "NotificationThread", id: threadId },
      ],
    }),
    sendNotificationReply: builder.mutation<
      NotificationThreadDetail,
      { threadId: string; body: string }
    >({
      async queryFn({ threadId, body }) {
        try {
          const result = await authedRequest<{ ok: true; thread: NotificationThreadDetail }>(
            `/api/notification-center/threads/${threadId}/messages`,
            {
              method: "POST",
              body: JSON.stringify({ body }),
            },
          );

          if (!result) {
            throw new Error("Necesitas iniciar sesión para continuar.");
          }

          return { data: result.thread };
        } catch (error) {
          return {
            error: buildError(error, "No se pudo enviar la respuesta."),
          };
        }
      },
      invalidatesTags: (_result, _error, { threadId }) => [
        "NotificationCenter",
        { type: "NotificationThread", id: threadId },
      ],
    }),
    markNotificationsAsRead: builder.mutation<string[], string[]>({
      async queryFn(notificationIds) {
        if (!notificationIds.length) {
          return { data: [] };
        }

        try {
          const supabase = getSupabaseClient();
          if (!supabase) {
            throw new Error("Falta configurar Supabase.");
          }

          const { error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .in("id", notificationIds);

          if (error) {
            throw error;
          }

          return { data: notificationIds };
        } catch (error) {
          return {
            error: buildError(error, "No se pudieron marcar las notificaciones."),
          };
        }
      },
      invalidatesTags: ["NotificationCenter"],
      async onQueryStarted(notificationIds, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          notificationsApi.util.updateQueryData(
            "getNotificationCenter",
            undefined,
            (draft) => {
              const unreadIds = new Set(notificationIds);
              draft.activity.forEach((item) => {
                if (unreadIds.has(item.id)) {
                  item.isRead = true;
                }
              });
            },
          ),
        );

        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

export const {
  useGetNotificationCenterQuery,
  useGetNotificationThreadQuery,
  useMarkNotificationsAsReadMutation,
  useSendNotificationReplyMutation,
} = notificationsApi;

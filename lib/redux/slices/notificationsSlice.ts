import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  buildDefaultNotificationPreferences,
  isPushNotificationEnabled,
  parseNotificationPreferences,
} from "@/lib/notificationPreferences";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { getSupabaseClient } from "@/lib/supabase";

export type AppNotificationItem = {
  id: string;
  text: string;
  date: string;
  createdAt: string;
  avatar: string | null;
  type: string;
  isRead?: boolean;
  action?: { label: string; href: string };
};

type NotificationsState = {
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  items: AppNotificationItem[];
};

const initialState: NotificationsState = {
  hydrated: false,
  loading: false,
  error: null,
  items: [],
};

const USER_VISIBLE_NOTIFICATION_TYPES = new Set([
  "follow",
  "tip",
  "purchase",
  "withdrawal_update",
  "author_application_update",
  "content_removed_update",
]);

const resolveAvatar = async (value: string | null) => {
  const supabase = getSupabaseClient();
  if (!supabase || !value) return null;
  if (value.startsWith("http")) return value;
  return supabase.storage.from("Imagenes").getPublicUrl(value).data.publicUrl;
};

export const hydrateNotificationsState = createAsyncThunk<
  AppNotificationItem[],
  void,
  { rejectValue: string }
>("notifications/hydrate", async (_, { rejectWithValue }) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return rejectWithValue("Falta configurar Supabase.");
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) {
    return [];
  }

  const { data: notifRows } = await supabase
    .from("notifications")
    .select("id,actor_id,message,created_at,type,entity_id,is_read")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const { data: notificationPrefsRow } = await supabase
    .from("notifications")
    .select("message")
    .eq("user_id", userId)
    .eq("type", "notification_preferences")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const notificationPreferences =
    parseNotificationPreferences(notificationPrefsRow?.message) ??
    buildDefaultNotificationPreferences();

  const actorIds = Array.from(
    new Set((notifRows ?? []).map((notification) => notification.actor_id).filter(Boolean)),
  );

  const { data: actors } = actorIds.length
    ? await supabase.from("users").select("id,avatar_url,username").in("id", actorIds)
    : { data: [] };

  const actorMap = new Map((actors ?? []).map((actor) => [actor.id, actor]));

  return Promise.all(
    (notifRows ?? [])
      .filter((row) => USER_VISIBLE_NOTIFICATION_TYPES.has(row.type ?? ""))
      .filter((row) => isPushNotificationEnabled(notificationPreferences, row.type ?? ""))
      .map(async (row) => {
        const actor = actorMap.get(row.actor_id);
        const actorUsername = actor?.username ?? null;

        return {
          id: row.id,
          type: row.type ?? "generic",
          text:
            row.type === "withdrawal_update" ||
            row.type === "author_application_update" ||
            row.type === "content_removed_update"
              ? `FanPush ${row.message ?? ""}`
              : `${actorUsername ?? "alguien"} ${row.message ?? ""}`,
          date: new Date(row.created_at).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
          }),
          createdAt: row.created_at,
          avatar:
            row.type === "withdrawal_update" ||
            row.type === "author_application_update" ||
            row.type === "content_removed_update"
              ? null
              : await resolveAvatar(actor?.avatar_url ?? null),
          isRead: row.is_read ?? false,
          action:
            row.type === "follow" && actorUsername
              ? { label: "Seguir tambien", href: buildUserProfileHref(actorUsername) }
              : row.type === "purchase"
                ? { label: "Ver venta", href: "/ventas" }
                : row.type === "withdrawal_update" ||
                    row.type === "author_application_update" ||
                    row.type === "content_removed_update"
                  ? { label: "Abrir mensajes", href: "/notificaciones?tab=messages" }
                  : undefined,
        };
      }),
  );
});

export const markNotificationsAsRead = createAsyncThunk<
  string[],
  string[],
  { rejectValue: string }
>("notifications/markAsRead", async (notificationIds, { rejectWithValue }) => {
  if (notificationIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return rejectWithValue("Falta configurar Supabase.");
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .in("id", notificationIds);

  if (error) {
    return rejectWithValue(error.message);
  }

  return notificationIds;
});

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(hydrateNotificationsState.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(hydrateNotificationsState.fulfilled, (state, action) => {
        state.loading = false;
        state.hydrated = true;
        state.error = null;
        state.items = action.payload;
      })
      .addCase(hydrateNotificationsState.rejected, (state, action) => {
        state.loading = false;
        state.hydrated = true;
        state.error = action.payload ?? "No se pudieron cargar las notificaciones.";
      })
      .addCase(markNotificationsAsRead.fulfilled, (state, action) => {
        if (!action.payload.length) return;
        const unreadIds = new Set(action.payload);
        state.items = state.items.map((item) =>
          unreadIds.has(item.id) ? { ...item, isRead: true } : item,
        );
      });
  },
});

export default notificationsSlice.reducer;

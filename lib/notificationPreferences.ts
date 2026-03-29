export const NOTIFICATION_PREFERENCE_CATEGORIES = [
  {
    key: "follow",
    label: "Nuevos seguidores",
    description: "Cuando alguien empieza a seguirte.",
  },
  {
    key: "tip",
    label: "Propinas",
    description: "Cuando recibes una propina o un apoyo directo.",
  },
  {
    key: "purchase",
    label: "Compras y ventas",
    description: "Cuando alguien compra tu contenido o se acredita una compra.",
  },
  {
    key: "withdrawal_update",
    label: "Retiros",
    description: "Cambios de estado en retiros y pagos programados.",
  },
  {
    key: "author_application_update",
    label: "Solicitud de autor",
    description: "Novedades sobre aprobación o revisión de tu solicitud.",
  },
  {
    key: "content_removed_update",
    label: "Moderación",
    description: "Avisos sobre contenido revisado, archivado o removido.",
  },
] as const;

export type NotificationPreferenceCategory =
  (typeof NOTIFICATION_PREFERENCE_CATEGORIES)[number]["key"];

export type NotificationChannelPreferences = Record<
  NotificationPreferenceCategory,
  boolean
>;

export type NotificationPreferences = {
  updatedAt: string | null;
  push: NotificationChannelPreferences;
  email: NotificationChannelPreferences;
};

const buildDefaultChannelPreferences = (): NotificationChannelPreferences =>
  Object.fromEntries(
    NOTIFICATION_PREFERENCE_CATEGORIES.map((category) => [category.key, true]),
  ) as NotificationChannelPreferences;

export const buildDefaultNotificationPreferences = (): NotificationPreferences => ({
  updatedAt: null,
  push: buildDefaultChannelPreferences(),
  email: buildDefaultChannelPreferences(),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const normalizeChannel = (value: unknown): NotificationChannelPreferences => {
  const defaults = buildDefaultChannelPreferences();
  if (!isRecord(value)) return defaults;

  for (const category of NOTIFICATION_PREFERENCE_CATEGORIES) {
    if (typeof value[category.key] === "boolean") {
      defaults[category.key] = value[category.key] as boolean;
    }
  }

  return defaults;
};

export const parseNotificationPreferences = (
  value?: string | null,
): NotificationPreferences | null => {
  if (!value?.trim()) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) return null;

    return {
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      push: normalizeChannel(parsed.push),
      email: normalizeChannel(parsed.email),
    };
  } catch {
    return null;
  }
};

export const serializeNotificationPreferences = (
  preferences: NotificationPreferences,
) =>
  JSON.stringify({
    updatedAt: preferences.updatedAt,
    push: preferences.push,
    email: preferences.email,
  });

export const isPushNotificationEnabled = (
  preferences: NotificationPreferences | null | undefined,
  category: string,
) => {
  if (!preferences) return true;
  if (!(category in preferences.push)) return true;
  return preferences.push[category as NotificationPreferenceCategory];
};

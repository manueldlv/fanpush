const MISSING_DIRECT_CHAT_TABLE_PATTERNS = [
  "direct_thread_members",
  "direct_threads",
  "direct_messages",
  "direct_message_purchases",
  "direct_user_blocks",
];

export const isDirectChatSchemaMissingError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  const normalized = message.toLowerCase();

  return (
    normalized.includes("schema cache") &&
    MISSING_DIRECT_CHAT_TABLE_PATTERNS.some((pattern) =>
      normalized.includes(pattern.toLowerCase()),
    )
  );
};

export const getDirectChatSchemaMissingMessage = (fallback: string) => {
  return `${fallback} Falta aplicar la migración de chats en Supabase: supabase/migrations/20260413000014_direct_chats.sql`;
};

export const normalizeDirectChatRouteError = (error: unknown, fallback: string) => {
  if (isDirectChatSchemaMissingError(error)) {
    return getDirectChatSchemaMissingMessage(fallback);
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
};

export const BLOCKED_CHAT_USERS_KEY = "fanpush_blocked_chat_users";
export const CHAT_BLOCKED_USERS_UPDATED_EVENT = "chat-blocked-users-updated";

export type BlockedChatUser = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  blockedAt: string;
};

export const loadBlockedChatUsers = (): BlockedChatUser[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BLOCKED_CHAT_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is BlockedChatUser =>
        item &&
        typeof item.id === "string" &&
        typeof item.username === "string" &&
        typeof item.fullName === "string" &&
        typeof item.blockedAt === "string",
    );
  } catch {
    return [];
  }
};

export const saveBlockedChatUsers = (users: BlockedChatUser[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BLOCKED_CHAT_USERS_KEY, JSON.stringify(users));
  window.dispatchEvent(new CustomEvent(CHAT_BLOCKED_USERS_UPDATED_EVENT));
};

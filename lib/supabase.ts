import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;
let cachedAdminBrowserClient: SupabaseClient | null = null;
let userSessionRequest: Promise<Session | null> | null = null;
let adminSessionRequest: Promise<Session | null> | null = null;

const USER_AUTH_STORAGE_KEY = "fanpush-user-auth";
const ADMIN_AUTH_STORAGE_KEY = "fanpush-admin-auth";

const isLockConflictError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "AbortError" ||
    error.message.includes("Lock broken by another request") ||
    error.message.includes("was released because another request stole it") ||
    error.message.includes('lock:fanpush-user-auth') ||
    error.message.includes('lock:fanpush-admin-auth')
  );
};

const readStoredBrowserSession = (storageKey: string): Session | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Session | null;
    return parsed?.access_token ? parsed : null;
  } catch {
    return null;
  }
};

export const getSupabaseSessionSafely = async (
  supabase: SupabaseClient,
  options?: {
    storageKey?: string;
    useInFlightRequest?: boolean;
  },
): Promise<Session | null> => {
  const storageKey = options?.storageKey ?? USER_AUTH_STORAGE_KEY;
  const useInFlightRequest = options?.useInFlightRequest ?? true;
  const sessionRequestRef =
    storageKey === ADMIN_AUTH_STORAGE_KEY
      ? {
          get current() {
            return adminSessionRequest;
          },
          set current(value: Promise<Session | null> | null) {
            adminSessionRequest = value;
          },
        }
      : {
          get current() {
            return userSessionRequest;
          },
          set current(value: Promise<Session | null> | null) {
            userSessionRequest = value;
          },
        };

  if (useInFlightRequest && sessionRequestRef.current) {
    return sessionRequestRef.current;
  }

  const request = (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      if (!isLockConflictError(error)) {
        throw error;
      }
      return readStoredBrowserSession(storageKey);
    }
  })();

  if (!useInFlightRequest) {
    return request;
  }

  sessionRequestRef.current = request.finally(() => {
    sessionRequestRef.current = null;
  });

  return sessionRequestRef.current;
};

export const getSupabaseClient = () => {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  cachedClient = createClient(url, anonKey, {
    auth: {
      storageKey: USER_AUTH_STORAGE_KEY,
    },
  });
  return cachedClient;
};

export const getSupabaseAdminBrowserClient = () => {
  if (cachedAdminBrowserClient) return cachedAdminBrowserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  cachedAdminBrowserClient = createClient(url, anonKey, {
    auth: {
      storageKey: ADMIN_AUTH_STORAGE_KEY,
    },
  });
  return cachedAdminBrowserClient;
};

export const ensureUserRow = async (
  supabase: SupabaseClient,
  user: User | null | undefined,
) => {
  if (!user?.id) return;

  const fallbackUsername =
    typeof user.user_metadata?.username === "string" &&
    user.user_metadata.username.trim()
      ? user.user_metadata.username.trim()
      : user.email?.split("@")[0] ?? "usuario";

  const { data: existingUser, error: selectError } = await supabase
    .from("users")
    .select("id, username")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) throw selectError;

  if (!existingUser) {
    const { error } = await supabase.from("users").insert({
      id: user.id,
      username: fallbackUsername,
    });
    if (error) throw error;
    return;
  }

  if (!existingUser.username?.trim()) {
    const { error } = await supabase
      .from("users")
      .update({ username: fallbackUsername })
      .eq("id", user.id);
    if (error) throw error;
  }
};

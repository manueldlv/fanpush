import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import type { PayoutProfile } from "@/lib/payouts";
import {
  getSupabaseAdminBrowserClient,
  getSupabaseClient,
} from "@/lib/supabase";

type ViewerProfileState = {
  username: string | null;
  avatarUrl: string | null;
  fullName: string;
  bio: string;
  website: string;
  instagram: string;
  badges: string[];
  isVerified: boolean;
  isFeatured: boolean;
};

type ViewerAccessState = {
  roles: string[];
  permissions: string[];
  authorStatus: "idle" | "pending" | "approved" | "rejected";
  isAuthor: boolean;
  isBlocked: boolean;
  blockedReason: string | null;
  kycLevel: string | null;
  isAdmin: boolean;
  canCreate: boolean;
  canWithdraw: boolean;
  canAccessAdmin: boolean;
};

type ViewerCommerceState = {
  balance: number;
  cashAvailable: number;
  cashPending: number;
  cashReserved: number;
  bonusAvailable: number;
  lifetimeDeposited: number;
  lifetimeEarned: number;
  lifetimeWithdrawn: number;
  creatorShare: number;
  platformFee: number;
  payoutProfile: PayoutProfile | null;
};

export type ViewerPayload = {
  profile: ViewerProfileState;
  access: ViewerAccessState;
  commerce: ViewerCommerceState;
};

export type SessionSummary = {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
};

export type AdminAccessSummary = {
  isAuthenticated: boolean;
  isAdmin: boolean;
};

const emptyViewerPayload = (): ViewerPayload => ({
  profile: {
    username: null,
    avatarUrl: null,
    fullName: "",
    bio: "",
    website: "",
    instagram: "",
    badges: [],
    isVerified: false,
    isFeatured: false,
  },
  access: {
    roles: [],
    permissions: [],
    authorStatus: "idle",
    isAuthor: false,
    isBlocked: false,
    blockedReason: null,
    kycLevel: null,
    isAdmin: false,
    canCreate: false,
    canWithdraw: false,
    canAccessAdmin: false,
  },
  commerce: {
    balance: 0,
    cashAvailable: 0,
    cashPending: 0,
    cashReserved: 0,
    bonusAvailable: 0,
    lifetimeDeposited: 0,
    lifetimeEarned: 0,
    lifetimeWithdrawn: 0,
    creatorShare: 0,
    platformFee: 0,
    payoutProfile: null,
  },
});

const normalizeAuthorStatus = (
  value: unknown,
): ViewerAccessState["authorStatus"] => {
  if (
    value === "idle" ||
    value === "pending" ||
    value === "approved" ||
    value === "rejected"
  ) {
    return value;
  }
  return "idle";
};

const buildError = (error: unknown, fallback: string) => ({
  error: error instanceof Error ? error.message : fallback,
});

const SESSION_STORAGE_KEY = "fanpush-user-auth";
const SESSION_TIMEOUT_MS = 1500;

const readStoredSessionSummary = (): SessionSummary | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      access_token?: unknown;
      user?: { id?: unknown; email?: unknown } | null;
    };

    if (!parsed?.access_token || !parsed.user?.id) {
      return null;
    }

    return {
      isAuthenticated: true,
      userId: typeof parsed.user.id === "string" ? parsed.user.id : null,
      email: typeof parsed.user.email === "string" ? parsed.user.email : null,
    };
  } catch {
    return null;
  }
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("session_timeout"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const loadSessionSummary = async (): Promise<SessionSummary> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Falta configurar Supabase.");
  }

  try {
    const {
      data: { session },
    } = await withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS);

    if (!session?.user) {
      return {
        isAuthenticated: false,
        userId: null,
        email: null,
      };
    }

    return {
      isAuthenticated: true,
      userId: session.user.id,
      email: session.user.email ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "session_timeout") {
      return (
        readStoredSessionSummary() ?? {
          isAuthenticated: false,
          userId: null,
          email: null,
        }
      );
    }

    throw error;
  }
};

const loadViewer = async (): Promise<ViewerPayload> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Falta configurar Supabase.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user || !session.access_token) {
    return emptyViewerPayload();
  }

  const response = await fetch("/api/me", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: "no-store",
  });

  const result = (await response.json()) as {
    error?: string;
    viewer?: Partial<ViewerPayload>;
  };

  if (response.status === 401) {
    return emptyViewerPayload();
  }

  if (!response.ok || !result.viewer) {
    throw new Error(result.error ?? "No se pudo cargar el perfil del usuario.");
  }

  const profile = (result.viewer.profile ?? {}) as Partial<ViewerProfileState>;
  const access = (result.viewer.access ?? {}) as Partial<ViewerAccessState>;
  const commerce = (result.viewer.commerce ?? {}) as Partial<ViewerCommerceState>;
  const authorStatus = normalizeAuthorStatus(access.authorStatus);
  const roles = Array.isArray(access.roles) ? access.roles.filter(Boolean) : [];
  const permissions = Array.isArray(access.permissions)
    ? access.permissions.filter(Boolean)
    : [];
  const derivedAuthor =
    Boolean(access.isAuthor) ||
    authorStatus === "approved" ||
    roles.includes("author") ||
    permissions.includes("content.create");

  return {
    profile: {
      username:
        typeof profile.username === "string" && profile.username.trim()
          ? profile.username
          : null,
      avatarUrl:
        typeof profile.avatarUrl === "string" && profile.avatarUrl.trim()
          ? profile.avatarUrl
          : null,
      fullName: typeof profile.fullName === "string" ? profile.fullName : "",
      bio: typeof profile.bio === "string" ? profile.bio : "",
      website: typeof profile.website === "string" ? profile.website : "",
      instagram: typeof profile.instagram === "string" ? profile.instagram : "",
      badges: Array.isArray((profile as { badges?: unknown }).badges)
        ? ((profile as { badges?: unknown[] }).badges ?? []).filter(
            (badge): badge is string => typeof badge === "string",
          )
        : [],
      isVerified: Boolean((profile as { isVerified?: boolean }).isVerified),
      isFeatured: Boolean((profile as { isFeatured?: boolean }).isFeatured),
    },
    access: {
      roles,
      permissions,
      authorStatus,
      isAuthor: derivedAuthor,
      isBlocked: Boolean(access.isBlocked),
      blockedReason:
        typeof (access as { blockedReason?: unknown }).blockedReason === "string" &&
        (access as { blockedReason?: string }).blockedReason?.trim()
          ? (access as { blockedReason?: string }).blockedReason ?? null
          : null,
      kycLevel:
        typeof (access as { kycLevel?: unknown }).kycLevel === "string" &&
        (access as { kycLevel?: string }).kycLevel?.trim()
          ? (access as { kycLevel?: string }).kycLevel ?? null
          : null,
      isAdmin: Boolean(access.isAdmin),
      canCreate: Boolean(access.canCreate ?? derivedAuthor),
      canWithdraw: Boolean(
        access.canWithdraw ??
          (derivedAuthor || permissions.includes("withdrawals.request")),
      ),
      canAccessAdmin: Boolean(access.canAccessAdmin ?? access.isAdmin),
    },
    commerce: {
      balance: Number(commerce.balance ?? 0),
      cashAvailable: Number(commerce.cashAvailable ?? 0),
      cashPending: Number(commerce.cashPending ?? 0),
      cashReserved: Number(commerce.cashReserved ?? 0),
      bonusAvailable: Number(commerce.bonusAvailable ?? 0),
      lifetimeDeposited: Number(commerce.lifetimeDeposited ?? 0),
      lifetimeEarned: Number(commerce.lifetimeEarned ?? 0),
      lifetimeWithdrawn: Number(commerce.lifetimeWithdrawn ?? 0),
      creatorShare: Number(commerce.creatorShare ?? 0),
      platformFee: Number(commerce.platformFee ?? 0),
      payoutProfile: (commerce.payoutProfile as PayoutProfile | null | undefined) ?? null,
    },
  };
};

const loadAdminAccess = async (): Promise<AdminAccessSummary> => {
  const supabase = getSupabaseAdminBrowserClient();
  if (!supabase) {
    throw new Error("Falta configurar Supabase.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      isAuthenticated: false,
      isAdmin: false,
    };
  }

  const response = await fetch("/api/admin/access", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    return {
      isAuthenticated: true,
      isAdmin: false,
    };
  }

  const result = (await response.json()) as { error?: string; isAdmin?: boolean };

  if (!response.ok) {
    throw new Error(result.error ?? "No se pudo validar el acceso admin.");
  }

  return {
    isAuthenticated: true,
    isAdmin: Boolean(result.isAdmin),
  };
};

export const sessionApi = createApi({
  reducerPath: "sessionApi",
  baseQuery: fakeBaseQuery<{ error: string }>(),
  tagTypes: ["Session", "Viewer", "AdminAccess"],
  endpoints: (builder) => ({
    getSession: builder.query<SessionSummary, void>({
      async queryFn() {
        try {
          return { data: await loadSessionSummary() };
        } catch (error) {
          return { error: buildError(error, "No se pudo validar la sesión.") };
        }
      },
      keepUnusedDataFor: 300,
      providesTags: ["Session"],
    }),
    getViewer: builder.query<ViewerPayload, void>({
      async queryFn() {
        try {
          return { data: await loadViewer() };
        } catch (error) {
          return { error: buildError(error, "No se pudo cargar el estado del usuario.") };
        }
      },
      keepUnusedDataFor: 300,
      providesTags: ["Viewer"],
    }),
    getAdminAccess: builder.query<AdminAccessSummary, void>({
      async queryFn() {
        try {
          return { data: await loadAdminAccess() };
        } catch (error) {
          return { error: buildError(error, "No se pudo validar el acceso admin.") };
        }
      },
      keepUnusedDataFor: 300,
      providesTags: ["AdminAccess"],
    }),
    signOut: builder.mutation<void, { admin?: boolean } | void>({
      async queryFn(arg) {
        const useAdmin = Boolean(arg && "admin" in arg && arg.admin);
        const supabase = useAdmin
          ? getSupabaseAdminBrowserClient()
          : getSupabaseClient();

        if (!supabase) {
          return { error: buildError(null, "Falta configurar Supabase.") };
        }

        const { error } = await supabase.auth.signOut();
        if (error) {
          return { error: buildError(error, "No se pudo cerrar la sesión.") };
        }

        return { data: undefined };
      },
      invalidatesTags: ["Session", "Viewer", "AdminAccess"],
    }),
  }),
});

export const {
  useGetAdminAccessQuery,
  useGetSessionQuery,
  useGetViewerQuery,
  useSignOutMutation,
} = sessionApi;

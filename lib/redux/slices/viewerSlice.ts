import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PayoutProfile } from "@/lib/payouts";
import { getSupabaseClient } from "@/lib/supabase";

export type AuthorStatus = "idle" | "pending" | "approved" | "rejected";

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
  authorStatus: AuthorStatus;
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

export type ViewerState = {
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  profile: ViewerProfileState;
  access: ViewerAccessState;
  commerce: ViewerCommerceState;
};

type ViewerPayload = Omit<ViewerState, "hydrated" | "loading" | "error">;

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

const initialState: ViewerState = {
  hydrated: false,
  loading: false,
  error: null,
  ...emptyViewerPayload(),
};

const normalizeAuthorStatus = (value: unknown): AuthorStatus => {
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

export const hydrateViewerState = createAsyncThunk<
  ViewerPayload,
  void,
  { rejectValue: string }
>("viewer/hydrate", async (_, { rejectWithValue }) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return rejectWithValue("Falta configurar Supabase.");
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
    return rejectWithValue(result.error ?? "No se pudo cargar el perfil del usuario.");
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
});

const viewerSlice = createSlice({
  name: "viewer",
  initialState,
  reducers: {
    clearViewerState: () => initialState,
    setViewerProfileSummary: (
      state,
      action: PayloadAction<Partial<ViewerProfileState>>,
    ) => {
      state.profile = {
        ...state.profile,
        ...action.payload,
      };
    },
    setViewerAuthorStatus: (state, action: PayloadAction<AuthorStatus>) => {
      const nextStatus = action.payload;
      const roleOrPermissionAuthor =
        state.access.roles.includes("author") ||
        state.access.permissions.includes("content.create");
      const isAuthor = roleOrPermissionAuthor || nextStatus === "approved";

      state.access.authorStatus = nextStatus;
      state.access.isAuthor = isAuthor;
      state.access.canCreate = isAuthor && !state.access.isBlocked;
      state.access.canWithdraw =
        (isAuthor || state.access.permissions.includes("withdrawals.request")) &&
        !state.access.isBlocked;
    },
    setViewerBalance: (state, action: PayloadAction<number>) => {
      state.commerce.balance = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateViewerState.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(hydrateViewerState.fulfilled, (state, action) => {
        state.loading = false;
        state.hydrated = true;
        state.error = null;
        state.profile = action.payload.profile;
        state.access = action.payload.access;
        state.commerce = action.payload.commerce;
      })
      .addCase(hydrateViewerState.rejected, (state, action) => {
        state.loading = false;
        state.hydrated = true;
        state.error = action.payload ?? "No se pudo cargar el estado del usuario.";
      });
  },
});

export const {
  clearViewerState,
  setViewerAuthorStatus,
  setViewerBalance,
  setViewerProfileSummary,
} = viewerSlice.actions;

export default viewerSlice.reducer;

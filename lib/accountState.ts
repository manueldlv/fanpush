export type AccountState = {
  isBlocked: boolean;
  blockedReason: string | null;
  kycLevel: string | null;
  badges: string[];
  isVerified: boolean;
  isFeatured: boolean;
  updatedAt?: string;
};

export const defaultAccountState = (): AccountState => ({
  isBlocked: false,
  blockedReason: null,
  kycLevel: null,
  badges: [],
  isVerified: false,
  isFeatured: false,
});

export const coerceAccountState = (value: unknown): AccountState => {
  if (!value || typeof value !== "object") {
    return defaultAccountState();
  }

  const parsed = value as Partial<AccountState>;
  return {
    isBlocked: Boolean(parsed.isBlocked),
    blockedReason:
      typeof parsed.blockedReason === "string" && parsed.blockedReason.trim()
        ? parsed.blockedReason
        : null,
    kycLevel:
      typeof parsed.kycLevel === "string" && parsed.kycLevel.trim()
        ? parsed.kycLevel
        : null,
    badges: Array.isArray(parsed.badges)
      ? parsed.badges.filter(
          (badge): badge is string => typeof badge === "string" && Boolean(badge.trim()),
        )
      : [],
    isVerified: Boolean(parsed.isVerified),
    isFeatured: Boolean(parsed.isFeatured),
    updatedAt:
      typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
  };
};

export const isPlatformDisabledReason = (reason?: string | null) =>
  reason === "account_closed" ||
  reason === "account_deleted" ||
  reason === "terms_violation" ||
  reason === "spam" ||
  reason === "admin_disabled";

export const canAccessFinanceWhileBlocked = (state: AccountState) =>
  state.isBlocked &&
  (state.blockedReason === "account_closed" ||
    state.blockedReason === "account_deleted");

export const isPubliclyUnavailableAccount = (state: AccountState) =>
  state.isBlocked && isPlatformDisabledReason(state.blockedReason);

export const getUnavailableAccountMessage = (state: AccountState) => {
  switch (state.blockedReason) {
    case "account_closed":
    case "account_deleted":
      return "Esta persona cerró su cuenta y ya no está disponible en la plataforma.";
    case "terms_violation":
    case "spam":
    case "admin_disabled":
      return "Este perfil no está disponible por incumplimiento de las normas de la plataforma.";
    default:
      return "Este perfil no está disponible.";
  }
};

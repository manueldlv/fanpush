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

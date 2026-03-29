export type PayoutProfile = {
  alias: string;
  holderName: string;
  holderDocument: string;
  notes?: string;
  updatedAt: string;
};

const PREFIX = "payout_profile:";

export const coercePayoutProfile = (value: unknown): PayoutProfile | null => {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<PayoutProfile>;
  if (!parsed.alias || !parsed.holderName || !parsed.holderDocument) return null;
  return {
    alias: parsed.alias,
    holderName: parsed.holderName,
    holderDocument: parsed.holderDocument,
    notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
    updatedAt:
      typeof parsed.updatedAt === "string"
        ? parsed.updatedAt
        : new Date().toISOString(),
  };
};

export const toPayoutProfileMetaValue = (profile: PayoutProfile) => ({
  alias: profile.alias,
  holderName: profile.holderName,
  holderDocument: profile.holderDocument,
  notes: profile.notes ?? "",
  updatedAt: profile.updatedAt,
});

export const serializePayoutProfile = (profile: PayoutProfile) =>
  `${PREFIX}${JSON.stringify(toPayoutProfileMetaValue(profile))}`;

export const parsePayoutProfile = (message?: string | null): PayoutProfile | null => {
  if (!message?.startsWith(PREFIX)) return null;
  try {
    return coercePayoutProfile(JSON.parse(message.slice(PREFIX.length)));
  } catch {
    return null;
  }
};

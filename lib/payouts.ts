export type PayoutProfile = {
  alias: string;
  holderName: string;
  holderDocument: string;
  notes?: string;
  updatedAt: string;
};

const PREFIX = "payout_profile:";

export const serializePayoutProfile = (profile: PayoutProfile) =>
  `${PREFIX}${JSON.stringify(profile)}`;

export const parsePayoutProfile = (message?: string | null): PayoutProfile | null => {
  if (!message?.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(message.slice(PREFIX.length)) as PayoutProfile;
    if (!parsed.alias || !parsed.holderName || !parsed.holderDocument) return null;
    return parsed;
  } catch {
    return null;
  }
};

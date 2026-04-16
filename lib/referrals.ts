import { getDefaultCreatorShare } from "@/lib/userCommission";

export type ReferralTier = {
  minReferrals: number;
  label: string;
  creatorShareRate: number;
  platformShareRate: number;
};

export const normalizeReferralCode = (value: string | null | undefined) =>
  value
    ? value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/^@+/, "")
        .replace(/[^a-z0-9._-]/g, "")
    : "";

export const REFERRAL_TIERS: ReferralTier[] = [
  {
    minReferrals: 0,
    label: "Base",
    creatorShareRate: getDefaultCreatorShare(),
    platformShareRate: 1 - getDefaultCreatorShare(),
  },
  {
    minReferrals: 5,
    label: "Impulso",
    creatorShareRate: 0.75,
    platformShareRate: 0.25,
  },
  {
    minReferrals: 15,
    label: "Crecimiento",
    creatorShareRate: 0.8,
    platformShareRate: 0.2,
  },
  {
    minReferrals: 30,
    label: "Elite",
    creatorShareRate: 0.85,
    platformShareRate: 0.15,
  },
];

export const getReferralTier = (count: number) =>
  [...REFERRAL_TIERS]
    .sort((a, b) => b.minReferrals - a.minReferrals)
    .find((tier) => count >= tier.minReferrals) ?? REFERRAL_TIERS[0];

export const getCreatorShareForReferralCount = (count: number) =>
  getReferralTier(count).creatorShareRate;

export const getPlatformShareForReferralCount = (count: number) =>
  getReferralTier(count).platformShareRate;

export const getNextReferralTierTarget = (count: number) =>
  REFERRAL_TIERS.find((tier) => tier.minReferrals > count)?.minReferrals ?? null;

export const buildReferralLink = (baseUrl: string, username: string) => {
  const origin = baseUrl.replace(/\/$/, "");
  const safeUsername = normalizeReferralCode(username);
  return `${origin}/auth?ref=${encodeURIComponent(safeUsername)}`;
};

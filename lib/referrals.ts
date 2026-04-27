import { getDefaultCreatorShare } from "@/lib/userCommission";

export const REFERRAL_LEVEL_MAX = 100;

const REFERRAL_LEVEL_REQUIREMENTS: Array<{ level: number; minReferrals: number }> = [];

let cumulativeReferrals = 0;
for (let level = 1; level <= REFERRAL_LEVEL_MAX; level += 1) {
  if (level === 1) {
    REFERRAL_LEVEL_REQUIREMENTS.push({
      level,
      minReferrals: 0,
    });
    continue;
  }

  const increment = Math.max(1, Math.round(2 + Math.pow(level - 1, 1.2) / 3.5));
  cumulativeReferrals += increment;
  REFERRAL_LEVEL_REQUIREMENTS.push({
    level,
    minReferrals: cumulativeReferrals,
  });
}

const REFERRAL_COMMISSION_LEVEL_RANGES = [
  { levelStart: 1, levelEnd: 10, creatorShareRate: 0.7 },
  { levelStart: 11, levelEnd: 20, creatorShareRate: 0.72 },
  { levelStart: 21, levelEnd: 30, creatorShareRate: 0.74 },
  { levelStart: 31, levelEnd: 40, creatorShareRate: 0.76 },
  { levelStart: 41, levelEnd: 50, creatorShareRate: 0.78 },
  { levelStart: 51, levelEnd: 60, creatorShareRate: 0.8 },
  { levelStart: 61, levelEnd: 70, creatorShareRate: 0.83 },
  { levelStart: 71, levelEnd: 80, creatorShareRate: 0.86 },
  { levelStart: 81, levelEnd: 90, creatorShareRate: 0.9 },
  { levelStart: 91, levelEnd: 100, creatorShareRate: 0.95 },
] as const;

export type ReferralTier = {
  level: number;
  minReferrals: number;
  label: string;
  creatorShareRate: number;
  platformShareRate: number;
};

export type ReferralLevelBenefit = {
  level: number;
  creatorShareRate: number;
  platformShareRate: number;
  unlocksCommissionUpgrade: boolean;
  nextCommissionLevel: number | null;
  title: string;
  description: string;
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

export const getReferralsRequiredForLevel = (level: number) => {
  const safeLevel = Math.min(Math.max(1, Math.floor(level)), REFERRAL_LEVEL_MAX);
  return REFERRAL_LEVEL_REQUIREMENTS[safeLevel - 1]?.minReferrals ?? 0;
};

export const getReferralLevel = (count: number) => {
  const safeCount = Math.max(0, Math.floor(count));

  for (let index = REFERRAL_LEVEL_REQUIREMENTS.length - 1; index >= 0; index -= 1) {
    const requirement = REFERRAL_LEVEL_REQUIREMENTS[index];
    if (safeCount >= requirement.minReferrals) {
      return requirement.level;
    }
  }

  return 1;
};

export const getReferralTierForLevel = (level: number): ReferralTier => {
  const safeLevel = Math.min(Math.max(1, Math.floor(level)), REFERRAL_LEVEL_MAX);
  const requirement = REFERRAL_LEVEL_REQUIREMENTS[safeLevel - 1];
  const commissionRange =
    REFERRAL_COMMISSION_LEVEL_RANGES.find(
      (item) => safeLevel >= item.levelStart && safeLevel <= item.levelEnd,
    ) ?? REFERRAL_COMMISSION_LEVEL_RANGES[0];

  return {
    level: safeLevel,
    minReferrals: requirement?.minReferrals ?? 0,
    label: `Nivel ${safeLevel}`,
    creatorShareRate: commissionRange.creatorShareRate,
    platformShareRate: 1 - commissionRange.creatorShareRate,
  };
};

export const getReferralBenefitForLevel = (level: number): ReferralLevelBenefit => {
  const safeLevel = Math.min(Math.max(1, Math.floor(level)), REFERRAL_LEVEL_MAX);
  const currentTier = getReferralTierForLevel(safeLevel);
  const previousTier = safeLevel > 1 ? getReferralTierForLevel(safeLevel - 1) : null;
  const unlocksCommissionUpgrade =
    !previousTier || previousTier.creatorShareRate !== currentTier.creatorShareRate;

  let nextCommissionLevel: number | null = null;
  for (let nextLevel = safeLevel + 1; nextLevel <= REFERRAL_LEVEL_MAX; nextLevel += 1) {
    const nextTier = getReferralTierForLevel(nextLevel);
    if (nextTier.creatorShareRate !== currentTier.creatorShareRate) {
      nextCommissionLevel = nextLevel;
      break;
    }
  }

  if (unlocksCommissionUpgrade) {
    return {
      level: safeLevel,
      creatorShareRate: currentTier.creatorShareRate,
      platformShareRate: currentTier.platformShareRate,
      unlocksCommissionUpgrade,
      nextCommissionLevel,
      title: `Desbloquea ${Math.round(currentTier.creatorShareRate * 100)}% para el autor`,
      description:
        safeLevel >= REFERRAL_LEVEL_MAX
          ? "Llegaste al rango más alto del programa de referidos."
          : `En este nivel mejoras tu comisión y dejas atrás el rango anterior.`,
    };
  }

  return {
    level: safeLevel,
    creatorShareRate: currentTier.creatorShareRate,
    platformShareRate: currentTier.platformShareRate,
    unlocksCommissionUpgrade,
    nextCommissionLevel,
    title: nextCommissionLevel
      ? `Acumulas progreso hacia Nivel ${nextCommissionLevel}`
      : "Mantienes el rango máximo",
    description: nextCommissionLevel
      ? `Tu comisión sigue en ${Math.round(currentTier.creatorShareRate * 100)}% para el autor. Este nivel te acerca al próximo salto real de comisión en Nivel ${nextCommissionLevel}.`
      : "Ya no quedan mejoras de comisión por desbloquear dentro del programa.",
  };
};

export const getReferralTier = (count: number) =>
  getReferralTierForLevel(getReferralLevel(count));

export const getCreatorShareForReferralCount = (count: number) =>
  getReferralTier(count).creatorShareRate;

export const getPlatformShareForReferralCount = (count: number) =>
  getReferralTier(count).platformShareRate;

export const getNextReferralTierTarget = (count: number) => {
  const currentLevel = getReferralLevel(count);
  if (currentLevel >= REFERRAL_LEVEL_MAX) return null;
  return getReferralsRequiredForLevel(currentLevel + 1);
};

export const getReferralProgress = (count: number) => {
  const safeCount = Math.max(0, Math.floor(count));
  const level = getReferralLevel(safeCount);
  const currentTier = getReferralTierForLevel(level);
  const currentLevelMin = getReferralsRequiredForLevel(level);
  const nextLevel = level < REFERRAL_LEVEL_MAX ? level + 1 : null;
  const nextLevelTarget = nextLevel ? getReferralsRequiredForLevel(nextLevel) : null;
  const referralsIntoLevel = safeCount - currentLevelMin;
  const referralsNeededForNextLevel = nextLevelTarget
    ? Math.max(nextLevelTarget - safeCount, 0)
    : 0;
  const referralsSpan = nextLevelTarget ? nextLevelTarget - currentLevelMin : 0;

  return {
    level,
    currentTier,
    currentLevelMin,
    nextLevel,
    nextLevelTarget,
    referralsIntoLevel,
    referralsNeededForNextLevel,
    referralsSpan,
  };
};

export const getDefaultReferralTier = (): ReferralTier => ({
  level: 1,
  minReferrals: 0,
  label: "Nivel 1",
  creatorShareRate: getDefaultCreatorShare(),
  platformShareRate: 1 - getDefaultCreatorShare(),
});

export const buildReferralLink = (baseUrl: string, username: string) => {
  const origin = baseUrl.replace(/\/$/, "");
  const safeUsername = normalizeReferralCode(username);
  return `${origin}/auth?ref=${encodeURIComponent(safeUsername)}`;
};

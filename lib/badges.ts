export type BadgeCategory =
  | "founders"
  | "sales"
  | "promotion"
  | "referrals"
  | "prestige";

export type BadgeSource = "manual" | "automatic";

export type BadgeDefinition = {
  slug: string;
  label: string;
  description: string;
  category: BadgeCategory;
  source: BadgeSource;
  rarity: "common" | "rare" | "epic" | "legendary";
  displayPriority: number;
};

export type ResolvedBadge = BadgeDefinition;

type BadgeContext = {
  persistedBadges?: string[] | null;
  lifetimeEarnedArs?: number | null;
  referralCount?: number | null;
  hasActivePromotion?: boolean | null;
  isFeatured?: boolean | null;
};

const salesThresholds = [
  ["sales-10k", 10_000],
  ["sales-25k", 25_000],
  ["sales-50k", 50_000],
  ["sales-100k", 100_000],
  ["sales-250k", 250_000],
  ["sales-500k", 500_000],
  ["sales-1m", 1_000_000],
  ["sales-2m", 2_000_000],
  ["sales-3m", 3_000_000],
  ["sales-5m", 5_000_000],
  ["sales-7_5m", 7_500_000],
  ["sales-10m", 10_000_000],
  ["sales-15m", 15_000_000],
  ["sales-20m", 20_000_000],
  ["sales-30m", 30_000_000],
  ["sales-40m", 40_000_000],
  ["sales-50m", 50_000_000],
  ["sales-75m", 75_000_000],
  ["sales-100m", 100_000_000],
  ["sales-150m", 150_000_000],
  ["sales-200m", 200_000_000],
  ["sales-300m", 300_000_000],
  ["sales-500m", 500_000_000],
  ["sales-1b", 1_000_000_000],
] as const;

const referralThresholds = [
  ["referrals-1", 1],
  ["referrals-5", 5],
  ["referrals-10", 10],
  ["referrals-25", 25],
  ["referrals-50", 50],
  ["referrals-100", 100],
  ["referrals-250", 250],
  ["referrals-500", 500],
  ["referrals-1000", 1000],
] as const;

const promoterThresholds = [
  ["promoter-bronze", 5],
  ["promoter-silver", 15],
  ["promoter-gold", 35],
  ["promoter-platinum", 75],
  ["promoter-diamond", 150],
  ["growth-partner", 300],
  ["top-promoter", 500],
  ["network-legend", 1000],
] as const;

const badgeCatalog: BadgeDefinition[] = [
  {
    slug: "founder",
    label: "Fundador",
    description: "Uno de los primeros 100 promotores de FanPush.",
    category: "founders",
    source: "manual",
    rarity: "legendary",
    displayPriority: 1000,
  },
  {
    slug: "founder-top-10",
    label: "Fundador Legendario",
    description: "Parte del grupo inicial más exclusivo del lanzamiento.",
    category: "founders",
    source: "manual",
    rarity: "legendary",
    displayPriority: 1010,
  },
  {
    slug: "launch-pioneer",
    label: "Pionero de Lanzamiento",
    description: "Activo desde la primera etapa pública del producto.",
    category: "founders",
    source: "manual",
    rarity: "epic",
    displayPriority: 920,
  },
  {
    slug: "og-promoter",
    label: "OG Promoter",
    description: "Impulsó el crecimiento del sitio desde el comienzo.",
    category: "founders",
    source: "manual",
    rarity: "epic",
    displayPriority: 930,
  },
  {
    slug: "day-one",
    label: "Día Uno",
    description: "Estuvo desde el primer día del lanzamiento.",
    category: "founders",
    source: "manual",
    rarity: "epic",
    displayPriority: 910,
  },
  {
    slug: "beta-pioneer",
    label: "Pionero Beta",
    description: "Participó antes de la apertura general.",
    category: "founders",
    source: "manual",
    rarity: "epic",
    displayPriority: 900,
  },
  {
    slug: "site-promoter",
    label: "Promotor FanPush",
    description: "Tiene promoción activa dentro de la plataforma.",
    category: "promotion",
    source: "automatic",
    rarity: "common",
    displayPriority: 700,
  },
  {
    slug: "rising-star",
    label: "Estrella Emergente",
    description: "Perfil con crecimiento temprano destacado.",
    category: "prestige",
    source: "manual",
    rarity: "rare",
    displayPriority: 650,
  },
  {
    slug: "trending",
    label: "En Tendencia",
    description: "Perfil con tracción destacada en la comunidad.",
    category: "prestige",
    source: "manual",
    rarity: "rare",
    displayPriority: 660,
  },
  {
    slug: "fan-favorite",
    label: "Favorito del Público",
    description: "Muy elegido por la comunidad.",
    category: "prestige",
    source: "manual",
    rarity: "epic",
    displayPriority: 680,
  },
  {
    slug: "most-supported",
    label: "Más Apoyado",
    description: "Recibió apoyo destacado de sus seguidores.",
    category: "prestige",
    source: "manual",
    rarity: "epic",
    displayPriority: 690,
  },
  {
    slug: "top-creator",
    label: "Top Creator",
    description: "Creador con resultados sostenidos dentro del producto.",
    category: "prestige",
    source: "manual",
    rarity: "epic",
    displayPriority: 710,
  },
  {
    slug: "featured-creator",
    label: "Creador Destacado",
    description: "Perfil destacado por el equipo de FanPush.",
    category: "prestige",
    source: "manual",
    rarity: "epic",
    displayPriority: 720,
  },
  {
    slug: "editor-pick",
    label: "Selección del Equipo",
    description: "Elegido editorialmente por FanPush.",
    category: "prestige",
    source: "manual",
    rarity: "epic",
    displayPriority: 730,
  },
  {
    slug: "community-icon",
    label: "Ícono de la Comunidad",
    description: "Perfil emblemático dentro de la comunidad.",
    category: "prestige",
    source: "manual",
    rarity: "legendary",
    displayPriority: 740,
  },
  {
    slug: "hall-of-fame",
    label: "Hall of Fame",
    description: "Forma parte del grupo histórico más destacado.",
    category: "prestige",
    source: "manual",
    rarity: "legendary",
    displayPriority: 750,
  },
  {
    slug: "legendary-creator",
    label: "Creador Legendario",
    description: "Máximo reconocimiento de prestigio dentro de FanPush.",
    category: "prestige",
    source: "manual",
    rarity: "legendary",
    displayPriority: 760,
  },
  ...salesThresholds.map(([slug, amount], index) => ({
    slug,
    label: `Ventas ${formatBadgeMoney(amount)}`,
    description: `Superó ${formatBadgeMoney(amount)} en ventas acumuladas.`,
    category: "sales" as const,
    source: "automatic" as const,
    rarity:
      amount >= 100_000_000
        ? ("legendary" as const)
        : amount >= 10_000_000
          ? ("epic" as const)
          : amount >= 1_000_000
            ? ("rare" as const)
            : ("common" as const),
    displayPriority: 300 + index,
  })),
  ...referralThresholds.map(([slug, count], index) => ({
    slug,
    label: count === 1 ? "Primer referido" : `${count} referidos`,
    description:
      count === 1
        ? "Consiguió su primer referido."
        : `Consiguió ${count} referidos acumulados.`,
    category: "referrals" as const,
    source: "automatic" as const,
    rarity:
      count >= 500
        ? ("legendary" as const)
        : count >= 100
          ? ("epic" as const)
          : count >= 25
            ? ("rare" as const)
            : ("common" as const),
    displayPriority: 500 + index,
  })),
  ...promoterThresholds.map(([slug, count], index) => ({
    slug,
    label:
      slug === "growth-partner"
        ? "Growth Partner"
        : slug === "top-promoter"
          ? "Top Promoter"
          : slug === "network-legend"
            ? "Leyenda de Red"
            : `Promotor ${slug.replace("promoter-", "")}`,
    description: `Desbloqueado por rendimiento sostenido de referidos y promoción (${count}+ referidos).`,
    category: "promotion" as const,
    source: "automatic" as const,
    rarity:
      count >= 500
        ? ("legendary" as const)
        : count >= 150
          ? ("epic" as const)
          : count >= 35
            ? ("rare" as const)
            : ("common" as const),
    displayPriority: 600 + index,
  })),
];

const badgeMap = new Map(badgeCatalog.map((badge) => [badge.slug, badge]));

function formatBadgeMoney(amount: number) {
  if (amount >= 1_000_000_000) return "$1.000M";
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const formatted =
      Number.isInteger(millions) ? String(millions) : String(millions).replace(".", ",");
    return `$${formatted}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }
  return `$${amount}`;
}

const pickHighestUnlocked = (
  currentValue: number,
  thresholds: readonly (readonly [string, number])[],
) => {
  let resolved: string | null = null;
  for (const [slug, threshold] of thresholds) {
    if (currentValue >= threshold) {
      resolved = slug;
    }
  }
  return resolved;
};

export const getBadgeDefinition = (slug: string) => badgeMap.get(slug) ?? null;

export const getAllBadgeDefinitions = () => badgeCatalog;

export const getBadgeThreshold = (slug: string) => {
  const salesThreshold = salesThresholds.find(([badgeSlug]) => badgeSlug === slug);
  if (salesThreshold) {
    return {
      kind: "sales" as const,
      value: salesThreshold[1],
    };
  }

  const referralThreshold = referralThresholds.find(([badgeSlug]) => badgeSlug === slug);
  if (referralThreshold) {
    return {
      kind: "referrals" as const,
      value: referralThreshold[1],
    };
  }

  const promoterThreshold = promoterThresholds.find(([badgeSlug]) => badgeSlug === slug);
  if (promoterThreshold) {
    return {
      kind: "promotion" as const,
      value: promoterThreshold[1],
    };
  }

  return null;
};

export const getNextBadgeThreshold = (
  kind: "sales" | "referrals" | "promotion",
  currentValue: number,
) => {
  const thresholds =
    kind === "sales"
      ? salesThresholds
      : kind === "referrals"
        ? referralThresholds
        : promoterThresholds;

  for (const [slug, value] of thresholds) {
    if (currentValue < value) {
      return { slug, value };
    }
  }

  return null;
};

export const formatBadgeThresholdValue = (
  kind: "sales" | "referrals" | "promotion",
  value: number,
) => {
  if (kind === "sales") {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  }

  return `${value}`;
};

export const resolveBadgeSlugs = ({
  persistedBadges,
  lifetimeEarnedArs,
  referralCount,
  hasActivePromotion,
  isFeatured,
}: BadgeContext) => {
  const slugs = new Set(
    (persistedBadges ?? []).filter(
      (badge): badge is string => typeof badge === "string" && badge.trim().length > 0,
    ),
  );

  const earned = Math.max(Number(lifetimeEarnedArs ?? 0), 0);
  const referrals = Math.max(Number(referralCount ?? 0), 0);

  const topSalesBadge = pickHighestUnlocked(earned, salesThresholds);
  if (topSalesBadge) slugs.add(topSalesBadge);

  const topReferralBadge = pickHighestUnlocked(referrals, referralThresholds);
  if (topReferralBadge) slugs.add(topReferralBadge);

  if (hasActivePromotion) {
    slugs.add("site-promoter");
  }

  const topPromotionBadge = pickHighestUnlocked(referrals, promoterThresholds);
  if (topPromotionBadge) slugs.add(topPromotionBadge);

  if (isFeatured) {
    slugs.add("featured-creator");
  }

  return Array.from(slugs);
};

export const resolveBadges = (context: BadgeContext): ResolvedBadge[] =>
  resolveBadgeSlugs(context)
    .map((slug) => getBadgeDefinition(slug))
    .filter(Boolean)
    .sort((a, b) => b.displayPriority - a.displayPriority) as ResolvedBadge[];

export const getPrimaryBadges = (context: BadgeContext, limit = 4): ResolvedBadge[] => {
  const byCategory = new Map<BadgeCategory, ResolvedBadge>();
  for (const badge of resolveBadges(context)) {
    if (!byCategory.has(badge.category)) {
      byCategory.set(badge.category, badge);
    }
  }
  return Array.from(byCategory.values())
    .sort((a, b) => b.displayPriority - a.displayPriority)
    .slice(0, limit);
};

"use client";

import Link from "next/link";
import ProfileBadgeIcon from "@/components/ProfileBadgeIcon";
import SidebarLeft from "@/components/SidebarLeft";
import {
  formatBadgeThresholdValue,
  getAllBadgeDefinitions,
  getBadgeThreshold,
  getNextBadgeThreshold,
  type BadgeCategory,
} from "@/lib/badges";
import { useGetSettingsQuery } from "@/lib/redux/api/settingsApi";
import { useGetViewerQuery } from "@/lib/redux/api/sessionApi";
import { formatARS } from "@/lib/utils";

const badgeCategoryTitle: Record<BadgeCategory, string> = {
  founders: "Fundación",
  sales: "Ventas",
  purchases: "Compras",
  promotion: "Promoción",
  referrals: "Referidos",
  prestige: "Prestigio",
};

const badgeCategoryDescription: Record<BadgeCategory, string> = {
  founders: "Badges reservadas para launch, founders y etapas tempranas.",
  sales: "Se desbloquean automáticamente según tus ventas acumuladas en ARS.",
  purchases: "Reconocen el valor acumulado de tus compras dentro de FanPush.",
  promotion: "Reconocen tu capacidad de mover crecimiento y traer creadores.",
  referrals: "Premian la cantidad total de personas que trajiste al ecosistema.",
  prestige: "Reconocimientos editoriales o manuales asignados por FanPush.",
};

const categoryOrder: BadgeCategory[] = [
  "founders",
  "sales",
  "purchases",
  "promotion",
  "referrals",
  "prestige",
];

const rarityTone: Record<string, string> = {
  common: "border-zinc-200 bg-zinc-50 text-zinc-600",
  rare: "border-sky-200 bg-sky-50 text-sky-700",
  epic: "border-violet-200 bg-violet-50 text-violet-700",
  legendary: "border-amber-200 bg-amber-50 text-amber-700",
};

const rarityLabel: Record<string, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export default function BadgesPage() {
  const { data: viewer } = useGetViewerQuery();
  const { data: settingsData } = useGetSettingsQuery();

  const unlockedSlugs = new Set(viewer?.profile.badges ?? []);
  const lifetimeEarned = viewer?.commerce.lifetimeEarned ?? 0;
  const referralCount = settingsData?.referrals.count ?? 0;

  const groupedBadges = categoryOrder.map((category) => ({
    category,
    items: getAllBadgeDefinitions()
      .filter((badge) => badge.category === category)
      .sort((a, b) => a.displayPriority - b.displayPriority),
  }));

  const progressCards = [
    {
      key: "sales",
      title: "Ventas",
      current: formatARS(lifetimeEarned),
      next: getNextBadgeThreshold("sales", lifetimeEarned),
      href: "/ventas",
    },
    {
      key: "referrals",
      title: "Referidos",
      current: `${referralCount}`,
      next: getNextBadgeThreshold("referrals", referralCount),
      href: "/referidos",
    },
    {
      key: "promotion",
      title: "Promoción",
      current: `${referralCount}`,
      next: getNextBadgeThreshold("promotion", referralCount),
      href: "/referidos",
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f7f5f1] text-zinc-900">
      <SidebarLeft />

      <div className="md:pl-60">
        <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-6 md:py-8">
          <section className="rounded-[28px] border border-[#e8e0d4] bg-white px-6 py-6 md:px-8 md:py-8">
            <div className="max-w-[760px]">
              <div className="text-sm font-medium text-[#5A3EE7]">Badges</div>
              <h1 className="mt-2 text-[50px] font-semibold tracking-[-0.04em] text-zinc-950">
                Todas tus insignias en un solo lugar
              </h1>
              <p className="mt-3 text-sm leading-6 text-zinc-600 md:text-base">
                Acá ves todas las badges disponibles, cuáles ya tenés y cuánto te falta para
                desbloquear el siguiente rango en ventas, referidos y promoción.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[22px] border border-[#e8e0d4] bg-[#faf7ff] p-5">
                <div className="text-sm text-zinc-500">Desbloqueadas</div>
                <div className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">
                  {unlockedSlugs.size}
                </div>
              </div>
              <div className="rounded-[22px] border border-[#e8e0d4] bg-[#faf7ff] p-5">
                <div className="text-sm text-zinc-500">Ventas acumuladas</div>
                <div className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">
                  {formatARS(lifetimeEarned)}
                </div>
              </div>
              <div className="rounded-[22px] border border-[#e8e0d4] bg-[#faf7ff] p-5">
                <div className="text-sm text-zinc-500">Referidos totales</div>
                <div className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">
                  {referralCount}
                </div>
              </div>
            </div>

          </section>

          <div className="mt-8 space-y-8">
            {groupedBadges.map((group) => (
              <section
                key={group.category}
                className="overflow-hidden rounded-[28px] border border-[#e8e0d4] bg-white"
              >
                <div className="border-b border-[#efe6da] px-6 py-6 md:px-8">
                  <h2 className="text-2xl font-semibold tracking-[-0.03em] text-zinc-950">
                    {badgeCategoryTitle[group.category]}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
                    {badgeCategoryDescription[group.category]}
                  </p>
                </div>

                <div className="grid gap-5 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4 md:px-8">
                  {group.items.map((badge) => {
                    const threshold = getBadgeThreshold(badge.slug);
                    const currentValue =
                      threshold?.kind === "sales"
                        ? lifetimeEarned
                        : threshold?.kind === "referrals" || threshold?.kind === "promotion"
                          ? referralCount
                          : null;
                    const unlockedByProgress =
                      threshold && currentValue !== null ? currentValue >= threshold.value : false;
                    const unlocked = unlockedSlugs.has(badge.slug) || unlockedByProgress;
                    const missing =
                      threshold && currentValue !== null
                        ? Math.max(threshold.value - currentValue, 0)
                        : null;

                    return (
                      <div
                        key={badge.slug}
                        className={`rounded-[24px] border p-5 transition ${
                          unlocked
                            ? "border-[#ddd2ff] bg-[linear-gradient(180deg,#faf7ff_0%,#ffffff_100%)]"
                            : "border-zinc-200 bg-zinc-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                              rarityTone[badge.rarity]
                            }`}
                          >
                            {rarityLabel[badge.rarity]}
                          </div>
                          <div
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              unlocked
                                ? "bg-[#e9e2ff] text-[#5A3EE7]"
                                : "bg-zinc-200 text-zinc-500"
                            }`}
                          >
                            {unlocked ? "Desbloqueada" : "Bloqueada"}
                          </div>
                        </div>

                        <div className="mt-5 flex justify-center">
                          <ProfileBadgeIcon
                            slug={badge.slug}
                            category={badge.category}
                            rarity={badge.rarity}
                            size={74}
                            className={`h-[74px] w-[74px] transition ${
                              unlocked ? "opacity-100" : "grayscale opacity-40"
                            }`}
                          />
                        </div>

                        <div className="mt-5 text-center">
                          <div className="text-[17px] font-semibold leading-tight text-zinc-950">
                            {badge.label}
                          </div>
                          <div className="mt-2 text-[13px] leading-5 text-zinc-500">
                            {badge.description}
                          </div>
                        </div>

                        <div className="mt-4 rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-center">
                          {threshold ? (
                            unlocked ? (
                              <div className="text-sm font-medium text-zinc-700">
                                Desbloqueada desde{" "}
                                <span className="font-semibold text-zinc-950">
                                  {formatBadgeThresholdValue(threshold.kind, threshold.value)}
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-zinc-500">
                                  Falta para desbloquear
                                </div>
                                <div className="text-sm font-semibold text-zinc-950">
                                  {missing !== null
                                    ? formatBadgeThresholdValue(threshold.kind, missing)
                                    : "Pendiente"}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  Objetivo: {formatBadgeThresholdValue(threshold.kind, threshold.value)}
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="text-sm text-zinc-600">
                              {unlocked
                                ? "Badge editorial o manual ya asignada."
                                : "Se asigna manualmente por staff o por condiciones especiales."}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

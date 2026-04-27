"use client";

import { useMemo, useState } from "react";
import { Copy, Users } from "lucide-react";
import SidebarLeft from "@/components/SidebarLeft";
import UserAvatar from "@/components/UserAvatar";
import { useGetSettingsQuery } from "@/lib/redux/api/settingsApi";
import {
  getReferralBenefitForLevel,
  getReferralProgress,
  getReferralTierForLevel,
  REFERRAL_LEVEL_MAX,
} from "@/lib/referrals";

export default function ReferralsPage() {
  const { data: settingsData } = useGetSettingsQuery();
  const [copiedReferralLink, setCopiedReferralLink] = useState(false);

  const referralSummary = settingsData?.referrals;
  const referralCount = referralSummary?.count ?? 0;
  const progress = useMemo(() => getReferralProgress(referralCount), [referralCount]);

  const creatorShare = Math.round((referralSummary?.creatorShareRate ?? 0.7) * 100);
  const platformShare = 100 - creatorShare;
  const nextLevelLabel = progress.nextLevel ? `Nivel ${progress.nextLevel}` : "Nivel máximo";
  const requiredForCurrentLevel = progress.nextLevelTarget
    ? progress.nextLevelTarget - progress.currentLevelMin
    : progress.referralsIntoLevel;
  const maxVisibleBars = 24;
  const usesCompressedProgress = requiredForCurrentLevel + 1 > maxVisibleBars;
  const displayedBars = usesCompressedProgress
    ? maxVisibleBars
    : Math.max(requiredForCurrentLevel + 1, 1);
  const progressRatio =
    requiredForCurrentLevel > 0
      ? Math.min(progress.referralsIntoLevel / requiredForCurrentLevel, 1)
      : 1;
  const filledBars = progress.nextLevel
    ? Math.min(
        Math.max(1, Math.round(progressRatio * (displayedBars - 1)) + 1),
        displayedBars,
      )
    : displayedBars;
  const currentLevelBenefit = useMemo(
    () => getReferralBenefitForLevel(progress.level),
    [progress.level],
  );
  const nextLevelBenefit = useMemo(
    () =>
      progress.nextLevel ? getReferralBenefitForLevel(progress.nextLevel) : currentLevelBenefit,
    [currentLevelBenefit, progress.nextLevel],
  );
  const nextLevelTierCreatorShare = progress.nextLevel
    ? Math.round(getReferralTierForLevel(progress.nextLevel).creatorShareRate * 100)
    : creatorShare;
  const nextLevelTierPlatformShare = 100 - nextLevelTierCreatorShare;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SidebarLeft />

      <div className="md:pl-60">
        <div className="mx-auto flex w-full max-w-none px-4 py-6 md:max-w-[1200px] md:px-6 md:py-8">
          <div className="w-full space-y-6">
            <div className="overflow-hidden rounded-[5px] border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 px-6 py-6 md:px-8 md:py-8">
                <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-zinc-950 md:text-5xl">
                  Nivel {progress.level}
                </h1>
                <p className="mt-3 max-w-3xl text-base text-zinc-600 md:text-lg">
                  Tu comisión actual es {creatorShare}% para el autor y {platformShare}%
                  para FanPush. Cuantos más usuarios activos traigas, más cerca estás
                  del siguiente rango.
                </p>
                <p className="mt-3 max-w-3xl text-sm text-zinc-500 md:text-base">
                  {currentLevelBenefit.description}
                </p>
              </div>

              <div className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:px-8 md:py-8">
                <div className="rounded-[5px] border border-zinc-200 bg-zinc-50 p-5 md:p-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-zinc-950">
                        Progreso hacia {nextLevelLabel}
                      </div>
                      <div className="mt-1 text-sm text-zinc-500">
                        {usesCompressedProgress
                          ? "Las barras muestran tu avance proporcional dentro de este tramo."
                          : "Cada barra representa una persona referida dentro del tramo actual."}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-zinc-600">
                      {progress.referralsIntoLevel}/{requiredForCurrentLevel}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {Array.from({ length: displayedBars }, (_, index) => {
                      const filled = index < filledBars;
                      return (
                        <div
                          key={index}
                          className={`h-9 w-3 rounded-full transition ${
                            filled
                              ? "bg-[#ff6a13] shadow-[0_8px_18px_rgba(255,106,19,0.22)]"
                              : "bg-zinc-200"
                          }`}
                        />
                      );
                    })}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
                    <span className="rounded-full bg-white px-3 py-1 font-medium text-zinc-700">
                      Desde {progress.currentLevelMin} referidos
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 font-medium text-zinc-700">
                      Próximo salto en {progress.nextLevelTarget ?? progress.currentLevelMin}
                    </span>
                  </div>

                  <div className="mt-5 rounded-[5px] border border-zinc-200 bg-white px-4 py-4">
                    {progress.nextLevel ? (
                      <p className="text-base font-semibold text-zinc-900">
                        Te faltan {progress.referralsNeededForNextLevel} referidos para
                        llegar a {nextLevelLabel}.
                      </p>
                    ) : (
                      <p className="text-base font-semibold text-zinc-900">
                        Ya llegaste al Nivel {REFERRAL_LEVEL_MAX}, el máximo del programa.
                      </p>
                    )}
                    <p className="mt-1 text-sm text-zinc-500">
                      El sistema está diseñado para que los últimos niveles sean mucho
                      más difíciles de alcanzar.
                    </p>
                  </div>

                  <div className="mt-4 rounded-[5px] border border-orange-200 bg-orange-50 px-4 py-4">
                    <div className="text-sm font-semibold text-zinc-900">
                      {progress.nextLevel ? `Qué desbloquea ${nextLevelLabel}` : "Beneficios del nivel máximo"}
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">
                      {nextLevelBenefit.title}. {nextLevelBenefit.description}
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded-[5px] bg-white px-3 py-3">
                        <div className="text-xs font-medium text-zinc-500">Comisión autor</div>
                        <div className="mt-1 text-lg font-semibold text-zinc-950">
                          {nextLevelTierCreatorShare}%
                        </div>
                      </div>
                      <div className="rounded-[5px] bg-white px-3 py-3">
                        <div className="text-xs font-medium text-zinc-500">Comisión FanPush</div>
                        <div className="mt-1 text-lg font-semibold text-zinc-950">
                          {nextLevelTierPlatformShare}%
                        </div>
                      </div>
                      <div className="rounded-[5px] bg-white px-3 py-3">
                        <div className="text-xs font-medium text-zinc-500">
                          {nextLevelBenefit.unlocksCommissionUpgrade
                            ? "Mejora"
                            : "Próximo salto real"}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-zinc-950">
                          {nextLevelBenefit.unlocksCommissionUpgrade
                            ? "Sube tu comisión"
                            : nextLevelBenefit.nextCommissionLevel
                              ? `Nivel ${nextLevelBenefit.nextCommissionLevel}`
                              : "Máximo alcanzado"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {progress.nextLevelTarget
                            ? `${progress.nextLevelTarget} referidos acumulados`
                            : "No hay más niveles por subir."}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
                    <div className="text-sm text-zinc-500">Personas referidas</div>
                    <div className="mt-2 text-4xl font-semibold text-zinc-950">
                      {referralCount}
                    </div>
                  </div>
                  <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
                    <div className="text-sm text-zinc-500">Comisión actual</div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-950">
                      {creatorShare}% creador
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {platformShare}% FanPush
                    </div>
                  </div>
                  <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
                    <div className="text-sm text-zinc-500">Próximo desbloqueo</div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-950">
                      {progress.nextLevel ? nextLevelLabel : "Máximo"}
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {progress.nextLevelTarget
                        ? `${progress.nextLevelTarget} referidos acumulados`
                        : "No hay más niveles por subir."}
                    </div>
                    {progress.nextLevel ? (
                      <div className="mt-3 text-sm text-zinc-700">
                        {nextLevelBenefit.unlocksCommissionUpgrade
                          ? `Subes a ${nextLevelTierCreatorShare}% para el autor y bajas a ${nextLevelTierPlatformShare}% para FanPush.`
                          : `No cambia tu comisión todavía. Este nivel te acerca al próximo salto real en Nivel ${nextLevelBenefit.nextCommissionLevel}.`}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                <div className="text-lg font-semibold text-zinc-950">Tu link de referido</div>
                <p className="mt-2 text-sm text-zinc-500">
                  Cada persona que se registre con este link queda asociada a tu nivel.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1 rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                    {referralSummary?.link || "Todavía no hay link disponible."}
                  </div>
                  <button
                    type="button"
                    disabled={!referralSummary?.link}
                    onClick={async () => {
                      if (!referralSummary?.link) return;
                      await navigator.clipboard.writeText(referralSummary.link);
                      setCopiedReferralLink(true);
                      window.setTimeout(() => setCopiedReferralLink(false), 1800);
                    }}
                    className="rounded-[5px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Copy className="h-4 w-4" />
                      {copiedReferralLink ? "Copiado" : "Copiar link"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-zinc-950">
                      Usuarios referidos
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      Personas que se registraron usando tu link.
                    </div>
                  </div>
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                    <Users className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {referralSummary?.referredUsers?.length ? (
                    referralSummary.referredUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between gap-4 rounded-[5px] border border-zinc-200 bg-zinc-50 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            src={user.avatarUrl}
                            alt={user.username}
                            sizeClassName="h-11 w-11"
                            iconClassName="h-4 w-4"
                          />
                          <div>
                            <div className="text-sm font-semibold text-zinc-950">
                              @{user.username}
                            </div>
                            <div className="text-sm text-zinc-500">
                              {user.fullName || "Sin nombre cargado"}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-zinc-500">
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString("es-AR")
                            : "Sin fecha"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[5px] border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
                      Todavía no tienes personas registradas con tu link.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import type { PayoutProfile } from "@/lib/payouts";
import {
  buildReferralLink,
  getNextReferralTierTarget,
  getReferralTier,
} from "@/lib/referrals";
import {
  buildDefaultNotificationPreferences,
  parseNotificationPreferences,
  serializeNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notificationPreferences";
import {
  coercePayoutProfile,
  parsePayoutProfile,
  serializePayoutProfile,
  toPayoutProfileMetaValue,
} from "@/lib/payouts";
import {
  coerceProfileDetails,
  normalizeWebsite,
  parseProfileDetails,
  serializeProfileDetails,
  toProfileDetailsMetaValue,
} from "@/lib/profileDetails";
import {
  getUserMetaEntries,
  upsertUserMetaValue,
  USER_META_KEYS,
} from "@/lib/userMeta";
import { getSupabaseClient } from "@/lib/supabase";
import {
  getCreatorShareFromProfile,
  getPlatformShareFromProfile,
  getLatestUserCommissionProfile,
} from "@/lib/userCommission";

type SettingsReferralUser = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  createdAt: string | null;
};

type SettingsReferralData = {
  code: string;
  link: string;
  count: number;
  creatorShareRate: number;
  platformShareRate: number;
  tierLabel: string;
  nextTierTarget: number | null;
  referredUsers: SettingsReferralUser[];
};

type SettingsData = {
  userId: string | null;
  username: string;
  avatarUrl: string | null;
  avatarPath: string | null;
  fullName: string;
  bio: string;
  website: string;
  instagram: string;
  payoutProfile: PayoutProfile | null;
  notificationPreferences: NotificationPreferences;
  referrals: SettingsReferralData;
};

type UpdateProfileArg = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  avatarPath: string | null;
  fullName: string;
  bio: string;
  website: string;
  instagram: string;
};

type UpdatePayoutArg = {
  userId: string;
  payoutProfile: PayoutProfile;
};

type UpdateNotificationPreferencesArg = {
  userId: string;
  notificationPreferences: NotificationPreferences;
};

const buildError = (error: unknown, fallback: string) => ({
  error: error instanceof Error ? error.message : fallback,
});

const resolveAvatarUrl = (
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  value: string | null,
) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return supabase.storage.from("Imagenes").getPublicUrl(value).data.publicUrl;
};

const loadSettings = async (): Promise<SettingsData> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Falta configurar Supabase.");
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id ?? null;
  if (!userId) {
    return {
      userId: null,
      username: "usuario",
      avatarUrl: null,
      avatarPath: null,
      fullName: "",
      bio: "",
      website: "",
      instagram: "",
      payoutProfile: null,
      notificationPreferences: buildDefaultNotificationPreferences(),
      referrals: {
        code: "",
        link: "",
        count: 0,
        creatorShareRate: 0.7,
        platformShareRate: 0.3,
        tierLabel: getReferralTier(0).label,
        nextTierTarget: getNextReferralTierTarget(0),
        referredUsers: [],
      },
    };
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("username, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  const { data: payoutRow } = await supabase
    .from("notifications")
    .select("message")
    .eq("user_id", userId)
    .eq("type", "payout_profile")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: profileMetaRow } = await supabase
    .from("notifications")
    .select("message")
    .eq("user_id", userId)
    .eq("type", "profile_meta")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: notificationPrefsRow } = await supabase
    .from("notifications")
    .select("message")
    .eq("user_id", userId)
    .eq("type", "notification_preferences")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const userMetaResult = await getUserMetaEntries(supabase, userId, [
    USER_META_KEYS.profileDetails,
    USER_META_KEYS.payoutProfile,
    USER_META_KEYS.notificationPreferences,
  ]);

  const payoutProfile =
    coercePayoutProfile(userMetaResult.entries.get(USER_META_KEYS.payoutProfile)) ??
    parsePayoutProfile(payoutRow?.message);
  const profileDetails =
    coerceProfileDetails(userMetaResult.entries.get(USER_META_KEYS.profileDetails)) ??
    parseProfileDetails(profileMetaRow?.message);
  const notificationPreferences =
    parseNotificationPreferences(notificationPrefsRow?.message) ??
    (userMetaResult.entries.get(USER_META_KEYS.notificationPreferences) as
      | NotificationPreferences
      | undefined) ??
    buildDefaultNotificationPreferences();
  const rawAvatar = userRow?.avatar_url ?? null;
  const resolvedAvatar = resolveAvatarUrl(supabase, rawAvatar);
  const { data: referralRows } = await supabase
    .from("user_referrals")
    .select("referred_user_id, created_at")
    .eq("referrer_user_id", userId)
    .order("created_at", { ascending: false });
  const referredUserIds = (referralRows ?? []).map((row) => row.referred_user_id);
  const referredUsersMap = new Map<string, SettingsReferralUser>();
  if (referredUserIds.length > 0) {
    const [{ data: referredUsersRows }, { data: referredProfilesRows }] = await Promise.all([
      supabase
        .from("users")
        .select("id, username, avatar_url")
        .in("id", referredUserIds),
      supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .in("id", referredUserIds),
    ]);

    const referredProfileMap = new Map(
      (referredProfilesRows ?? []).map((row) => [row.id, row]),
    );

    (referredUsersRows ?? []).forEach((row) => {
      const profile = referredProfileMap.get(row.id);
      referredUsersMap.set(row.id, {
        id: row.id,
        username: row.username ?? "usuario",
        fullName: profile?.full_name ?? "",
        avatarUrl: resolveAvatarUrl(supabase, row.avatar_url ?? null),
        createdAt: profile?.created_at ?? null,
      });
    });
  }

  const referralCount = referralRows?.length ?? 0;
  const tier = getReferralTier(referralCount);
  const latestCommission = await getLatestUserCommissionProfile(supabase, userId);
  const creatorShareRate = getCreatorShareFromProfile(latestCommission?.record);
  const platformShareRate = getPlatformShareFromProfile(latestCommission?.record);

  return {
    userId,
    username: userRow?.username ?? "usuario",
    avatarUrl: resolvedAvatar,
    avatarPath: rawAvatar,
    fullName: profileRow?.full_name ?? "",
    bio: profileDetails?.bio ?? "",
    website: profileDetails?.website ?? "",
    instagram: profileDetails?.instagram ?? "",
    payoutProfile,
    notificationPreferences,
    referrals: {
      code: userRow?.username ?? "",
      link:
        typeof window !== "undefined" && userRow?.username
          ? buildReferralLink(window.location.origin, userRow.username)
          : "",
      count: referralCount,
      creatorShareRate,
      platformShareRate,
      tierLabel: tier.label,
      nextTierTarget: getNextReferralTierTarget(referralCount),
      referredUsers: (referralRows ?? [])
        .map((row) => referredUsersMap.get(row.referred_user_id))
        .filter(Boolean) as SettingsReferralUser[],
    },
  };
};

export const settingsApi = createApi({
  reducerPath: "settingsApi",
  baseQuery: fakeBaseQuery<{ error: string }>(),
  tagTypes: ["Settings"],
  endpoints: (builder) => ({
    getSettings: builder.query<SettingsData, void>({
      async queryFn() {
        try {
          return { data: await loadSettings() };
        } catch (error) {
          return { error: buildError(error, "No se pudo cargar la configuración.") };
        }
      },
      providesTags: ["Settings"],
    }),
    updateProfile: builder.mutation<SettingsData, UpdateProfileArg>({
      async queryFn(arg) {
        try {
          const supabase = getSupabaseClient();
          if (!supabase) throw new Error("Falta configurar Supabase.");

          const { error: userError } = await supabase.from("users").upsert(
            {
              id: arg.userId,
              username: arg.username,
              avatar_url: arg.avatarPath ?? arg.avatarUrl,
            },
            { onConflict: "id" },
          );
          if (userError) throw userError;

          const { error: profileError } = await supabase.from("profiles").upsert(
            {
              id: arg.userId,
              full_name: arg.fullName,
              email: "",
            },
            { onConflict: "id" },
          );
          if (profileError) throw profileError;

          await upsertUserMetaValue(
            supabase,
            arg.userId,
            USER_META_KEYS.profileDetails,
            toProfileDetailsMetaValue({
              bio: arg.bio,
              website: normalizeWebsite(arg.website),
              instagram: arg.instagram,
            }),
          );

          const payload = serializeProfileDetails({
            bio: arg.bio,
            website: normalizeWebsite(arg.website),
            instagram: arg.instagram,
          });
          const { data: existingProfileMeta } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", arg.userId)
            .eq("type", "profile_meta")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (existingProfileMeta?.id) {
            const { error } = await supabase
              .from("notifications")
              .update({ message: payload, is_read: true })
              .eq("id", existingProfileMeta.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("notifications").insert({
              user_id: arg.userId,
              actor_id: arg.userId,
              type: "profile_meta",
              entity_id: arg.userId,
              message: payload,
              is_read: true,
            });
            if (error) throw error;
          }

          return { data: await loadSettings() };
        } catch (error) {
          return { error: buildError(error, "No se pudo actualizar el perfil.") };
        }
      },
      invalidatesTags: ["Settings"],
    }),
    updatePayoutProfile: builder.mutation<SettingsData, UpdatePayoutArg>({
      async queryFn(arg) {
        try {
          const supabase = getSupabaseClient();
          if (!supabase) throw new Error("Falta configurar Supabase.");

          const payload = serializePayoutProfile(arg.payoutProfile);
          await upsertUserMetaValue(
            supabase,
            arg.userId,
            USER_META_KEYS.payoutProfile,
            toPayoutProfileMetaValue(arg.payoutProfile),
          );

          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", arg.userId)
            .eq("type", "payout_profile")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existing?.id) {
            const { error } = await supabase
              .from("notifications")
              .update({ message: payload, is_read: true })
              .eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("notifications").insert({
              user_id: arg.userId,
              actor_id: arg.userId,
              type: "payout_profile",
              entity_id: arg.userId,
              message: payload,
              is_read: true,
            });
            if (error) throw error;
          }

          return { data: await loadSettings() };
        } catch (error) {
          return { error: buildError(error, "No se pudo actualizar los datos de cobro.") };
        }
      },
      invalidatesTags: ["Settings"],
    }),
    updateNotificationPreferences: builder.mutation<
      SettingsData,
      UpdateNotificationPreferencesArg
    >({
      async queryFn(arg) {
        try {
          const supabase = getSupabaseClient();
          if (!supabase) throw new Error("Falta configurar Supabase.");

          await upsertUserMetaValue(
            supabase,
            arg.userId,
            USER_META_KEYS.notificationPreferences,
            arg.notificationPreferences,
          );

          const payload = serializeNotificationPreferences(arg.notificationPreferences);
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", arg.userId)
            .eq("type", "notification_preferences")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existing?.id) {
            const { error } = await supabase
              .from("notifications")
              .update({ message: payload, is_read: true })
              .eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("notifications").insert({
              user_id: arg.userId,
              actor_id: arg.userId,
              type: "notification_preferences",
              entity_id: arg.userId,
              message: payload,
              is_read: true,
            });
            if (error) throw error;
          }

          return { data: await loadSettings() };
        } catch (error) {
          return {
            error: buildError(error, "No se pudieron actualizar las notificaciones."),
          };
        }
      },
      invalidatesTags: ["Settings"],
    }),
    deleteAccount: builder.mutation<void, void>({
      async queryFn() {
        try {
          const supabase = getSupabaseClient();
          if (!supabase) throw new Error("Falta configurar Supabase.");
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error("Necesitas iniciar sesion.");
          }

          const response = await fetch("/api/account/delete", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          const result = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(result.error ?? "No se pudo borrar la cuenta.");
          }

          return { data: undefined };
        } catch (error) {
          return { error: buildError(error, "No se pudo borrar la cuenta.") };
        }
      },
      invalidatesTags: ["Settings"],
    }),
  }),
});

export const {
  useDeleteAccountMutation,
  useGetSettingsQuery,
  useUpdateNotificationPreferencesMutation,
  useUpdatePayoutProfileMutation,
  useUpdateProfileMutation,
} = settingsApi;

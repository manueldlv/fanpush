import type { SupabaseClient } from "@supabase/supabase-js";

export type UserCommissionProfile = {
  creatorShare: number;
  platformShare: number;
  updatedAt: string;
};

const PREFIX = "user_commission_profile:";
const DEFAULT_CREATOR_SHARE = 0.7;

export const getDefaultCreatorShare = () => DEFAULT_CREATOR_SHARE;

export const serializeUserCommissionProfile = (
  record: UserCommissionProfile,
) => `${PREFIX}${JSON.stringify(record)}`;

export const parseUserCommissionProfile = (
  message?: string | null,
): UserCommissionProfile | null => {
  if (!message?.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      message.slice(PREFIX.length),
    ) as UserCommissionProfile;
    if (
      typeof parsed.creatorShare !== "number" ||
      typeof parsed.platformShare !== "number" ||
      !parsed.updatedAt
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const getCreatorShareFromProfile = (
  profile?: UserCommissionProfile | null,
) => {
  const share = profile?.creatorShare;
  if (typeof share !== "number" || Number.isNaN(share)) {
    return DEFAULT_CREATOR_SHARE;
  }
  return Math.min(Math.max(share, 0), 1);
};

export const getPlatformShareFromProfile = (
  profile?: UserCommissionProfile | null,
) => 1 - getCreatorShareFromProfile(profile);

export const getLatestUserCommissionProfile = async (
  supabase: SupabaseClient,
  userId: string,
) => {
  const { data } = await supabase
    .from("notifications")
    .select("id,message,created_at")
    .eq("user_id", userId)
    .eq("type", "user_commission_profile")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data
    ? {
        id: data.id,
        createdAt: data.created_at,
        record: parseUserCommissionProfile(data.message),
      }
    : null;
};

import type { SupabaseClient } from "@supabase/supabase-js";

export const USER_META_KEYS = {
  profileDetails: "profile.details",
  payoutProfile: "payout.profile",
  accountState: "account.state",
  notificationPreferences: "notification.preferences",
} as const;

const isMissingUserMetaRelationError = (message?: string | null) =>
  Boolean(
    message &&
      (/relation .* does not exist/i.test(message) ||
        /could not find the table .* in the schema cache/i.test(message)),
  );

export const getUserMetaEntries = async (
  client: SupabaseClient,
  userId: string,
  metaKeys?: readonly string[],
) => {
  let query = client
    .from("user_meta")
    .select("meta_key, meta_value, updated_at")
    .eq("user_id", userId);

  if (metaKeys?.length) {
    query = query.in("meta_key", [...metaKeys]);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingUserMetaRelationError(error.message)) {
      return {
        available: false as const,
        entries: new Map<string, unknown>(),
      };
    }
    throw new Error(`No se pudo leer user_meta: ${error.message}`);
  }

  return {
    available: true as const,
    entries: new Map<string, unknown>(
      (data ?? []).map((row) => [row.meta_key, row.meta_value]),
    ),
  };
};

export const upsertUserMetaValue = async (
  client: SupabaseClient,
  userId: string,
  metaKey: string,
  metaValue: unknown,
) => {
  const { error } = await client.from("user_meta").upsert(
    {
      user_id: userId,
      meta_key: metaKey,
      meta_value: metaValue,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,meta_key" },
  );

  if (error) {
    if (isMissingUserMetaRelationError(error.message)) return false;
    throw new Error(`No se pudo guardar user_meta (${metaKey}): ${error.message}`);
  }

  return true;
};

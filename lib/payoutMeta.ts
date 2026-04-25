import type { SupabaseClient } from "@supabase/supabase-js";
import { coercePayoutProfile } from "@/lib/payouts";

export const PAYOUT_META_KEYS = {
  defaultAccount: "accounts.default",
} as const;

const isMissingPayoutMetaRelationError = (message?: string | null) =>
  Boolean(
    message &&
      (/relation .* does not exist/i.test(message) ||
        /could not find the table .* in the schema cache/i.test(message)),
  );

export const getPayoutMetaEntries = async (
  client: SupabaseClient,
  userId: string,
  metaKeys?: readonly string[],
) => {
  let query = client
    .from("payouts_meta")
    .select("meta_key, meta_value, updated_at")
    .eq("user_id", userId);

  if (metaKeys?.length) {
    query = query.in("meta_key", [...metaKeys]);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingPayoutMetaRelationError(error.message)) {
      return {
        available: false as const,
        entries: new Map<string, unknown>(),
      };
    }
    throw new Error(`No se pudo leer payouts_meta: ${error.message}`);
  }

  return {
    available: true as const,
    entries: new Map<string, unknown>(
      (data ?? []).map((row) => [row.meta_key, row.meta_value]),
    ),
  };
};

export const upsertPayoutMetaValue = async (
  client: SupabaseClient,
  userId: string,
  metaKey: string,
  metaValue: unknown,
) => {
  const { error } = await client.from("payouts_meta").upsert(
    {
      user_id: userId,
      meta_key: metaKey,
      meta_value: metaValue,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,meta_key" },
  );

  if (error) {
    if (isMissingPayoutMetaRelationError(error.message)) return false;
    throw new Error(`No se pudo guardar payouts_meta (${metaKey}): ${error.message}`);
  }

  return true;
};

export const getDefaultPayoutProfile = async (
  client: SupabaseClient,
  userId: string,
) => {
  const result = await getPayoutMetaEntries(client, userId, [PAYOUT_META_KEYS.defaultAccount]);
  return coercePayoutProfile(result.entries.get(PAYOUT_META_KEYS.defaultAccount));
};

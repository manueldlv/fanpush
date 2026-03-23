import type { SupabaseClient, User } from "@supabase/supabase-js";

export const parseTipAmountFromMessage = (message?: string | null) => {
  if (!message) return 0;
  const match = message.match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  return match ? Number(match[1]) : 0;
};

export const loadCreatorEarnings = async (
  supabase: SupabaseClient,
  userId: string,
) => {
  const { data: ownedPosts } = await supabase
    .from("posts")
    .select("id")
    .eq("user_id", userId);

  const ownedIds = (ownedPosts ?? []).map((row: { id: string }) => row.id);

  let purchaseGross = 0;
  if (ownedIds.length > 0) {
    const { data: purchaseRows } = await supabase
      .from("purchases")
      .select("amount, post_id")
      .in("post_id", ownedIds);

    purchaseGross = (purchaseRows ?? []).reduce(
      (sum: number, row: { amount: number | string | null }) =>
        sum + Number(row.amount || 0),
      0,
    );
  }

  const { data: tipRows } = await supabase
    .from("notifications")
    .select("message")
    .eq("user_id", userId)
    .eq("type", "tip");

  const tipGross = (tipRows ?? []).reduce(
    (sum: number, row: { message?: string | null }) =>
      sum + parseTipAmountFromMessage(row.message),
    0,
  );

  const gross = purchaseGross + tipGross;
  const creatorNet = gross * 0.7;
  const platformFee = gross * 0.3;

  return {
    purchasesGross: purchaseGross,
    tipsGross: tipGross,
    totalGross: gross,
    creatorNet,
    platformFee,
  };
};

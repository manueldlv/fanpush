import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  getCreatorShareFromProfile,
  getLatestUserCommissionProfile,
} from "@/lib/userCommission";

export const parseTipAmountFromMessage = (message?: string | null) => {
  if (!message) return 0;
  const match = message.match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  return match ? Number(match[1]) : 0;
};

export const parseTipNoteFromMessage = (message?: string | null) => {
  if (!message) return "";
  const match = message.match(/mensaje:\s*(.+)$/i);
  return match ? match[1].trim() : "";
};

type TipReferenceRow = {
  id: string;
  entity_id?: string | null;
  message?: string | null;
};

export const resolveTipAmountMap = async (
  supabase: SupabaseClient,
  rows: TipReferenceRow[],
) => {
  const referenceIds = Array.from(
    new Set(rows.map((row) => row.entity_id?.trim()).filter(Boolean) as string[]),
  );

  let byProviderPaymentId = new Map<string, number>();
  let byTransactionId = new Map<string, number>();

  if (referenceIds.length > 0) {
    const [{ data: providerRows, error: providerError }, { data: txRows, error: txError }] =
      await Promise.all([
        supabase
          .from("ledger_transactions")
          .select("provider_payment_id,transaction_amount")
          .in("provider_payment_id", referenceIds),
        supabase
          .from("ledger_transactions")
          .select("id,transaction_amount")
          .in("id", referenceIds),
      ]);

    if (providerError) {
      throw new Error(`No se pudieron leer las propinas desde ledger: ${providerError.message}`);
    }
    if (txError) {
      throw new Error(`No se pudieron leer las propinas desde ledger: ${txError.message}`);
    }

    byProviderPaymentId = new Map(
      (providerRows ?? [])
        .filter((row) => row.provider_payment_id)
        .map((row) => [row.provider_payment_id as string, Number(row.transaction_amount || 0)]),
    );
    byTransactionId = new Map(
      (txRows ?? []).map((row) => [row.id as string, Number(row.transaction_amount || 0)]),
    );
  }

  return new Map<string, number>(
    rows.map((row) => {
      const referenceId = row.entity_id?.trim() ?? "";
      const amountFromLedger =
        byProviderPaymentId.get(referenceId) ?? byTransactionId.get(referenceId) ?? null;
      return [row.id, amountFromLedger ?? parseTipAmountFromMessage(row.message)];
    }),
  );
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

  const { data: directMessageRows } = await supabase
    .from("direct_messages")
    .select("id")
    .eq("sender_id", userId)
    .eq("kind", "premium");

  const directMessageIds = (directMessageRows ?? []).map(
    (row: { id: string }) => row.id,
  );

  let chatGross = 0;
  if (directMessageIds.length > 0) {
    const { data: directPurchaseRows } = await supabase
      .from("direct_message_purchases")
      .select("amount")
      .in("message_id", directMessageIds);

    chatGross = (directPurchaseRows ?? []).reduce(
      (sum: number, row: { amount: number | string | null }) =>
        sum + Number(row.amount || 0),
      0,
    );
  }

  const { data: tipLedgerRows, error: tipLedgerError } = await supabase
    .from("ledger_transactions")
    .select("transaction_amount")
    .eq("kind", "tip")
    .eq("recipient_user_id", userId)
    .in("status", ["approved", "settled"]);

  if (tipLedgerError) {
    throw new Error(
      `No se pudieron leer las propinas desde ledger: ${tipLedgerError.message}`,
    );
  }

  const tipGross = (tipLedgerRows ?? []).reduce(
    (sum: number, row: { transaction_amount: number | string | null }) =>
      sum + Number(row.transaction_amount || 0),
    0,
  );

  const gross = purchaseGross + chatGross + tipGross;
  const commissionProfile = await getLatestUserCommissionProfile(supabase, userId);
  const creatorShare = getCreatorShareFromProfile(commissionProfile?.record);
  const creatorNet = gross * creatorShare;
  const platformFee = gross - creatorNet;

  return {
    purchasesGross: purchaseGross,
    chatsGross: chatGross,
    tipsGross: tipGross,
    totalGross: gross,
    creatorNet,
    platformFee,
    creatorShare,
  };
};

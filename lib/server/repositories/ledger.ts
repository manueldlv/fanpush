import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCreatorEarnings } from "@/lib/earnings";
import {
  getCreatorShareFromProfile,
  getLatestUserCommissionProfile,
  getPlatformShareFromProfile,
} from "@/lib/userCommission";
import { getWithdrawalReservedAmount, parseWithdrawalRecord } from "@/lib/withdrawals";

type UserBalanceRow = {
  user_id: string;
  cash_available: number | string;
  cash_pending: number | string;
  cash_reserved: number | string;
  bonus_available: number | string;
  lifetime_deposited: number | string;
  lifetime_spent: number | string;
  lifetime_earned: number | string;
  lifetime_withdrawn: number | string;
};

type UserBalanceSnapshot = {
  userId: string;
  cashAvailable: number;
  cashPending: number;
  cashReserved: number;
  bonusAvailable: number;
  lifetimeDeposited: number;
  lifetimeSpent: number;
  lifetimeEarned: number;
  lifetimeWithdrawn: number;
};

type BalanceDelta = Partial<{
  cashAvailable: number;
  cashPending: number;
  cashReserved: number;
  bonusAvailable: number;
  lifetimeDeposited: number;
  lifetimeSpent: number;
  lifetimeEarned: number;
  lifetimeWithdrawn: number;
}>;

type LedgerCommissionSplit = {
  creatorShareRate: number;
  platformShareRate: number;
  creatorAmount: number;
  platformFeeAmount: number;
};

const mapBalanceRow = (row?: UserBalanceRow | null): UserBalanceSnapshot | null => {
  if (!row) return null;
  return {
    userId: row.user_id,
    cashAvailable: Number(row.cash_available || 0),
    cashPending: Number(row.cash_pending || 0),
    cashReserved: Number(row.cash_reserved || 0),
    bonusAvailable: Number(row.bonus_available || 0),
    lifetimeDeposited: Number(row.lifetime_deposited || 0),
    lifetimeSpent: Number(row.lifetime_spent || 0),
    lifetimeEarned: Number(row.lifetime_earned || 0),
    lifetimeWithdrawn: Number(row.lifetime_withdrawn || 0),
  };
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const throwRepositoryError = (
  error: { message: string } | null,
  fallback: string,
) => {
  if (error) {
    throw new Error(`${fallback}: ${error.message}`);
  }
};

export const getUserBalanceSnapshot = async (
  admin: SupabaseClient,
  userId: string,
) => {
  const { data, error } = await admin
    .from("user_balances")
    .select(
      "user_id,cash_available,cash_pending,cash_reserved,bonus_available,lifetime_deposited,lifetime_spent,lifetime_earned,lifetime_withdrawn",
    )
    .eq("user_id", userId)
    .maybeSingle();

  throwRepositoryError(error, "No se pudo leer el balance del usuario");
  return mapBalanceRow(data);
};

const getUserLedgerEntryCount = async (admin: SupabaseClient, userId: string) => {
  const { count, error } = await admin
    .from("ledger_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  throwRepositoryError(error, "No se pudo leer el ledger del usuario");
  return count ?? 0;
};

export const ensureLegacyCreatorBalanceBaseline = async (
  admin: SupabaseClient,
  userId: string,
) => {
  const [balance, ledgerEntryCount] = await Promise.all([
    getUserBalanceSnapshot(admin, userId),
    getUserLedgerEntryCount(admin, userId),
  ]);

  const hasNonZeroBalance =
    balance !== null &&
    [
      balance.cashAvailable,
      balance.cashPending,
      balance.cashReserved,
      balance.bonusAvailable,
      balance.lifetimeDeposited,
      balance.lifetimeSpent,
      balance.lifetimeEarned,
      balance.lifetimeWithdrawn,
    ].some((value) => Math.abs(value) > 0.0001);

  if (ledgerEntryCount > 0 || hasNonZeroBalance) {
    return balance;
  }

  const [earnings, { data: withdrawalRows, error: withdrawalError }] =
    await Promise.all([
      loadCreatorEarnings(admin, userId),
      admin
        .from("notifications")
        .select("message")
        .eq("user_id", userId)
        .eq("type", "withdrawal_request"),
    ]);

  throwRepositoryError(withdrawalError, "No se pudieron leer los retiros legacy");

  const reserved = getWithdrawalReservedAmount(
    (withdrawalRows ?? [])
      .map((row) => parseWithdrawalRecord(row.message))
      .filter((value): value is NonNullable<typeof value> => Boolean(value)),
  );

  const cashAvailable = roundMoney(Math.max(earnings.creatorNet - reserved, 0));
  const cashReserved = roundMoney(reserved);
  const lifetimeEarned = roundMoney(earnings.creatorNet);

  const { error: upsertError } = await admin.from("user_balances").upsert(
    {
      user_id: userId,
      cash_available: cashAvailable,
      cash_reserved: cashReserved,
      lifetime_earned: lifetimeEarned,
    },
    { onConflict: "user_id" },
  );

  throwRepositoryError(upsertError, "No se pudo inicializar el balance del usuario");

  return getUserBalanceSnapshot(admin, userId);
};

export const applyUserBalanceDelta = async (
  admin: SupabaseClient,
  userId: string,
  delta: BalanceDelta,
) => {
  const { data, error } = await admin.rpc("apply_user_balance_delta", {
    target_user_id: userId,
    cash_available_delta: roundMoney(delta.cashAvailable ?? 0),
    cash_pending_delta: roundMoney(delta.cashPending ?? 0),
    cash_reserved_delta: roundMoney(delta.cashReserved ?? 0),
    bonus_available_delta: roundMoney(delta.bonusAvailable ?? 0),
    lifetime_deposited_delta: roundMoney(delta.lifetimeDeposited ?? 0),
    lifetime_spent_delta: roundMoney(delta.lifetimeSpent ?? 0),
    lifetime_earned_delta: roundMoney(delta.lifetimeEarned ?? 0),
    lifetime_withdrawn_delta: roundMoney(delta.lifetimeWithdrawn ?? 0),
  });

  throwRepositoryError(error, "No se pudo actualizar el balance del usuario");
  const row = Array.isArray(data) ? data[0] : data;
  return mapBalanceRow(row as UserBalanceRow | null);
};

const getCommissionSplitForAmount = async (
  admin: SupabaseClient,
  recipientUserId: string,
  transactionAmount: number,
): Promise<LedgerCommissionSplit> => {
  const commissionProfile = await getLatestUserCommissionProfile(admin, recipientUserId);
  const creatorShareRate = getCreatorShareFromProfile(commissionProfile?.record);
  const platformShareRate = getPlatformShareFromProfile(commissionProfile?.record);
  const creatorAmount = roundMoney(transactionAmount * creatorShareRate);
  const platformFeeAmount = roundMoney(transactionAmount - creatorAmount);

  return {
    creatorShareRate,
    platformShareRate,
    creatorAmount,
    platformFeeAmount,
  };
};

const findLedgerTransactionByProviderPaymentId = async (
  admin: SupabaseClient,
  provider: string,
  providerPaymentId: string,
) => {
  const { data, error } = await admin
    .from("ledger_transactions")
    .select("id,kind,provider_payment_id")
    .eq("external_provider", provider)
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();

  throwRepositoryError(error, "No se pudo validar la transacción del ledger");
  return data;
};

const insertLedgerEntries = async (
  admin: SupabaseClient,
  rows: Array<Record<string, unknown>>,
) => {
  if (rows.length === 0) return;
  const { error } = await admin.from("ledger_entries").insert(rows);
  throwRepositoryError(error, "No se pudieron guardar los asientos del ledger");
};

export const recordMercadoPagoCreatorCreditTransaction = async ({
  admin,
  kind,
  providerPaymentId,
  buyerUserId,
  recipientUserId,
  transactionAmount,
  sourceType,
  sourceId,
  externalReference,
}: {
  admin: SupabaseClient;
  kind: "purchase" | "tip" | "donation";
  providerPaymentId: string | number;
  buyerUserId: string;
  recipientUserId: string;
  transactionAmount: number;
  sourceType: string;
  sourceId: string;
  externalReference?: string | null;
}) => {
  const normalizedPaymentId = String(providerPaymentId);
  const existing = await findLedgerTransactionByProviderPaymentId(
    admin,
    "mercadopago",
    normalizedPaymentId,
  );
  if (existing) {
    return { alreadyRecorded: true, transactionId: existing.id };
  }

  await ensureLegacyCreatorBalanceBaseline(admin, recipientUserId);

  const split = await getCommissionSplitForAmount(
    admin,
    recipientUserId,
    roundMoney(transactionAmount),
  );

  const { data: transaction, error: transactionError } = await admin
    .from("ledger_transactions")
    .insert({
      kind,
      status: "approved",
      currency: "ARS",
      transaction_amount: roundMoney(transactionAmount),
      creator_share_rate: split.creatorShareRate,
      platform_share_rate: split.platformShareRate,
      creator_amount: split.creatorAmount,
      platform_fee_amount: split.platformFeeAmount,
      buyer_user_id: buyerUserId,
      recipient_user_id: recipientUserId,
      source_type: sourceType,
      source_id: sourceId,
      external_provider: "mercadopago",
      provider_payment_id: normalizedPaymentId,
      external_reference: externalReference ?? null,
      metadata: {},
    })
    .select("id")
    .single();

  throwRepositoryError(transactionError, "No se pudo crear la transacción del ledger");
  if (!transaction) {
    throw new Error("No se recibió la transacción creada del ledger.");
  }

  await insertLedgerEntries(admin, [
    {
      transaction_id: transaction.id,
      user_id: recipientUserId,
      entry_scope: "user",
      account_code: "user.cash_available",
      balance_bucket: "cash_available",
      direction: "credit",
      amount: split.creatorAmount,
      metadata: { kind },
    },
    ...(split.platformFeeAmount > 0
      ? [
          {
            transaction_id: transaction.id,
            entry_scope: "platform",
            account_code: "platform.fee_revenue",
            direction: "credit",
            amount: split.platformFeeAmount,
            metadata: { kind },
          },
        ]
      : []),
    {
      transaction_id: transaction.id,
      entry_scope: "provider",
      account_code: "provider.mercadopago_clearing",
      direction: "credit",
      amount: roundMoney(transactionAmount),
      metadata: { kind },
    },
  ]);

  await applyUserBalanceDelta(admin, recipientUserId, {
    cashAvailable: split.creatorAmount,
    lifetimeEarned: split.creatorAmount,
  });

  return { alreadyRecorded: false, transactionId: transaction.id, split };
};

export const reserveWithdrawalLedgerBalance = async ({
  admin,
  withdrawalId,
  userId,
  amount,
  monthKey,
}: {
  admin: SupabaseClient;
  withdrawalId: string;
  userId: string;
  amount: number;
  monthKey: string;
}) => {
  const { data: existingRequest, error: requestReadError } = await admin
    .from("withdrawal_requests")
    .select("id,ledger_transaction_id,status")
    .eq("id", withdrawalId)
    .maybeSingle();

  throwRepositoryError(requestReadError, "No se pudo validar el retiro");
  if (existingRequest) {
    return {
      alreadyRecorded: true,
      withdrawalId: existingRequest.id,
      transactionId: existingRequest.ledger_transaction_id,
    };
  }

  await ensureLegacyCreatorBalanceBaseline(admin, userId);

  const { data: transaction, error: transactionError } = await admin
    .from("ledger_transactions")
    .insert({
      kind: "payout_request",
      status: "reserved",
      currency: "ARS",
      transaction_amount: roundMoney(amount),
      recipient_user_id: userId,
      source_type: "withdrawal_request",
      source_id: withdrawalId,
      metadata: { monthKey },
    })
    .select("id")
    .single();

  throwRepositoryError(transactionError, "No se pudo crear el ledger del retiro");
  if (!transaction) {
    throw new Error("No se recibió la transacción del retiro.");
  }

  await insertLedgerEntries(admin, [
    {
      transaction_id: transaction.id,
      user_id: userId,
      entry_scope: "user",
      account_code: "user.cash_available",
      balance_bucket: "cash_available",
      direction: "debit",
      amount: roundMoney(amount),
      metadata: { stage: "withdrawal_request" },
    },
    {
      transaction_id: transaction.id,
      user_id: userId,
      entry_scope: "user",
      account_code: "user.cash_reserved",
      balance_bucket: "cash_reserved",
      direction: "credit",
      amount: roundMoney(amount),
      metadata: { stage: "withdrawal_request" },
    },
  ]);

  await applyUserBalanceDelta(admin, userId, {
    cashAvailable: -roundMoney(amount),
    cashReserved: roundMoney(amount),
  });

  const { error: requestInsertError } = await admin.from("withdrawal_requests").insert({
    id: withdrawalId,
    user_id: userId,
    amount: roundMoney(amount),
    status: "requested",
    ledger_transaction_id: transaction.id,
    month_key: monthKey,
  });

  throwRepositoryError(requestInsertError, "No se pudo guardar el retiro en tabla");

  return {
    alreadyRecorded: false,
    withdrawalId,
    transactionId: transaction.id,
  };
};

export const settleWithdrawalAsPaid = async ({
  admin,
  withdrawalId,
  actorId,
}: {
  admin: SupabaseClient;
  withdrawalId: string;
  actorId: string;
}) => {
  const { data: requestRow, error: requestError } = await admin
    .from("withdrawal_requests")
    .select("id,user_id,amount,status,ledger_transaction_id")
    .eq("id", withdrawalId)
    .maybeSingle();

  throwRepositoryError(requestError, "No se pudo leer el retiro");
  if (!requestRow || requestRow.status === "paid") return;

  const { data: existingPayout, error: payoutReadError } = await admin
    .from("ledger_transactions")
    .select("id")
    .eq("kind", "payout_paid")
    .eq("source_type", "withdrawal_request")
    .eq("source_id", withdrawalId)
    .maybeSingle();

  throwRepositoryError(payoutReadError, "No se pudo validar el pago del retiro");

  if (!existingPayout) {
    const { data: transaction, error: transactionError } = await admin
      .from("ledger_transactions")
      .insert({
        kind: "payout_paid",
        status: "settled",
        currency: "ARS",
        transaction_amount: roundMoney(Number(requestRow.amount || 0)),
        recipient_user_id: requestRow.user_id,
        source_type: "withdrawal_request",
        source_id: withdrawalId,
        metadata: { reviewedBy: actorId },
        settled_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    throwRepositoryError(transactionError, "No se pudo registrar el pago del retiro");
    if (!transaction) {
      throw new Error("No se recibió la transacción de pago del retiro.");
    }

    await insertLedgerEntries(admin, [
      {
        transaction_id: transaction.id,
        user_id: requestRow.user_id,
        entry_scope: "user",
        account_code: "user.cash_reserved",
        balance_bucket: "cash_reserved",
        direction: "debit",
        amount: roundMoney(Number(requestRow.amount || 0)),
        metadata: { stage: "withdrawal_paid" },
      },
      {
        transaction_id: transaction.id,
        entry_scope: "provider",
        account_code: "provider.mercadopago_clearing",
        direction: "debit",
        amount: roundMoney(Number(requestRow.amount || 0)),
        metadata: { stage: "withdrawal_paid" },
      },
    ]);

    await applyUserBalanceDelta(admin, requestRow.user_id, {
      cashReserved: -roundMoney(Number(requestRow.amount || 0)),
      lifetimeWithdrawn: roundMoney(Number(requestRow.amount || 0)),
    });
  }

  if (requestRow.ledger_transaction_id) {
    await admin
      .from("ledger_transactions")
      .update({ status: "settled", settled_at: new Date().toISOString() })
      .eq("id", requestRow.ledger_transaction_id);
  }

  await admin
    .from("withdrawal_requests")
    .update({
      status: "paid",
      reviewed_at: new Date().toISOString(),
      reviewed_by: actorId,
    })
    .eq("id", withdrawalId);
};

export const releaseRejectedWithdrawalReservation = async ({
  admin,
  withdrawalId,
  actorId,
  reason,
}: {
  admin: SupabaseClient;
  withdrawalId: string;
  actorId: string;
  reason?: string;
}) => {
  const { data: requestRow, error: requestError } = await admin
    .from("withdrawal_requests")
    .select("id,user_id,amount,status,ledger_transaction_id")
    .eq("id", withdrawalId)
    .maybeSingle();

  throwRepositoryError(requestError, "No se pudo leer el retiro");
  if (!requestRow || requestRow.status === "rejected") return;

  const { data: existingRelease, error: releaseReadError } = await admin
    .from("ledger_transactions")
    .select("id")
    .eq("kind", "admin_adjustment")
    .eq("source_type", "withdrawal_request")
    .eq("source_id", withdrawalId)
    .maybeSingle();

  throwRepositoryError(releaseReadError, "No se pudo validar la liberación del retiro");

  if (!existingRelease) {
    const { data: transaction, error: transactionError } = await admin
      .from("ledger_transactions")
      .insert({
        kind: "admin_adjustment",
        status: "approved",
        currency: "ARS",
        transaction_amount: roundMoney(Number(requestRow.amount || 0)),
        recipient_user_id: requestRow.user_id,
        source_type: "withdrawal_request",
        source_id: withdrawalId,
        metadata: {
          reason: reason?.trim() || null,
          adjustment: "withdrawal_rejection_release",
          reviewedBy: actorId,
        },
      })
      .select("id")
      .single();

    throwRepositoryError(transactionError, "No se pudo liberar el retiro");
    if (!transaction) {
      throw new Error("No se recibió la transacción de liberación del retiro.");
    }

    await insertLedgerEntries(admin, [
      {
        transaction_id: transaction.id,
        user_id: requestRow.user_id,
        entry_scope: "user",
        account_code: "user.cash_reserved",
        balance_bucket: "cash_reserved",
        direction: "debit",
        amount: roundMoney(Number(requestRow.amount || 0)),
        metadata: { stage: "withdrawal_rejected" },
      },
      {
        transaction_id: transaction.id,
        user_id: requestRow.user_id,
        entry_scope: "user",
        account_code: "user.cash_available",
        balance_bucket: "cash_available",
        direction: "credit",
        amount: roundMoney(Number(requestRow.amount || 0)),
        metadata: { stage: "withdrawal_rejected" },
      },
    ]);

    await applyUserBalanceDelta(admin, requestRow.user_id, {
      cashReserved: -roundMoney(Number(requestRow.amount || 0)),
      cashAvailable: roundMoney(Number(requestRow.amount || 0)),
    });
  }

  if (requestRow.ledger_transaction_id) {
    await admin
      .from("ledger_transactions")
      .update({
        status: "rejected",
        metadata: { reason: reason?.trim() || null, reviewedBy: actorId },
      })
      .eq("id", requestRow.ledger_transaction_id);
  }

  await admin
    .from("withdrawal_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: actorId,
      notes: reason?.trim() || null,
    })
    .eq("id", withdrawalId);
};

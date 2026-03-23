export type WithdrawalStatus = "requested" | "sent" | "rejected";

export type WithdrawalRecord = {
  amount: number;
  status: WithdrawalStatus;
  requestedAt: string;
  monthKey: string;
};

const PREFIX = "withdrawal_request:";
const HISTORY_PREFIX = "withdrawal_history:";

export const getCurrentMonthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const serializeWithdrawalRecord = (record: WithdrawalRecord) =>
  `${PREFIX}${JSON.stringify(record)}`;

export const parseWithdrawalRecord = (message?: string | null) => {
  if (!message?.startsWith(PREFIX)) return null;
  try {
    return JSON.parse(message.slice(PREFIX.length)) as WithdrawalRecord;
  } catch {
    return null;
  }
};

export const getWithdrawalReservedAmount = (records: WithdrawalRecord[]) =>
  records.reduce((sum, record) => {
    if (record.status === "rejected") return sum;
    return sum + Number(record.amount || 0);
  }, 0);

export const getWithdrawalStatusLabel = (status: WithdrawalStatus) => {
  switch (status) {
    case "requested":
      return "Solicitado";
    case "sent":
      return "Enviado";
    case "rejected":
      return "Rechazado";
    default:
      return status;
  }
};

export type WithdrawalHistoryRecord = {
  withdrawalId: string;
  status: WithdrawalStatus;
  amount: number;
  actedAt: string;
  reason?: string;
};

export const serializeWithdrawalHistory = (record: WithdrawalHistoryRecord) =>
  `${HISTORY_PREFIX}${JSON.stringify(record)}`;

export const parseWithdrawalHistory = (
  message?: string | null,
): WithdrawalHistoryRecord | null => {
  if (!message?.startsWith(HISTORY_PREFIX)) return null;
  try {
    const parsed = JSON.parse(message.slice(HISTORY_PREFIX.length)) as WithdrawalHistoryRecord;
    if (!parsed.withdrawalId || !parsed.status || !parsed.actedAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

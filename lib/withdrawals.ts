export type WithdrawalStatus =
  | "requested"
  | "scheduled"
  | "sent"
  | "rejected";

export type WithdrawalRecord = {
  amount: number;
  status: WithdrawalStatus;
  requestedAt: string;
  monthKey: string;
};

const PREFIX = "withdrawal_request:";

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
    case "scheduled":
      return "Programado";
    case "sent":
      return "Enviado";
    case "rejected":
      return "Rechazado";
    default:
      return status;
  }
};

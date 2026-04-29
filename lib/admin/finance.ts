export type FinanceTableRow = {
  id: string;
  kind: "purchase" | "tip" | "withdrawal";
  user: string;
  counterparty: string;
  amount: number;
  status: string;
  statusTone: "emerald" | "sky" | "amber";
  createdAt: string;
  description: string;
  provider: string;
  origin: string;
  category: string;
  project: string;
  costCenter: string;
  percentage: string;
  period: string;
  account: string;
  detail: string;
};

export const FINANCE_COLUMN_ORDER = [
  "date",
  "description",
  "provider",
  "amount",
  "origin",
  "category",
  "project",
  "costCenter",
  "percentage",
  "period",
  "account",
  "actions",
] as const;

export type FinanceColumnKey = (typeof FINANCE_COLUMN_ORDER)[number];

export type FinanceView =
  | "overview"
  | "sales"
  | "tips"
  | "withdrawals"
  | "creators"
  | "classification"
  | "analysis"
  | "pnl";

export const FINANCE_COLUMN_LABELS: Record<FinanceColumnKey, string> = {
  date: "Fecha",
  description: "Descripción",
  provider: "Proveedor",
  amount: "Monto",
  origin: "Origen",
  category: "Categoría",
  project: "Proyecto",
  costCenter: "Centro de costo",
  percentage: "%",
  period: "Periodo",
  account: "Cuenta",
  actions: "",
};

export const isInsufficientBalanceMessage = (message: string | null | undefined) => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("saldo suficiente") ||
    normalized.includes("insufficient_balance") ||
    normalized.includes("carga saldo") ||
    normalized.includes("saldo insuficiente") ||
    normalized.includes("saldo disponible")
  );
};

type SaldoRedirectOptions = {
  reason?: string;
  requiredAmount?: number | null;
  currentBalance?: number | null;
  kind?: "purchase" | "tip" | "chat";
  targetId?: string | null;
  targetLabel?: string | null;
  targetAvatar?: string | null;
};

const SALDO_REDIRECT_CONTEXT_KEY = "fanpush_saldo_redirect_context";

export const buildSaldoRedirectUrl = ({
  reason = "insufficient-balance",
  requiredAmount,
  currentBalance,
  kind,
  targetId,
  targetLabel,
  targetAvatar,
}: SaldoRedirectOptions = {}) => {
  const url = new URL("/saldo", "http://localhost");
  url.searchParams.set("reason", reason);

  if (typeof requiredAmount === "number" && Number.isFinite(requiredAmount)) {
    url.searchParams.set("required", String(requiredAmount));
  }

  if (typeof currentBalance === "number" && Number.isFinite(currentBalance)) {
    url.searchParams.set("balance", String(currentBalance));
  }

  if (kind) {
    url.searchParams.set("kind", kind);
  }

  if (targetId) {
    url.searchParams.set("target", targetId);
  }

  if (targetLabel) {
    url.searchParams.set("targetLabel", targetLabel);
  }

  if (targetAvatar) {
    url.searchParams.set("targetAvatar", targetAvatar);
  }

  return `${url.pathname}${url.search}`;
};

export const redirectToSaldo = (options?: SaldoRedirectOptions) => {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(
      SALDO_REDIRECT_CONTEXT_KEY,
      JSON.stringify(options ?? {}),
    );
  } catch {}
  window.location.assign(buildSaldoRedirectUrl(options));
  return true;
};

export const redirectToSaldoIfNeeded = (
  message: string | null | undefined,
  options?: SaldoRedirectOptions,
) => {
  if (typeof window === "undefined") return false;
  if (!isInsufficientBalanceMessage(message)) return false;
  return redirectToSaldo(options);
};

export const shouldRedirectToSaldo = ({
  availableBalance,
  requiredAmount,
}: {
  availableBalance: number | null | undefined;
  requiredAmount: number | null | undefined;
}) => {
  const balance = Number(availableBalance ?? 0);
  const required = Number(requiredAmount ?? 0);

  if (!Number.isFinite(balance) || !Number.isFinite(required)) return false;
  return required > 0 && balance < required;
};

export const readSaldoRedirectContext = () => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(SALDO_REDIRECT_CONTEXT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SaldoRedirectOptions;
  } catch {
    return null;
  }
};

export const clearSaldoRedirectContext = () => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SALDO_REDIRECT_CONTEXT_KEY);
  } catch {}
};

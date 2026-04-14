export const isInsufficientBalanceMessage = (message: string | null | undefined) => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("saldo suficiente") ||
    normalized.includes("insufficient_balance") ||
    normalized.includes("carga saldo")
  );
};

export const redirectToSaldoIfNeeded = (message: string | null | undefined) => {
  if (typeof window === "undefined") return false;
  if (!isInsufficientBalanceMessage(message)) return false;
  window.location.assign("/saldo?reason=insufficient-balance");
  return true;
};

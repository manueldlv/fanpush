const RESERVED_USERNAMES = [
  "fanpush",
  "admin",
  "administrator",
  "admins",
  "support",
  "soporte",
  "moderacion",
  "moderator",
  "mod",
  "staff",
  "team",
  "equipo",
  "official",
  "oficial",
  "system",
  "sistema",
  "notifications",
  "notificaciones",
  "security",
  "seguridad",
  "billing",
  "payments",
  "pagos",
  "withdrawals",
  "retiros",
  "help",
  "ayuda",
  "faq",
  "api",
  "root",
  "owner",
  "superadmin",
  "fanpushapp",
  "fanpushoficial",
];

const normalizeUsernameForCheck = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._-]/g, "");

export const isReservedUsername = (value: string) => {
  const normalized = normalizeUsernameForCheck(value);
  return RESERVED_USERNAMES.includes(normalized);
};

export const getReservedUsernameError = (value: string) =>
  isReservedUsername(value)
    ? "Ese nombre de usuario está reservado y no se puede usar."
    : null;

export const reservedUsernames = RESERVED_USERNAMES;

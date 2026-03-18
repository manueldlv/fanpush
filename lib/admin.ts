const HARDCODED_ADMIN_EMAILS: string[] = [];

const HARDCODED_ADMIN_USERNAMES: string[] = [];

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const envEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((value) => normalize(value))
  .filter(Boolean);

const envUsernames = (process.env.ADMIN_USERNAMES ?? "")
  .split(",")
  .map((value) => normalize(value))
  .filter(Boolean);

export const getAdminEmails = () =>
  [...HARDCODED_ADMIN_EMAILS, ...envEmails]
    .map((value) => normalize(value))
    .filter(Boolean);

export const getAdminUsernames = () =>
  [...HARDCODED_ADMIN_USERNAMES, ...envUsernames]
    .map((value) => normalize(value))
    .filter(Boolean);

export const isAdminIdentity = ({
  email,
  username,
}: {
  email?: string | null;
  username?: string | null;
}) => {
  const normalizedEmail = normalize(email);
  const normalizedUsername = normalize(username);

  return (
    getAdminEmails().includes(normalizedEmail) ||
    getAdminUsernames().includes(normalizedUsername)
  );
};

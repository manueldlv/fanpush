export const buildUserProfileHref = (username: string) =>
  `/user/${encodeURIComponent(username)}`;

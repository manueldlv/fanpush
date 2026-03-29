export type ProfileDetails = {
  bio: string;
  website: string;
  instagram: string;
  updatedAt?: string;
};

export const coerceProfileDetails = (value: unknown): ProfileDetails | null => {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<ProfileDetails>;
  return {
    bio: typeof parsed.bio === "string" ? parsed.bio : "",
    website: typeof parsed.website === "string" ? parsed.website : "",
    instagram: typeof parsed.instagram === "string" ? parsed.instagram : "",
    updatedAt:
      typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
  };
};

export const parseProfileDetails = (value?: string | null): ProfileDetails | null => {
  if (!value) return null;
  try {
    return coerceProfileDetails(JSON.parse(value));
  } catch {
    return null;
  }
};

export const toProfileDetailsMetaValue = (value: ProfileDetails) => ({
  bio: value.bio.trim(),
  website: value.website.trim(),
  instagram: value.instagram.trim(),
  updatedAt: value.updatedAt ?? new Date().toISOString(),
});

export const serializeProfileDetails = (value: ProfileDetails) =>
  JSON.stringify(toProfileDetailsMetaValue(value));

export const normalizeWebsite = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

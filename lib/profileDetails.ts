export type ProfileDetails = {
  bio: string;
  website: string;
  instagram: string;
  updatedAt?: string;
};

export const parseProfileDetails = (value?: string | null): ProfileDetails | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ProfileDetails>;
    return {
      bio: typeof parsed.bio === "string" ? parsed.bio : "",
      website: typeof parsed.website === "string" ? parsed.website : "",
      instagram: typeof parsed.instagram === "string" ? parsed.instagram : "",
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
    };
  } catch {
    return null;
  }
};

export const serializeProfileDetails = (value: ProfileDetails) =>
  JSON.stringify({
    bio: value.bio.trim(),
    website: value.website.trim(),
    instagram: value.instagram.trim(),
    updatedAt: value.updatedAt ?? new Date().toISOString(),
  });

export const normalizeWebsite = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

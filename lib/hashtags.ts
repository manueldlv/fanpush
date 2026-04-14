export const extractHashtags = (value: string | null | undefined) => {
  if (!value) return [];
  const matches = value.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const seen = new Set<string>();
  return matches.filter((tag) => {
    const normalized = tag.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export const buildHashtagHref = (tag: string) => {
  const normalized = tag.startsWith("#") ? tag.slice(1) : tag;
  return `/hashtags/${encodeURIComponent(normalized.toLowerCase())}`;
};

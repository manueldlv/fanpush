export type ContentAudience = "adult_18" | "sugerente" | "general";

export type ModerationCategory =
  | "desnudo"
  | "lenceria"
  | "solo"
  | "pareja"
  | "fetiche"
  | "pies"
  | "cosplay"
  | "otro";

export const CONTENT_AUDIENCE_OPTIONS: Array<{
  value: ContentAudience;
  label: string;
}> = [
  { value: "adult_18", label: "Adulto (+18)" },
  { value: "sugerente", label: "Sugerente" },
  { value: "general", label: "General" },
];

export const MODERATION_CATEGORY_OPTIONS: Array<{
  value: ModerationCategory;
  label: string;
}> = [
  { value: "desnudo", label: "Desnudo" },
  { value: "lenceria", label: "Lencería" },
  { value: "solo", label: "Solo" },
  { value: "pareja", label: "Pareja" },
  { value: "fetiche", label: "Fetiche" },
  { value: "pies", label: "Pies" },
  { value: "cosplay", label: "Cosplay" },
  { value: "otro", label: "Otro" },
];

export const getContentAudienceLabel = (value?: string | null) =>
  CONTENT_AUDIENCE_OPTIONS.find((option) => option.value === value)?.label ?? "General";

export const getModerationCategoryLabel = (value?: string | null) =>
  MODERATION_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? "Otro";

export const normalizeModerationTags = (value: string) =>
  Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 10);

export type UploadModerationMeta = {
  version: 1;
  displayCaption: string;
  contentAudience: ContentAudience;
  moderationCategory: ModerationCategory;
  tags: string[];
  tipsEnabled: boolean;
};

const PREFIX = "fanpush_upload_meta:";

export const serializeUploadModerationMeta = (value: UploadModerationMeta) =>
  `${PREFIX}${JSON.stringify(value)}`;

export const parseUploadModerationMeta = (
  value?: string | null,
): UploadModerationMeta | null => {
  if (!value?.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(PREFIX.length)) as UploadModerationMeta;
    if (
      !parsed ||
      parsed.version !== 1 ||
      typeof parsed.displayCaption !== "string" ||
      !CONTENT_AUDIENCE_OPTIONS.some((option) => option.value === parsed.contentAudience) ||
      !MODERATION_CATEGORY_OPTIONS.some(
        (option) => option.value === parsed.moderationCategory,
      ) ||
      !Array.isArray(parsed.tags)
    ) {
      return null;
    }
    return {
      ...parsed,
      tags: parsed.tags.filter((tag): tag is string => typeof tag === "string"),
      tipsEnabled: Boolean(parsed.tipsEnabled),
    };
  } catch {
    return null;
  }
};

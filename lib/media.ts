export const PUBLIC_MEDIA_BUCKET = "Imagenes";
export const PREMIUM_MEDIA_BUCKET = "premium";

const LOCKED_PREVIEW_SEGMENT = "locked-previews";
const PREMIUM_SEGMENT = "premium";

export const buildPublicMediaPath = (
  userId: string,
  token: string,
  fileName: string,
) => {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `posts/${userId}/${token}-${safeName}`;
};

export const buildLockedPreviewPath = (
  userId: string,
  token: string,
  originalKind: "image" | "video",
  originalExt: string,
) =>
  `${LOCKED_PREVIEW_SEGMENT}/${userId}/${token}__${originalKind}__${originalExt}.jpg`;

export const buildPremiumMediaPath = (
  userId: string,
  token: string,
  originalExt: string,
) => `${PREMIUM_SEGMENT}/${userId}/${token}.${originalExt}`;

export const parseLockedPreviewPath = (path: string | null | undefined) => {
  if (!path?.startsWith(`${LOCKED_PREVIEW_SEGMENT}/`)) return null;
  const fileName = path.split("/").pop() ?? "";
  const match = fileName.match(/^(.+)__(image|video)__([a-zA-Z0-9]+)\.jpg$/);
  if (!match) return null;
  return {
    token: match[1],
    originalKind: match[2] as "image" | "video",
    originalExt: match[3].toLowerCase(),
  };
};

export const getPremiumPathFromPreview = (
  ownerUserId: string | null | undefined,
  path: string | null | undefined,
) => {
  if (!ownerUserId) return null;
  const parsed = parseLockedPreviewPath(path);
  if (!parsed) return null;
  return buildPremiumMediaPath(ownerUserId, parsed.token, parsed.originalExt);
};

export const inferDisplayKind = (
  mediaUrl: string | null | undefined,
  mediaType: string | null | undefined,
  isLocked: boolean | null | undefined,
): "image" | "video" => {
  const parsed = parseLockedPreviewPath(mediaUrl);
  if (parsed && isLocked) return "image";
  return mediaType === "video" ? "video" : "image";
};

export const getExtensionFromFile = (file: File) => {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (fromName) return fromName;
  if (file.type.includes("png")) return "png";
  if (file.type.includes("webp")) return "webp";
  if (file.type.includes("gif")) return "gif";
  if (file.type.includes("quicktime")) return "mov";
  if (file.type.includes("mp4")) return "mp4";
  if (file.type.includes("webm")) return "webm";
  return file.type.startsWith("video") ? "mp4" : "jpg";
};

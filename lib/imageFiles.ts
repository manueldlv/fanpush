const DEFAULT_ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const ALLOWED_IMAGE_TYPES: readonly string[] = [...DEFAULT_ALLOWED_IMAGE_TYPES];
export const MAX_AVATAR_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_DOCUMENT_IMAGE_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_IMAGE_ACCEPT = DEFAULT_ALLOWED_IMAGE_TYPES.join(",");

const formatMaxSizeLabel = (bytes: number) => {
  const megabytes = bytes / (1024 * 1024);
  return Number.isInteger(megabytes) ? `${megabytes} MB` : `${megabytes.toFixed(1)} MB`;
};

export const validateImageFile = (
  file: File,
  {
    label,
    maxBytes,
    allowedTypes = ALLOWED_IMAGE_TYPES,
  }: {
    label: string;
    maxBytes: number;
    allowedTypes?: readonly string[];
  },
) => {
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`${label}: sube una imagen JPG, PNG o WEBP.`);
  }

  if (file.size > maxBytes) {
    throw new Error(
      `${label}: el archivo no puede superar ${formatMaxSizeLabel(maxBytes)}.`,
    );
  }
};

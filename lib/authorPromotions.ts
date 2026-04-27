const AUTHOR_PROMOTIONS_TABLE = "author_promotions";
const AUTHOR_PROMOTIONS_MIGRATION =
  "supabase/migrations/20260427000018_author_promotions.sql";

export const isAuthorPromotionsSchemaMissingError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const normalized = message.toLowerCase();

  return (
    normalized.includes("schema cache") &&
    normalized.includes(AUTHOR_PROMOTIONS_TABLE)
  );
};

export const normalizeAuthorPromotionsError = (
  error: unknown,
  fallback: string,
) => {
  if (isAuthorPromotionsSchemaMissingError(error)) {
    return `${fallback} Falta aplicar la migración de promociones de autores en Supabase: ${AUTHOR_PROMOTIONS_MIGRATION}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
};

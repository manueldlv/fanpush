import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthorApplicationStatus = "pending" | "approved" | "rejected";

export type AuthorApplicationRecord = {
  fullName: string;
  birthDate: string;
  documentType: string;
  documentNumber: string;
  country: string;
  province: string;
  city: string;
  address: string;
  documentFrontUrl: string;
  documentBackUrl: string;
  status: AuthorApplicationStatus;
  submittedAt: string;
  archived?: boolean;
};

export type AuthorApplicationHistoryRecord = {
  applicationId: string;
  action: AuthorApplicationStatus;
  actedAt: string;
  reason?: string;
};

const PREFIX = "author_application:";
const HISTORY_PREFIX = "author_application_history:";

export const serializeAuthorApplication = (record: AuthorApplicationRecord) =>
  `${PREFIX}${JSON.stringify(record)}`;

export const parseAuthorApplication = (
  message?: string | null,
): AuthorApplicationRecord | null => {
  if (!message?.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(message.slice(PREFIX.length)) as AuthorApplicationRecord;
    if (
      !parsed.fullName ||
      !parsed.birthDate ||
      !parsed.documentType ||
      !parsed.documentNumber ||
      !parsed.documentFrontUrl ||
      !parsed.documentBackUrl ||
      !parsed.submittedAt
    ) {
      return null;
    }
    return {
      ...parsed,
      status: parsed.status ?? "pending",
      archived: parsed.archived ?? false,
    };
  } catch {
    return null;
  }
};

export const serializeAuthorApplicationHistory = (
  record: AuthorApplicationHistoryRecord,
) => `${HISTORY_PREFIX}${JSON.stringify(record)}`;

export const parseAuthorApplicationHistory = (
  message?: string | null,
): AuthorApplicationHistoryRecord | null => {
  if (!message?.startsWith(HISTORY_PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      message.slice(HISTORY_PREFIX.length),
    ) as AuthorApplicationHistoryRecord;
    if (!parsed.applicationId || !parsed.action || !parsed.actedAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const getAuthorApplicationForUser = async (
  supabase: SupabaseClient,
  userId: string,
) => {
  const { data } = await supabase
    .from("notifications")
    .select("id,message,created_at")
    .eq("user_id", userId)
    .eq("type", "author_application")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data
    ? {
        id: data.id,
        createdAt: data.created_at,
        record: parseAuthorApplication(data.message),
      }
    : null;
};

export const isApprovedAuthor = async (
  supabase: SupabaseClient,
  userId: string,
) => {
  const application = await getAuthorApplicationForUser(supabase, userId);
  return application?.record?.status === "approved";
};

export type ContentReport = {
  albumId: string;
  reason: string;
  reportedAt: string;
  status?: "open" | "reviewed" | "dismissed" | "removed";
  archived?: boolean;
};

const PREFIX = "content_report:";
const ACTION_PREFIX = "moderation_action:";

export const serializeContentReport = (report: ContentReport) =>
  `${PREFIX}${JSON.stringify(report)}`;

export const parseContentReport = (message?: string | null): ContentReport | null => {
  if (!message?.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(message.slice(PREFIX.length)) as ContentReport;
    if (!parsed.albumId || !parsed.reason || !parsed.reportedAt) return null;
    return {
      ...parsed,
      status: parsed.status ?? "open",
      archived: parsed.archived ?? false,
    };
  } catch {
    return null;
  }
};

export type ModerationActionRecord = {
  reportId: string;
  albumId: string;
  action: "reviewed" | "dismissed" | "removed";
  reason?: string;
  actedAt: string;
};

export const serializeModerationAction = (record: ModerationActionRecord) =>
  `${ACTION_PREFIX}${JSON.stringify(record)}`;

export const parseModerationAction = (
  message?: string | null,
): ModerationActionRecord | null => {
  if (!message?.startsWith(ACTION_PREFIX)) return null;
  try {
    const parsed = JSON.parse(message.slice(ACTION_PREFIX.length)) as ModerationActionRecord;
    if (!parsed.reportId || !parsed.albumId || !parsed.action || !parsed.actedAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

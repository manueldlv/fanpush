export type ModerationArchivedPost = {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: string | null;
  is_locked: boolean | null;
  likes_count: number | null;
  caption: string | null;
  created_at?: string | null;
};

export type ModerationArchiveRecord = {
  album: {
    id: string;
    user_id: string;
    description: string | null;
    price: number | null;
    created_at?: string | null;
  };
  posts: ModerationArchivedPost[];
  archivedAt: string;
};

const PREFIX = "moderation_archive:";

export const serializeModerationArchive = (record: ModerationArchiveRecord) =>
  `${PREFIX}${JSON.stringify(record)}`;

export const parseModerationArchive = (
  message?: string | null,
): ModerationArchiveRecord | null => {
  if (!message?.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(message.slice(PREFIX.length)) as ModerationArchiveRecord;
    if (!parsed.album?.id || !parsed.album?.user_id || !Array.isArray(parsed.posts)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

import type { Post } from "@/lib/store/posts";

export const FAVORITES_UPDATED_EVENT = "favorites-updated";

export type FavoritePostRecord = {
  post: Post;
  savedAt: string;
};

const STORAGE_PREFIX = "fanpush:favorites:";

const getStorageKey = (viewerId?: string | null) =>
  `${STORAGE_PREFIX}${viewerId?.trim() || "guest"}`;

const dispatchFavoritesUpdated = (viewerId?: string | null) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(FAVORITES_UPDATED_EVENT, {
      detail: { viewerId: viewerId?.trim() || "guest" },
    }),
  );
};

export const loadFavoritePosts = (
  viewerId?: string | null,
): FavoritePostRecord[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getStorageKey(viewerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoritePostRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        Boolean(item) &&
        typeof item?.savedAt === "string" &&
        Boolean(item?.post?.id),
    );
  } catch {
    return [];
  }
};

export const saveFavoritePosts = (
  viewerId: string | null | undefined,
  items: FavoritePostRecord[],
) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(viewerId), JSON.stringify(items));
  dispatchFavoritesUpdated(viewerId);
};

export const isFavoritePost = (
  viewerId: string | null | undefined,
  postId: string,
) => loadFavoritePosts(viewerId).some((item) => item.post.id === postId);

export const toggleFavoritePost = (
  viewerId: string | null | undefined,
  post: Post,
) => {
  const current = loadFavoritePosts(viewerId);
  const exists = current.some((item) => item.post.id === post.id);
  const next = exists
    ? current.filter((item) => item.post.id !== post.id)
    : [{ post, savedAt: new Date().toISOString() }, ...current];

  saveFavoritePosts(viewerId, next);

  return {
    favorite: !exists,
    items: next,
  };
};

export const removeFavoritePost = (
  viewerId: string | null | undefined,
  postId: string,
) => {
  const next = loadFavoritePosts(viewerId).filter(
    (item) => item.post.id !== postId,
  );
  saveFavoritePosts(viewerId, next);
  return next;
};

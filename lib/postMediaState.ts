export type ResolvedAccessMedia = {
  url: string;
  kind: "image" | "video";
  locked: boolean;
};

export type PostMediaState = {
  url: string;
  kind: "image" | "video";
  locked: boolean;
  previewUrl: string;
  previewKind: "image" | "video";
  resolvedUrl: string | null;
  resolvedKind: "image" | "video" | null;
  hasAccess: boolean;
  accessResolved: boolean;
};

export const buildInitialPostMediaState = ({
  previewUrl,
  previewKind,
  locked,
}: {
  previewUrl: string;
  previewKind: "image" | "video";
  locked: boolean;
}): PostMediaState => ({
  url: previewUrl,
  kind: previewKind,
  locked,
  previewUrl,
  previewKind,
  resolvedUrl: locked ? null : previewUrl,
  resolvedKind: locked ? null : previewKind,
  hasAccess: !locked,
  accessResolved: !locked,
});

export const applyResolvedMediaAccess = (
  item: PostMediaState,
  resolved: ResolvedAccessMedia | null | undefined,
): PostMediaState => {
  if (!resolved) return item;

  if (resolved.locked) {
    return {
      ...item,
      url: resolved.url || item.previewUrl,
      kind: resolved.kind,
      locked: true,
      previewUrl: resolved.url || item.previewUrl,
      previewKind: resolved.kind,
      resolvedUrl: null,
      resolvedKind: null,
      hasAccess: false,
      accessResolved: true,
    };
  }

  return {
    ...item,
    url: resolved.url,
    kind: resolved.kind,
    locked: false,
    resolvedUrl: resolved.url,
    resolvedKind: resolved.kind,
    hasAccess: true,
    accessResolved: true,
  };
};

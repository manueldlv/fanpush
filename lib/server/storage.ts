import type { SupabaseClient } from "@supabase/supabase-js";

export const createSignedUrlMap = async ({
  admin,
  bucket,
  paths,
  expiresIn,
}: {
  admin: SupabaseClient;
  bucket: string;
  paths: Array<string | null | undefined>;
  expiresIn: number;
}) => {
  const uniquePaths = Array.from(
    new Set(paths.filter((path): path is string => Boolean(path))),
  );
  const signedUrlMap = new Map<string, string>();
  if (uniquePaths.length === 0) return signedUrlMap;

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrls(uniquePaths, expiresIn);

  if (error) return signedUrlMap;

  (data ?? []).forEach((item, index) => {
    const path = typeof item.path === "string" ? item.path : uniquePaths[index];
    if (path && item.signedUrl) signedUrlMap.set(path, item.signedUrl);
  });

  return signedUrlMap;
};

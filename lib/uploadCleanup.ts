import type { SupabaseClient } from "@supabase/supabase-js";

export type UploadedStorageObject = {
  bucket: string;
  path: string;
};

export const cleanupUploadedStorageObjects = async (
  admin: SupabaseClient,
  objects: UploadedStorageObject[],
) => {
  const grouped = new Map<string, string[]>();

  objects.forEach((item) => {
    const current = grouped.get(item.bucket) ?? [];
    current.push(item.path);
    grouped.set(item.bucket, current);
  });

  await Promise.all(
    Array.from(grouped.entries()).map(async ([bucket, paths]) => {
      if (paths.length === 0) return;
      await admin.storage.from(bucket).remove(paths);
    }),
  );
};

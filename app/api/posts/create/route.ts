import { NextResponse } from "next/server";
import { requireApprovedAuthor } from "@/lib/server/auth/authorization";
import { getAdminSupabase } from "@/lib/server/auth/session";
import {
  buildLockedPreviewPath,
  buildPremiumMediaPath,
  buildPublicMediaPath,
  getExtensionFromFile,
  PREMIUM_MEDIA_BUCKET,
  PUBLIC_MEDIA_BUCKET,
} from "@/lib/media";

type ItemMeta = {
  id: string;
  kind: "image" | "video";
  isPreview: boolean;
  fileName: string;
};

const MIN_PRICE_ARS = 1000;

const ensureMediaBuckets = async () => {
  const admin = getAdminSupabase();
  if (!admin) return;
  const { data: buckets } = await admin.storage.listBuckets();
  const bucketNames = new Set((buckets ?? []).map((bucket) => bucket.name));

  if (!bucketNames.has(PUBLIC_MEDIA_BUCKET)) {
    await admin.storage.createBucket(PUBLIC_MEDIA_BUCKET, {
      public: true,
    });
  }

  if (!bucketNames.has(PREMIUM_MEDIA_BUCKET)) {
    const { error } = await admin.storage.createBucket(PREMIUM_MEDIA_BUCKET, {
      public: false,
    });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`No se pudo preparar el bucket privado: ${error.message}`);
    }
  }
};

const uploadWithBucketRetry = async ({
  admin,
  bucket,
  path,
  file,
  contentType,
}: {
  admin: NonNullable<ReturnType<typeof getAdminSupabase>>;
  bucket: string;
  path: string;
  file: File;
  contentType: string;
}) => {
  let result = await admin.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType,
  });

  if (result.error && /bucket not found/i.test(result.error.message)) {
    await ensureMediaBuckets();
    result = await admin.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType,
    });
  }

  return result;
};

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await requireApprovedAuthor(request);
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Necesitas aprobación como autor para publicar." ? 403 : 401 },
      );
    }

    await ensureMediaBuckets();

    const formData = await request.formData();
    const description = String(formData.get("description") ?? "").trim();
    const monetization = String(formData.get("monetization") ?? "free");
    const rawPrice = Number(formData.get("price") ?? 0);
    const normalizedPrice =
      monetization === "paid" ? Math.max(rawPrice || 0, MIN_PRICE_ARS) : 0;
    const itemsMetaValue = formData.get("itemsMeta");

    if (typeof itemsMetaValue !== "string") {
      return NextResponse.json(
        { error: "No se pudo leer el contenido a publicar." },
        { status: 400 },
      );
    }

    const itemsMeta = JSON.parse(itemsMetaValue) as ItemMeta[];
    if (!Array.isArray(itemsMeta) || itemsMeta.length === 0) {
      return NextResponse.json(
        { error: "Agrega al menos un archivo antes de publicar." },
        { status: 400 },
      );
    }

    const caption =
      description ||
      (monetization === "paid"
        ? "Nueva publicacion en venta."
        : "Nueva publicacion.");

    const { data: album, error: albumError } = await admin
      .from("albums")
      .insert({
        user_id: user.id,
        description: caption,
        price: normalizedPrice,
      })
      .select("id")
      .single();

    if (albumError || !album?.id) {
      throw new Error(albumError?.message ?? "No se pudo crear la publicación.");
    }

    const uploads = await Promise.all(
      itemsMeta.map(async (item, index) => {
        const originalFile = formData.get(`original_${index}`);
        if (!(originalFile instanceof File)) {
          throw new Error(`Falta el archivo original #${index + 1}.`);
        }

        const token = `${Date.now()}-${index}-${crypto.randomUUID()}`;
        const ext = getExtensionFromFile(originalFile);

        if (monetization === "paid" && !item.isPreview) {
          const previewFile = formData.get(`preview_${index}`);
          if (!(previewFile instanceof File)) {
            throw new Error(
              `No se pudo generar la vista previa del archivo ${item.fileName}.`,
            );
          }

          const previewPath = buildLockedPreviewPath(user.id, token, item.kind, ext);
          const premiumPath = buildPremiumMediaPath(user.id, token, ext);

          const [{ error: previewError }, { error: premiumError }] =
            await Promise.all([
              uploadWithBucketRetry({
                admin,
                bucket: PUBLIC_MEDIA_BUCKET,
                path: previewPath,
                file: previewFile,
                contentType: previewFile.type || "image/jpeg",
              }),
              uploadWithBucketRetry({
                admin,
                bucket: PREMIUM_MEDIA_BUCKET,
                path: premiumPath,
                file: originalFile,
                contentType:
                  originalFile.type ||
                  (item.kind === "video" ? "video/mp4" : "image/jpeg"),
              }),
            ]);

          if (previewError) {
            throw new Error(
              `No se pudo subir la vista previa de ${item.fileName}: ${previewError.message}`,
            );
          }
          if (premiumError) {
            throw new Error(
              `No se pudo subir el archivo protegido de ${item.fileName}: ${premiumError.message}`,
            );
          }

          return {
            user_id: user.id,
            media_url: previewPath,
            media_type: item.kind,
            is_locked: true,
            likes_count: 0,
            caption,
          };
        }

        const publicPath = buildPublicMediaPath(user.id, token, item.fileName);
        const { error: publicError } = await uploadWithBucketRetry({
          admin,
          bucket: PUBLIC_MEDIA_BUCKET,
          path: publicPath,
          file: originalFile,
          contentType:
            originalFile.type ||
            (item.kind === "video" ? "video/mp4" : "image/jpeg"),
        });

        if (publicError) {
          throw new Error(
            `No se pudo subir ${item.fileName}: ${publicError.message}`,
          );
        }

        return {
          user_id: user.id,
          media_url: publicPath,
          media_type: item.kind,
          is_locked: false,
          likes_count: 0,
          caption,
        };
      }),
    );

    const { data: postRows, error: insertError } = await admin
      .from("posts")
      .insert(uploads)
      .select("id");

    if (insertError) {
      throw new Error(insertError.message);
    }

    const albumPosts = (postRows ?? []).map((row) => ({
      album_id: album.id,
      post_id: row.id,
    }));

    if (albumPosts.length > 0) {
      const { error: linkError } = await admin
        .from("album_posts")
        .insert(albumPosts);
      if (linkError) throw new Error(linkError.message);
    }

    return NextResponse.json({ ok: true, albumId: album.id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo publicar el contenido.",
      },
      { status: 500 },
    );
  }
}

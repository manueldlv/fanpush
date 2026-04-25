import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { normalizeDirectChatRouteError } from "@/lib/server/direct-chat-schema";
import {
  getDirectThread,
  sendDirectMediaMessage,
  sendDirectTextMessage,
} from "@/lib/server/repositories/direct-chats";
import {
  buildDirectLockedPreviewPath,
  buildDirectPremiumMediaPath,
  buildDirectPublicMediaPath,
  getExtensionFromFile,
  PREMIUM_MEDIA_BUCKET,
  PUBLIC_MEDIA_BUCKET,
} from "@/lib/media";
import { MAX_CONTENT_PRICE_ARS, MIN_CONTENT_PRICE_ARS } from "@/lib/pricing";
import { cleanupUploadedStorageObjects, type UploadedStorageObject } from "@/lib/uploadCleanup";

const ensureMediaBuckets = async (
  admin: SupabaseClient,
) => {
  const { data: buckets } = await admin.storage.listBuckets();
  const bucketNames = new Set((buckets ?? []).map((bucket) => bucket.name));

  if (!bucketNames.has(PUBLIC_MEDIA_BUCKET)) {
    await admin.storage.createBucket(PUBLIC_MEDIA_BUCKET, { public: true });
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
  admin: SupabaseClient;
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
    await ensureMediaBuckets(admin);
    result = await admin.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType,
    });
  }

  return result;
};

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const uploadedObjects: UploadedStorageObject[] = [];
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const formData = await request.formData();
    const kind = String(formData.get("kind") ?? "text");

    if (kind === "text") {
      const body = String(formData.get("body") ?? "");
      await sendDirectTextMessage({
        admin,
        viewerUserId: user.id,
        threadId: params.id,
        body,
      });
    } else if (kind === "attachment" || kind === "premium") {
      const attachmentsMeta = await Promise.all(
        Array.from(formData.keys())
          .filter((key) => key.startsWith("original_"))
          .sort()
          .map(async (key, index) => {
            const originalFile = formData.get(key);
            if (!(originalFile instanceof File)) return null;

            const previewFileValue = formData.get(`preview_${index}`);
            const previewFile =
              previewFileValue instanceof File ? previewFileValue : originalFile;
            const originalKind = originalFile.type.startsWith("video/") ? "video" : "image";
            const token = `${Date.now()}-${index}-${crypto.randomUUID()}`;
            const ext = getExtensionFromFile(originalFile);

            if (kind === "premium") {
              const previewPath = buildDirectLockedPreviewPath(
                user.id,
                token,
                originalKind,
                ext,
              );
              const premiumPath = buildDirectPremiumMediaPath(user.id, token, ext);
              const [{ error: previewError }, { error: premiumError }] = await Promise.all([
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
                    (originalKind === "video" ? "video/mp4" : "image/jpeg"),
                }),
              ]);

              if (previewError) {
                throw new Error(`No se pudo subir la vista previa: ${previewError.message}`);
              }
              if (premiumError) {
                throw new Error(`No se pudo subir el contenido pago: ${premiumError.message}`);
              }

              uploadedObjects.push(
                { bucket: PUBLIC_MEDIA_BUCKET, path: previewPath },
                { bucket: PREMIUM_MEDIA_BUCKET, path: premiumPath },
              );

              return {
                id: `${token}-${index}`,
                name: originalFile.name || `archivo-${index + 1}`,
                kind: originalKind === "video" ? "video" : "foto",
                previewMode:
                  String(formData.get(`preview_mode_${index}`) ?? "preview") === "locked"
                    ? "locked"
                    : "preview",
                previewPath,
                premiumPath,
              };
            }

            const publicPath = buildDirectPublicMediaPath(user.id, token, originalFile.name);
            const { error: publicError } = await uploadWithBucketRetry({
              admin,
              bucket: PUBLIC_MEDIA_BUCKET,
              path: publicPath,
              file: originalFile,
              contentType:
                originalFile.type ||
                (originalKind === "video" ? "video/mp4" : "image/jpeg"),
            });

            if (publicError) {
              throw new Error(`No se pudo subir el adjunto: ${publicError.message}`);
            }

            uploadedObjects.push({ bucket: PUBLIC_MEDIA_BUCKET, path: publicPath });

            return {
              id: `${token}-${index}`,
              name: originalFile.name || `archivo-${index + 1}`,
              kind: originalKind === "video" ? "video" : "foto",
              publicPath,
            };
          }),
      );

      const normalizedAttachments = attachmentsMeta.filter(Boolean) as Array<{
        id: string;
        name: string;
        kind: "foto" | "video";
        previewPath?: string;
        premiumPath?: string;
        publicPath?: string;
      }>;

      try {
        await sendDirectMediaMessage({
          admin,
          viewerUserId: user.id,
          threadId: params.id,
          kind,
          title: String(formData.get("title") ?? "Contenido privado"),
          price: Math.min(
            Math.max(Number(formData.get("price") ?? 0), MIN_CONTENT_PRICE_ARS),
            MAX_CONTENT_PRICE_ARS,
          ),
          attachments: normalizedAttachments,
        });
      } catch (sendError) {
        if (uploadedObjects.length > 0) {
          await cleanupUploadedStorageObjects(admin, uploadedObjects);
        }
        throw sendError;
      }
    } else {
      return NextResponse.json({ error: "Tipo de mensaje inválido." }, { status: 400 });
    }

    const thread = await getDirectThread({
      admin,
      viewerUserId: user.id,
      threadId: params.id,
      markAsRead: true,
    });

    return NextResponse.json({ ok: true, thread });
  } catch (requestError) {
    return NextResponse.json(
      {
        error: normalizeDirectChatRouteError(
          requestError,
          "No se pudo enviar el mensaje.",
        ),
      },
      { status: 400 },
    );
  }
}

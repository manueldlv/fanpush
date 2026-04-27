"use client";

export const createLockedImagePreviewFile = async (file: File, id: string) => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ratio = bitmap.width / bitmap.height || 1;
  const width = Math.min(900, bitmap.width);
  const height = Math.max(1, Math.round(width / ratio));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la vista previa.");
  context.filter = "blur(10px)";
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.72),
  );
  if (!blob) {
    throw new Error(`No se pudo generar la vista previa de ${file.name}.`);
  }
  return new File([blob], `${id}-locked-preview.jpg`, { type: "image/jpeg" });
};

export const createLockedVideoPreviewFile = async ({
  file,
  sourceUrl,
  id,
}: {
  file: File;
  sourceUrl: string;
  id: string;
}) => {
  const video = document.createElement("video");
  video.src = sourceUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("No se pudo generar la miniatura del video."));
  });

  const captureTime =
    Number.isFinite(video.duration) && video.duration > 0.5 ? 0.3 : 0;

  await new Promise<void>((resolve, reject) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done, { once: true });
    try {
      video.currentTime = captureTime;
    } catch {
      resolve();
    }
    window.setTimeout(resolve, 250);
    video.onerror = () =>
      reject(new Error("No se pudo capturar la miniatura del video."));
  });

  const width = Math.min(video.videoWidth || 1280, 960);
  const height =
    Math.max(
      1,
      Math.round(width / ((video.videoWidth || 1280) / (video.videoHeight || 720))),
    ) || 720;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la miniatura del video.");
  context.filter = "blur(8px)";
  context.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.72),
  );
  if (!blob) {
    throw new Error(`No se pudo generar la vista previa de ${file.name}.`);
  }
  return new File([blob], `${id}-locked-preview.jpg`, { type: "image/jpeg" });
};

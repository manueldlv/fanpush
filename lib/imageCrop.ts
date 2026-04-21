export type CropAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () =>
      reject(new Error("No se pudo cargar la imagen para recortarla.")),
    );
    image.setAttribute("crossOrigin", "anonymous");
    image.src = src;
  });

const loadVideo = (src: string) =>
  new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("loadeddata", () => resolve(video), { once: true });
    video.addEventListener(
      "error",
      () => reject(new Error("No se pudo cargar el video para editarlo.")),
      { once: true },
    );
    video.src = src;
  });

const waitForVideoSeek = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve, reject) => {
    const onSeeked = () => resolve();
    const onError = () =>
      reject(new Error("No se pudo posicionar el video para crear la miniatura."));
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    try {
      video.currentTime = Math.max(0, time);
    } catch {
      resolve();
    }
  });

const getSafeOutputSize = (
  crop: CropAreaPixels,
  outputWidth?: number,
  outputHeight?: number,
) => ({
  width: Math.max(1, Math.round(outputWidth ?? crop.width)),
  height: Math.max(1, Math.round(outputHeight ?? crop.height)),
});

const createBaseCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const drawSourceToCanvas = ({
  sourceWidth,
  sourceHeight,
  rotation,
  draw,
}: {
  sourceWidth: number;
  sourceHeight: number;
  rotation: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}) => {
  const radians = toRadians(rotation);
  const normalizedRightAngle =
    Math.abs(rotation) % 180 === 90 || Math.abs(rotation) % 180 === 270;
  const canvasWidth = normalizedRightAngle ? sourceHeight : sourceWidth;
  const canvasHeight = normalizedRightAngle ? sourceWidth : sourceHeight;
  const canvas = createBaseCanvas(canvasWidth, canvasHeight);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo inicializar el editor de imagen.");
  }

  context.save();
  context.translate(canvasWidth / 2, canvasHeight / 2);
  context.rotate(radians);
  draw(context);
  context.restore();

  return canvas;
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar el archivo editado."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });

export const createCroppedImageBlob = async ({
  imageSrc,
  crop,
  rotation = 0,
  mimeType = "image/jpeg",
  quality = 0.92,
  outputWidth,
  outputHeight,
}: {
  imageSrc: string;
  crop: CropAreaPixels;
  rotation?: number;
  mimeType?: string;
  quality?: number;
  outputWidth?: number;
  outputHeight?: number;
}) => {
  const image = await loadImage(imageSrc);
  const rotatedCanvas = drawSourceToCanvas({
    sourceWidth: image.width,
    sourceHeight: image.height,
    rotation,
    draw: (context) =>
      context.drawImage(image, -image.width / 2, -image.height / 2),
  });
  const targetSize = getSafeOutputSize(crop, outputWidth, outputHeight);
  const canvas = createBaseCanvas(targetSize.width, targetSize.height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo inicializar el editor de imagen.");
  }

  context.drawImage(
    rotatedCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    targetSize.width,
    targetSize.height,
  );

  return canvasToBlob(canvas, mimeType, quality);
};

export const createVideoPreviewBlob = async ({
  videoSrc,
  crop,
  rotation = 0,
  frameTime = 0.1,
  mimeType = "image/jpeg",
  quality = 0.9,
  outputWidth,
  outputHeight,
}: {
  videoSrc: string;
  crop: CropAreaPixels;
  rotation?: number;
  frameTime?: number;
  mimeType?: string;
  quality?: number;
  outputWidth?: number;
  outputHeight?: number;
}) => {
  const video = await loadVideo(videoSrc);
  await waitForVideoSeek(video, frameTime);

  const rotatedCanvas = drawSourceToCanvas({
    sourceWidth: video.videoWidth || 1280,
    sourceHeight: video.videoHeight || 720,
    rotation,
    draw: (context) =>
      context.drawImage(
        video,
        -(video.videoWidth || 1280) / 2,
        -(video.videoHeight || 720) / 2,
      ),
  });

  const targetSize = getSafeOutputSize(crop, outputWidth, outputHeight);
  const canvas = createBaseCanvas(targetSize.width, targetSize.height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo preparar la miniatura del video.");
  }

  context.drawImage(
    rotatedCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    targetSize.width,
    targetSize.height,
  );

  return canvasToBlob(canvas, mimeType, quality);
};

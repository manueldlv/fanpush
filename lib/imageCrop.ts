export type CropAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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

export const createCroppedImageBlob = async ({
  imageSrc,
  crop,
  mimeType = "image/jpeg",
  quality = 0.92,
  outputWidth = 640,
  outputHeight = 640,
}: {
  imageSrc: string;
  crop: CropAreaPixels;
  mimeType?: string;
  quality?: number;
  outputWidth?: number;
  outputHeight?: number;
}) => {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo inicializar el editor de imagen.");
  }

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar la imagen recortada."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
};

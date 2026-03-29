"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Minus, Plus, X } from "lucide-react";
import { createCroppedImageBlob } from "@/lib/imageCrop";

type AvatarCropModalProps = {
  imageSrc: string;
  fileName: string;
  mimeType: string;
  open: boolean;
  title?: string;
  description?: string;
  aspect?: number;
  cropShape?: "round" | "rect";
  previewShape?: "round" | "rect";
  previewLabel?: string;
  confirmLabel?: string;
  outputWidth?: number;
  outputHeight?: number;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void> | void;
};

const buildCroppedFileName = (fileName: string, mimeType: string) => {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "avatar";
  const extension = mimeType === "image/png" ? "png" : "jpg";
  return `${baseName}-cropped.${extension}`;
};

export default function AvatarCropModal({
  imageSrc,
  fileName,
  mimeType,
  open,
  title = "Ajustar foto de perfil",
  description = "Arrastra la imagen y usa el zoom para centrar tu avatar.",
  aspect = 1,
  cropShape = "round",
  previewShape = "round",
  previewLabel = "Vista previa",
  confirmLabel = "Usar esta foto",
  outputWidth = 640,
  outputHeight = 640,
  onCancel,
  onConfirm,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);

  const handleCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setProcessingError(null);
  }, [imageSrc, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4 py-6">
      <button
        type="button"
        onClick={onCancel}
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label="Cerrar editor de avatar"
      />
      <div className="relative z-10 w-full max-w-[920px] overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <div className="text-xl font-semibold text-zinc-950">{title}</div>
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[10px] p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="relative h-[420px] bg-zinc-950 md:h-[520px]">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          </div>

          <div className="border-t border-zinc-200 bg-zinc-50 p-5 md:border-l md:border-t-0">
            <div className="rounded-[18px] border border-zinc-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {previewLabel}
              </div>
              <div className="mt-4 flex justify-center">
                <div
                  className={`relative overflow-hidden border border-zinc-200 bg-zinc-100 ${
                    previewShape === "round"
                      ? "h-36 w-36 rounded-full"
                      : "w-full max-w-[210px] rounded-[18px]"
                  }`}
                  style={
                    previewShape === "round"
                      ? undefined
                      : {
                          aspectRatio: `${aspect}`,
                        }
                  }
                >
                  <img
                    src={imageSrc}
                    alt="Vista previa del avatar"
                    className="h-full w-full object-cover"
                    style={{
                      transform: `translate(${crop.x / 5}px, ${crop.y / 5}px) scale(${zoom})`,
                      transformOrigin: "center",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[18px] border border-zinc-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Zoom
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setZoom((current) => Math.max(1, current - 0.1))}
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100"
                  aria-label="Alejar"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="w-full accent-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => setZoom((current) => Math.min(3, current + 0.1))}
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100"
                  aria-label="Acercar"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {processingError ? (
              <div className="mt-5 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {processingError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (!croppedAreaPixels || processing) return;
                  setProcessing(true);
                  setProcessingError(null);
                  try {
                    const normalizedMimeType =
                      mimeType === "image/png" ? "image/png" : "image/jpeg";
                    const blob = await createCroppedImageBlob({
                      imageSrc,
                      crop: croppedAreaPixels,
                      mimeType: normalizedMimeType,
                      outputWidth,
                      outputHeight,
                    });
                    const nextFile = new File(
                      [blob],
                      buildCroppedFileName(fileName, normalizedMimeType),
                      { type: normalizedMimeType },
                    );
                    await onConfirm(nextFile);
                  } catch (error) {
                    setProcessingError(
                      error instanceof Error
                        ? error.message
                        : "No se pudo preparar la imagen.",
                    );
                  } finally {
                    setProcessing(false);
                  }
                }}
                disabled={processing || !croppedAreaPixels}
                className="rounded-[12px] bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {processing ? "Procesando..." : confirmLabel}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-[12px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

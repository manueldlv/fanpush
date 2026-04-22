"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Eye,
  Image as ImageIcon,
  Lock,
  ShieldCheck,
  Upload,
} from "lucide-react";
import SidebarLeft from "@/components/SidebarLeft";
import { getAuthorApplicationForUser } from "@/lib/authorApplications";
import {
  CONTENT_AUDIENCE_OPTIONS,
  MODERATION_CATEGORY_OPTIONS,
  normalizeModerationTags,
  type ContentAudience,
  type ModerationCategory,
} from "@/lib/contentClassification";
import { getExtensionFromFile } from "@/lib/media";
import { useAppDispatch } from "@/lib/redux/hooks";
import { feedApi } from "@/lib/redux/api/feedApi";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { formatARS } from "@/lib/utils";

type UploadItem = {
  id: string;
  file: File;
  url: string;
  kind: "image" | "video";
};

type Monetization = "free" | "paid";

const MIN_PRICE_ARS = 1000;

function CrearPageSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <div className="fanpush-skeleton h-9 w-56 rounded-full" />
        <div className="mt-3 fanpush-skeleton h-4 w-[420px] max-w-full rounded-full" />
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-white p-10 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[16px] bg-zinc-100">
          <div className="fanpush-skeleton h-6 w-6 rounded-full" />
        </div>
        <div className="mt-6 flex flex-col items-center">
          <div className="fanpush-skeleton h-6 w-64 rounded-full" />
          <div className="mt-3 fanpush-skeleton h-4 w-48 rounded-full" />
          <div className="mt-6 fanpush-skeleton h-10 w-40 rounded-[14px]" />
        </div>
      </div>
    </div>
  );
}

export default function CrearPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [monetization, setMonetization] = useState<Monetization>("free");
  const [price, setPrice] = useState(String(MIN_PRICE_ARS));
  const [tipsEnabled, setTipsEnabled] = useState(false);
  const [description, setDescription] = useState("");
  const [contentAudience, setContentAudience] =
    useState<ContentAudience>("adult_18");
  const [moderationCategory, setModerationCategory] =
    useState<ModerationCategory>("desnudo");
  const [moderationTags, setModerationTags] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorStatus, setAuthorStatus] = useState<
    "loading" | "idle" | "pending" | "approved" | "rejected"
  >("loading");

  const getErrorMessage = (value: unknown) => {
    if (value instanceof Error) return value.message;
    if (
      typeof value === "object" &&
      value !== null &&
      "message" in value &&
      typeof value.message === "string"
    ) {
      return value.message;
    }
    return "Ocurrió un error.";
  };

  // Note: we keep object URLs so published posts can render in the feed/modal.

  const IMAGE_MAX_DIM = 2000;
  const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
  const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
  const VIDEO_MAX_DURATION = 10 * 60;
  const VIDEO_MAX_DIM = 1920;

  const getImageSize = (file: File) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo leer la imagen."));
      };
      img.src = url;
    });

  const getVideoMeta = (file: File) =>
    new Promise<{ duration: number; width: number; height: number }>(
      (resolve, reject) => {
        const video = document.createElement("video");
        const url = URL.createObjectURL(file);
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          const duration = Number.isFinite(video.duration) ? video.duration : 0;
          const width = video.videoWidth || 0;
          const height = video.videoHeight || 0;
          URL.revokeObjectURL(url);
          resolve({ duration, width, height });
        };
        video.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("No se pudo leer el video."));
        };
        video.src = url;
      },
    );

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const entries = Array.from(files);
    const results = await Promise.all(
      entries.map(async (file) => {
        const kind = file.type.startsWith("video") ? "video" : "image";
        if (kind === "image") {
          if (file.size > IMAGE_MAX_BYTES) {
            return {
              ok: false,
              reason: `${file.name}: supera ${Math.round(
                IMAGE_MAX_BYTES / 1024 / 1024,
              )}MB.`,
            };
          }
          try {
            const { width, height } = await getImageSize(file);
            if (Math.max(width, height) > IMAGE_MAX_DIM) {
              return {
                ok: false,
                reason: `${file.name}: max ${IMAGE_MAX_DIM}px lado mayor.`,
              };
            }
          } catch (err) {
            return {
              ok: false,
              reason:
                err instanceof Error
                  ? `${file.name}: ${err.message}`
                  : `${file.name}: archivo invalido.`,
            };
          }
        }

        if (kind === "video") {
          if (file.size > VIDEO_MAX_BYTES) {
            return {
              ok: false,
              reason: `${file.name}: supera ${Math.round(
                VIDEO_MAX_BYTES / 1024 / 1024,
              )}MB.`,
            };
          }
          try {
            const { duration, width, height } = await getVideoMeta(file);
            if (duration > VIDEO_MAX_DURATION) {
              return {
                ok: false,
                reason: `${file.name}: max 10 minutos.`,
              };
            }
            if (Math.max(width, height) > VIDEO_MAX_DIM) {
              return {
                ok: false,
                reason: `${file.name}: max ${VIDEO_MAX_DIM}px lado mayor.`,
              };
            }
          } catch (err) {
            return {
              ok: false,
              reason:
                err instanceof Error
                  ? `${file.name}: ${err.message}`
                  : `${file.name}: archivo invalido.`,
            };
          }
        }

        return {
          ok: true,
          item: {
            id: `${file.name}-${file.size}-${file.lastModified}`,
            file,
            url: URL.createObjectURL(file),
            kind,
          } as UploadItem,
        };
      }),
    );

    const accepted = results
      .filter((result) => result.ok)
      .map((result) => result.item) as UploadItem[];
    const rejected = results
      .filter((result) => !result.ok)
      .map((result) => (result as { reason: string }).reason);

    if (rejected.length > 0) {
      setError(rejected.join(" "));
    }

    if (accepted.length > 0) {
      setItems((prev) => [...prev, ...accepted]);
      setPreviewIds((prev) => [...prev, ...accepted.map((item) => item.id)]);
    }
  };

  const togglePreview = (id: string) => {
    setPreviewIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  };

  const makeAllPreview = () => {
    setPreviewIds(items.map((item) => item.id));
  };

  const lockAll = () => {
    setPreviewIds([]);
  };

  const previewCount = previewIds.length;
  const lockedCount = Math.max(items.length - previewCount, 0);
  const normalizedPrice = Math.max(Number(price) || 0, MIN_PRICE_ARS);

  const payout = useMemo(() => {
    const value = normalizedPrice;
    const creator = value * 0.7;
    const platform = value * 0.3;
    return {
      value: value.toFixed(2),
      creator: creator.toFixed(2),
      platform: platform.toFixed(2),
    };
  }, [normalizedPrice]);

  const createImagePreviewFile = async (item: UploadItem) => {
    const bitmap = await createImageBitmap(item.file);
    const canvas = document.createElement("canvas");
    const ratio = bitmap.width / bitmap.height || 1;
    const width = Math.min(900, bitmap.width);
    const height = Math.round(width / ratio);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la vista previa.");
    ctx.filter = "blur(10px)";
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.72),
    );
    if (!blob) {
      throw new Error(`No se pudo generar la vista previa de ${item.file.name}.`);
    }
    return new File([blob], `${item.id}-preview.jpg`, { type: "image/jpeg" });
  };

  const createVideoPreviewFile = async (item: UploadItem) => {
    const video = document.createElement("video");
    video.src = item.url;
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
      Math.round(width / ((video.videoWidth || 1280) / (video.videoHeight || 720))) ||
      720;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la miniatura del video.");
    ctx.filter = "blur(8px)";
    ctx.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.72),
    );
    if (!blob) {
      throw new Error(`No se pudo generar la vista previa de ${item.file.name}.`);
    }
    return new File([blob], `${item.id}-preview.jpg`, { type: "image/jpeg" });
  };

  const handlePublish = async () => {
    if (items.length === 0 || publishing) return;
    setError(null);
    setPublishing(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Falta configurar SUPABASE_URL o SUPABASE_ANON_KEY.");
      setPublishing(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData?.user?.id;
      if (!userId) {
        setError("Necesitas iniciar sesion para publicar.");
        setPublishing(false);
        return;
      }

      const formData = new FormData();
      formData.append("description", description.trim());
      formData.append("monetization", monetization);
      formData.append("price", String(normalizedPrice));
      formData.append("tipsEnabled", String(tipsEnabled));
      formData.append("contentAudience", contentAudience);
      formData.append("moderationCategory", moderationCategory);
      formData.append(
        "moderationTags",
        JSON.stringify(normalizeModerationTags(moderationTags)),
      );

      const itemsMeta = await Promise.all(
        items.map(async (item, index) => {
          formData.append(`original_${index}`, item.file);
          const isPreview =
            monetization === "free" ? true : previewIds.includes(item.id);

          if (monetization === "paid" && !isPreview) {
            const previewFile =
              item.kind === "video"
                ? await createVideoPreviewFile(item)
                : await createImagePreviewFile(item);
            formData.append(`preview_${index}`, previewFile);
          }

          return {
            id: item.id,
            kind: item.kind,
            isPreview,
            fileName:
              item.file.name || `${item.kind}-${index}.${getExtensionFromFile(item.file)}`,
          };
        }),
      );

      formData.append("itemsMeta", JSON.stringify(itemsMeta));

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error("Necesitas iniciar sesion para publicar.");
      }

      const response = await fetch("/api/posts/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo publicar el contenido.");
      }

      dispatch(feedApi.util.invalidateTags(["Feed"]));
      router.push("/");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    const loadAuthorStatus = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setAuthorStatus("idle");
        return;
      }
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) {
        setAuthorStatus("idle");
        return;
      }
      const application = await getAuthorApplicationForUser(supabase, userId);
      setAuthorStatus(application?.record?.status ?? "idle");
    };

    loadAuthorStatus();
    const interval = window.setInterval(loadAuthorStatus, 15000);
    const refresh = () => loadAuthorStatus();
    window.addEventListener("creator-status-updated", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("creator-status-updated", refresh);
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SidebarLeft />

      <div className="flex min-h-screen md:pl-60">
        <div className="mx-auto flex w-full max-w-none flex-col gap-6 px-4 py-6 pb-24 md:max-w-[720px] md:gap-8 md:px-6 md:py-10">
          {authorStatus === "loading" ? <CrearPageSkeleton /> : null}

          {authorStatus !== "approved" ? (
            authorStatus !== "loading" ? (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-semibold">Crear contenido</h1>
                <p className="mt-2 text-sm text-zinc-500">
                  Para vender contenido en FanPush primero necesitas aprobación
                  como autor.
                </p>
              </div>

              <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="rounded-[20px] border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-700">
                  {authorStatus === "pending"
                    ? "Tu solicitud está en revisión. Cuando el equipo la apruebe se habilitará Crear automáticamente."
                    : authorStatus === "rejected"
                      ? "Tu solicitud fue rechazada. Revisa tus datos y vuelve a enviarla."
                      : "Todavía no tienes acceso para crear publicaciones. Completa la verificación de identidad para convertirte en autor."}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => router.push("/autor/solicitud")}
                    className="rounded-[18px] bg-zinc-950 px-5 py-3 text-sm font-semibold text-white"
                  >
                    {authorStatus === "pending"
                      ? "Ver mi solicitud"
                      : authorStatus === "rejected"
                        ? "Reenviar solicitud"
                        : "Convertirme en autor"}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="rounded-[18px] border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700"
                  >
                    Volver al feed
                  </button>
                </div>
              </div>
            </div>
            ) : null
          ) : null}

          {authorStatus === "approved" ? (
          <>
          {step === 1 ? (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-semibold">Subir contenido</h1>
                <p className="mt-2 text-sm text-zinc-500">
                  Agrega una o varias imagenes o videos a tu publicacion. Luego
                  podras elegir cuales seran vista previa y cuales se bloquearan.
                </p>
              </div>

              <div className="rounded-[5px] border-2 border-dashed border-zinc-200 bg-white p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[5px] bg-zinc-100">
                  <Upload className="h-6 w-6 text-zinc-500" />
                </div>
                <div className="mt-4 text-lg font-semibold text-zinc-800">
                  Arrastra imagenes aqui para subirlas
                </div>
                <div className="text-sm text-zinc-500">
                  O haz clic en el boton de abajo
                </div>
                <div className="mt-3 text-xs text-zinc-500">
                  Imagenes: max {IMAGE_MAX_DIM}px lado mayor, hasta{" "}
                  {Math.round(IMAGE_MAX_BYTES / 1024 / 1024)}MB. Videos: max 10
                  min, hasta {Math.round(VIDEO_MAX_BYTES / 1024 / 1024)}MB,
                  {` ${VIDEO_MAX_DIM}px`} lado mayor.
                </div>
                <label className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-[5px] border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-700">
                  Seleccionar archivos
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(event) => handleFiles(event.target.files)}
                  />
                </label>
              </div>
              {error ? (
                <div className="rounded-[5px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </div>
              ) : null}

              <div>
                <div className="text-sm font-semibold">Descripcion del post</div>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Escribe una descripcion para tu publicacion..."
                  maxLength={500}
                  className="mt-3 min-h-[120px] w-full rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                />
                <div className="mt-2 text-xs text-zinc-500">
                  {description.trim().length}/500 caracteres
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Tipo de contenido</span>
                  <select
                    value={contentAudience}
                    onChange={(event) =>
                      setContentAudience(event.target.value as ContentAudience)
                    }
                    className="h-11 rounded-[18px] border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none"
                  >
                    {CONTENT_AUDIENCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Categoría para moderación</span>
                  <select
                    value={moderationCategory}
                    onChange={(event) =>
                      setModerationCategory(
                        event.target.value as ModerationCategory,
                      )
                    }
                    className="h-11 rounded-[18px] border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none"
                  >
                    {MODERATION_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <div className="text-sm font-semibold">Etiquetas opcionales</div>
                <input
                  value={moderationTags}
                  onChange={(event) => setModerationTags(event.target.value)}
                  placeholder="Ej: cosplay, exterior, selfie"
                  className="mt-3 h-11 w-full rounded-[18px] border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                />
                <div className="mt-2 text-xs text-zinc-500">
                  Sepáralas con coma. Esto ayuda a moderar más rápido el contenido.
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold">
                  Archivos seleccionados ({items.length})
                </div>
                {items.length === 0 ? (
                  <div className="mt-3 text-sm text-zinc-500">
                    Todavia no seleccionaste archivos.
                  </div>
                ) : (
                  <div className="mt-4 flex gap-4">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        className="relative h-24 w-24 overflow-hidden rounded-[5px] border border-zinc-200 bg-zinc-100"
                      >
                        {item.kind === "image" ? (
                          <img
                            src={item.url}
                            alt={item.file.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <video
                            src={item.url}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                          />
                        )}
                        <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-[5px] bg-zinc-900 text-xs font-semibold text-white">
                          {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-xs text-zinc-500">
                  Arrastra para reordenar (proximamente).
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-6">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={items.length === 0}
                  className="fanpush-button-primary w-full rounded-[5px] px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Siguiente
                </button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-semibold">
                  Elegi la monetizacion
                </h1>
                <p className="mt-2 text-sm text-zinc-500">
                  Decide como queres compartir esta publicacion con tu audiencia.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setMonetization("free");
                    setPreviewIds(items.map((item) => item.id));
                  }}
                  className={`rounded-[5px] border p-5 text-left ${
                    monetization === "free"
                      ? "border-zinc-900"
                      : "border-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        monetization === "free"
                          ? "border-zinc-900 bg-zinc-900"
                          : "border-zinc-300"
                      }`}
                    >
                      {monetization === "free" ? (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      ) : null}
                    </span>
                    <ImageIcon className="h-4 w-4" />
                    Siempre visible
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">
                    Comparte tu publicacion gratis. Siempre sera visible para
                    todos.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMonetization("paid")}
                  className={`rounded-[5px] border p-5 text-left ${
                    monetization === "paid"
                      ? "border-zinc-900"
                      : "border-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        monetization === "paid"
                          ? "border-zinc-900 bg-zinc-900"
                          : "border-zinc-300"
                      }`}
                    >
                      {monetization === "paid" ? (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      ) : null}
                    </span>
                    <Lock className="h-4 w-4" />
                    En venta (bloqueado)
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">
                    Bloquea tu contenido con un precio. Solo quien compre podra
                    verlo.
                  </p>
                </button>
              </div>

              <div className="rounded-[5px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                {monetization === "free"
                  ? "Tu publicacion gratis aparecera completa en el feed para todos los usuarios."
                  : "Tu publicacion bloqueada requerira compra para ver el contenido completo."}
              </div>

              <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-[720px]">
                    <div className="text-2xl font-semibold text-zinc-900">
                      Propina para publicacion
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">
                      Actívala si quieres que en el popup del post aparezca el
                      botón <span className="font-medium text-zinc-700">Enviar propina</span>.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={tipsEnabled}
                    onClick={() => setTipsEnabled((prev) => !prev)}
                    className={`relative inline-flex h-11 w-20 shrink-0 items-center rounded-full border transition ${
                      tipsEnabled
                        ? "border-zinc-900 bg-zinc-900"
                        : "border-zinc-200 bg-zinc-100"
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1 h-9 w-9 rounded-full bg-white shadow-sm transition ${
                        tipsEnabled ? "translate-x-9" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-4 rounded-[5px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                  <div className="flex items-center gap-2 font-medium text-zinc-700">
                    <img
                      src="/tip-lightning.png"
                      alt=""
                      aria-hidden="true"
                      className="h-4 w-4 object-contain"
                    />
                    {tipsEnabled ? "Propina activada" : "Propina desactivada"}
                  </div>
                  <p className="mt-1">
                    {tipsEnabled
                      ? "La publicación permitirá recibir propinas sin configurar precio adicional."
                      : "Si queda apagada, el popup del post no mostrará ninguna opción de propina."}
                  </p>
                </div>
              </div>

              {monetization === "paid" ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-semibold">Define tu precio</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Recibes el 70% del precio de compra. El 30% cubre tarifas
                      de la plataforma.
                    </p>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-zinc-700">
                      Precio (ARS)
                    </div>
                    <div className="mt-2 flex items-center gap-2 rounded-[5px] border border-zinc-300 bg-white px-3 py-2 text-lg font-semibold text-zinc-900">
                      <span className="text-zinc-500">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        min={MIN_PRICE_ARS}
                        step={1}
                        className="w-full bg-transparent outline-none"
                      />
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      Minimo ARS {MIN_PRICE_ARS.toLocaleString("es-AR")} · Compra unica
                    </div>
                  </div>

                  <div className="rounded-[5px] border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
                    <div className="flex items-center justify-between">
                      <span>Precio de venta</span>
                      <span className="font-semibold">{formatARS(Number(payout.value))}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span>Tu recibes (70%)</span>
                      <span className="font-semibold">{formatARS(Number(payout.creator))}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span>Tarifa plataforma (30%)</span>
                      <span className="font-semibold">{formatARS(Number(payout.platform))}</span>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500">
                    Precio sugerido: ARS 2.000 - ARS 15.000. La mayoría cobra entre
                    ARS 4.000 y ARS 9.000.
                  </div>
                </div>
              ) : null}

              <div className="border-t border-zinc-200 pt-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-[5px] border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                  >
                    <ArrowLeft className="mr-1 inline h-4 w-4" />
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (monetization === "paid" && items.length > 0) {
                        if (previewCount === items.length) {
                          setPreviewIds(items.slice(0, -1).map((item) => item.id));
                        }
                      }
                      setStep(3);
                    }}
                    className="fanpush-button-primary flex-1 px-6 py-3"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-semibold">
                  Vista previa vs contenido bloqueado
                </h1>
                <p className="mt-2 text-sm text-zinc-500">
                  Elige que imagenes se mostraran como vista previa. El resto se
                  bloqueara hasta que alguien compre tu publicacion.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={makeAllPreview}
                  disabled={monetization === "free"}
                  className="rounded-[5px] border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                >
                  Hacer todo vista previa
                </button>
                <button
                  type="button"
                  onClick={lockAll}
                  disabled={monetization === "free"}
                  className="rounded-[5px] border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                >
                  Bloquear todo
                </button>
              </div>

              <div className="text-sm font-semibold">
                Vista previa: {previewCount} · Bloqueado: {lockedCount}
              </div>

              <div className="flex gap-4">
                {items.map((item) => {
                  const isPreview = previewIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (monetization === "free") return;
                        togglePreview(item.id);
                      }}
                      className={`relative h-28 w-28 overflow-hidden rounded-[5px] border ${
                        isPreview ? "border-zinc-900" : "border-zinc-200"
                      }`}
                    >
                      {item.kind === "image" ? (
                        <img
                          src={item.url}
                          alt={item.file.name}
                          className={`h-full w-full object-cover ${
                            isPreview ? "" : "blur-[6px]"
                          }`}
                        />
                      ) : (
                        <video
                          src={item.url}
                          className={`h-full w-full object-cover ${
                            isPreview ? "" : "blur-[6px]"
                          }`}
                          muted
                          playsInline
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                        {isPreview ? "Vista previa" : "Bloqueado"}
                      </div>
                      {isPreview ? (
                        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-[5px] bg-white text-zinc-900">
                          <Check className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-[5px] bg-white text-zinc-900">
                          <Lock className="h-4 w-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-[5px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                Cuando alguien compre tu publicacion, tendra acceso a todo el
                contenido, incluyendo el bloqueado.
              </div>

              <div className="border-t border-zinc-200 pt-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-[5px] border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                  >
                    <ArrowLeft className="mr-1 inline h-4 w-4" />
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="fanpush-button-primary flex-1 px-6 py-3"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-semibold">Revisar y publicar</h1>
                <p className="mt-2 text-sm text-zinc-500">
                  Verifica los detalles antes de publicar. Una vez publicado,
                  aparecera en tu perfil y en el feed.
                </p>
              </div>

              <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
                <div className="text-sm font-semibold text-zinc-900">
                  Vista previa del post
                </div>
                <div className="mt-3 rounded-[16px] bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                  {description.trim() || "Sin descripcion."}
                </div>
                <div className="mt-4 flex gap-4">
                  {items.slice(0, 2).map((item) => {
                    const isPreview = previewIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className="relative h-28 w-28 overflow-hidden rounded-[5px] border border-zinc-200"
                      >
                        {item.kind === "image" ? (
                          <img
                            src={item.url}
                            alt={item.file.name}
                            className={`h-full w-full object-cover ${
                              isPreview ? "" : "blur-[6px]"
                            }`}
                          />
                        ) : (
                          <video
                            src={item.url}
                            className={`h-full w-full object-cover ${
                              isPreview ? "" : "blur-[6px]"
                            }`}
                            muted
                            playsInline
                          />
                        )}
                        {!isPreview ? (
                          <div className="absolute inset-0 flex items-center justify-center text-white">
                            <Lock className="h-5 w-5" />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 border-t border-zinc-200 pt-4 text-sm text-zinc-600">
                  <div className="flex items-center justify-between">
                    <span>Total de archivos</span>
                    <span className="font-semibold">{items.length}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Vista previa
                    </span>
                    <span className="font-semibold">{previewCount}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Bloqueados
                    </span>
                    <span className="font-semibold">{lockedCount}</span>
                  </div>
                </div>
              </div>

              {monetization === "paid" ? (
                <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
                  <div className="text-sm font-semibold text-zinc-900">Precio</div>
                  <div className="mt-3 flex items-center gap-2 rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-900">
                    <span className="text-zinc-500">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      min={MIN_PRICE_ARS}
                      step={1}
                      className="w-full bg-transparent outline-none"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-zinc-600">
                    <span>Precio de venta</span>
                    <span className="text-xl font-semibold">
                      {formatARS(Number(payout.value))}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Compra unica · Sin reembolsos
                  </div>
                  <div className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-500">
                    Luego del procesamiento, recibirás {formatARS(Number(payout.creator))}.
                  </div>
                </div>
              ) : null}

              <div className="rounded-[5px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4" />
                  <span>
                    {monetization === "paid"
                      ? "Tu publicacion aparecera como bloqueada en el feed. Tus seguidores podran ver la vista previa y comprar para desbloquear el contenido completo."
                      : "Tu publicacion se vera completa en el feed y en tu perfil al publicarse."}
                  </span>
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-[5px] border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                  >
                    <ArrowLeft className="mr-1 inline h-4 w-4" />
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={handlePublish}
                    className="fanpush-button-primary flex-1 rounded-[5px] px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={publishing}
                  >
                    {publishing
                      ? "Publicando..."
                      : monetization === "free"
                        ? "Publicar de una"
                        : "Publicar"}
                  </button>
                </div>
                {error ? (
                  <div className="mt-4 rounded-[5px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

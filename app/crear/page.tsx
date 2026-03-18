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
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";
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

export default function CrearPage() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [monetization, setMonetization] = useState<Monetization>("free");
  const [price, setPrice] = useState("9.99");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const payout = useMemo(() => {
    const value = Number(price) || 0;
    const creator = value * 0.7;
    const platform = value * 0.3;
    return {
      value: value.toFixed(2),
      creator: creator.toFixed(2),
      platform: platform.toFixed(2),
    };
  }, [price]);

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

      const caption =
        monetization === "paid"
          ? "Nueva publicacion en venta."
          : "Nueva publicacion.";

      const { data: albumRows, error: albumError } = await supabase
        .from("albums")
        .insert({
          user_id: userId,
          description: caption,
          price: Number(price) || 0,
        })
        .select("id")
        .single();
      if (albumError) throw albumError;

      const uploads = await Promise.all(
        items.map(async (item) => {
          const path = `posts/${userId}/${Date.now()}-${item.file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("Imagenes")
            .upload(path, item.file);
          if (uploadError) throw uploadError;
          return {
            user_id: userId,
            media_url: path,
            media_type: item.kind,
            is_locked:
              monetization === "paid" ? !previewIds.includes(item.id) : false,
            likes_count: 0,
            caption,
          };
        }),
      );

      const { data: postRows, error: insertError } = await supabase
        .from("posts")
        .insert(uploads)
        .select("id");
      if (insertError) throw insertError;

      const albumPosts = (postRows ?? []).map((row) => ({
        album_id: albumRows.id,
        post_id: row.id,
      }));
      if (albumPosts.length > 0) {
        const { error: linkError } = await supabase
          .from("album_posts")
          .insert(albumPosts);
        if (linkError) throw linkError;
      }

      router.push("/");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      <SidebarLeft
        searchOpen={searchOpen}
        onSearchClick={() => {
          setNotificationsOpen(false);
          setSearchOpen(true);
        }}
        notificationsOpen={notificationsOpen}
        onNotificationsClick={() => {
          setSearchOpen(false);
          setNotificationsOpen(true);
        }}
      />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-none flex-col gap-6 px-4 py-6 md:max-w-[720px] md:gap-8 md:px-6 md:py-10">
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
                  className="w-full rounded-[5px] bg-zinc-900 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
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
                        className="w-full bg-transparent outline-none"
                      />
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      Compra unica · Sin suscripciones
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
                    className="flex-1 rounded-[5px] bg-zinc-900 px-6 py-3 text-sm font-semibold text-white"
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
                    className="flex-1 rounded-[5px] bg-zinc-900 px-6 py-3 text-sm font-semibold text-white"
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
                      className="w-full bg-transparent outline-none"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-zinc-600">
                    <span>Precio de venta</span>
                    <span className="text-xl font-semibold">${payout.value}</span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Compra unica · Sin reembolsos
                  </div>
                  <div className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-500">
                    Luego del procesamiento, recibiras ${payout.creator}.
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
                    className="flex-1 rounded-[5px] bg-zinc-900 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
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
        </div>
      </div>
    </div>
  );
}

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
import { usePostsStore } from "@/lib/store";
import { useRouter } from "next/navigation";

type UploadItem = {
  id: string;
  file: File;
  url: string;
  kind: "image" | "video";
};

type Monetization = "free" | "paid";

export default function CrearPage() {
  const router = useRouter();
  const addPost = usePostsStore((state) => state.addPost);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [monetization, setMonetization] = useState<Monetization>("free");
  const [price, setPrice] = useState("9.99");

  // Note: we keep object URLs so published posts can render in the feed/modal.

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming: UploadItem[] = Array.from(files).map((file) => {
      const kind = file.type.startsWith("video") ? "video" : "image";
      return {
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        url: URL.createObjectURL(file),
        kind,
      };
    });
    setItems((prev) => [...prev, ...incoming]);
    setPreviewIds((prev) => [...prev, ...incoming.map((item) => item.id)]);
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

  const buildMediaPayload = () => {
    return items.map((item) => ({
      url: item.url,
      kind: item.kind,
      locked: monetization === "paid" ? !previewIds.includes(item.id) : false,
    }));
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

      <div className="flex h-full pl-60">
        <div className="mx-auto flex h-full w-full max-w-[720px] flex-col gap-8 px-6 py-10">
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
                  className="rounded-[5px] border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                >
                  Hacer todo vista previa
                </button>
                <button
                  type="button"
                  onClick={lockAll}
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
                      onClick={() => togglePreview(item.id)}
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
                    onClick={() => setStep(1)}
                    className="rounded-[5px] border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                  >
                    <ArrowLeft className="mr-1 inline h-4 w-4" />
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (previewCount === 0) {
                        setMonetization("paid");
                        setStep(4);
                        return;
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
                  Elegi la monetizacion
                </h1>
                <p className="mt-2 text-sm text-zinc-500">
                  Decide como queres compartir esta publicacion con tu audiencia.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMonetization("free")}
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
                      Precio (USD)
                    </div>
                    <div className="mt-2 flex items-center gap-2 rounded-[5px] border border-zinc-300 bg-white px-3 py-2 text-lg font-semibold text-zinc-900">
                      <span className="text-zinc-500">$</span>
                      <input
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
                      <span className="font-semibold">${payout.value}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span>Tu recibes (70%)</span>
                      <span className="font-semibold">${payout.creator}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span>Tarifa plataforma (30%)</span>
                      <span className="font-semibold">${payout.platform}</span>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500">
                    Precio sugerido: $4.99 - $24.99. La mayoria cobra entre
                    $7.99 y $14.99.
                  </div>
                </div>
              ) : null}

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
                    onClick={() => {
                      if (monetization === "paid" && items.length > 0) {
                        if (previewCount === items.length) {
                          setPreviewIds(items.slice(0, -1).map((item) => item.id));
                        }
                      }
                      setStep(4);
                    }}
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
                    onClick={() => setStep(2)}
                    className="rounded-[5px] border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                  >
                    <ArrowLeft className="mr-1 inline h-4 w-4" />
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (items.length === 0) return;
                      addPost({
                        id: `post-${Date.now()}`,
                        author: "bebudlv",
                        verified: false,
                        time: "Ahora",
                        suggestion: "Sugerencia para ti",
                        caption:
                          monetization === "paid"
                            ? "Nueva publicacion en venta."
                            : "Nueva publicacion.",
                        likes: 0,
                        avatar: "https://picsum.photos/seed/bebudlv/64/64",
                        price: Number(price) || 0,
                        media: buildMediaPayload(),
                      });
                      router.push("/");
                    }}
                    className="flex-1 rounded-[5px] bg-zinc-900 px-6 py-3 text-sm font-semibold text-white"
                  >
                    {monetization === "free" ? "Publicar de una" : "Publicar"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

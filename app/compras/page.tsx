"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Image as ImageIcon, Lock, X } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import MediaImage from "@/components/MediaImage";
import SidebarLeft from "@/components/SidebarLeft";
import { useGetPurchasesQuery } from "@/lib/redux/api/commerceApi";
import { formatARS } from "@/lib/utils";

type PurchaseItem = {
  id: string;
  title: string;
  creator: string;
  date: string;
  price: number;
  cover: string;
  covers: string[];
  media: { url: string; kind: "image" | "video" }[];
  status: string;
};

export default function ComprasPage() {
  const [openPurchase, setOpenPurchase] = useState<PurchaseItem | null>(null);
  const [openIndex, setOpenIndex] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { data, isLoading: loading } = useGetPurchasesQuery();
  const items = data?.items ?? [];

  const handleDownload = async (purchase: PurchaseItem) => {
    if (downloadingId) return;
    setDownloadingId(purchase.id);
    try {
      const zip = new JSZip();
      const files = purchase.media.length > 0 ? purchase.media : purchase.covers.map((url) => ({ url, kind: "image" as const }));
      await Promise.all(
        files.map(async (item, index) => {
          const response = await fetch(item.url);
          const blob = await response.blob();
          const ext = item.kind === "video" ? "mp4" : "jpg";
          zip.file(
            `fanpush-${purchase.id}-${index + 1}.${ext}`,
            blob,
          );
        }),
      );
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `fanpush-${purchase.id}.zip`);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      <SidebarLeft />
      {openPurchase ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6">
          <div
            className="absolute inset-0 h-full w-full"
            onClick={() => setOpenPurchase(null)}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => setOpenPurchase(null)}
            className="absolute right-6 top-6 rounded-[5px] bg-white/90 p-2"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative z-10 flex w-full max-w-[900px] overflow-hidden rounded-[5px] bg-black">
            <div className="relative h-[520px] w-full bg-black">
              {openPurchase.media[openIndex]?.kind === "video" ? (
                <video
                  src={openPurchase.media[openIndex]?.url}
                  className="h-full w-full object-contain"
                  controls
                  playsInline
                />
              ) : (
                <MediaImage
                  src={openPurchase.media[openIndex]?.url}
                  alt={openPurchase.title}
                  className="h-full w-full object-contain"
                  fallbackClassName="h-full w-full bg-zinc-950 text-zinc-500"
                  iconClassName="h-8 w-8"
                />
              )}
              {openPurchase.media.length > 1 ? (
                <>
                  <div className="absolute inset-y-0 left-0 z-20 flex items-center pl-3">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenIndex((prev) =>
                          (prev - 1 + openPurchase.media.length) %
                          openPurchase.media.length,
                        )
                      }
                      className="rounded-[5px] bg-white/80 px-2 py-1 text-xs font-semibold text-zinc-700"
                    >
                      ‹
                    </button>
                  </div>
                  <div className="absolute inset-y-0 right-0 z-20 flex items-center pr-3">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenIndex((prev) =>
                          (prev + 1) % openPurchase.media.length,
                        )
                      }
                      className="rounded-[5px] bg-white/80 px-2 py-1 text-xs font-semibold text-zinc-700"
                    >
                      ›
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-none flex-col gap-6 px-4 py-6 md:max-w-[1100px] md:gap-8 md:px-6 md:py-8">
          <div>
            <h1 className="text-2xl font-semibold">Mis compras</h1>
            <p className="text-sm text-zinc-500">
              Contenido adquirido y packs desbloqueados.
            </p>
          </div>

          {!loading && items.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-[12px] border border-zinc-200 bg-white p-5">
                <div className="text-xs text-zinc-500">Publicaciones compradas</div>
                <div className="mt-2 text-2xl font-semibold text-zinc-900">
                  {items.length}
                </div>
              </div>
              <div className="rounded-[12px] border border-zinc-200 bg-white p-5">
                <div className="text-xs text-zinc-500">Invertido en contenido</div>
                <div className="mt-2 text-2xl font-semibold text-zinc-900">
                  {formatARS(items.reduce((acc, item) => acc + item.price, 0))}
                </div>
              </div>
              <div className="rounded-[12px] border border-zinc-200 bg-white p-5">
                <div className="text-xs text-zinc-500">Última compra</div>
                <div className="mt-2 text-lg font-semibold text-zinc-900">
                  {items[0]?.date ?? "—"}
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-4">
            {loading ? (
              <div className="rounded-[5px] border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                Cargando compras...
              </div>
            ) : null}
            {!loading && items.length === 0 ? (
              <div className="rounded-[16px] border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
                <div className="text-lg font-semibold text-zinc-900">
                  Aún no tienes compras
                </div>
                <p className="mt-2 max-w-[560px] leading-6">
                  Cuando compres contenido bloqueado o envíes propinas, lo verás
                  reflejado aquí con acceso rápido para volver a abrirlo o descargarlo.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="/explorar"
                    className="rounded-[12px] bg-zinc-950 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Explorar contenido
                  </a>
                  <a
                    href="/ayuda"
                    className="rounded-[12px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700"
                  >
                    Cómo funciona
                  </a>
                </div>
              </div>
            ) : null}
            {items.map((purchase) => (
              <div
                key={purchase.id}
                className="flex flex-col gap-4 rounded-[5px] border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="relative h-20 w-20 overflow-hidden rounded-[5px] border border-zinc-200 bg-zinc-100">
                      <MediaImage
                        src={purchase.cover}
                        alt={purchase.title}
                        className="h-full w-full object-cover"
                        fallbackClassName="h-full w-full"
                        iconClassName="h-5 w-5"
                      />
                      {purchase.status === "Pendiente" ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                          <Lock className="h-5 w-5" />
                        </div>
                      ) : null}
                    </div>
                    {purchase.covers.length > 1 ? (
                      <div className="flex gap-1">
                        {purchase.covers.slice(1, 3).map((cover, index) => (
                          <MediaImage
                            key={`${purchase.id}-thumb-${index}`}
                            src={cover}
                            alt={purchase.title}
                            className="h-10 w-10 rounded-[5px] object-cover"
                            fallbackClassName="h-10 w-10 rounded-[5px]"
                            iconClassName="h-4 w-4"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {purchase.title}
                    </div>
                    <div className="text-xs text-zinc-500">
                      @{purchase.creator} · {purchase.date}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-sm">
                      <span className="font-semibold text-zinc-900">
                        {formatARS(purchase.price)}
                      </span>
                      <span className="text-xs text-zinc-500">{purchase.status}</span>
                    </div>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPurchase(purchase);
                      setOpenIndex(0);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-[5px] border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Ver foto
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(purchase)}
                    className="inline-flex items-center justify-center gap-2 rounded-[5px] border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={downloadingId === purchase.id}
                  >
                    <Download className="h-4 w-4" />
                    {downloadingId === purchase.id ? "Descargando..." : "Descargar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
